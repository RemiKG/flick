// Flick — persistence. Flick OWNS its Toy Box: a structured record per flick PLUS
// its media, so a child's flicks survive a closed tab and a cold session (Qwen's
// video URLs expire ~24h; Qwen's server memory expires ~7 days — useless for a
// keepsake). This filesystem store is genuinely persistent and needs no cloud.
//
// Env seam: set DATABASE_URL / OSS_* to move the durable copy to Alibaba Cloud
// RDS + OSS at deploy time (see README). Absent => this local store.
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');
export const STORE_DIR = path.join(ROOT, 'store');
export const FLICKS_DIR = path.join(STORE_DIR, 'flicks');
export const MEDIA_DIR = path.join(STORE_DIR, 'media');

async function ensureDirs() {
  await fs.mkdir(FLICKS_DIR, { recursive: true });
  await fs.mkdir(MEDIA_DIR, { recursive: true });
}
ensureDirs().catch(() => {});

function idOk(id) { return typeof id === 'string' && /^[a-z0-9-]{4,40}$/i.test(id); }

// atomic-ish write
async function writeJSON(file, obj) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

export async function saveFlick(flick) {
  await ensureDirs();
  if (!idOk(flick.id)) throw new Error('bad flick id');
  await writeJSON(path.join(FLICKS_DIR, `${flick.id}.json`), flick);
  return flick;
}

export async function getFlick(id) {
  if (!idOk(id)) return null;
  const file = path.join(FLICKS_DIR, `${id}.json`);
  if (!existsSync(file)) return null;
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}

export async function listFlicks() {
  await ensureDirs();
  const names = (await fs.readdir(FLICKS_DIR)).filter((n) => n.endsWith('.json'));
  const out = [];
  for (const n of names) {
    try { out.push(JSON.parse(await fs.readFile(path.join(FLICKS_DIR, n), 'utf8'))); } catch { /* skip */ }
  }
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out;
}

export async function deleteFlick(id) {
  if (!idOk(id)) return;
  await fs.rm(path.join(FLICKS_DIR, `${id}.json`), { force: true });
  await fs.rm(path.join(MEDIA_DIR, id), { recursive: true, force: true });
}

// Save a media buffer for a flick, return the public path (/media/<id>/<name>).
export async function saveMedia(id, name, buffer) {
  if (!idOk(id)) throw new Error('bad id');
  const dir = path.join(MEDIA_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buffer);
  return `/media/${id}/${name}`;
}

export function mediaPath(id, name) { return path.join(MEDIA_DIR, id, name); }

// ── Toy Box shaping: group a child's flicks into a Series Bible (a season per kid) ──
export function groupSeries(flicks) {
  const byChild = new Map();
  for (const f of flicks) {
    const k = (f.child || 'You').trim() || 'You';
    if (!byChild.has(k)) byChild.set(k, []);
    byChild.get(k).push(f);
  }
  return byChild;
}
