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
PM2_ECOSYSTEM="${ROOT_DIR}/scripts/deploy/pm2.admin-stack.ecosystem.js"
AUTO_BOOTSTRAP_SERVER="${AUTO_BOOTSTRAP_SERVER:-true}"
AUTO_OPEN_FIREWALL_PORTS="${AUTO_OPEN_FIREWALL_PORTS:-true}"
AUTO_PM2_STARTUP="${AUTO_PM2_STARTUP:-true}"
AUTO_INSTALL_POSTGRES="${AUTO_INSTALL_POSTGRES:-true}"
AUTO_PROVISION_LOCAL_DB="${AUTO_PROVISION_LOCAL_DB:-true}"
AUTO_LOCAL_DB_TRUST_AUTH="${AUTO_LOCAL_DB_TRUST_AUTH:-true}"
HEALTH_CHECK_AFTER_DEPLOY="${HEALTH_CHECK_AFTER_DEPLOY:-true}"
API_HEALTH_PATH="${API_HEALTH_PATH:-/api}"
NODE_MAJOR="${NODE_MAJOR:-20}"
PRISMA_SCHEMA_SYNC_MODE="${PRISMA_SCHEMA_SYNC_MODE:-dbpush}"
PRISMA_DB_FORCE_RESET="${PRISMA_DB_FORCE_RESET:-false}"
RUN_PROFESSIONAL_DEMO_SEED="${RUN_PROFESSIONAL_DEMO_SEED:-true}"
DEFAULT_DB_HOST="${DEFAULT_DB_HOST:-127.0.0.1}"
DEFAULT_DB_PORT="${DEFAULT_DB_PORT:-5432}"
DEFAULT_DB_NAME="${DEFAULT_DB_NAME:-community_dashboard}"
DEFAULT_DB_USER="${DEFAULT_DB_USER:-${SUDO_USER:-${USER:-community}}}"
DEFAULT_DB_SCHEMA="${DEFAULT_DB_SCHEMA:-public}"
DEFAULT_DB_PASSWORD="${DEFAULT_DB_PASSWORD:-community123}"
DEFAULT_DB_SOCKET_DIR="${DEFAULT_DB_SOCKET_DIR:-/var/run/postgresql}"
DEFAULT_JWT_SECRET="${DEFAULT_JWT_SECRET:-change-me-in-dev}"
DETECTED_DB_RUNTIME="false"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: Missing required command: $1" >&2
    exit 1
  }
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

note() {
  echo "==> $*"
}

warn() {
  echo "WARN: $*" >&2
}

info() {
  echo "INFO: $*"
}

run_root() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  elif have_cmd sudo; then
    sudo "$@"
  else
    echo "ERROR: Need root/sudo to run: $*" >&2
    exit 1
  fi
}

ensure_apt_pkg() {
  local pkg="$1"
  dpkg -s "$pkg" >/dev/null 2>&1 || MISSING_APT_PKGS+=("$pkg")
}

get_env_value() {
  local file="$1"
  local key="$2"
  local line
  line="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -n1 || true)"
  line="${line#${key}=}"
  line="${line%\"}"
  line="${line#\"}"
  echo "$line"
}

postgres_psql() {
  local sql="$1"
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    su - postgres -c "psql -v ON_ERROR_STOP=1 -d postgres -tAc \"$sql\""
  elif have_cmd sudo; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres -tAc "$sql"
  else
    echo "ERROR: sudo is required to manage PostgreSQL as postgres user." >&2
    exit 1
  fi
}

postgres_show() {
  local key="$1"
  postgres_psql "SHOW ${key};" | tr -d '[:space:]'
}

detect_postgres_runtime_settings() {
  ensure_postgres_installed_and_running
  require_cmd psql
  local detected_port detected_socket_dirs first_socket_dir
  detected_port="$(postgres_show port || true)"
  detected_socket_dirs="$(postgres_show unix_socket_directories || true)"
  if [[ -n "$detected_port" && "$detected_port" =~ ^[0-9]+$ ]]; then
    DEFAULT_DB_PORT="$detected_port"
  fi
  if [[ -n "$detected_socket_dirs" ]]; then
    first_socket_dir="${detected_socket_dirs%%,*}"
    if [[ -n "$first_socket_dir" && "$first_socket_dir" != "''" ]]; then
      DEFAULT_DB_SOCKET_DIR="$first_socket_dir"
    fi
  fi
  DETECTED_DB_RUNTIME="true"
}

psql_socket_test() {
  local err_file
  err_file="$(mktemp)"
  if psql -w -h "${DEFAULT_DB_SOCKET_DIR}" -p "${DEFAULT_DB_PORT}" -U "${DEFAULT_DB_USER}" -d "${DEFAULT_DB_NAME}" -c "select 1" >/dev/null 2>"$err_file"; then
    rm -f "$err_file"
    return 0
  fi
  echo "---- psql socket test stderr ----" >&2
  cat "$err_file" >&2 || true
  echo "---------------------------------" >&2
  rm -f "$err_file"
  return 1
}

http_head_code() {
  local url="$1"
  curl -sS -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || true
}

restart_postgres_service() {
  if have_cmd systemctl; then
    if ! run_root systemctl restart postgresql; then
      run_root systemctl status postgresql --no-pager -n 80 || true
      echo "ERROR: Failed to restart PostgreSQL after updating pg_hba.conf" >&2
      exit 1
    fi
  elif have_cmd service; then
    if ! run_root service postgresql restart; then
      echo "ERROR: Failed to restart PostgreSQL after updating pg_hba.conf" >&2
      exit 1
    fi
  fi
}

ensure_postgres_installed_and_running() {
  if [[ "$AUTO_INSTALL_POSTGRES" != "true" ]]; then
    return
  fi

  if ! have_cmd psql; then
    if have_cmd apt-get; then
      note "Installing PostgreSQL"
      run_root apt-get update
      run_root apt-get install -y postgresql postgresql-contrib
    else
      warn "psql not found and apt-get unavailable; skipping PostgreSQL install."
      return
    fi
  fi

  if have_cmd systemctl; then
    run_root systemctl enable postgresql >/dev/null 2>&1 || true
    run_root systemctl start postgresql >/dev/null 2>&1 || true
  elif have_cmd service; then
    run_root service postgresql start >/dev/null 2>&1 || true
  fi
}

configure_local_postgres_trust_auth() {
  if [[ "$AUTO_LOCAL_DB_TRUST_AUTH" != "true" ]]; then
    return
  fi
  ensure_postgres_installed_and_running
  require_cmd psql

  local hba_file
  hba_file="$(postgres_show hba_file || true)"
  if [[ -z "$hba_file" || ! -f "$hba_file" ]]; then
    warn "Could not detect pg_hba.conf path. Skipping trust auth bootstrap."
    return
  fi

  note "Configuring PostgreSQL localhost auth to trust (demo mode)"
  run_root cp "$hba_file" "${hba_file}.bak.deploy" || true
  # Rebuild top section deterministically so trust rules always win and duplicates/bad pasted lines are removed.
  local tmp_hba
  tmp_hba="$(mktemp)"
  run_root awk '
    BEGIN {
      print "# CODEX_DEMO_TRUST_RULES";
      print "local   all             all                                     trust";
      print "host    all             all             127.0.0.1/32            trust";
      print "host    all             all             ::1/128                 trust";
    }
    /CODEX_DEMO_TRUST_RULES/ { next }
    /^[[:space:]]*local[[:space:]]+all[[:space:]]+all[[:space:]]+/ { next }
    /^[[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1\/32[[:space:]]+/ { next }
    /^[[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]]+::1\/128[[:space:]]+/ { next }
    /RUN_DEMO_SEEDS=true/ { next }
    /deploy\.sh-d community_dashboa/ { next }
    { print }
  ' "$hba_file" > "$tmp_hba"
  run_root cp "$tmp_hba" "$hba_file"
  rm -f "$tmp_hba"

  restart_postgres_service
}

provision_local_postgres_db() {
  local env_file="$1"
  local force_repair="${2:-false}"
  if [[ "$AUTO_PROVISION_LOCAL_DB" != "true" ]]; then
    return
  fi

  local db_url current_db_url jwt_secret
  current_db_url="$(get_env_value "$env_file" "DATABASE_URL")"
  jwt_secret="$(get_env_value "$env_file" "JWT_ACCESS_SECRET")"

  # For zero-touch demo deployments, use deterministic demo secret (matches local demo defaults)
  # instead of generating a random secret.
  if [[ -z "$jwt_secret" || "$jwt_secret" == "CHANGE_ME_STRONG_SECRET" ]]; then
    note "Applying default demo JWT_ACCESS_SECRET from script defaults"
    upsert_env "$env_file" "JWT_ACCESS_SECRET" "$DEFAULT_JWT_SECRET"
  fi

  # If a real database URL is already set, keep it.
  if [[ "$force_repair" != "true" && -n "$current_db_url" && "$current_db_url" != *"USER:PASSWORD"* ]]; then
    return
  fi

  ensure_postgres_installed_and_running
  if [[ "$DETECTED_DB_RUNTIME" != "true" ]]; then
    detect_postgres_runtime_settings
  fi
  configure_local_postgres_trust_auth
  require_cmd psql

  local db_user db_name db_host db_port db_schema db_pass
  db_user="$DEFAULT_DB_USER"
  db_name="$DEFAULT_DB_NAME"
  db_host="$DEFAULT_DB_HOST"
  db_port="$DEFAULT_DB_PORT"
  db_schema="$DEFAULT_DB_SCHEMA"
  db_pass="$(get_env_value "$env_file" "AUTO_LOCAL_DB_PASSWORD")"
  if [[ -z "$db_pass" ]]; then
    db_pass="$DEFAULT_DB_PASSWORD"
    upsert_env "$env_file" "AUTO_LOCAL_DB_PASSWORD" "$db_pass"
  fi

  note "Provisioning local PostgreSQL database (${db_name}) and user (${db_user})"

  local role_exists db_exists
  role_exists="$(postgres_psql "SELECT 1 FROM pg_roles WHERE rolname='${db_user}'" | tr -d '[:space:]' || true)"
  if [[ "$role_exists" != "1" ]]; then
    postgres_psql "CREATE ROLE ${db_user} LOGIN PASSWORD '${db_pass}'"
  else
    postgres_psql "ALTER ROLE ${db_user} WITH LOGIN PASSWORD '${db_pass}'"
  fi

  db_exists="$(postgres_psql "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | tr -d '[:space:]' || true)"
  if [[ "$db_exists" != "1" ]]; then
    postgres_psql "CREATE DATABASE ${db_name} OWNER ${db_user}"
  fi
  postgres_psql "GRANT ALL PRIVILEGES ON DATABASE ${db_name} TO ${db_user}" >/dev/null || true

  # Zero-touch demo path uses Unix socket (trust auth) to avoid local TCP auth edge-cases on fresh servers.
  db_url="postgresql://${db_user}@localhost:${db_port}/${db_name}?schema=${db_schema}&host=${DEFAULT_DB_SOCKET_DIR}"
  upsert_env "$env_file" "DATABASE_URL" "$db_url"
  upsert_env "$env_file" "DIRECT_URL" "$db_url"
}

auto_mock_provider_flags() {
  local env_file="$1"
  local smtp_host smtp_user smtp_pass twilio_sid twilio_token twilio_num expo_token fcm_json fcm_proj fcm_email fcm_key
  local email_mock sms_mock expo_mock fcm_mock
  smtp_host="$(get_env_value "$env_file" "SMTP_HOST")"
  smtp_user="$(get_env_value "$env_file" "SMTP_USER")"
  smtp_pass="$(get_env_value "$env_file" "SMTP_PASS")"
  twilio_sid="$(get_env_value "$env_file" "TWILIO_ACCOUNT_SID")"
  twilio_token="$(get_env_value "$env_file" "TWILIO_AUTH_TOKEN")"
  twilio_num="$(get_env_value "$env_file" "TWILIO_PHONE_NUMBER")"
  expo_token="$(get_env_value "$env_file" "EXPO_PUSH_ACCESS_TOKEN")"
  fcm_json="$(get_env_value "$env_file" "FCM_SERVICE_ACCOUNT_JSON")"
  fcm_proj="$(get_env_value "$env_file" "FCM_PROJECT_ID")"
  fcm_email="$(get_env_value "$env_file" "FCM_CLIENT_EMAIL")"
  fcm_key="$(get_env_value "$env_file" "FCM_PRIVATE_KEY")"
  email_mock="$(get_env_value "$env_file" "EMAIL_MOCK_MODE")"
  sms_mock="$(get_env_value "$env_file" "TWILIO_MOCK_MODE")"
  expo_mock="$(get_env_value "$env_file" "EXPO_PUSH_MOCK_MODE")"
  fcm_mock="$(get_env_value "$env_file" "FCM_MOCK_MODE")"

  if [[ -z "$email_mock" && ( -z "$smtp_host" || -z "$smtp_user" || -z "$smtp_pass" ) ]]; then
    upsert_env "$env_file" "EMAIL_MOCK_MODE" "true"
  fi
  if [[ -z "$sms_mock" && ( -z "$twilio_sid" || -z "$twilio_token" || -z "$twilio_num" ) ]]; then
    upsert_env "$env_file" "TWILIO_MOCK_MODE" "true"
  fi
  if [[ -z "$expo_mock" && -z "$expo_token" ]]; then
    upsert_env "$env_file" "EXPO_PUSH_MOCK_MODE" "true"
  fi
  if [[ -z "$fcm_mock" && -z "$fcm_json" && ( -z "$fcm_proj" || -z "$fcm_email" || -z "$fcm_key" ) ]]; then
    upsert_env "$env_file" "FCM_MOCK_MODE" "true"
  fi
}

bootstrap_server() {
  if [[ "$AUTO_BOOTSTRAP_SERVER" != "true" ]]; then
    return
  fi

  if ! have_cmd apt-get; then
    echo "==> Skipping server bootstrap (apt-get not found)."
    return
  fi

  note "Bootstrapping server prerequisites (apt + node + pm2)"
  run_root apt-get update

  MISSING_APT_PKGS=()
  ensure_apt_pkg curl
  ensure_apt_pkg git
  ensure_apt_pkg build-essential
  if [[ ${#MISSING_APT_PKGS[@]} -gt 0 ]]; then
    run_root apt-get install -y "${MISSING_APT_PKGS[@]}"
  fi

  if ! have_cmd node || ! have_cmd npm; then
    note "Installing Node.js ${NODE_MAJOR}.x"
    run_root bash -lc "curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -"
    run_root apt-get install -y nodejs
  fi

  if ! have_cmd pm2; then
    note "Installing PM2 globally"
    run_root npm i -g pm2
  fi

  if [[ "$AUTO_OPEN_FIREWALL_PORTS" == "true" ]] && have_cmd ufw; then
    local ufw_state
    ufw_state="$(run_root ufw status 2>/dev/null | head -n1 || true)"
    if echo "$ufw_state" | grep -qi "Status: active"; then
      note "Opening firewall ports ${FRONTEND_PORT}/${BACKEND_PORT} (UFW)"
      run_root ufw allow "${FRONTEND_PORT}/tcp" >/dev/null || true
      run_root ufw allow "${BACKEND_PORT}/tcp" >/dev/null || true
    fi
  fi
}

upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped_value
  escaped_value="$(printf '%s' "$value" | sed 's/[&]/\\&/g')"
  if grep -qE "^${key}=" "$file"; then
    sed -i "s#^${key}=.*#${key}=${escaped_value}#g" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

source_env_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "ERROR: Env file not found: $file" >&2
    exit 1
  fi
  # Parse KEY=VALUE lines safely (handles values containing '&', '?', etc.)
  eval "$(
    python3 - "$file" <<'PY'
import sys, shlex
import re
from pathlib import Path

for raw in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in raw:
        continue
    k, v = raw.split("=", 1)
    k = k.strip()
    # Skip malformed env entries (for example leaked PEM/newline fragments).
    if not k or not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", k):
        continue
    print(f"export {k}={shlex.quote(v)}")
PY
  )"
}

sync_env_key_from_example() {
  local target_file="$1"
  local example_file="$2"
  local key="$3"
  local example
  example="$(get_env_value "$example_file" "$key")"
  if [[ -n "$example" ]]; then
    upsert_env "$target_file" "$key" "$example"
  fi
}

bootstrap_server

note "Validating tooling"
require_cmd node
require_cmd npm
require_cmd pm2

note "Preparing production env files"
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

# Backfill Firebase push/auth envs from example when production file has empty values.
sync_env_key_from_example "$ROOT_ENV_PROD" "$ROOT_ENV_PROD_EXAMPLE" "FCM_PROJECT_ID"
sync_env_key_from_example "$ROOT_ENV_PROD" "$ROOT_ENV_PROD_EXAMPLE" "FCM_CLIENT_EMAIL"
sync_env_key_from_example "$ROOT_ENV_PROD" "$ROOT_ENV_PROD_EXAMPLE" "FCM_PRIVATE_KEY"
sync_env_key_from_example "$ROOT_ENV_PROD" "$ROOT_ENV_PROD_EXAMPLE" "RESEND_API_KEY"
sync_env_key_from_example "$ROOT_ENV_PROD" "$ROOT_ENV_PROD_EXAMPLE" "RESEND_FROM_EMAIL"
if [[ -n "$(get_env_value "$ROOT_ENV_PROD" "FCM_PROJECT_ID")" && -n "$(get_env_value "$ROOT_ENV_PROD" "FCM_CLIENT_EMAIL")" && -n "$(get_env_value "$ROOT_ENV_PROD" "FCM_PRIVATE_KEY")" ]]; then
  upsert_env "$ROOT_ENV_PROD" "FCM_MOCK_MODE" "false"
  upsert_env "$ROOT_ENV_PROD" "SMS_OTP_ENABLED" "true"
  note "Firebase OTP auto-enabled from env"
fi
if [[ -n "$(get_env_value "$ROOT_ENV_PROD" "RESEND_API_KEY")" ]]; then
  upsert_env "$ROOT_ENV_PROD" "EMAIL_MOCK_MODE" "false"
fi

provision_local_postgres_db "$ROOT_ENV_PROD"
auto_mock_provider_flags "$ROOT_ENV_PROD"

if grep -q "CHANGE_ME_STRONG_SECRET" "$ROOT_ENV_PROD"; then
  echo "ERROR: JWT_ACCESS_SECRET could not be generated automatically. Update $ROOT_ENV_PROD." >&2
  exit 1
fi
if grep -q "USER:PASSWORD" "$ROOT_ENV_PROD"; then
  echo "ERROR: DATABASE_URL/DIRECT_URL could not be provisioned automatically. Update $ROOT_ENV_PROD." >&2
  exit 1
fi

note "Installing backend dependencies"
cd "$ROOT_DIR"
npm ci

note "Building backend"
source_env_file "$ROOT_ENV_PROD"
detect_postgres_runtime_settings
if ! psql_socket_test; then
  warn "Local DB login test failed for ${DEFAULT_DB_USER}@${DEFAULT_DB_HOST}:${DEFAULT_DB_PORT}. Re-provisioning local DB credentials + demo trust auth."
  provision_local_postgres_db "$ROOT_ENV_PROD" true
  source_env_file "$ROOT_ENV_PROD"
  configure_local_postgres_trust_auth
fi

# Final hard fail with diagnosis if local TCP auth is still broken after trust setup.
if ! psql_socket_test; then
  warn "PostgreSQL local socket auth still failing after trust setup. Showing first localhost auth rules:"
  HBA_FILE_NOW="$(postgres_show hba_file || true)"
  if [[ -n "${HBA_FILE_NOW:-}" ]]; then
    run_root grep -nE 'CODEX_DEMO_TRUST_RULES|127\.0\.0\.1/32|::1/128|local[[:space:]]+all[[:space:]]+all' "$HBA_FILE_NOW" | head -n 20 || true
  fi
  echo "ERROR: PostgreSQL local auth bootstrap failed; aborting before Prisma." >&2
  exit 1
fi
npm run prisma:generate
if [[ "$PRISMA_SCHEMA_SYNC_MODE" == "migrate" ]]; then
  note "Applying Prisma migrations (migrate deploy)"
  npx prisma migrate deploy
else
  note "Syncing Prisma schema directly (db push)"
  if [[ "$PRISMA_DB_FORCE_RESET" == "true" ]]; then
    npx prisma db push --force-reset --accept-data-loss
  else
    npx prisma db push
  fi
fi
npm run build

if [[ "${RUN_DEMO_SEEDS:-false}" == "true" || "${RUN_DASHBOARD_LOAD_SEED:-false}" == "true" ]]; then
  note "Running baseline Prisma seed"
  source_env_file "$ROOT_ENV_PROD"
  npx prisma db seed
fi

if [[ "${RUN_DEMO_SEEDS:-false}" == "true" ]]; then
  note "Seeding demo personas"
  source_env_file "$ROOT_ENV_PROD"
  npm run seed:mobile-personas
fi
if [[ "${RUN_DASHBOARD_LOAD_SEED:-false}" == "true" ]]; then
  note "Seeding realistic dashboard load data"
  source_env_file "$ROOT_ENV_PROD"
  npm run seed:dashboard-load
fi

if [[ "${RUN_PROFESSIONAL_DEMO_SEED:-true}" == "true" ]]; then
  note "Seeding professional demo dataset (fresh reset + Egyptian personas)"
  source_env_file "$ROOT_ENV_PROD"
  if [[ "${NODE_ENV:-}" == "production" && "${ALLOW_DEMO_RESET:-false}" != "true" ]]; then
    echo "ERROR: Refusing demo reset on NODE_ENV=production without ALLOW_DEMO_RESET=true" >&2
    exit 1
  fi
  npm run seed:mobile-personas
  npm run seed:professional-demo
fi

note "Installing admin-web dependencies"
cd "$ROOT_DIR/apps/admin-web"
# Admin preview runs through Vite, which is a devDependency.
# Force-install dev dependencies regardless of NODE_ENV on the host.
npm ci --include=dev

note "Building admin-web (API: $API_URL)"
source_env_file "$ADMIN_ENV_PROD"
npm run build

note "Starting / reloading PM2 apps"
cd "$ROOT_DIR"
pm2 delete community-backend >/dev/null 2>&1 || true
pm2 delete community-admin-web >/dev/null 2>&1 || true
pm2 delete pm2.admin-stack.ecosystem >/dev/null 2>&1 || true
pm2 delete pm2.admin-stack.ecosystem.cjs >/dev/null 2>&1 || true
pm2 delete pm2.admin-stack.ecosystem.js >/dev/null 2>&1 || true

source_env_file "$ROOT_ENV_PROD"
BACKEND_ENTRY="$ROOT_DIR/dist/main.js"
if [[ ! -f "$BACKEND_ENTRY" && -f "$ROOT_DIR/dist/src/main.js" ]]; then
  BACKEND_ENTRY="$ROOT_DIR/dist/src/main.js"
fi
if [[ ! -f "$BACKEND_ENTRY" ]]; then
  echo "ERROR: Backend entry not found (checked dist/main.js and dist/src/main.js)." >&2
  exit 1
fi

PORT="$BACKEND_PORT" pm2 start "$BACKEND_ENTRY" \
  --name community-backend \
  --cwd "$ROOT_DIR" \
  --time \
  --update-env

source_env_file "$ADMIN_ENV_PROD"
pm2 start npm \
  --name community-admin-web \
  --cwd "$ROOT_DIR/apps/admin-web" \
  --time \
  --update-env \
  -- run preview -- --host 0.0.0.0 --port "$FRONTEND_PORT"
pm2 save

if [[ "$AUTO_PM2_STARTUP" == "true" ]]; then
  if have_cmd systemctl; then
    note "Ensuring PM2 startup (systemd)"
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
      PM2_STARTUP_USER="${SUDO_USER:-root}"
      PM2_STARTUP_HOME="${HOME:-/root}"
      pm2 startup systemd -u "${PM2_STARTUP_USER}" --hp "${PM2_STARTUP_HOME}" >/dev/null 2>&1 || true
    else
      run_root env "PATH=$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true
    fi
    pm2 save >/dev/null 2>&1 || true
  fi
fi

if [[ "$HEALTH_CHECK_AFTER_DEPLOY" == "true" ]]; then
  note "Running post-deploy health checks"
  sleep 2
  BACKEND_LOCAL_CODE="$(http_head_code "http://127.0.0.1:${BACKEND_PORT}${API_HEALTH_PATH}")"
  ADMIN_LOCAL_CODE="$(http_head_code "http://127.0.0.1:${FRONTEND_PORT}/")"
  if [[ "$BACKEND_LOCAL_CODE" =~ ^[23] ]] && [[ "$ADMIN_LOCAL_CODE" =~ ^[23] ]]; then
    info "Local health checks passed (backend=${BACKEND_LOCAL_CODE}, admin=${ADMIN_LOCAL_CODE})"
  else
    warn "Local health checks not fully passing (backend=${BACKEND_LOCAL_CODE:-n/a}, admin=${ADMIN_LOCAL_CODE:-n/a})"
    if have_cmd ss; then
      info "Listening ports snapshot:"
      ss -ltnp 2>/dev/null | grep -E ":${BACKEND_PORT}|:${FRONTEND_PORT}" || true
    fi
    warn "Inspect PM2 logs if needed: pm2 logs community-backend / pm2 logs community-admin-web"
  fi
fi

echo ""
echo "Deployment complete."
echo "Admin URL   : $ADMIN_URL"
echo "Backend URL : $API_URL"
echo "Swagger     : ${API_URL}/api"
echo "Server IP   : ${SERVER_IP}"
echo "Env file    : ${ROOT_ENV_PROD}"
echo "Admin env   : ${ADMIN_ENV_PROD}"
echo "Note        : Provider mocks auto-enabled when credentials are missing."
echo "Health      : http://127.0.0.1:${BACKEND_PORT}${API_HEALTH_PATH} | http://127.0.0.1:${FRONTEND_PORT}/"
echo ""
echo "PM2 status:"
pm2 status
