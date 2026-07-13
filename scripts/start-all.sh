#!/usr/bin/env bash
set -euo pipefail

# ClawManager auto-start script — run on boot or manually
# Starts: k3s → port-forwards → backend → frontend
# All processes are backgrounded with nohup, logs in /var/log/clawmanager-*.log

SCRIPT_DIR="/home/allen/project/clawmanager"
NAMESPACE="clawmanager-system"
LOG_DIR="/var/log"
PID_FILE="/var/run/clawmanager-dev.pids"

info()  { echo "[clawmanager] $1"; }
ok()    { echo "[✓] $1"; }
err()   { echo "[✗] $1" >&2; }

# ─── 1. Start k3s ─────────────────────────────────────────────────────────
start_k3s() {
  if kubectl cluster-info >/dev/null 2>&1; then
    ok "k3s already running"
    return 0
  fi
  info "Starting k3s..."
  nohup k3s server > "$LOG_DIR/k3s.log" 2>&1 &
  echo $! >> "$PID_FILE"
  for i in $(seq 1 30); do
    sleep 2
    if kubectl cluster-info >/dev/null 2>&1; then
      ok "k3s started"
      return 0
    fi
  done
  err "k3s failed to start within 60s"
  return 1
}

# ─── 2. Port-forwards ─────────────────────────────────────────────────────
start_port_forwards() {
  info "Starting port-forwards..."

  # Kill existing port-forwards
  pkill -f "kubectl port-forward" 2>/dev/null || true
  sleep 1

  # MySQL
  nohup kubectl port-forward svc/mysql -n "$NAMESPACE" 3306:3306 > "$LOG_DIR/clawmanager-pf-mysql.log" 2>&1 &
  echo $! >> "$PID_FILE"

  # Redis
  nohup kubectl port-forward svc/clawmanager-redis -n "$NAMESPACE" 6379:6379 > "$LOG_DIR/clawmanager-pf-redis.log" 2>&1 &
  echo $! >> "$PID_FILE"

  # MinIO
  nohup kubectl port-forward svc/minio -n "$NAMESPACE" 9000:9000 > "$LOG_DIR/clawmanager-pf-minio.log" 2>&1 &
  echo $! >> "$PID_FILE"

  # Skill scanner
  nohup kubectl port-forward svc/skill-scanner -n "$NAMESPACE" 8000:8000 > "$LOG_DIR/clawmanager-pf-scanner.log" 2>&1 &
  echo $! >> "$PID_FILE"

  sleep 3
  for port in 3306 6379 9000; do
    if nc -z 127.0.0.1 $port 2>/dev/null; then
      ok "Port $port OK"
    else
      err "Port $port not ready"
    fi
  done
}

# ─── 3. Backend ───────────────────────────────────────────────────────────
start_backend() {
  if curl -s -m 3 http://localhost:9001/api/v1/agent-variants >/dev/null 2>&1; then
    ok "Backend already running"
    return 0
  fi

  info "Starting backend..."

  # Fetch secrets from k3s
  local MYSQL_PASS CONTROL_TOKEN REPORT_TOKEN MINIO_ACCESS MINIO_SECRET GW_TOKEN JWT_SECRET
  MYSQL_PASS=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.mysql-password}' 2>/dev/null | base64 -d 2>/dev/null) || MYSQL_PASS="clawreef123"
  JWT_SECRET=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.jwt-secret}' 2>/dev/null | base64 -d 2>/dev/null) || JWT_SECRET="clawreef-dev-secret-key-change-in-production"
  CONTROL_TOKEN=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.runtime-agent-control-token}' 2>/dev/null | base64 -d 2>/dev/null) || CONTROL_TOKEN="dev-control-token"
  REPORT_TOKEN=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.runtime-agent-report-token}' 2>/dev/null | base64 -d 2>/dev/null) || REPORT_TOKEN="dev-report-token"
  MINIO_ACCESS=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.minio-access-key}' 2>/dev/null | base64 -d 2>/dev/null) || MINIO_ACCESS="minioadmin"
  MINIO_SECRET=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.minio-secret-key}' 2>/dev/null | base64 -d 2>/dev/null) || MINIO_SECRET="minioadmin123"
  GW_TOKEN=$(kubectl get secrets -n "$NAMESPACE" clawmanager-secrets -o jsonpath='{.data.openclaw-gateway-token}' 2>/dev/null | base64 -d 2>/dev/null) || GW_TOKEN="dev-gateway-token"

  export SERVER_ADDRESS=":9001"
  export SERVER_MODE="release"
  export DB_HOST="localhost"
  export DB_PORT="3306"
  export DB_USER="clawmanager"
  export DB_PASSWORD="$MYSQL_PASS"
  export DB_NAME="clawmanager"
  export JWT_SECRET="$JWT_SECRET"
  export K8S_MODE="outofcluster"
  export K8S_NAMESPACE="$NAMESPACE"
  export K8S_STORAGE_CLASS="local-path"
  export RUNTIME_NAMESPACE="$NAMESPACE"
  export RUNTIME_WORKSPACE_ROOT="/workspaces"
  export RUNTIME_SCHEDULER_ENABLED="true"
  export RUNTIME_AGENT_CONTROL_TOKEN="$CONTROL_TOKEN"
  export RUNTIME_AGENT_REPORT_TOKEN="$REPORT_TOKEN"
  export PLATFORM_REDIS_URL="redis://:Redis_2026-18@localhost:6379/0"
  export OBJECT_STORAGE_ENDPOINT="localhost:9000"
  export OBJECT_STORAGE_ACCESS_KEY="$MINIO_ACCESS"
  export OBJECT_STORAGE_SECRET_KEY="$MINIO_SECRET"
  export OBJECT_STORAGE_BUCKET="clawmanager-skills"
  export OBJECT_STORAGE_USE_SSL="false"
  export OBJECT_STORAGE_FORCE_PATH_STYLE="true"
  export SKILL_SCANNER_BASE_URL="http://localhost:8000"
  export SKILL_SCANNER_ENABLED="false"
  export OPENCLAW_GATEWAY_TOKEN="$GW_TOKEN"
  export CLAWMANAGER_LLM_GATEWAY_BASE_URL="http://10.42.0.1:9001/api/v1/gateway/llm"

  cd "$SCRIPT_DIR/backend"
  nohup ./bin/server > "$LOG_DIR/clawmanager-server.log" 2>&1 &
  echo $! >> "$PID_FILE"

  for i in $(seq 1 15); do
    sleep 2
    if curl -s -m 3 http://localhost:9001/api/v1/agent-versions >/dev/null 2>&1 || \
       curl -s -m 3 http://localhost:9001/api/v1/agent-variants >/dev/null 2>&1; then
      ok "Backend started"
      return 0
    fi
  done
  err "Backend failed to start within 30s"
  return 1
}

# ─── 4. Frontend ──────────────────────────────────────────────────────────
start_frontend() {
  if curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:9002 2>/dev/null | grep -q "200\|301\|302"; then
    ok "Frontend already running"
    return 0
  fi

  info "Starting frontend..."
  cd "$SCRIPT_DIR/frontend"
  nohup npm run dev > "$LOG_DIR/clawmanager-frontend.log" 2>&1 &
  echo $! >> "$PID_FILE"

  for i in $(seq 1 15); do
    sleep 2
    if curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:9002 2>/dev/null | grep -q "200"; then
      ok "Frontend started"
      return 0
    fi
  done
  err "Frontend failed to start within 30s"
  return 1
}

# ─── Stop all ─────────────────────────────────────────────────────────────
stop_all() {
  info "Stopping ClawManager..."
  if [ -f "$PID_FILE" ]; then
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  pkill -f "kubectl port-forward" 2>/dev/null || true
  pkill -f "bin/server" 2>/dev/null || true
  ok "Stopped"
}

# ─── Main ─────────────────────────────────────────────────────────────────
case "${1:-start}" in
  start)
    : > "$PID_FILE"
    start_k3s
    start_port_forwards
    start_backend
    start_frontend
    ok "ClawManager is running:"
    ok "  Frontend: http://localhost:9002"
    ok "  Backend:  http://localhost:9001"
    ok "  Login:    admin / admin123"
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    sleep 2
    "$0" start
    ;;
  status)
    kubectl cluster-info >/dev/null 2>&1 && ok "k3s: running" || err "k3s: down"
    nc -z 127.0.0.1 3306 2>/dev/null && ok "MySQL port-forward: OK" || err "MySQL: down"
    curl -s -m 3 http://localhost:9001/api/v1/agent-variants >/dev/null 2>&1 && ok "Backend: running" || err "Backend: down"
    curl -s -m 3 -o /dev/null http://localhost:9002 2>/dev/null && ok "Frontend: running" || err "Frontend: down"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
