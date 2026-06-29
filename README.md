# ASSISTRAN

**Speak. Translate. Connect.**

ASSISTRAN is a production-quality, mobile-first web app for **AI-powered live translation** across
meetings, chats, and quick voice translation. It looks and feels like a real native mobile app and
runs entirely on your computer for local testing.

All translations are produced by **your private Ollama server**. The frontend **never** talks to
Ollama directly — it calls the backend, and only the backend calls Ollama.

```text
Browser / Mobile Web UI
        │   fetch('/api/translate')   (relative URL, proxied by Vite)
        ▼
Backend API:  POST /api/translate     (Node + Express + TypeScript)
        │   POST {OLLAMA_URL}/api/chat
        ▼
Ollama Server  →  Model: qwen2.5-coder:32b
```

---

## ✨ Features

| Page | What it does |
| --- | --- |
| **Welcome** | Animated logo reveal + tagline splash. |
| **Onboarding** | Local login / create-account (name, username, password). |
| **Language Select** | Pick your spoken language from 11 options (circular flag cards). |
| **Home** | 2×2 action grid, user card with live language switcher, quick links, footer. |
| **Translate** | Voice (Web Speech API) + text translation, read-aloud (SpeechSynthesis), history. |
| **New / Join Meeting** | Create or schedule meetings, shareable code/link, pre-meeting device check. |
| **Meeting Room** | Zoom-style room with camera tiles, screen share, push-to-talk, **live per-participant translation**. |
| **Chats** | WhatsApp-style chats where each person reads in their own language. |
| **History** | Activity log of meetings, chats and translations. |
| **Settings** | Edit profile, change language/password, privacy, about, log out, delete account. |

### Translation behaviour
- A single backend route, `POST /api/translate`, drives **every** translation (quick translate, chat
  messages, and meeting speech).
- The system prompt turns the model into a strict **live interpreter**: it returns only the
  translation — no explanations, notes, or answers.
- **English → Hejazi Arabic** is rendered as natural, spoken, respectful Hejazi (western Saudi
  Arabia). **Hejazi → English** is fluent and professional. All other pairs preserve tone and meaning.

---

## 🧱 Tech stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, Framer Motion, lucide-react.
- **Backend:** Node.js + Express + TypeScript (calls Ollama via the native `fetch`).
- **AI:** Ollama `/api/chat`, model `qwen2.5-coder:32b` (backend-only).
- **Browser APIs:** Web Speech API (speech-to-text), SpeechSynthesis (text-to-speech),
  `getUserMedia` (camera/mic), `getDisplayMedia` (screen share).
- **Storage:** `localStorage` (users, profile, friends, chats, meetings, history).

---

## 🚀 Getting started

### Prerequisites
- **Node.js 18+** (tested on Node 22) and npm.
- Network access to your Ollama server with the `qwen2.5-coder:32b` model pulled.

### 1. Install
```bash
npm install
```
This installs both the `backend` and `frontend` workspaces in one step.

### 2. Configure environment
```bash
cp .env.example .env
```
`.env` (read by the **backend only**):
```env
OLLAMA_URL=http://46.152.253.223:11434
MODEL_NAME=qwen2.5-coder:32b
PORT=3000
OLLAMA_TIMEOUT_MS=60000
```
> These same values are baked in as defaults, so the app still runs without a `.env` — but copying
> the file makes them easy to change.

> **Tip — translation quality:** `qwen2.5-coder:32b` is tuned for *code*, so general/dialect
> translation can be hit-or-miss. For noticeably better, more natural translations, point
> `MODEL_NAME` at a general instruct model you have pulled in Ollama — e.g. `qwen2.5:32b-instruct`,
> `qwen2.5:14b-instruct`, `gemma2:27b`, or `aya-expanse:32b` (Cohere's multilingual model). It's a
> one-line change in `.env`; no code changes needed.

### 3. Run (both servers together)
```bash
npm run dev
```
- Frontend → **http://localhost:5173**
- Backend  → **http://localhost:3000**

Vite proxies all `/api/*` requests from the frontend to the backend, so the browser only ever uses
relative URLs and never sees the Ollama address.

Open **http://localhost:5173** in your browser. For the most realistic feel, open your browser
dev-tools device toolbar (mobile view). **Use Chrome or Edge** for full microphone speech
recognition support.

### Other scripts
```bash
npm run build        # type-check + build backend and frontend for production
npm start            # run the compiled backend (after npm run build)
npm run typecheck    # type-check both workspaces
```

---

## ✅ Testing guide

1. **Start the backend & frontend:** `npm run dev`.
2. **Open the app:** visit http://localhost:5173.
3. **Create an account:** Onboarding → *Sign Up* → enter name, username, password, confirm.
4. **Select a preferred language:** tap a flag (e.g. *British English*) → *Continue*.
5. **Change language from Home:** use the language dropdown in the user card — it updates everywhere.
6. **Quick Translate:** open *Translate*, type or speak, watch the translated text appear and be read
   aloud. Tap a history item to replay it.
7. **Verify the Ollama translation API** with the curl commands below.
8. **New Meeting:** Home → *New Meeting* → create → copy link → *Start* → set camera/mic/language →
   *Join*. In the room, **hold "Hold to speak"** to speak, or **tap a participant tile** to hear them
   speak — their line is translated into your language and read aloud.
9. **Join Meeting:** Home → *Join Meeting* → paste a code/link → *Join* → pre-meeting → room.
10. **Chats:** open *Chats* (demo friends are pre-seeded). Accept the pending friend request, then
    open a chat and send a message — it is translated for your friend, and their reply comes back in
    your language. Add a friend by username (`sofia`, `kenji`, `liang`).
11. **History:** Home → *History* shows your meetings, chats and translations.
12. **Settings:** edit profile, change password/language, toggle privacy, log out, delete account.

### curl checks

**Confirm Ollama is reachable and has the model:**
```bash
curl http://46.152.253.223:11434/api/tags
```

**Test the backend translation route:**
```bash
curl -X POST http://localhost:3000/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, how are you?","source":"English","target":"Hejazi Arabic"}'
```
Expected:
```json
{ "translation": "..." }
```

**Test a smart bot reply** (used by chats & meeting participants):
```bash
curl -X POST http://localhost:3000/api/reply \
  -H "Content-Type: application/json" \
  -d '{"personaName":"Sofía","language":"Spanish","context":"chatting 1:1","messages":[{"role":"user","content":"Hey, are we still on for Friday?"}]}'
```
Expected:
```json
{ "reply": "..." }
```

**Backend health / diagnostics** — the single most useful check:
```bash
curl http://localhost:3000/api/health
```
```jsonc
{
  "status": "ok",
  "ollamaReachable": true,            // can the backend reach your Ollama server?
  "configuredModel": "qwen2.5-coder:32b",
  "activeModel": "qwen2.5:14b-instruct", // the model actually being used
  "installedModels": ["qwen2.5:14b-instruct", "..."]  // what your server has
}
```
If `ollamaReachable` is `false`, the backend can't reach Ollama (URL/firewall/VPN). If
`installedModels` is empty or your model isn't listed, pull one or set `MODEL_NAME`.

---

## 👥 Share it with a friend

Translation needs an Ollama server with a chat model, so the only real requirement is that whoever
runs the app can **reach a working Ollama**. The cleanest, error-free way for a friend to try it:

### Option A — friend runs everything on their own machine (recommended)
1. Install **Node 18+** and **[Ollama](https://ollama.com)**.
2. Pull a model and start Ollama:
   ```bash
   ollama pull qwen2.5:14b-instruct   # good quality/speed; or qwen2.5:7b-instruct for low-end PCs
   ollama serve                       # (usually already running on http://localhost:11434)
   ```
3. Clone and configure:
   ```bash
   git clone https://github.com/DrHayabusa/ASSISTRAN.git
   cd ASSISTRAN
   cp .env.example .env
   ```
   Edit `.env` so it points at their **own** Ollama:
   ```env
   OLLAMA_URL=http://localhost:11434
   MODEL_NAME=qwen2.5:14b-instruct
   ```
4. Run it:
   ```bash
   npm install
   npm run dev
   ```
5. Open **http://localhost:5173** (Chrome/Edge for the microphone).

This "just works" with no 404/405/500/502 because everything is local. Mic/camera also work because
`localhost` is a secure origin.

### Option B — friend uses *your* shared Ollama server
Keep `OLLAMA_URL` pointing at your server (e.g. `http://46.152.253.223:11434`). For this to work:
- Your Ollama server must be **reachable from the friend's network** (public IP/port, port-forwarded,
  or a tunnel like `ngrok http 11434`). Verify from *their* machine: `curl http://YOUR_IP:11434/api/tags`.
- That server must have a **chat model installed** (run `ollama pull qwen2.5:14b-instruct` on it). The
  app auto-falls-back to any installed chat model, but it must have at least one.

> Mic/camera need a secure origin. Each person running their own copy on `localhost` is fine. If you
> instead expose one instance over a LAN IP (`npm run dev -- --host`), the mic/camera are blocked
> unless it's served over HTTPS (use a tunnel such as `cloudflared`/`ngrok`).

---

## 🛠️ Troubleshooting (404 / 405 / 500 / 502)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `model '...' not found` (404) | The model in `MODEL_NAME` isn't installed on the Ollama server | `ollama pull <model>` on that server, or set `MODEL_NAME` to one from `installedModels`. The app now **auto-falls-back** to an installed chat model. |
| "The translation API isn't reachable" (**404/405**) | The frontend is served **without the backend** behind `/api` (e.g. only `vite`, or static `dist/` on a host with no API) | Run **both** servers with `npm run dev`; open `http://localhost:5173`. |
| "Cannot reach the ASSISTRAN backend" / **500** | Backend isn't running, or crashed, or wrong port | Start it (`npm run dev`); check the backend terminal; confirm `curl http://localhost:3000/api/health`. |
| `Translation failed: ... timed out` (**502**) | Backend is up but can't reach Ollama (URL wrong, firewall, VPN, server down) | Check `OLLAMA_URL`; from the backend machine run `curl $OLLAMA_URL/api/tags`. |
| Translations are poor | `qwen2.5-coder:32b` is code-tuned | Set `MODEL_NAME` to a general instruct model (see the tip above). |

**Golden rule:** if you see a 404/405 on `/api/...`, the backend isn't there — never serve the frontend
without it. Always check `GET /api/health` first.

---

## 🧩 What's real vs. simulated (local prototype)

Real-time multi-user transport (WebRTC/sockets) is **not** included — it requires a signalling
server. Everything is structured so it can be added later without changing the UI or translation flow.

| Real today | Simulated for local testing |
| --- | --- |
| Ollama translation through the backend (`/api/translate`) | That there are *other real users* (chat friends & meeting participants are local) |
| AI-generated, context-aware bot replies via `/api/reply` | Friend list / friend requests (seeded demo data) |
| Camera, microphone & screen-share via browser APIs | Online/offline status |
| Speech-to-text & text-to-speech | Real-time transport between devices (no WebRTC/socket server) |
| All persistence via `localStorage` | |

The simulated chat friends and meeting participants are **not** canned scripts — each reply is
generated by the model through `/api/reply`, so they actually read the conversation and respond in
character, in their own language, before being translated into yours. To make meetings/chats real
later: replace the simulated speakers with a socket/WebRTC layer that delivers each remote
utterance/message, then run it through the **same** `/api/translate` call already used here.

---

## 📁 Project structure

```text
ASSISTRAN/
├─ backend/
│  └─ src/
│     ├─ index.ts             # Express app + routes
│     ├─ config.ts            # env loading (OLLAMA_URL, MODEL_NAME, ...)
│     ├─ routes/translate.ts  # POST /api/translate
│     └─ services/ollama.ts   # interpreter prompt + Ollama /api/chat call
├─ frontend/
│  └─ src/
│     ├─ pages/               # Welcome, Onboarding, Home, Translate, chats/, meeting/, ...
│     ├─ components/ui/       # MobileShell, Modal, Avatar, LanguageDropdown, PageHeader
│     ├─ context/AppContext.tsx
│     ├─ hooks/useSpeechRecognition.ts
│     ├─ lib/                 # api, storage, languages, speech, personas, utils
│     └─ types.ts
├─ .env.example
└─ package.json               # npm workspaces + dev scripts
```

---

## 🎙️ Microphone / voice troubleshooting

Voice input uses the browser **Web Speech API**, which has three hard requirements. If the mic
doesn't work, the app now shows the exact reason on screen — it's almost always one of these:

1. **Browser:** use **Google Chrome** or **Microsoft Edge**. Firefox, Safari, and Brave do not
   support speech recognition reliably (Brave blocks it by default).
2. **Secure origin:** open the app at **`http://localhost:5173`**. Browsers **block the microphone on
   a plain LAN/IP address** (e.g. `http://192.168.1.50:5173`), so opening it on your phone over the
   network will fail until you serve it over **HTTPS** (e.g. via a tunnel like `ngrok`/`cloudflared`,
   or a self-signed cert).
3. **Permission + connection:** allow the microphone when prompted (check the lock/camera icon in the
   address bar if you dismissed it), and stay online — Chrome processes speech via an online service.

Typing always works as a fallback, so you can use every feature without a mic. Text-to-speech
(reading translations aloud) and camera/screen-share have the same secure-origin requirement.

## 🔒 Notes
- **Local testing only:** authentication is intentionally simple and passwords are stored in plain
  text in `localStorage`. Do **not** use this auth as-is in production.
- The Ollama URL/model live in the backend env only — they are never bundled into the frontend.

---

All rights reserved by Assistran™ 2026
