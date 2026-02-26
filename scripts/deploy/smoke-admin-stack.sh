#!/usr/bin/env bash
set -euo pipefail

SERVER_IP="${SERVER_IP:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-4002}"
BACKEND_PORT="${BACKEND_PORT:-4003}"
BACKEND_HEALTH_PATH="${BACKEND_HEALTH_PATH:-/api}"

curl_code() {
  local url="$1"
  curl -sS -o /dev/null -w "%{http_code}" "$url"
}

echo "==> PM2 status"
pm2 status || true

echo "==> Backend local health"
BACK_LOCAL_URL="http://127.0.0.1:${BACKEND_PORT}${BACKEND_HEALTH_PATH}"
BACK_LOCAL_CODE="$(curl_code "$BACK_LOCAL_URL")"
echo "[$BACK_LOCAL_CODE] $BACK_LOCAL_URL"

echo "==> Admin local health"
ADMIN_LOCAL_URL="http://127.0.0.1:${FRONTEND_PORT}/"
ADMIN_LOCAL_CODE="$(curl_code "$ADMIN_LOCAL_URL")"
echo "[$ADMIN_LOCAL_CODE] $ADMIN_LOCAL_URL"

if [[ "$SERVER_IP" != "127.0.0.1" ]]; then
  echo "==> Public port checks (direct)"
  BACK_PUBLIC_URL="http://${SERVER_IP}:${BACKEND_PORT}${BACKEND_HEALTH_PATH}"
  ADMIN_PUBLIC_URL="http://${SERVER_IP}:${FRONTEND_PORT}/"
  BACK_PUBLIC_CODE="$(curl_code "$BACK_PUBLIC_URL" || true)"
  ADMIN_PUBLIC_CODE="$(curl_code "$ADMIN_PUBLIC_URL" || true)"
  echo "[${BACK_PUBLIC_CODE:-n/a}] $BACK_PUBLIC_URL"
  echo "[${ADMIN_PUBLIC_CODE:-n/a}] $ADMIN_PUBLIC_URL"
fi

if command -v ss >/dev/null 2>&1; then
  echo "==> Listening ports"
  ss -ltnp 2>/dev/null | grep -E ":${BACKEND_PORT}|:${FRONTEND_PORT}" || true
fi

if [[ ! "$BACK_LOCAL_CODE" =~ ^[23] ]] || [[ ! "$ADMIN_LOCAL_CODE" =~ ^[23] ]]; then
  echo "ERROR: admin/back local health checks failed." >&2
  exit 1
fi

echo "SMOKE_OK"
