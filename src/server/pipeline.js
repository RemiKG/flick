// Flick — the showrunner. Runs the crew in order, streams each stage as it lands
// (latency visible, not hidden), runs the fidelity -> targeted single-shot
// re-render loop, and computes EVERY on-screen number live. Nothing here is a
// canned value; if it can't be computed it isn't shown.
import * as crew from './crew.js';
import * as store from './store.js';
import * as FF from './ffmpeg.js';
import { round2 } from './util.js';

// in-memory bus so the SSE route can subscribe to a running job
const buses = new Map();
export function subscribe(id, fn) {
  if (!buses.has(id)) buses.set(id, new Set());
  buses.get(id).add(fn);
  return () => buses.get(id)?.delete(fn);
}
function publish(id, evt) {
  const set = buses.get(id);
  if (set) for (const fn of set) { try { fn(evt); } catch {} }
}

export function isRunning(id) { return buses.has(id) && buses.get(id)._running; }

function computeLedger(flick) {
  const shots = flick.shots || [];
  const done = shots.filter((s) => typeof s.fidelity === 'number');
  const avg = done.length ? round2(done.reduce((a, s) => a + s.fidelity, 0) / done.length) : null;
  const redrawnShots = shots.filter((s) => (s.redraws || 0) > 0);
  const base = shots.reduce((a, s) => a + (s.duration_s || 0), 0);
  const redrawnSeconds = redrawnShots.reduce((a, s) => a + (s.duration_s || 0), 0);
  const wanUsed = shots.filter((s) => s.engine && s.engine !== 'local').reduce((a, s) => a + (s.duration_s || 0), 0)
    + redrawnSeconds * (flick.mode === 'qwen' ? 1 : 0);
  // targeted re-render saves vs re-filming the WHOLE episode on every drift
  const pctSaved = redrawnSeconds > 0 && base > 0 ? Math.round(100 * (1 - redrawnSeconds / base)) : null;
  return {
    avgFidelity: avg,
    redrawn: redrawnShots.length,
    shotsTotal: shots.length,
    wanSecondsUsed: wanUsed,
    wanFree: flick.ledger?.wanFree ?? 50,
    pctSaved,
    endToEndMs: flick.ledger?.endToEndMs ?? null,
  };
}

export async function runFlick(flick, { onComplete } = {}) {
  const id = flick.id;
  if (!buses.has(id)) buses.set(id, new Set());
  buses.get(id)._running = true;
  const t0 = Date.now();
  const emit = (evt) => publish(id, evt);
  // degrade / status notes go to the UI (SSE) AND the server log, so a deployed
  // backend shows honestly in its console when a crew member falls back.
  const log = (m) => { console.warn(`[flick ${id}] ${m}`); emit({ stage: 'log', message: m }); };
  const ctx = { emit, log };
  const threshold = flick.settings?.threshold ?? 0.8;

  const tick = async () => { flick.ledger = { ...flick.ledger, ...computeLedger(flick) }; await store.saveFlick(flick); emit({ stage: 'ledger', ledger: flick.ledger }); };

  try {
    // 1 · Reader
    emit({ stage: 'reader', status: 'running' });
    const sheet = await crew.read_drawing({ flick }, ctx);
    flick.drawingSheet = sheet;
