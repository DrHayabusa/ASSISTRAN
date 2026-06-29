import express from 'express';
import cors from 'cors';
import { config } from './config';
import translateRouter from './routes/translate';
import replyRouter from './routes/reply';
import { listModels } from './services/ollama';

const app = express();

// Allow the Vite dev server (and any local origin) to call the API directly.
// In normal use the frontend proxies /api through Vite, so CORS is just a safety net.
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Lightweight liveness check.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: config.modelName, ollamaUrl: config.ollamaUrl });
});

// Diagnostic route: confirms the backend can reach Ollama and lists models.
app.get('/api/models', async (_req, res) => {
  try {
    const data = await listModels();
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: `Could not reach Ollama at ${config.ollamaUrl}: ${message}` });
  }
});

// Translation API.
app.use('/api', translateRouter);

// Conversational replies for simulated chat/meeting participants.
app.use('/api', replyRouter);

// 404 for any other /api/* path.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(config.port, () => {
  console.log(`\n  ASSISTRAN backend running at http://localhost:${config.port}`);
  console.log(`  Translate endpoint:  POST http://localhost:${config.port}/api/translate`);
  console.log(`  Ollama target:       ${config.ollamaUrl}`);
  console.log(`  Model:               ${config.modelName}\n`);
});
