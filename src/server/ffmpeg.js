// Flick — the Cutter's hands. Deterministic ffmpeg (system binary). Two real jobs:
//   • concatShots  — assemble the Qwen r2v shot MP4s + mux narration (the real path)
//   • zoompanReel  — offline, animate the stranger's OWN uploaded drawing into a
//                    real MP4 (gentle pan/zoom) — honest "deterministic post", their
//                    actual pixels moving, never a stranger's dragon.
// If ffmpeg is absent, every function resolves to null and the app relies on the
// live in-browser animation + client-side capture — degraded honestly, never faked.
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
let _has = null;

export async function hasFFmpeg() {
  if (_has !== null) return _has;
  _has = await new Promise((resolve) => {
    try {
      const p = spawn(FFMPEG, ['-version']);
      p.on('error', () => resolve(false));
      p.on('close', (code) => resolve(code === 0));
    } catch { resolve(false); }
  });
  return _has;
}

function run(args, { timeoutMs = 5 * 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args);
    let err = '';
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} reject(new Error('ffmpeg timeout')); }, timeoutMs);
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', (e) => { clearTimeout(t); reject(e); });
    p.on('close', (code) => { clearTimeout(t); code === 0 ? resolve(true) : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-500)}`)); });
  });
}

const AR = { '16:9': '1280x720', '9:16': '720x1280', '1:1': '720x720' };

// Concatenate rendered shot files into one episode, then (optionally) mux narration.
export async function concatShots(shotFiles, outFile, { audioFile } = {}) {
  if (!(await hasFFmpeg()) || !shotFiles.length) return null;
  const listFile = `${outFile}.txt`;
  await fs.writeFile(listFile, shotFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
  const tmp = audioFile ? `${outFile}.silent.mp4` : outFile;
  await run(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp]);
  if (audioFile) {
    await run(['-y', '-i', tmp, '-i', audioFile, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', outFile]);
    await fs.rm(tmp, { force: true });
  }
  await fs.rm(listFile, { force: true });
  return outFile;
}

// Offline: turn ONE still drawing into a gentle ~Ns Ken-Burns MP4 (their pixels, moving).
export async function zoompanReel(sourceImage, outFile, { seconds = 12, aspect = '9:16', audioFile } = {}) {
  if (!(await hasFFmpeg())) return null;
  const size = AR[aspect] || AR['9:16'];
  const [w, h] = size.split('x').map(Number);
  const fps = 25;
  const frames = Math.max(fps * 2, Math.round(seconds * fps));
  // slow zoom-in with a soft drift — deterministic, calm, "alive but still theirs".
  const vf = [
    `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase`,
    `crop=${w * 2}:${h * 2}`,
    `zoompan=z='min(zoom+0.0006,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=${fps}`,
    `format=yuv420p`,
  ].join(',');
  const tmp = audioFile ? `${outFile}.silent.mp4` : outFile;
  await run(['-y', '-loop', '1', '-i', sourceImage, '-vf', vf, '-t', String(seconds), '-c:v', 'libx264', '-movflags', '+faststart', tmp]);
  if (audioFile) {
    await run(['-y', '-i', tmp, '-i', audioFile, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', outFile]);
    await fs.rm(tmp, { force: true });
  }
  return outFile;
}

// Pull a still thumbnail from a finished video.
export async function thumbnail(videoFile, outFile, { at = 1.0 } = {}) {
  if (!(await hasFFmpeg())) return null;
  try {
    await run(['-y', '-ss', String(at), '-i', videoFile, '-frames:v', '1', outFile]);
    return outFile;
  } catch { return null; }
}

// Extract one representative frame (for the Critic to compare against the drawing).
export async function extractFrame(videoFile, outFile, { at = 0.5 } = {}) {
  if (!(await hasFFmpeg())) return null;
  try {
    await run(['-y', '-ss', String(at), '-i', videoFile, '-frames:v', '1', outFile]);
    return outFile;
  } catch { return null; }
}
