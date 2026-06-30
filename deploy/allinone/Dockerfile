# ASSISTRAN — single all-in-one Ubuntu image:
#   Frontend + Backend + MariaDB + Redis + supervisord, in one container.
# Ollama and (optional) LiveKit are EXTERNAL, configured via env vars.
#
# Build from the repo root:
#   docker build -t assistran:allinone -f deploy/allinone/Dockerfile .

# ---------- build stage: compile FE + BE ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci
COPY . .
RUN npm run build

# ---------- runtime stage: Ubuntu with everything ----------
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    FRONTEND_DIST=/app/frontend/dist \
    DB_HOST=127.0.0.1 \
    DB_PORT=3306 \
    DB_NAME=assistran \
    DB_USER=assistran \
    DB_PASSWORD=assistran \
    REDIS_URL=redis://127.0.0.1:6379 \
    PORT=3000

# DB + cache + supervisor + Node 22 runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg tzdata \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs mariadb-server redis-server supervisor \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Prebuilt app + hoisted node_modules from the build stage.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist

# Process supervision + first-run DB bootstrap.
COPY deploy/allinone/supervisord.conf /etc/supervisor/conf.d/assistran.conf
COPY deploy/allinone/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Persist the database across container restarts.
VOLUME ["/var/lib/mysql"]
EXPOSE 3000

# Lightweight container healthcheck against the backend.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
