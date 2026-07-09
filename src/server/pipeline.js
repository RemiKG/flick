// Flick — the showrunner. Runs the crew in order, streams each stage as it lands
// (latency visible, not hidden), runs the fidelity -> targeted single-shot
// re-render loop, and computes EVERY on-screen number live. Nothing here is a
// canned value; if it can't be computed it isn't shown.
import * as crew from './crew.js';
import * as store from './store.js';
import * as FF from './ffmpeg.js';
import { round2 } from './util.js';

// Optional demo cadence. Default 0 => stages stream as fast as they land (the
// shipped/deployed default; the offline preview is near-instant, real Qwen is
// naturally slow). Set FLICK_DEMO_PACING_MS to space the reveal so a human eye
// can follow the crew light up — it only *delays* real stages, never fakes one.
const PACE = Math.max(0, Number(process.env.FLICK_DEMO_PACING_MS) || 0);
const pace = (mult = 1) => PACE ? new Promise((r) => setTimeout(r, PACE * mult)) : Promise.resolve();

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
    await pace();
    const sheet = await crew.read_drawing({ flick }, ctx);
    flick.drawingSheet = sheet;
    flick.mode = sheet.engine === 'local' ? 'offline' : 'qwen';
    emit({ stage: 'reader', status: 'done', drawingSheet: sheet });
    await tick();

    // 2 · Writer
    emit({ stage: 'writer', status: 'running' });
    await pace();
    const story = await crew.write_story({ flick, sheet }, ctx);
    flick.story = story;
    emit({ stage: 'writer', status: 'done', title: story.title, story });
    await store.saveFlick(flick);

    // 3 · Storyboarder
    emit({ stage: 'board', status: 'running' });
    await pace();
    const { shots, engine: sbEngine } = await crew.storyboard({ flick, sheet, story }, ctx);
    flick.shots = shots.map((s) => ({ ...s, status: 'queued', fidelity: null, redraws: 0, night: sheet.night }));
    flick.storyboardEngine = sbEngine;
    emit({ stage: 'board', status: 'done', shots: flick.shots });
    await tick();

    // 4 · Set Painter
    emit({ stage: 'painter', status: 'running' });
    await pace();
    const set = await crew.paint_set({ flick, sheet }, ctx);
    flick.media = { ...(flick.media || {}), setUrl: set.setUrl };
    flick.setEngine = set.engine;
    emit({ stage: 'painter', status: 'done', setUrl: set.setUrl, engine: set.engine });
    await store.saveFlick(flick);

    // 5+6 · Camera -> Critic (per shot) with targeted re-render
    const cameraOut = [];
    for (const shot of flick.shots) {
      shot.status = 'rolling';
      emit({ stage: 'camera', shot: shot.shot_no, status: 'rolling', model: flick.mode === 'qwen' ? crew.CREW[4].model : 'local preview' });
      await pace();

      let cam = await crew.roll_camera({ flick, sheet, shot }, ctx);
      let frameFile = null;
      if (cam.videoUrl && !cam.preview) { frameFile = store.mediaPath(flick.id, `frame${shot.shot_no}.png`); await FF.extractFrame(store.mediaPath(flick.id, `shot${shot.shot_no}.mp4`), frameFile).catch(() => { frameFile = null; }); }

      let verdict = await crew.check_fidelity({ flick, sheet, shot, frameFile }, ctx);
      shot.fidelity = verdict.fidelity;
      emit({ stage: 'critic', shot: shot.shot_no, fidelity: verdict.fidelity, smoothed: verdict.smoothed });
      await tick();
      await pace();

      // the un-fakeable loop: re-draw ONLY the shot that drifts (never the episode)
      if (verdict.fidelity < threshold && flick.settings?.onDrift !== 'looser') {
        const from = verdict.fidelity;
        emit({ stage: 'redraw', shot: shot.shot_no, from, status: 'running' });
        await pace(1.6);
        shot._redrawn = true; shot.redraws = (shot.redraws || 0) + 1;
        cam = await crew.roll_camera({ flick, sheet, shot, subSeed: 100 }, ctx);
        if (cam.videoUrl && !cam.preview) { frameFile = store.mediaPath(flick.id, `frame${shot.shot_no}.png`); await FF.extractFrame(store.mediaPath(flick.id, `shot${shot.shot_no}.mp4`), frameFile).catch(() => { frameFile = null; }); }
        verdict = await crew.check_fidelity({ flick, sheet, shot, frameFile }, ctx);
        shot.fidelity = verdict.fidelity;
        emit({ stage: 'redraw', shot: shot.shot_no, from, to: verdict.fidelity, status: 'done' });
      }

      shot.engine = cam.engine; shot.preview = cam.preview; shot.status = 'done';
      shot.held = verdict.held;
      cameraOut.push({ shot: shot.shot_no, videoUrl: cam.videoUrl, preview: cam.preview, engine: cam.engine });
      emit({ stage: 'camera', shot: shot.shot_no, status: 'done', fidelity: shot.fidelity });
      await tick();
    }
    flick.camera = cameraOut;

    // 7 · Voice
    emit({ stage: 'voice', status: 'running' });
    await pace();
    const voice = await crew.voice_line({ flick, story }, ctx);
    flick.media = { ...(flick.media || {}), audioUrl: voice.audioUrl };
    flick.voiceEngine = voice.engine;
    emit({ stage: 'voice', status: 'done', engine: voice.engine, audioUrl: voice.audioUrl });
    await store.saveFlick(flick);

    // 8 · Cutter
    emit({ stage: 'cutter', status: 'running' });
    await pace();
    const cut = await crew.cut_episode({ flick, story, shots: flick.shots, camera: cameraOut, voice }, ctx);
    flick.media = { ...(flick.media || {}), videoUrl: cut.videoUrl, thumbUrl: cut.thumbUrl };
    flick.edl = cut.edl; flick.cutEngine = cut.engine;
    emit({ stage: 'cutter', status: 'done', media: flick.media, engine: cut.engine });

    // finalise
    flick.ledger = { ...flick.ledger, ...computeLedger(flick), endToEndMs: Date.now() - t0 };
    flick.status = 'ready';
    await store.saveFlick(flick);
    emit({ stage: 'ledger', ledger: flick.ledger });
    emit({ stage: 'complete', flick });
    onComplete?.(flick);
    return flick;
  } catch (err) {
    flick.status = 'error'; flick.error = err.message;
    await store.saveFlick(flick).catch(() => {});
    emit({ stage: 'error', message: err.message });
    throw err;
  } finally {
    buses.get(id)._running = false;
    // let late subscribers still read the final flick; drop the bus after a grace period
    setTimeout(() => buses.delete(id), 60000);
  }
}
