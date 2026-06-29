import path from 'path';
import dotenv from 'dotenv';

/**
 * Load environment variables.
 *
 * When the backend is started through npm workspaces (`npm run dev -w backend`)
 * the current working directory is the `backend/` folder, so we load:
 *   1. backend/.env        (per-package override, optional)
 *   2. <repo-root>/.env    (the main .env documented in .env.example)
 *
 * dotenv does NOT overwrite already-defined variables, so the first match wins
 * and real environment variables (e.g. from the shell or CI) always take
 * precedence over the files.
 */
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const config = {
  /** Port the Express server listens on. */
  port: Number(process.env.PORT) || 3000,

  /**
   * Base URL of the Ollama server. The frontend never sees this value — only
   * the backend talks to Ollama. Override it via the OLLAMA_URL env var.
   */
  ollamaUrl: (process.env.OLLAMA_URL || 'http://46.152.253.223:11434').replace(/\/+$/, ''),

  /** Ollama model used for every translation. */
  modelName: process.env.MODEL_NAME || 'qwen2.5-coder:32b',

  /** Abort an Ollama request if it takes longer than this (milliseconds). */
  ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS) || 60000,
} as const;
