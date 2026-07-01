#!/usr/bin/env bash
# First-run bootstrap for the all-in-one container, then hand off to supervisord.
set -e

DB_NAME="${DB_NAME:-assistran}"
DB_USER="${DB_USER:-assistran}"
DB_PASSWORD="${DB_PASSWORD:-assistran}"

mkdir -p /run/mysqld /etc/mysql /var/lib/mysql
chown -R mysql:mysql /run/mysqld /var/lib/mysql

# Initialize the data directory on first run (e.g. a fresh/empty volume).
if [ ! -d /var/lib/mysql/mysql ]; then
  echo "[entrypoint] initializing MariaDB data directory…"
  mariadb-install-db --user=mysql --datadir=/var/lib/mysql --auth-root-authentication-method=socket >/dev/null
fi

# Idempotent init SQL that MariaDB runs on every start (via --init-file), so the
# app database + user always exist and the password tracks the current env.
cat > /etc/mysql/assistran-init.sql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE OR REPLACE USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
CREATE OR REPLACE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
chmod 644 /etc/mysql/assistran-init.sql

echo "[entrypoint] starting services (MariaDB + Redis + backend)…"
exec "$@"
