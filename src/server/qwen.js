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
