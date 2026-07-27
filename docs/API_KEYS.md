# ASSISTRAN — API Keys & Configuration

**Where every credential/URL lives in the repo, where it's *used* to make the API call, and how to add a key if your Ollama endpoint requires one.**

---

## TL;DR

- **All outbound API calls are made by the BACKEND only.** The frontend never holds a key — it only calls your own backend at `/api/*` and `/socket.io`.
- **You set everything in ONE file:** the root **`.env`** (copy it from [`.env.example`](../.env.example)). Nothing is hardcoded; nothing goes in the frontend.
- The backend reads that file in **`backend/src/config.ts`**, and each service file uses those values to make its call.

```
.env  ──►  backend/src/config.ts  ──►  backend/src/services/*.ts  ──►  external API
(you edit)   (reads env into config)     (uses config to call it)      (Ollama / LiveKit)
```

---

## 1. The only file you edit: `.env` (repo root)

```bash
cp .env.example .env      # then edit the values
```

| Setting | What it's for | Example |
| --- | --- | --- |
| `OLLAMA_URL` | Your Ollama server (the translation API) | `http://46.152.253.223:11434` |
| `MODEL_NAME` | Model to use | `qwen2.5-coder:32b` |
| `JWT_SECRET` | Signs login tokens — **set a long random one** | `openssl rand -hex 32` |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | MariaDB connection | `127.0.0.1` / `assistran` / … |
| `REDIS_URL` | Redis (realtime scaling) | `redis://127.0.0.1:6379` |
| `LIVEKIT_URL` | LiveKit server the browser connects to (audio/video) | `wss://<PUBLIC_IP>:7443` |
| `LIVEKIT_API_KEY` | LiveKit key **name** | `assistran_key` |
| `LIVEKIT_API_SECRET` | LiveKit **secret** (also set in `deploy/livekit.yaml`) | `openssl rand -hex 32` |

> `.env` is git-ignored — **never commit real secrets.** `.env.example` (committed) is just the template.

---

## 2. Where each key is wired in the code (the "integration points")

Every value flows through **`backend/src/config.ts`**, then into a service that makes the call:

| API call | Set in `.env` | Read in | **Used to make the call in** |
| --- | --- | --- | --- |
| **Translation** (`POST {OLLAMA_URL}/api/chat`) | `OLLAMA_URL`, `MODEL_NAME` | `config.ts` → `config.ollamaUrl`, `config.modelName` | **`backend/src/services/ollama.ts`** — functions `rawChat()` (POST `/api/chat`) and `listInstalledModels()` (GET `/api/tags`) |
| **Audio/Video tokens** | `LIVEKIT_URL/API_KEY/API_SECRET` | `config.ts` → `config.livekit.*` | **`backend/src/services/livekit.ts`** — `mintLivekitToken()` (uses `AccessToken(apiKey, apiSecret)`) |
| **Login tokens** | `JWT_SECRET` | `config.ts` → `config.jwtSecret` | `backend/src/auth/tokens.ts` |
| **Database** | `DB_*` | `config.ts` → `config.db` | `backend/src/db/pool.ts` |
| **Realtime scaling** | `REDIS_URL` | `config.ts` → `config.redisUrl` | `backend/src/realtime/redis.ts` |

So the **translation "API call" integration point is `backend/src/services/ollama.ts`**, driven by `OLLAMA_URL` + `MODEL_NAME` in `.env`.

---

## 3. "My Ollama endpoint needs an API key / bearer token — where do I add it?"

Vanilla Ollama needs **no key**. But if you front it with an auth proxy, or use a cloud / OpenAI-compatible endpoint that needs `Authorization: Bearer <key>`, add it in **3 small steps**:

**Step 1 — add the key to `.env`:**
```env
OLLAMA_API_KEY=sk-your-key-here
```

**Step 2 — expose it in `backend/src/config.ts`** (inside the `Ollama` block):
```ts
// ---- Ollama (translation) ----
ollamaUrl: (process.env.OLLAMA_URL || 'http://46.152.253.223:11434').replace(/\/+$/, ''),
modelName: process.env.MODEL_NAME || 'qwen2.5-coder:32b',
ollamaApiKey: process.env.OLLAMA_API_KEY || '',        // <-- add this line
ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS) || 60000,
```

**Step 3 — send it on the request in `backend/src/services/ollama.ts`.** Add an `Authorization` header to the two `fetch(...)` calls (`rawChat()` and `listInstalledModels()`). For example, in `rawChat()`:
```ts
const response = await fetch(`${config.ollamaUrl}/api/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(config.ollamaApiKey ? { Authorization: `Bearer ${config.ollamaApiKey}` } : {}),
  },
  body: JSON.stringify({ model, messages, stream: false, options }),
  signal: controller.signal,
});
```
Do the same in `listInstalledModels()` (add the same `headers` object to its `fetch`). Rebuild the backend (`npm run build -w backend`) and restart.

> Prefer not to touch code? If your provider is **OpenAI-compatible**, an easier route is to run a tiny local proxy (e.g. LiteLLM) that holds the key and speaks Ollama's `/api/chat`, then point `OLLAMA_URL` at that proxy — no code change needed.

---

## 4. LiveKit: the key lives in TWO places and they must match

For audio/video, the same secret is shared between your backend and the LiveKit server:

1. **`.env`** → `LIVEKIT_API_KEY=assistran_key`, `LIVEKIT_API_SECRET=<secret>`
2. **`deploy/livekit.yaml`** →
   ```yaml
   keys:
     assistran_key: <the SAME secret>
   ```

The backend signs join tokens with these (`backend/src/services/livekit.ts`); LiveKit validates them with the matching entry in `livekit.yaml`. If the two secrets differ, video fails to connect.

---

## 5. Apply your changes

```bash
# after editing .env (and livekit.yaml if using A/V)
npm run build          # if you changed any .ts file
npm run dev            # local, or restart your container / docker compose
curl http://localhost:3000/api/health   # confirms what it sees (db / ollama / livekit)
```

`/api/health` echoes back `ollama.url`, `ollama.reachable`, `ollama.activeModel`, and `livekit.configured` — the fastest way to confirm your keys/URLs took effect.
