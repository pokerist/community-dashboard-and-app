#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/scripts/deploy/deploy-admin-stack.sh"

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [options]

Ubuntu deploy helper for backend + admin-web (PM2 + Prisma + optional seed).

Options:
  --server-ip <ip>         Public server IP used to build API/Admin URLs
  --backend-port <port>    Backend port (default: 4003)
  --frontend-port <port>   Admin web port (default: 4002)
  --api-url <url>          Override API base URL (example: https://api.example.com)
  --admin-url <url>        Override Admin URL (example: https://admin.example.com)
  --node-major <version>   Node major for bootstrap (default: 20)
  --reset-db               Force prisma db push reset
  --demo-data              Run demo persona/professional seeds (sets ALLOW_DEMO_RESET=true)
  --no-bootstrap           Skip apt/node/pm2 bootstrap
  --no-postgres-install    Skip PostgreSQL auto-install/provision
  -h, --help               Show this help

Examples:
  ./deploy.sh
  ./deploy.sh --server-ip 203.0.113.10 --backend-port 3001 --frontend-port 4002
  ./deploy.sh --demo-data --reset-db
EOF
}

# Safe defaults for fresh Ubuntu deploys.
: "${BACKEND_PORT:=4003}"
: "${FRONTEND_PORT:=4002}"
: "${NODE_MAJOR:=20}"
: "${AUTO_BOOTSTRAP_SERVER:=true}"
: "${AUTO_OPEN_FIREWALL_PORTS:=true}"
: "${AUTO_PM2_STARTUP:=true}"
: "${AUTO_INSTALL_POSTGRES:=true}"
: "${AUTO_PROVISION_LOCAL_DB:=true}"
: "${AUTO_LOCAL_DB_TRUST_AUTH:=true}"
: "${HEALTH_CHECK_AFTER_DEPLOY:=true}"

# Keep production-safe default: no destructive reset/demo data unless explicitly requested.
: "${PRISMA_DB_FORCE_RESET:=false}"
: "${RUN_DEMO_SEEDS:=false}"
: "${RUN_DASHBOARD_LOAD_SEED:=false}"
: "${RUN_PROFESSIONAL_DEMO_SEED:=false}"
: "${ALLOW_DEMO_RESET:=false}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-ip)
      SERVER_IP="${2:-}"; shift 2 ;;
    --backend-port)
      BACKEND_PORT="${2:-}"; shift 2 ;;
    --frontend-port)
      FRONTEND_PORT="${2:-}"; shift 2 ;;
    --api-url)
      API_URL="${2:-}"; shift 2 ;;
    --admin-url)
      ADMIN_URL="${2:-}"; shift 2 ;;
    --node-major)
      NODE_MAJOR="${2:-}"; shift 2 ;;
    --reset-db)
      PRISMA_DB_FORCE_RESET="true"; shift ;;
    --demo-data)
      RUN_PROFESSIONAL_DEMO_SEED="true"
      RUN_DEMO_SEEDS="true"
      RUN_DASHBOARD_LOAD_SEED="true"
      ALLOW_DEMO_RESET="true"
      shift ;;
    --no-bootstrap)
      AUTO_BOOTSTRAP_SERVER="false"; shift ;;
    --no-postgres-install)
      AUTO_INSTALL_POSTGRES="false"
      AUTO_PROVISION_LOCAL_DB="false"
      shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "ERROR: Unknown option: $1" >&2
      usage
      exit 1 ;;
  esac
done

echo "==> Deploy configuration"
echo "    BACKEND_PORT=${BACKEND_PORT}"
echo "    FRONTEND_PORT=${FRONTEND_PORT}"
echo "    NODE_MAJOR=${NODE_MAJOR}"
echo "    PRISMA_DB_FORCE_RESET=${PRISMA_DB_FORCE_RESET}"
echo "    RUN_PROFESSIONAL_DEMO_SEED=${RUN_PROFESSIONAL_DEMO_SEED}"

"${DEPLOY_SCRIPT}"
