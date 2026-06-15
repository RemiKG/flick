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
  const mins = kept.reduce((a, f) => a + (f.meta?.seconds || f.settings?.seconds || 0), 0) / 60;
  const fids = kept.map((f) => f.ledger?.avgFidelity).filter((x) => typeof x === 'number');
  const stats = {
    kept: kept.length,
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
