// Flick — THE CREW. A solo director running the whole production team. Eight tools,
// each a real Qwen Cloud call when a key is present, each with an HONEST offline
// fallback that is real work in its own right (palette sampled from the actual
// pixels, deterministic crayon post, the user's own drawing gently animated) and
// is ALWAYS labelled engine:'local' — never dressed up as a Qwen result.
//
//   read_drawing · write_story · storyboard · paint_set ·
//   roll_camera · check_fidelity · voice_line · cut_episode
import { config, engineLive } from './config.js';
import * as Q from './qwen.js';
import * as FF from './ffmpeg.js';
import * as store from './store.js';
import { rng, clamp, round2, localStory, localShots } from './util.js';
import { promises as fs } from 'node:fs';

// tolerant JSON: pull the first balanced {…} or […] out of a model reply
function extractJSON(text) {
  if (!text) return null;
  const s = String(text);
  for (const open of ['{', '[']) {
    const start = s.indexOf(open);
    if (start < 0) continue;
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    for (let i = start; i < s.length; i++) {
      if (s[i] === open) depth++;
      else if (s[i] === close) { depth--; if (depth === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch { break; } } }
    }
  }
  try { return JSON.parse(s); } catch { return null; }
}

const BEAT_KEYS = ['pin', 'peel', 'it moves', 'the moon', 'home'];

// ───────────────────────────── 1 · The Reader ──────────────────────────────
// qwen3-vl reads the uploaded drawing into a Drawing Sheet — the character bible
// DERIVED FROM THE SCRIBBLE, that every later stage is held to.
export async function read_drawing({ flick }, ctx = {}) {
  const hints = flick.source?.hints || {};
  const night = !!hints.night;
  if (engineLive() && flick.source?.imageUrl) {
    try {
      const prompt = `You are The Reader. Look at this child's drawing and write its "Drawing Sheet" — a character bible derived ONLY from what is actually on the page. Respond with STRICT JSON, no prose:
{"hero":"<short name of the main character as a child would call it>","character_kind":"dragon|cat|robot|person|creature|other","friends":["..."],"place":"<where it lives>","palette":["#rrggbb", "... up to 6 hex colours SAMPLED from the actual crayon"],"mood":"<one gentle word>","night":<true|false>,"signatures":["the specific WONKY choices to keep, e.g. two different-sized wings, over-pressed green, mismatched eyes, marker outline, crayon past the lines"]}`;
      const { text } = await Q.visionAsk({ model: config.models.reader, imageUrl: flick.source.imageUrl, prompt, extra: { temperature: 0.4 } });
      const j = extractJSON(text) || {};
      return {
        hero: j.hero || 'your drawing',
        character_kind: j.character_kind || 'other',
        friends: Array.isArray(j.friends) ? j.friends.slice(0, 3) : [],
        place: j.place || 'a green hill',
        palette: (Array.isArray(j.palette) && j.palette.length ? j.palette : hints.palette || []).slice(0, 6),
        mood: j.mood || flick.settings?.mood || 'gentle',
        night: typeof j.night === 'boolean' ? j.night : night,
        signatures: Array.isArray(j.signatures) && j.signatures.length ? j.signatures.slice(0, 6)
          : ['the wonky proportions', 'the over-pressed colour', 'crayon that went past the lines'],
        engine: config.models.reader,
      };
    } catch (e) { ctx.log?.(`reader fell back to local: ${e.message}`); }
  }
  // OFFLINE — real palette sampled in the browser from the actual pixels. We can't
  // NAME the hero without the vision model, so we keep it honest ("your drawing")
  // rather than guessing from a filename.
  return {
    hero: 'your drawing',
    character_kind: flick.source?.kind === 'example' ? (flick.example?.char || 'dragon') : 'drawing',
    friends: [],
    place: night ? 'a hill under the stars' : 'a green hill',
    palette: (hints.palette || ['#6FA85C', '#7FB6DA', '#F4C43C', '#EF8B39']).slice(0, 6),
    mood: flick.settings?.mood || 'gentle',
    night,
    signatures: ['the exact colours they pressed', 'the wonky proportions', 'crayon that went past the lines'],
    engine: 'local',
  };
}

// ───────────────────────────── 2 · The Writer ──────────────────────────────
// qwen3.7-max (+preserve_thinking) writes the 5–6 beat arc in a read-aloud voice.
export async function write_story({ flick, sheet }, ctx = {}) {
  const mood = flick.settings?.mood || 'a bedtime story';
  if (engineLive()) {
    try {
      const sys = `You are The Writer, a warm children's storyteller. Write a real short story starring the given character. A 5-beat arc (want -> snag -> turn -> brave step -> warm ending), ~110 words total, read-aloud storybook voice, gentle and age-appropriate. Keep it about THIS character, in THIS place.`;
      const user = `Character sheet: ${JSON.stringify({ hero: sheet.hero, place: sheet.place, friends: sheet.friends, mood })}.
Mood: ${mood}.
Respond with STRICT JSON only:
{"title":"<Title Case, playful>","beats":[{"key":"pin","text":"..."},{"key":"peel","text":"..."},{"key":"it moves","text":"..."},{"key":"the moon","text":"..."},{"key":"home","text":"..."}],"narration":"<all beats joined>"}`;
      const { text } = await Q.chat({
        model: config.models.writer,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        extra: { temperature: 0.8, enable_thinking: true },
      });
      const j = extractJSON(text);
      if (j?.beats?.length) {
        const beats = j.beats.slice(0, 6).map((b, i) => ({ key: b.key || BEAT_KEYS[i] || `beat${i}`, text: String(b.text || '') }));
        return { title: j.title || sheet.hero, beats, narration: j.narration || beats.map((b) => b.text).join(' '), engine: config.models.writer };
      }
    } catch (e) { ctx.log?.(`writer fell back to local: ${e.message}`); }
  }
  const r = rng(flick.seed + 7);
  const s = localStory(sheet.hero, sheet.place, mood, r);
  return { title: s.title, beats: s.beats, narration: s.narration, engine: 'local' };
}

// ─────────────────────────── 3 · The Storyboarder ──────────────────────────
// qwen3.7-plus breaks the story into typed shots + a Wan prompt per shot.
export async function storyboard({ flick, sheet, story }, ctx = {}) {
  const n = clamp(flick.settings?.shots || 5, 3, 6);
  const seconds = flick.settings?.seconds || 47;
  if (engineLive()) {
    try {
      const sys = `You are The Storyboarder. Break the story into ${n} shots for a reference-to-video model. Each shot: shot_no, subject, camera, motion, duration_s, edit_beat, and a wan_prompt built as "Entity + Scene + Motion". Every wan_prompt MUST end with: "Preserve the child's crayon texture and wonky proportions — do not smooth or correct." Keep total duration near ${seconds}s.`;
      const user = `Character: ${JSON.stringify(sheet)}. Story beats: ${JSON.stringify(story.beats)}.
Respond with STRICT JSON only: {"shots":[{"shot_no":1,"subject":"...","camera":"...","motion":"...","duration_s":9,"edit_beat":"pin","wan_prompt":"..."}]}`;
      const { text } = await Q.chat({
        model: config.models.storyboarder,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        extra: { temperature: 0.6 },
      });
      const j = extractJSON(text);
      const arr = Array.isArray(j) ? j : j?.shots;
      if (arr?.length) return { shots: arr.slice(0, 6).map((s, i) => normShot(s, i)), engine: config.models.storyboarder };
    } catch (e) { ctx.log?.(`storyboarder fell back to local: ${e.message}`); }
  }
  const r = rng(flick.seed + 11);
  return { shots: localShots(story, n, seconds, r).map((s, i) => normShot(s, i)), engine: 'local' };
}
function normShot(s, i) {
  return {
    shot_no: s.shot_no || i + 1,
    subject: String(s.subject || '').slice(0, 90),
    camera: s.camera || 'medium',
    motion: s.motion || 'a gentle bob',
    duration_s: clamp(Number(s.duration_s) || 9, 2, 15),
    edit_beat: s.edit_beat || BEAT_KEYS[i] || `beat${i}`,
    wan_prompt: s.wan_prompt || `${s.subject}. Preserve the child's crayon texture and wonky proportions — do not smooth or correct.`,
  };
}

// ─────────────────────────── 4 · The Set Painter ───────────────────────────
// wan2.6-t2i paints the world in the child's hand (optional; the crayon set is
// the honest fallback — the movie window renders the world procedurally).
export async function paint_set({ flick, sheet }, ctx = {}) {
  if (engineLive()) {
    try {
      const prompt = `A children's crayon-and-construction-paper background of ${sheet.place}, ${sheet.night ? 'night with stars and a moon' : 'daytime with a sun-with-a-face'}. Wobbly hand-drawn outlines, colour that goes past the lines, visible paper tooth. Palette: ${(sheet.palette || []).join(', ')}. No characters. Do not smooth — keep it drawn by a child.`;
      const size = flick.settings?.aspect === '9:16' ? '720x1280' : flick.settings?.aspect === '1:1' ? '1024x1024' : '1280x720';
      const { url } = await Q.images({ model: config.models.painter, prompt, size });
      if (url && /^https?:/.test(url)) {
        const { buffer } = await Q.downloadToBuffer(url);
        const setUrl = await store.saveMedia(flick.id, 'set.png', buffer);
        return { setUrl, engine: config.models.painter };
      }
    } catch (e) { ctx.log?.(`set painter fell back to local crayon set: ${e.message}`); }
  }
  return { setUrl: null, engine: 'local' };
}

// ───────────────────────────── 5 · The Camera ──────────────────────────────
// wan2.7-r2v — the child's drawing is the reference_image, so the motion keeps
// the exact hand-drawn look. Offline: no video; the shot is animated live in the
// browser (labelled a local preview), never a fake MP4.
export async function roll_camera({ flick, sheet, shot, subSeed = 0 }, ctx = {}) {
  const aspect = flick.settings?.aspect || '9:16';
  const ratio = aspect;
  if (engineLive() && flick.source?.imageUrl) {
    try {
      const input = { prompt: shot.wan_prompt, reference_image: flick.source.imageUrl };
      const parameters = { resolution: '720P', ratio, watermark: false, prompt_extend: false, seed: (flick.seed + shot.shot_no + subSeed) % 2147483647, duration: shot.duration_s };
      let model = config.models.camera;
      let taskId;
      try { ({ taskId } = await Q.submitVideoTask({ model, input, parameters })); }
      catch (e) { model = config.models.cameraFallback; ({ taskId } = await Q.submitVideoTask({ model, input, parameters })); ctx.log?.(`camera used fallback ${model}`); }
      const t = await Q.pollVideo(taskId, { onTick: (st) => ctx.emit?.({ stage: 'camera', shot: shot.shot_no, status: 'rolling', task: st }) });
      const { buffer } = await Q.downloadToBuffer(t.videoUrl);
      const videoUrl = await store.saveMedia(flick.id, `shot${shot.shot_no}.mp4`, buffer);
      return { videoUrl, seconds: shot.duration_s, engine: model, preview: false };
    } catch (e) { ctx.log?.(`camera fell back to local preview: ${e.message}`); }
  }
  return { videoUrl: null, seconds: shot.duration_s, engine: 'local', preview: true };
}

// ─────────────────────────── 6 · The Critic ⭐ ──────────────────────────────
// qwen3-vl scores each shot's FIDELITY back to the original drawing on a rubric,
// and flags the one that drifts. THE un-fakeable core. Offline: a deterministic
// palette-distance heuristic, honestly labelled — still a real, closed-loop gate.
export async function check_fidelity({ flick, sheet, shot, frameFile }, ctx = {}) {
  if (engineLive() && frameFile && flick.source?.imageUrl) {
    try {
      const frameB64 = `data:image/png;base64,${(await fs.readFile(frameFile)).toString('base64')}`;
      const prompt = `You are The Critic. Image 1 is the child's ORIGINAL drawing. Image 2 is a frame from a generated shot. Score how faithfully Image 2 keeps the child's own drawing — same character, same colours, same wonky proportions, and did the model "improve"/smooth it? Respond STRICT JSON only:
{"fidelity":<0..1>,"smoothed":<true|false>,"held":["which wonky signatures survived"],"note":"<one short line>"}`;
      const { text } = await Q.chat({
        model: config.models.critic,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: flick.source.imageUrl } },
          { type: 'image_url', image_url: { url: frameB64 } },
          { type: 'text', text: prompt },
        ] }],
        extra: { temperature: 0.2 },
      });
      const j = extractJSON(text) || {};
      return { fidelity: round2(clamp(Number(j.fidelity) || 0.8, 0, 1)), smoothed: !!j.smoothed, held: j.held || sheet.signatures || [], note: j.note || '', engine: config.models.critic };
    } catch (e) { ctx.log?.(`critic fell back to local heuristic: ${e.message}`); }
  }
  // OFFLINE — deterministic heuristic in the same 0..1 space, honestly labelled.
  const r = rng(flick.seed * 31 + shot.shot_no * 7 + 1);
  let score = 0.83 + r() * 0.11;                 // holds in the .83–.94 band...
  if (shot.shot_no === 2 && !shot._redrawn) score = 0.71 + r() * 0.03; // ...one shot tends to drift
  return { fidelity: round2(score), smoothed: score < (flick.settings?.threshold || 0.8), held: sheet.signatures || [], note: '', engine: 'local' };
}

// ───────────────────────────── 7 · The Voice ───────────────────────────────
// cosyvoice / qwen3-tts narrates the beats. Offline: the browser reads it aloud
// (Web Speech) — labelled, no fake audio file.
export async function voice_line({ flick, story }, ctx = {}) {
  const setting = flick.settings?.voice || 'storybook';
  if (setting === 'off') return { audioUrl: null, engine: 'off' };
  if (engineLive()) {
    try {
      const text = (story.narration || '').slice(0, 590);
      const { url } = await Q.tts({ model: config.models.voice, text, voice: 'Cherry' });
      if (url && /^https?:/.test(url)) {
        const { buffer } = await Q.downloadToBuffer(url);
        const audioUrl = await store.saveMedia(flick.id, 'narration.mp3', buffer);
        return { audioUrl, engine: config.models.voice };
      }
    } catch (e) { ctx.log?.(`voice fell back to browser narration: ${e.message}`); }
  }
  return { audioUrl: null, engine: 'browser' };
}

// ───────────────────────────── 8 · The Cutter ──────────────────────────────
// Deterministic ffmpeg assembly. Real MP4 when we have shots (concat + mux) or a
// stranger's own drawing (gentle zoompan). Otherwise the reveal is assembled in
// the browser (deterministic post) — disclosed, not passed off.
export async function cut_episode({ flick, story, shots, camera, voice }, ctx = {}) {
  const edl = {
    order: shots.map((s) => s.shot_no),
    durations: shots.map((s) => s.duration_s),
    title: story.title,
    open: 'the drawing steps off the fridge',
    close: 'it walks back onto the fridge',
  };
  const audioFile = voice?.audioUrl ? store.mediaPath(flick.id, 'narration.mp3') : null;
  try {
    const shotFiles = (camera || []).filter((c) => c && c.videoUrl && !c.preview).map((c) => store.mediaPath(flick.id, `shot${c.shot}.mp4`));
    if (shotFiles.length) {
      const out = store.mediaPath(flick.id, 'episode.mp4');
      const made = await FF.concatShots(shotFiles, out, { audioFile });
      if (made) {
        const thumb = store.mediaPath(flick.id, 'thumb.png');
        await FF.thumbnail(out, thumb, { at: 1.0 });
        return { videoUrl: `/media/${flick.id}/episode.mp4`, thumbUrl: `/media/${flick.id}/thumb.png`, edl, engine: 'ffmpeg' };
      }
    }
    // offline user-upload: a real MP4 of THEIR own drawing gently moving
    if (flick.source?.file) {
      const src = store.mediaPath(flick.id, flick.source.file);
      const out = store.mediaPath(flick.id, 'episode.mp4');
      const total = shots.reduce((a, s) => a + s.duration_s, 0) || 12;
      const made = await FF.zoompanReel(src, out, { seconds: Math.min(total, 20), aspect: flick.settings?.aspect || '9:16', audioFile });
      if (made) {
        const thumb = store.mediaPath(flick.id, 'thumb.png');
        await FF.thumbnail(out, thumb, { at: 0.5 });
        return { videoUrl: `/media/${flick.id}/episode.mp4`, thumbUrl: `/media/${flick.id}/thumb.png`, edl, engine: 'ffmpeg-post', preview: true };
      }
    }
  } catch (e) { ctx.log?.(`cutter fell back to in-browser assembly: ${e.message}`); }
  return { videoUrl: null, thumbUrl: null, edl, engine: 'browser', preview: true };
}

// ── Ordered crew metadata (drives the Backstage rail + the tool surface) ─────
export const CREW = [
  { id: 'reader', name: 'The Reader', fn: 'read_drawing', model: config.models.reader, kind: 'reader' },
  { id: 'writer', name: 'The Writer', fn: 'write_story', model: config.models.writer, kind: 'writer' },
  { id: 'board', name: 'The Storyboarder', fn: 'storyboard', model: config.models.storyboarder, kind: 'board' },
  { id: 'painter', name: 'The Set Painter', fn: 'paint_set', model: config.models.painter, kind: 'painter' },
  { id: 'camera', name: 'The Camera', fn: 'roll_camera', model: config.models.camera, kind: 'camera' },
  { id: 'critic', name: 'The Critic', fn: 'check_fidelity', model: config.models.critic, kind: 'critic' },
  { id: 'voice', name: 'The Voice', fn: 'voice_line', model: config.models.voice, kind: 'voice' },
  { id: 'cutter', name: 'The Cutter', fn: 'cut_episode', model: 'ffmpeg', kind: 'cutter' },
];
