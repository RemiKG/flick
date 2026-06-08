// Flick — runtime config. One honest source of truth for "is the Qwen crew live?"
// Every value has a safe default so the app runs cold with ZERO env set.
import 'dotenv/config';

const env = process.env;

export const config = {
  port: Number(env.PORT) || 8080,

  // The one switch. Present => the real Qwen crew is live; absent => honest offline.
  apiKey: (env.DASHSCOPE_API_KEY || '').trim(),

  baseUrl: (env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/$/, ''),
  nativeUrl: (env.DASHSCOPE_NATIVE_URL || 'https://dashscope-intl.aliyuncs.com/api/v1').replace(/\/$/, ''),

  models: {
    reader: env.MODEL_READER || 'qwen3-vl-plus',
    writer: env.MODEL_WRITER || 'qwen3.7-max',
    storyboarder: env.MODEL_STORYBOARDER || 'qwen3.7-plus',
    painter: env.MODEL_PAINTER || 'wan2.6-t2i',
    camera: env.MODEL_CAMERA || 'wan2.7-r2v',
    cameraFallback: env.MODEL_CAMERA_FALLBACK || 'happyhorse-1.1-r2v',
    critic: env.MODEL_CRITIC || 'qwen3-vl-plus',
    voice: env.MODEL_VOICE || 'cosyvoice-v3-plus',
    voiceFallback: env.MODEL_VOICE_FALLBACK || 'qwen3-tts-flash',
  },

  // Free-tier Wan seconds per model (the track's budget, made a feature).
  wanFreeSeconds: Number(env.WAN_FREE_SECONDS) || 50,

  databaseUrl: (env.DATABASE_URL || '').trim(),
  oss: {
    region: env.OSS_REGION || '',
    bucket: env.OSS_BUCKET || '',
    keyId: env.OSS_ACCESS_KEY_ID || '',
    keySecret: env.OSS_ACCESS_KEY_SECRET || '',
  },

  // Where the backend actually runs — drives the honest readout label.
  // Deploy on Alibaba Cloud ECS/SAS sets DEPLOY_LABEL="on Alibaba Cloud".
  deployLabel: env.DEPLOY_LABEL || (env.ECS_INSTANCE_ID || env.ALIBABA_CLOUD_REGION ? 'on Alibaba Cloud' : 'running locally'),
};

export const engineLive = () => config.apiKey.length > 0;

// A compact, non-secret description of the crew for the /api/config surface.
export function publicConfig() {
  return {
    engineLive: engineLive(),
    deployLabel: config.deployLabel,
    onAlibaba: /alibaba/i.test(config.deployLabel),
    wanFreeSeconds: config.wanFreeSeconds,
    baseUrl: config.baseUrl,
    models: config.models,
  };
}
