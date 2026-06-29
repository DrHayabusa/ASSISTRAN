import express from 'express';
import cors from 'cors';
import { config } from './config';
import translateRouter from './routes/translate';
import replyRouter from './routes/reply';
import { getActiveModel, initModel, listInstalledModels, listModels } from './services/ollama';

const app = express();

// Allow the Vite dev server (and any local origin) to call the API directly.
// In normal use the frontend proxies /api through Vite, so CORS is just a safety net.
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Liveness + setup check. Confirms the backend is up, whether it can reach the
// Ollama server, and which model will actually be used — handy for friends
// verifying their setup.
app.get('/api/health', async (_req, res) => {
  let ollamaReachable = false;
  let installedModels: string[] = [];
  try {
    installedModels = await listInstalledModels(3000); // keep health fast
    ollamaReachable = true;
  } catch {
    ollamaReachable = false;
  }
  res.json({
    status: 'ok',
    ollamaUrl: config.ollamaUrl,
    ollamaReachable,
    configuredModel: config.modelName,
    activeModel: getActiveModel(),
    installedModels,
  });
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
  console.log(`  Configured model:    ${config.modelName}`);
  // Check the Ollama server and pick a usable model (logs a fallback if needed).
  void initModel();
});
