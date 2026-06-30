# ASSISTRAN — all-in-one container

One Ubuntu container running **Frontend + Backend + MariaDB + Redis** under
supervisord. Your **Ollama** server (and optionally **LiveKit** for A/V) are
external and supplied via environment variables.

```
┌─ container (ubuntu:24.04) ─────────────────────────────┐
│ supervisord ─ mariadb (127.0.0.1:3306)                 │
│             ─ redis   (127.0.0.1:6379)                 │
│             ─ node backend → serves SPA + /api + /ws   │  → :3000
└────────────────────────────────────────────────────────┘
        │ OLLAMA_URL                 │ LIVEKIT_URL (optional)
        ▼                            ▼
   Ollama server               LiveKit SFU (A/V)
```

## Build (from the repo root)
```bash
docker build -t assistran:allinone -f deploy/allinone/Dockerfile .
```

## Run
```bash
docker volume create assistran-db   # persists the database

docker run -d --name assistran -p 8080:3000 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e DB_PASSWORD="$(openssl rand -hex 16)" \
  -e OLLAMA_URL="http://YOUR_OLLAMA_HOST:11434" \
  -e MODEL_NAME="qwen2.5:14b-instruct" \
  -v assistran-db:/var/lib/mysql \
  assistran:allinone
```
Open **http://YOUR_HOST:8080** and check **http://YOUR_HOST:8080/api/health**
(`db.reachable: true`, `ollama.reachable: true`).

### Enable audio/video (optional)
Point at a LiveKit server (see [`../DEPLOY.md`](../DEPLOY.md) to run one) and add:
```bash
  -e LIVEKIT_URL="wss://YOUR_HOST:7443" \
  -e LIVEKIT_API_KEY="assistran_key" \
  -e LIVEKIT_API_SECRET="<same secret as the LiveKit server>"
```
Without these, meetings still work with live translated transcript + chat.

## Environment variables
| Var | Default | Notes |
| --- | --- | --- |
| `OLLAMA_URL` | `http://46.152.253.223:11434` | Your external Ollama server |
| `MODEL_NAME` | `qwen2.5-coder:32b` | Use an instruct model for quality |
| `JWT_SECRET` | dev default | **Set this** to a long random string |
| `DB_PASSWORD` | `assistran` | App DB password (set on first run) |
| `DB_NAME` / `DB_USER` | `assistran` | App database/user |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Internal; leave as-is |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | empty | Enables A/V |

> The container exposes plain **HTTP** on 3000. Browsers require **HTTPS** for the
> microphone, camera and screen-share — put a TLS terminator in front (e.g. the
> Caddy service in [`../docker-compose.yml`](../docker-compose.yml), or your load
> balancer). Translation, chat and transcript work over HTTP for quick testing.

## Operate
```bash
docker logs -f assistran                 # combined service logs
docker exec -it assistran mariadb assistran   # open the DB
docker restart assistran                 # data persists in the assistran-db volume
```

## Notes
- MariaDB data lives in the `assistran-db` volume; set `DB_PASSWORD` before the
  first run (it is applied to the app DB user on every start).
- This single-container setup runs one backend instance — fine for one host.
  To scale horizontally, split services out and keep Redis (the Socket.IO Redis
  adapter is already wired) shared across instances.
