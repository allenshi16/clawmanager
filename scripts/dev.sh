#!/usr/bin/env bash
set -euo pipefail

# ─── ClawManager Local Dev Mode ─────────────────────────────────────────
# Usage:
#   ./scripts/dev.sh              # Interactive mode (asks what to start)
#   ./scripts/dev.sh pf           # Only start port-forwards (background)
#   ./scripts/dev.sh backend      # Start Go backend with air (hot-reload)
#   ./scripts/dev.sh frontend     # Start Vite dev server (HMR)
#   ./scripts/dev.sh stop         # Stop all dev services
#
# Architecture:
#   Frontend (Vite, port 9002, HMR) ──proxy──> Backend (Go, port 9001, air)
#                                                    │
#                                          kubectl port-forward
#                                                    │
#                                          ┌────┬────┬────┐
#                                          │MySQL│Redis│MinIO│
#                                          └────┴────┴────┘
# ──────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="${SCRIPT_DIR}/.dev-pids"
BACKEND_DIR="${SCRIPT_DIR}/backend"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"
NAMESPACE="clawmanager-system"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()  { echo -e "${CYAN}[dev]${NC} $1"; }
ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }

cleanup_pids() {
  if [ -f "$PID_FILE" ]; then
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
}

save_pid() {
  echo "$1" >> "$PID_FILE"
}

# ─── Stop ────────────────────────────────────────────────────────────────
stop_all() {
  info "Stopping all dev services..."

  # Scale k3s deployment back up
  kubectl scale deployment/clawmanager-app -n "$NAMESPACE" --replicas=1 2>/dev/null || true
  ok "Scaled up k3s clawmanager-app to 1 replica"

  # Kill port-forwards and other background processes
  cleanup_pids
  ok "Stopped all background processes"
  info "Dev mode deactivated"
}

# ─── Port-forward ───────────────────────────────────────────────────────
start_port_forward() {
  info "Starting kubectl port-forwards for k3s services..."

  # Ensure k3s is accessible
  kubectl cluster-info >/dev/null 2>&1 || { err "k3s not accessible. Is the cluster running?"; exit 1; }

  # Scale down k3s backend to avoid DB conflicts
  kubectl scale deployment/clawmanager-app -n "$NAMESPACE" --replicas=0 2>/dev/null || true
  ok "Scaled down k3s clawmanager-app to 0 replicas (avoid DB conflicts)"

  # MySQL
  kubectl port-forward svc/mysql -n "$NAMESPACE" 3306:3306 >/dev/null 2>&1 &
  save_pid $!
  ok "MySQL → localhost:3306"

  # Redis (platform)
  kubectl port-forward svc/clawmanager-redis -n "$NAMESPACE" 6379:6379 >/dev/null 2>&1 &
  save_pid $!
  ok "Redis → localhost:6379"

  # MinIO S3 API
  kubectl port-forward svc/minio -n "$NAMESPACE" 9000:9000 >/dev/null 2>&1 &
  save_pid $!
  ok "MinIO → localhost:9000"

  # Skill scanner (optional, but useful)
  kubectl port-forward svc/skill-scanner -n "$NAMESPACE" 8000:8000 >/dev/null 2>&1 &
  save_pid $!
  ok "skill-scanner → localhost:8000"

  sleep 2

  # Verify port-forwards are alive
  for port in 3306 6379 9000 8000; do
    if ss -tlnp "sport = :$port" 2>/dev/null | grep -q ":$port"; then
      ok "  Port $port is listening"
    else
      warn "  Port $port may not be listening yet (retry in a few seconds)"
    fi
  done
}

# ─── Backend env ─────────────────────────────────────────────────────────
print_backend_env() {
  # Fetch secrets from k3s
  MYSQL_PASS=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.mysql-password}' 2>/dev/null | base64 -d) || MYSQL_PASS="clawreef123"
  JWT_SECRET=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.jwt-secret}' 2>/dev/null | base64 -d) || JWT_SECRET="dev-jwt-secret-key-change-me"
  CONTROL_TOKEN=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.runtime-agent-control-token}' 2>/dev/null | base64 -d) || CONTROL_TOKEN="dev-control-token"
  REPORT_TOKEN=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.runtime-agent-report-token}' 2>/dev/null | base64 -d) || REPORT_TOKEN="dev-report-token"
  MINIO_ACCESS=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.minio-access-key}' 2>/dev/null | base64 -d) || MINIO_ACCESS="minioadmin"
  MINIO_SECRET=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.minio-secret-key}' 2>/dev/null | base64 -d) || MINIO_SECRET="minioadmin123"
  GW_TOKEN=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.openclaw-gateway-token}' 2>/dev/null | base64 -d) || GW_TOKEN="dev-gateway-token"

  cat <<ENV
export SERVER_ADDRESS=":9001"
export SERVER_MODE="debug"
export DB_HOST="localhost"
export DB_PORT="3306"
export DB_USER="clawmanager"
export DB_PASSWORD="${MYSQL_PASS}"
export DB_NAME="clawmanager"
export JWT_SECRET="${JWT_SECRET}"

# K8s: out-of-cluster mode using local kubeconfig
export K8S_MODE="outofcluster"
export K8S_NAMESPACE="${NAMESPACE}"
export K8S_STORAGE_CLASS="local-path"
export KUBECONFIG="${KUBECONFIG:-${HOME}/.kube/config}"

# Runtime pool
export RUNTIME_NAMESPACE="${NAMESPACE}"
export RUNTIME_WORKSPACE_ROOT="/opt/clawmanager/workspaces"
export RUNTIME_SCHEDULER_ENABLED="false"
export RUNTIME_AGENT_CONTROL_TOKEN="${CONTROL_TOKEN}"
export RUNTIME_AGENT_REPORT_TOKEN="${REPORT_TOKEN}"
export PLATFORM_REDIS_URL="redis://:Redis_2026-18@localhost:6379/0"

# Object storage (MinIO)
export OBJECT_STORAGE_ENDPOINT="localhost:9000"
export OBJECT_STORAGE_ACCESS_KEY="${MINIO_ACCESS}"
export OBJECT_STORAGE_SECRET_KEY="${MINIO_SECRET}"
export OBJECT_STORAGE_BUCKET="clawmanager-skills"
export OBJECT_STORAGE_USE_SSL="false"
export OBJECT_STORAGE_FORCE_PATH_STYLE="true"

# Skill scanner (optional, via port-forward)
export SKILL_SCANNER_BASE_URL="http://localhost:8000"
export SKILL_SCANNER_ENABLED="false"

# Gateway token for runtime communication
export OPENCLAW_GATEWAY_TOKEN="${GW_TOKEN}"
ENV
}

# ─── Backend (air) ───────────────────────────────────────────────────────
start_backend() {
  if ! command -v air &>/dev/null; then
    warn "air not found, installing..."
    go install github.com/air-verse/air@latest
    ok "air installed"
  fi

  # Generate env file for the backend
  print_backend_env > "${BACKEND_DIR}/.env.dev"
  ok "Created backend/.env.dev"

  info "Starting Go backend with air (hot-reload) on :9001..."
  info "Edit Go files → auto rebuild & restart"
  cd "$BACKEND_DIR"

  # Create .air.toml if not exists
  if [ ! -f .air.toml ]; then
    cat > .air.toml <<'AIRTOML'
root = "."
testdata_dir = "testdata"
tmp_dir = "tmp"

[build]
  cmd = "go build -o ./tmp/server ./cmd/server"
  bin = "./tmp/server"
  full_bin = "bash -c 'set -a; source .env.dev 2>/dev/null; set +a; exec ./tmp/server'"
  include_ext = ["go", "tpl", "tmpl", "html"]
  exclude_dir = ["tmp", "vendor", "testdata", ".git"]
  exclude_regex = ["_test.go"]
  exclude_unchanged = true
  delay = 500
  stop_on_error = false
  send_interrupt = true
  kill_delay = 500

[log]
  time = true

[color]
  main = "cyan"
  build = "green"
  runner = "yellow"

[misc]
  clean_on_exit = true
AIRTOML
    ok "Created backend/.air.toml"
  fi

  exec air
}

# ─── Frontend (Vite HMR) ────────────────────────────────────────────────
start_frontend() {
  info "Starting Vite dev server on :9002 with HMR..."
  cd "$FRONTEND_DIR"
  exec npm run dev
}

# ─── Status ──────────────────────────────────────────────────────────────
show_status() {
  echo ""
  info "── Dev Mode Status ──────────────────────────────────"
  echo ""

  echo -e "  ${CYAN}Port-forwards:${NC}"
  for port in 3306 6379 9000 8000; do
    if ss -tlnp "sport = :$port" 2>/dev/null | grep -q ":$port"; then
      echo -e "    ${GREEN}✓${NC} Port $port is listening"
    else
      echo -e "    ${RED}✗${NC} Port $port is NOT listening"
    fi
  done

  echo ""
  echo -e "  ${CYAN}Deployments:${NC}"
  kubectl get deployment -n "$NAMESPACE" clawmanager-app -o jsonpath='    clawmanager-app replicas: {.spec.replicas}{"\n"}' 2>/dev/null || true

  echo ""
  echo -e "  ${CYAN}Useful commands:${NC}"
  echo -e "    ./scripts/dev.sh backend    Start Go backend (air, port 9001)"
  echo -e "    ./scripts/dev.sh frontend   Start frontend (Vite, port 9002)"
  echo -e "    ./scripts/dev.sh stop       Stop everything"
  echo ""
}

# ─── Main ────────────────────────────────────────────────────────────────
case "${1:-}" in
  pf)
    start_port_forward
    show_status
    info "Port-forwards running in background. PIDs saved to ${PID_FILE}"
    info "Run './scripts/dev.sh stop' to stop them"
    ;;
  backend)
    start_port_forward 2>/dev/null || true
    start_backend
    ;;
  frontend)
    start_frontend
    ;;
  stop)
    stop_all
    ;;
  status)
    show_status
    ;;
  *)
    # Interactive mode
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     ClawManager Local Dev Mode           ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo "  1) Start everything (port-forward + backend + frontend)"
    echo "  2) Start port-forwards only"
    echo "  3) Start backend only (air hot-reload)"
    echo "  4) Start frontend only (Vite HMR)"
    echo "  5) Stop all dev services"
    echo "  6) Show status"
    echo ""
    read -rp "  Choose [1-6]: " choice

    case "$choice" in
      1)
        start_port_forward
        show_status
        echo ""
        info "Open a new terminal and run:"
        echo "    ./scripts/dev.sh backend"
        echo ""
        info "Open another terminal and run:"
        echo "    ./scripts/dev.sh frontend"
        echo ""
        info "Then visit: http://localhost:9002"
        echo ""
        # Keep script alive to allow Ctrl+C cleanup
        info "Press Ctrl+C to stop port-forwards"
        trap stop_all EXIT INT TERM
        wait
        ;;
      2)
        start_port_forward
        show_status
        info "PIDs saved to ${PID_FILE}. Run './scripts/dev.sh stop' to stop"
        trap stop_all EXIT INT TERM
        wait
        ;;
      3)
        start_port_forward 2>/dev/null || true
        start_backend
        ;;
      4)
        start_frontend
        ;;
      5) stop_all ;;
      6) show_status ;;
      *) err "Invalid choice" ;;
    esac
    ;;
esac
