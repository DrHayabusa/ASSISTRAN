#!/usr/bin/env bash
# Generate a self-signed TLS certificate for a public IP (no domain).
# Usage:  ./gen-certs.sh <PUBLIC_IP>
set -euo pipefail

IP="${1:-}"
if [ -z "$IP" ]; then
  echo "Usage: $0 <PUBLIC_IP>" >&2
  exit 1
fi

mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout certs/assistran.key \
  -out certs/assistran.crt \
  -subj "/CN=$IP" \
  -addext "subjectAltName=IP:$IP"

echo "Created certs/assistran.crt and certs/assistran.key for IP $IP"
echo "Browsers will warn it's self-signed — accept it for https://$IP AND https://$IP:7443"
