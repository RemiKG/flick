// Flick — the Qwen Cloud client. Thin `fetch` wrappers over the exact documented
// dashscope-intl endpoints. No SDK, no hidden magic. Every call throws a clear
// error on failure so the orchestrator can degrade honestly (never fake a result).
//
//   chat / vision / images  ->  {baseUrl}  (OpenAI-compatible, Bearer key)
//   async video synthesis    ->  {nativeUrl}/services/aigc/video-generation/video-synthesis
//                                  header X-DashScope-Async: enable -> task_id -> poll /tasks/{id}
//   TTS                       ->  {nativeUrl}/services/aigc/... (cosyvoice / qwen3-tts)
import { config } from './config.js';

class QwenError extends Error {
  constructor(message, status, body) { super(message); this.name = 'QwenError'; this.status = status; this.body = body; }
}
export { QwenError };

function authHeaders(extra = {}) {
  if (!config.apiKey) throw new QwenError('No DASHSCOPE_API_KEY set — the Qwen crew is offline.', 0, null);
  return { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', ...extra };
}

async function doFetch(url, opts, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      const msg = json?.message || json?.error?.message || json?.code || `HTTP ${res.status}`;
      throw new QwenError(`Qwen call failed: ${msg}`, res.status, json);
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

// ── OpenAI-compatible chat / vision ─────────────────────────────────────────
// messages: standard OpenAI shape. For vision, content is an array with
// {type:'image_url', image_url:{url:<dataURL|http>}} + {type:'text', text}.
export async function chat({ model, messages, extra = {}, timeoutMs = 90000 }) {
  const body = { model, messages, ...extra };
  const json = await doFetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
  }, timeoutMs);
  const choice = json?.choices?.[0]?.message;
  return { text: choice?.content ?? '', message: choice, usage: json?.usage, raw: json };
}

// convenience: ask a vision model about one image, get text back
export async function visionAsk({ model, imageUrl, prompt, extra = {}, timeoutMs = 90000 }) {
  return chat({
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: prompt },
      ],
    }],
    extra, timeoutMs,
  });
}

// ── Images (OpenAI-compatible images.generate) ──────────────────────────────
export async function images({ model, prompt, size = '1024x1024', n = 1, extra = {}, timeoutMs = 120000 }) {
  const body = { model, prompt, size, n, ...extra };
  const json = await doFetch(`${config.baseUrl}/images/generations`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
  }, timeoutMs);
  const url = json?.data?.[0]?.url || json?.data?.[0]?.b64_json || null;
  return { url, raw: json };
}

// ── Async video synthesis (Wan / HappyHorse) ────────────────────────────────
// Returns a task_id. `input` and `parameters` are built by the Camera crew tool
// so the exact per-model field shape lives with the caller.
export async function submitVideoTask({ model, input, parameters = {}, timeoutMs = 60000 }) {
  const body = { model, input, parameters };
  const json = await doFetch(
    `${config.nativeUrl}/services/aigc/video-generation/video-synthesis`,
    { method: 'POST', headers: authHeaders({ 'X-DashScope-Async': 'enable' }), body: JSON.stringify(body) },
    timeoutMs,
  );
  const taskId = json?.output?.task_id;
  if (!taskId) throw new QwenError('No task_id returned from video-synthesis', 200, json);
  return { taskId, raw: json };
}

export async function getTask(taskId, timeoutMs = 30000) {
  const json = await doFetch(`${config.nativeUrl}/tasks/${taskId}`, {
    method: 'GET', headers: authHeaders(),
  }, timeoutMs);
  const out = json?.output || {};
  return { status: out.task_status, videoUrl: out.video_url, output: out, raw: json };
}

// Poll a submitted video task to completion. Qwen video URLs expire ~24h, so the
// caller downloads immediately. onTick(status) lets the UI show honest latency.
export async function pollVideo(taskId, { onTick, intervalMs = 6000, timeoutMs = 8 * 60000 } = {}) {
  const start = Date.now();
  for (;;) {
    const t = await getTask(taskId);
    if (onTick) onTick(t.status);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED' || t.status === 'UNKNOWN') {
      throw new QwenError(`Video task ${t.status}`, 200, t.raw);
    }
    if (Date.now() - start > timeoutMs) throw new QwenError('Video task timed out', 0, t.raw);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// ── TTS (narration) ─────────────────────────────────────────────────────────
// qwen3-tts-flash: multimodal-generation/generation, {input:{text, voice}} -> audio url
// cosyvoice-v3-plus: text2audio/generation (SSML) -> audio url
export async function tts({ model, text, voice = 'Cherry', extra = {}, timeoutMs = 60000 }) {
  const isCosy = /cosyvoice/i.test(model);
  const path = isCosy ? 'services/aigc/text2audio/generation' : 'services/aigc/multimodal-generation/generation';
  const input = isCosy ? { text, voice, ...extra } : { text, voice, ...extra };
  const json = await doFetch(`${config.nativeUrl}/${path}`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ model, input, parameters: {} }),
  }, timeoutMs);
  const url = json?.output?.audio?.url || json?.output?.audio_url || json?.output?.url || null;
  return { url, raw: json };
}

// Clone a voice from a short clip (10–20s). Returns a voice id usable by tts().
export async function enrollVoice({ model, audioUrl, targetModel, timeoutMs = 60000 }) {
  const json = await doFetch(`${config.nativeUrl}/services/audio/tts/customization`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ model: model || 'qwen-voice-enrollment', input: { action: 'create_voice', target_model: targetModel || config.models.voice, url: audioUrl } }),
  }, timeoutMs);
  const voiceId = json?.output?.voice_id || json?.output?.voice || null;
  return { voiceId, raw: json };
}

// Download a (soon-to-expire) remote asset to a Buffer so Flick can keep its own copy.
export async function downloadToBuffer(url, timeoutMs = 120000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new QwenError(`Download failed: HTTP ${res.status}`, res.status, null);
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') || '';
    return { buffer: buf, contentType: type };
  } finally { clearTimeout(t); }
}
