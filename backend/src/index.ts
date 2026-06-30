import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { config, livekitEnabled } from './config';
import translateRouter from './routes/translate';
import replyRouter from './routes/reply';
import authRouter from './routes/auth';
import meetingsRouter from './routes/meetings';
import { getActiveModel, initModel, listInstalledModels, listModels } from './services/ollama';
import { pingDb } from './db/pool';
import { migrate } from './db/migrate';
import { initRealtime } from './realtime/socket';
import { attachRedisAdapter } from './realtime/redis';

const app = express();

// Behind the reverse proxy the frontend is same-origin; CORS is a dev safety net.
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Liveness + full setup check (DB, Ollama, LiveKit). Probes run in parallel and
// are bounded so the endpoint stays fast even when a dependency is down.
app.get('/api/health', async (_req, res) => {
  const [dbReachable, installedModels] = await Promise.all([
    pingDb().then(() => true).catch(() => false),
    listInstalledModels(3000).catch(() => [] as string[]),
  ]);
  res.json({
    status: 'ok',
    db: { reachable: dbReachable },
    ollama: {
      url: config.ollamaUrl,
      reachable: installedModels.length > 0,
      configuredModel: config.modelName,
      activeModel: getActiveModel(),
      installedModels,
    },
    livekit: { configured: livekitEnabled(), url: config.livekit.url || null },
  });
});

// Diagnostic: list models straight from Ollama.
app.get('/api/models', async (_req, res) => {
  try {
    res.json(await listModels());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: `Could not reach Ollama at ${config.ollamaUrl}: ${message}` });
  }
});

app.use('/api', authRouter); // /api/auth/*
app.use('/api', meetingsRouter); // /api/meetings*
app.use('/api', translateRouter); // /api/translate
app.use('/api', replyRouter); // /api/reply
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// In production, serve the built frontend from this same origin so the SPA,
// /api and /socket.io all sit behind one HTTPS host (no CORS, no mixed content).
const distDir = process.env.FRONTEND_DIST || path.resolve(process.cwd(), '../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`[static] serving frontend from ${distDir}`);
}

const server = http.createServer(app);
const io = initRealtime(server); // attach Socket.IO to the same HTTP server

// Connect + migrate with retries, in the background, so we don't block startup
// and tolerate MariaDB coming up slightly after the app (e.g. under supervisord).
async function initDb(): Promise<void> {
  const attempts = Number(process.env.DB_INIT_RETRIES) || 20;
  for (let i = 1; i <= attempts; i++) {
    try {
      await pingDb();
      await migrate();
      console.log('[db] connected and schema ready');
      return;
    } catch (e) {
      if (i === attempts) {
        console.error(`[db] NOT available after ${attempts} attempts: ${(e as Error).message}`);
        console.error('     Auth and meetings need MariaDB. Translation still works without it.');
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function start() {
  void initDb();

  try {
    if (await attachRedisAdapter(io)) console.log('[redis] Socket.IO adapter attached');
  } catch (e) {
    console.warn(`[redis] adapter not attached (${(e as Error).message}) — using in-memory.`);
  }

  if (config.jwtSecret === 'dev-insecure-change-me') {
    console.warn('[auth] Using the default JWT secret — set JWT_SECRET in .env before sharing this server.');
  }

  server.listen(config.port, () => {
    console.log(`\n  ASSISTRAN backend running at http://localhost:${config.port}`);
    console.log(`  Ollama:   ${config.ollamaUrl} (model ${config.modelName})`);
    console.log(`  LiveKit:  ${livekitEnabled() ? config.livekit.url : 'not configured (A/V disabled)'}`);
    console.log(`  Realtime: Socket.IO on /socket.io\n`);
    void initModel();
  });
}

void start();
