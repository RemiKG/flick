// Flick — the server. One origin: the crayon-scrapbook SPA + the showrunner API +
// SSE progress + the MCP tool surface + the persistent media store. Built to run
// as a single Node process on Alibaba Cloud ECS/SAS (the eligibility gate) or
// anywhere. No hardcoded hosts; the client talks to relative paths only.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, publicConfig, engineLive } from './config.js';
import * as store from './store.js';
import { newId, hashSeed } from './util.js';
import { runFlick, subscribe, isRunning } from './pipeline.js';
import * as crew from './crew.js';
import { ensureSeed, SEED_IDS } from './seed.js';
import { mountMCP, TOOLS, callTool } from './mcp.js';
import { hasFFmpeg } from './ffmpeg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, '..', '..', 'public');

const app = express();
app.use(express.json({ limit: '20mb' })); // drawings arrive as data URLs

// ── config / health ─────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => res.json({ ok: true, engineLive: engineLive(), ffmpeg: await hasFFmpeg() }));
app.get('/api/config', async (_req, res) => res.json({ ...publicConfig(), ffmpeg: await hasFFmpeg(), crew: crew.CREW }));

// ── Toy Box ───────────────────────────────────────────────────────────────
app.get('/api/flicks', async (_req, res) => {
  const all = await store.listFlicks();
  const kept = all.filter((f) => !f.example);
  const examples = all.filter((f) => f.example);
  // stats count only REAL runs — seeded demo records never pad the numbers
  const real = kept.filter((f) => !f.example_seed);
  const mins = real.reduce((a, f) => a + (f.meta?.seconds || f.settings?.seconds || 0), 0) / 60;
  const fids = real.map((f) => f.ledger?.avgFidelity).filter((x) => typeof x === 'number');
  const stats = {
    kept: real.length,
    watchedMin: Math.round(mins * 10) / 10,
    avgFidelity: fids.length ? Math.round((fids.reduce((a, b) => a + b, 0) / fids.length) * 100) / 100 : null,
  };
  res.json({ kept, examples, stats });
});

app.get('/api/flicks/:id', async (req, res) => {
  const f = await store.getFlick(req.params.id);
  if (!f) return res.status(404).json({ error: 'not found' });
  res.json(f);
});

// create a flick from a stranger's own drawing (real path). Starts on stream-connect.
app.post('/api/flicks', async (req, res) => {
  try {
    const { image, hints = {}, settings = {}, child } = req.body || {};
    if (!image || typeof image !== 'string') return res.status(400).json({ error: 'no drawing supplied' });
    if (!/^data:image\//i.test(image) && !/^https?:\/\//i.test(image)) {
      return res.status(400).json({ error: 'that isn\'t an image — send a photo of the drawing (data URL or link)' });
    }
    const id = newId();
    const flick = {
      id, createdAt: Date.now(), status: 'draft', child: (child || 'You').slice(0, 40),
      seed: hashSeed(image.slice(0, 512) + id),
      source: { kind: 'upload', imageUrl: image, file: null, hints, title: (settings.title || '').slice(0, 60) },
      settings: {
        mood: settings.mood || 'a bedtime story',
        shots: Math.max(3, Math.min(6, settings.shots || 5)),
        seconds: Math.max(20, Math.min(60, settings.seconds || 47)),
        threshold: Math.max(0.5, Math.min(0.95, settings.threshold ?? 0.8)),
        onDrift: settings.onDrift === 'looser' ? 'looser' : 'again',
        voice: ['storybook', 'clone', 'off'].includes(settings.voice) ? settings.voice : 'storybook',
        aspect: ['16:9', '9:16', '1:1'].includes(settings.aspect) ? settings.aspect : '9:16',
      },
      render: { char: hints.char || 'photo', night: !!hints.night, seed: hashSeed(image.slice(0, 512) + id), aspect: settings.aspect || '9:16' },
      ledger: { wanFree: config.wanFreeSeconds },
      media: {},
    };
    // keep the uploaded drawing on disk so the Cutter can animate their own pixels offline
    const m = image.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (m) {
      const ext = (m[1].split('/')[1] || 'png').replace('+xml', '').replace('jpeg', 'jpg');
      const buf = Buffer.from(m[2], 'base64');
      flick.source.file = `source.${ext}`;
      await store.saveMedia(id, `source.${ext}`, buf);
    }
    await store.saveFlick(flick);
    res.json({ id, watch: `/watch/${id}`, stream: `/api/flicks/${id}/stream`, engineLive: engineLive() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SSE progress. Starts the pipeline on first connect (guarantees the client
// catches every event); replays 'complete' for already-finished flicks.
const started = new Set();
app.get('/api/flicks/:id/stream', async (req, res) => {
  const id = req.params.id;
  const flick = await store.getFlick(id);
  if (!flick) return res.status(404).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(': flick stream\n\n');
  const send = (evt) => { try { res.write(`data: ${JSON.stringify(evt)}\n\n`); } catch {} };

  if (flick.status === 'ready') { send({ stage: 'complete', flick }); return res.end(); }

  const unsub = subscribe(id, send);
  const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch {} }, 15000);
  req.on('close', () => { clearInterval(ka); unsub(); });

  if (flick.status === 'draft' && !started.has(id) && !isRunning(id)) {
    started.add(id);
    runFlick(flick).catch((e) => send({ stage: 'error', message: e.message })).finally(() => started.delete(id));
  }
});

// targeted re-render of ONE shot (the Booth's "re-draw one shot")
app.post('/api/flicks/:id/redraw', async (req, res) => {
  try {
    const flick = await store.getFlick(req.params.id);
    if (!flick) return res.status(404).json({ error: 'not found' });
    const shotNo = Number(req.body?.shot);
    const shot = (flick.shots || []).find((s) => s.shot_no === shotNo);
    if (!shot) return res.status(400).json({ error: 'no such shot' });
    shot._redrawn = true; shot.redraws = (shot.redraws || 0) + 1;
    const cam = await crew.roll_camera({ flick, sheet: flick.drawingSheet, shot, subSeed: 100 + shot.redraws }, {});
    const verdict = await crew.check_fidelity({ flick, sheet: flick.drawingSheet, shot, frameFile: null }, {});
    shot.fidelity = verdict.fidelity; shot.engine = cam.engine; shot.preview = cam.preview;
    // recompute ledger
    const fids = flick.shots.filter((s) => typeof s.fidelity === 'number').map((s) => s.fidelity);
    flick.ledger.avgFidelity = fids.length ? Math.round((fids.reduce((a, b) => a + b, 0) / fids.length) * 100) / 100 : null;
    flick.ledger.redrawn = flick.shots.filter((s) => (s.redraws || 0) > 0).length;
    await store.saveFlick(flick);
    res.json({ shot, ledger: flick.ledger });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// single crew tool over HTTP (the Skill's scripts call these; handy for curl)
app.get('/api/tools', (_req, res) => res.json({ tools: TOOLS }));
app.post('/api/tools/:name', async (req, res) => {
  try { res.json(await callTool(req.params.name, req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ── MCP surface ──────────────────────────────────────────────────────────
mountMCP(app);

// ── static: media store, then the SPA ─────────────────────────────────────
app.use('/media', express.static(store.MEDIA_DIR, { maxAge: '1h' }));
app.use(express.static(PUBLIC, { extensions: ['html'] }));

// SPA history fallback (client routes: /, /backstage, /toybox, /booth, /watch/:id, /edges)
app.get(/^\/(?!api\/|media\/|mcp\/).*/, (_req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));

// seed the Toy Box on init (both a persistent host and a serverless cold start)
await ensureSeed().catch((e) => console.error('seed error', e.message));

// Export the app so a serverless host (e.g. Vercel) can wrap it as a handler.
export default app;

// A persistent Node host (Alibaba Cloud ECS/SAS, or local) listens on a port.
if (!process.env.VERCEL) {
  const server = app.listen(config.port, async () => {
    const ff = await hasFFmpeg();
    console.log(`\n  Flick is live  →  http://localhost:${config.port}`);
    console.log(`  crew: ${engineLive() ? 'Qwen Cloud ONLINE' : 'offline (add DASHSCOPE_API_KEY to wake the crew)'}  ·  ffmpeg: ${ff ? 'yes' : 'no'}  ·  ${config.deployLabel}`);
    console.log(`  toy box seeded: ${SEED_IDS.length} examples  ·  MCP: /mcp/sse\n`);
  });
  server.on('error', (e) => { console.error('server error:', e.message); process.exit(1); });
}
