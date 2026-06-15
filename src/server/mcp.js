// Flick — the MCP surface (SSE, JSON-RPC 2.0). The same eight crew tools, mountable
// over SSE by any agent: read_drawing · write_story · storyboard · paint_set ·
// roll_camera · check_fidelity · voice_line · cut_episode — plus make_flick, the
// "text a photo of the fridge to a bot" entry. Each tool is the real Qwen call
// (or the honest offline fallback) — the identical code the web app runs.
import * as crew from './crew.js';
import * as store from './store.js';
import { runFlick } from './pipeline.js';
import { newId, hashSeed } from './util.js';
import { engineLive, config } from './config.js';

const PROTOCOL = '2024-11-05';

const TOOLS = [
  { name: 'read_drawing', description: 'The Reader (qwen3-vl): read a child\'s drawing into a Drawing Sheet (hero, palette-as-hex, wonky signatures).',
    inputSchema: { type: 'object', properties: { image: { type: 'string', description: 'image URL or data: URL' } }, required: ['image'] } },
  { name: 'write_story', description: 'The Writer (qwen3.7-max): a 5-beat read-aloud story for the character.',
    inputSchema: { type: 'object', properties: { sheet: { type: 'object' }, mood: { type: 'string' } }, required: ['sheet'] } },
  { name: 'storyboard', description: 'The Storyboarder (qwen3.7-plus): typed shot list + a Wan prompt per shot.',
    inputSchema: { type: 'object', properties: { sheet: { type: 'object' }, story: { type: 'object' }, shots: { type: 'number' } }, required: ['story'] } },
  { name: 'paint_set', description: 'The Set Painter (wan2.6-t2i): paint the world in the child\'s hand.',
    inputSchema: { type: 'object', properties: { sheet: { type: 'object' } }, required: ['sheet'] } },
  { name: 'roll_camera', description: 'The Camera (wan2.7-r2v): film one shot with the drawing as reference_image.',
    inputSchema: { type: 'object', properties: { image: { type: 'string' }, shot: { type: 'object' } }, required: ['shot'] } },
  { name: 'check_fidelity', description: 'The Critic (qwen3-vl): score a shot\'s fidelity back to the drawing (0..1).',
    inputSchema: { type: 'object', properties: { image: { type: 'string' }, shot: { type: 'object' } }, required: ['shot'] } },
  { name: 'voice_line', description: 'The Voice (cosyvoice/qwen3-tts): narrate the story in a warm storybook voice.',
    inputSchema: { type: 'object', properties: { story: { type: 'object' } }, required: ['story'] } },
  { name: 'cut_episode', description: 'The Cutter (ffmpeg): assemble the shots + narration into the episode.',
    inputSchema: { type: 'object', properties: { story: { type: 'object' }, shots: { type: 'array' } }, required: ['story'] } },
  { name: 'make_flick', description: 'Run the whole showrunner on one drawing: read -> write -> storyboard -> paint -> film -> check -> voice -> cut. Returns a watch URL.',
    inputSchema: { type: 'object', properties: { image: { type: 'string', description: 'image URL or data: URL' }, child: { type: 'string' }, mood: { type: 'string' } }, required: ['image'] } },
];

function tmpFlick(image, extra = {}) {
  const id = newId();
  return {
    id, createdAt: Date.now(), status: 'draft', seed: hashSeed(String(image).slice(0, 200) + id),
    source: { kind: 'upload', imageUrl: image, hints: {} },
    settings: { mood: extra.mood || 'a bedtime story', shots: 5, seconds: 47, threshold: 0.8, onDrift: 'again', voice: 'storybook', aspect: '9:16' },
    child: extra.child || 'You',
  };
}

async function callTool(name, args) {
  const a = args || {};
  switch (name) {
    case 'read_drawing': return crew.read_drawing({ flick: tmpFlick(a.image) });
    case 'write_story': return crew.write_story({ flick: tmpFlick('', { mood: a.mood }), sheet: a.sheet || { hero: 'the drawing', place: 'a green hill' } });
    case 'storyboard': return crew.storyboard({ flick: tmpFlick('', { mood: a.mood }), sheet: a.sheet || {}, story: a.story });
    case 'paint_set': return crew.paint_set({ flick: tmpFlick(a.image || ''), sheet: a.sheet || {} });
    case 'roll_camera': return crew.roll_camera({ flick: tmpFlick(a.image || ''), sheet: a.sheet || {}, shot: a.shot });
    case 'check_fidelity': return crew.check_fidelity({ flick: tmpFlick(a.image || ''), sheet: a.sheet || {}, shot: a.shot });
    case 'voice_line': return crew.voice_line({ flick: tmpFlick('', { }), story: a.story });
    case 'cut_episode': return crew.cut_episode({ flick: tmpFlick(''), story: a.story, shots: a.shots || [], camera: [], voice: {} });
    case 'make_flick': {
      const flick = tmpFlick(a.image, { child: a.child, mood: a.mood });
      await store.saveFlick(flick);
      runFlick(flick).catch(() => {}); // fire-and-forget; the URL streams progress
      return { id: flick.id, watch: `/watch/${flick.id}`, stream: `/api/flicks/${flick.id}/stream`, engine: engineLive() ? 'qwen' : 'offline' };
    }
    default: throw new Error(`unknown tool: ${name}`);
  }
}

// ── SSE transport (hand-rolled JSON-RPC over SSE, MCP-compatible) ────────────
const sessions = new Map();

export function mountMCP(app) {
  app.get('/mcp/sse', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
    res.write(': flick mcp\n\n');
    const sid = newId();
    sessions.set(sid, res);
    // tell the client where to POST messages (MCP SSE handshake)
    res.write(`event: endpoint\ndata: /mcp/messages?sessionId=${sid}\n\n`);
    const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch {} }, 15000);
    req.on('close', () => { clearInterval(ka); sessions.delete(sid); });
  });

  app.post('/mcp/messages', async (req, res) => {
    const sid = req.query.sessionId;
    const out = sessions.get(sid);
    const msg = req.body || {};
    res.status(202).end(); // ack; the real reply goes over SSE
    const reply = (result, error) => {
      const payload = { jsonrpc: '2.0', id: msg.id, ...(error ? { error } : { result }) };
      if (out) out.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    try {
      if (msg.method === 'initialize') {
        reply({ protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: 'flick', version: '1.0.0' } });
      } else if (msg.method === 'notifications/initialized' || msg.method === 'notifications/cancelled') {
        // no response needed for notifications
      } else if (msg.method === 'ping') {
        reply({});
      } else if (msg.method === 'tools/list') {
        reply({ tools: TOOLS });
      } else if (msg.method === 'tools/call') {
        const result = await callTool(msg.params?.name, msg.params?.arguments);
        reply({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } else {
        reply(null, { code: -32601, message: `Method not found: ${msg.method}` });
      }
    } catch (e) {
      reply(null, { code: -32000, message: e.message });
    }
  });
}

export { TOOLS, callTool };
