# ASSISTRAN — on-prem deployment (public IP, self-signed HTTPS)

This stack runs the whole app for real multi-user meetings:

```
Browser ──HTTPS(:443)──> Caddy ──> app (Express: SPA + /api + /socket.io)
                          │                 ├── MariaDB (users/meetings/chat)
                          │                 └── Ollama (translation, external)
   Browser ──WSS(:7443)──> Caddy ──> LiveKit (SFU signaling)
   Browser ──UDP(:3478, :50000-50100)─────> LiveKit (media + TURN)
```

> **Why HTTPS is mandatory:** browsers block camera, microphone and screen-share
> outside a secure context. A self-signed cert on the IP is enough once accepted.

## 1. Prerequisites
- A host with **Docker + Docker Compose v2** and a reachable **public IP**.
- An **Ollama** server reachable from the host, with the model pulled
  (`ollama pull qwen2.5-coder:32b`).
- Firewall open for: **443/tcp**, **7443/tcp**, **7881/tcp**, **3478/udp**, **50000-50100/udp**.

## 2. Configure environment (`../.env`)
```bash
cp ../.env.example ../.env
```
Edit `../.env`:
- `OLLAMA_URL` → your Ollama server; `MODEL_NAME` → an installed model.
- `DB_PASSWORD` → a real password (used by both MariaDB and the app).
- `JWT_SECRET` → a long random string (`openssl rand -hex 32`).
- `LIVEKIT_URL=wss://<PUBLIC_IP>:7443`
- `LIVEKIT_API_KEY=assistran_key`
- `LIVEKIT_API_SECRET=<long random string>`  (`openssl rand -hex 32`)

## 3. Match the LiveKit secret
Edit `livekit.yaml` so the key/secret matches `.env`:
```yaml
keys:
  assistran_key: <the same value as LIVEKIT_API_SECRET>
```

## 4. Generate the self-signed certificate
```bash
chmod +x gen-certs.sh
./gen-certs.sh <PUBLIC_IP>
```

## 5. Start everything
```bash
docker compose up -d --build
```
Check logs: `docker compose logs -f app` (look for "connected and schema ready").

## 6. First-time browser trust (important)
Because the cert is self-signed, each user must accept it **twice**:
1. Open `https://<PUBLIC_IP>` → accept the warning (loads the app).
2. Open `https://<PUBLIC_IP>:7443` → accept the warning (so LiveKit WSS works).

If step 2 is skipped, audio/video silently fails while chat/transcript still work.

## 7. Verify
```bash
curl -k https://<PUBLIC_IP>/api/health
```
Expect `db.reachable: true`, `ollama.reachable: true`, `livekit.configured: true`.

Then: sign up on 2+ devices, one creates a meeting, share the code, others Join —
everyone lands in the **same** room with live translated transcript/chat + A/V.

## Troubleshooting
| Symptom | Fix |
| --- | --- |
| Chat/transcript works but **no video/audio** | Accept the cert at `https://<IP>:7443`; open UDP 3478 + 50000-50100; ensure `use_external_ip: true` in `livekit.yaml`. |
| `livekit.configured: false` in /api/health | `LIVEKIT_URL/KEY/SECRET` not set in `.env` (or secret ≠ `livekit.yaml`). |
| `db.reachable: false` | MariaDB still starting, or `DB_PASSWORD` mismatch between `.env` and the DB volume (recreate volume if you changed it). |
| `model '…' not found` | Pull it on the Ollama server or set `MODEL_NAME` to an installed model. |
| 404/405 on `/api` | You opened the frontend without the backend — always go through `https://<IP>` (Caddy → app). |
| Mic blocked | Use Chrome/Edge and the **https** URL (not http, not a bare IP over http). |

## Scaling notes
- This is a single app instance. For multiple instances, add the **Socket.IO Redis
  adapter** (presence/floor) and run LiveKit as its own cluster.
- For best media connectivity at 50 participants, consider running the `livekit`
  service with **host networking** instead of mapped UDP ports.

## Later: move to a domain
Point a DNS A record at the IP, then in `Caddyfile` remove `auto_https off` and the
`tls` lines, replace `:443`/`:7443` with `yourdomain.com`/`livekit.yourdomain.com`,
and set `LIVEKIT_URL=wss://livekit.yourdomain.com`. Caddy will fetch real certs
automatically and the browser warnings disappear.

## No-Docker alternative (dev / single host)
Run MariaDB + LiveKit yourself, then on the host:
```bash
npm install
npm run build
# serve the built frontend from the backend:
FRONTEND_DIST=$(pwd)/frontend/dist npm start -w backend
```
Set `.env` accordingly. You still need HTTPS in front for camera/mic on remote devices.
