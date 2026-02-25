#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

SERVER_IP="${SERVER_IP:-108.61.174.92}"
FRONTEND_PORT="${FRONTEND_PORT:-4002}"
BACKEND_PORT="${BACKEND_PORT:-4003}"
API_URL="${API_URL:-http://${SERVER_IP}:${BACKEND_PORT}}"
ADMIN_URL="${ADMIN_URL:-http://${SERVER_IP}:${FRONTEND_PORT}}"

ROOT_ENV_PROD="${ROOT_DIR}/.env.production"
ROOT_ENV_PROD_EXAMPLE="${ROOT_DIR}/.env.production.example"
ADMIN_ENV_PROD="${ROOT_DIR}/apps/admin-web/.env.production"
ADMIN_ENV_PROD_EXAMPLE="${ROOT_DIR}/apps/admin-web/.env.production.example"
PM2_ECOSYSTEM="${ROOT_DIR}/scripts/deploy/pm2.admin-stack.ecosystem.cjs"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: Missing required command: $1" >&2
    exit 1
  }
}

upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -qE "^${key}=" "$file"; then
    sed -i "s#^${key}=.*#${key}=${value}#g" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

echo "==> Validating tooling"
require_cmd node
require_cmd npm
require_cmd pm2

echo "==> Preparing production env files"
if [[ ! -f "$ROOT_ENV_PROD" ]]; then
  cp "$ROOT_ENV_PROD_EXAMPLE" "$ROOT_ENV_PROD"
  echo "Created $ROOT_ENV_PROD from example."
fi
if [[ ! -f "$ADMIN_ENV_PROD" ]]; then
  cp "$ADMIN_ENV_PROD_EXAMPLE" "$ADMIN_ENV_PROD"
  echo "Created $ADMIN_ENV_PROD from example."
fi

upsert_env "$ROOT_ENV_PROD" "PORT" "$BACKEND_PORT"
upsert_env "$ROOT_ENV_PROD" "CORS_ORIGIN" "$ADMIN_URL"
upsert_env "$ROOT_ENV_PROD" "FRONTEND_URL" "$ADMIN_URL"
upsert_env "$ADMIN_ENV_PROD" "VITE_API_BASE_URL" "$API_URL"

if grep -q "CHANGE_ME_STRONG_SECRET" "$ROOT_ENV_PROD"; then
  echo "ERROR: Update JWT_ACCESS_SECRET in $ROOT_ENV_PROD before deployment." >&2
  exit 1
fi
if grep -q "USER:PASSWORD" "$ROOT_ENV_PROD"; then
  echo "ERROR: Update DATABASE_URL and DIRECT_URL in $ROOT_ENV_PROD before deployment." >&2
  exit 1
fi

echo "==> Installing backend dependencies"
cd "$ROOT_DIR"
npm ci

echo "==> Building backend"
npm run prisma:generate
npx prisma migrate deploy
npm run build

if [[ "${RUN_DEMO_SEEDS:-false}" == "true" ]]; then
  echo "==> Seeding demo personas"
  npm run seed:mobile-personas
fi
if [[ "${RUN_DASHBOARD_LOAD_SEED:-false}" == "true" ]]; then
  echo "==> Seeding realistic dashboard load data"
  npm run seed:dashboard-load
fi

echo "==> Installing admin-web dependencies"
cd "$ROOT_DIR/apps/admin-web"
npm ci

echo "==> Building admin-web (API: $API_URL)"
set -a
source "$ADMIN_ENV_PROD"
set +a
npm run build

echo "==> Starting / reloading PM2 apps"
cd "$ROOT_DIR"
BACKEND_PORT="$BACKEND_PORT" FRONTEND_PORT="$FRONTEND_PORT" \
  pm2 startOrReload "$PM2_ECOSYSTEM" --env production
pm2 save

echo ""
echo "Deployment complete."
echo "Admin URL   : $ADMIN_URL"
echo "Backend URL : $API_URL"
echo "Swagger     : ${API_URL}/api"
echo ""
echo "PM2 status:"
pm2 status

