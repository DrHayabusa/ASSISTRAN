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

**Backend health / diagnostics:**
```bash
curl http://localhost:3000/api/health     # { "status": "ok", ... }
curl http://localhost:3000/api/models     # proxies Ollama /api/tags through the backend
```

---

## 🧩 What's real vs. simulated (local prototype)

Real-time multi-user transport (WebRTC/sockets) is **not** included — it requires a signalling
server. Everything is structured so it can be added later without changing the UI or translation flow.

| Real today | Simulated for local testing |
| --- | --- |
| Ollama translation through the backend (`/api/translate`) | Remote meeting participants (tap a tile to make them "speak") |
| Camera, microphone & screen-share via browser APIs | The "other side" of a chat (friend auto-replies in their language) |
| Speech-to-text & text-to-speech | Friend list / friend requests (seeded demo data) |
| All persistence via `localStorage` | Online/offline status |

To make meetings/chats real later: replace the simulated speakers/replies with a socket or WebRTC
layer that delivers each remote utterance/message, then run it through the **same** `/api/translate`
call already used here.

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

## 🔒 Notes
- **Local testing only:** authentication is intentionally simple and passwords are stored in plain
  text in `localStorage`. Do **not** use this auth as-is in production.
- The Ollama URL/model live in the backend env only — they are never bundled into the frontend.
- Microphone speech recognition is best supported in Chromium browsers (Chrome/Edge). The app falls
  back to typed input where it isn't available.

---

All rights reserved by Assistran™ 2026
