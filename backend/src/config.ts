import path from 'path';
import dotenv from 'dotenv';

/**
 * Load environment variables from backend/.env first, then the repo-root .env
 * (dotenv never overrides already-set vars, so shell/CI env wins).
 */
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

function bool(v: string | undefined, fallback = false): boolean {
  if (v === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(v);
}

export const config = {
  port: Number(process.env.PORT) || 3000,

  // ---- Ollama (translation) ----
  ollamaUrl: (process.env.OLLAMA_URL || 'http://46.152.253.223:11434').replace(/\/+$/, ''),
  modelName: process.env.MODEL_NAME || 'qwen2.5-coder:32b',
  ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS) || 60000,

  // ---- MariaDB / MySQL ----
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'assistran',
    password: process.env.DB_PASSWORD || 'assistran',
    database: process.env.DB_NAME || 'assistran',
    connectionLimit: Number(process.env.DB_POOL) || 10,
  },

  // ---- Auth ----
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-change-me',
  jwtExpiresInSec: Number(process.env.JWT_EXPIRES_SEC) || 60 * 60 * 24 * 7, // 7 days

  // ---- LiveKit (SFU for audio/video) ----
  livekit: {
    // URL the BROWSER connects to (wss in production), e.g. wss://<public-ip>:7880
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },

  // True once a real JWT secret is set — used only for a startup warning.
  isProd: bool(process.env.NODE_ENV === 'production' ? 'true' : process.env.PROD),
} as const;

/** True when LiveKit is configured (otherwise A/V is disabled but the rest works). */
export function livekitEnabled(): boolean {
  return Boolean(config.livekit.url && config.livekit.apiKey && config.livekit.apiSecret);
}
