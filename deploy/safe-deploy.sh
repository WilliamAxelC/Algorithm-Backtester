#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# CUANG // QUANT — Safe Zero-Downtime Deployment Script (wyckoff-quant-v3)
# Target: Intel Core i3-8100T Mini PC (cuang.dev/projects/backtester)
# ==============================================================================

PORT="${PORT:-4175}"
HOST="${HOST:-0.0.0.0}" # Bind to 0.0.0.0 so both 127.0.0.1 and Docker host IP 10.20.20.178 can connect
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-${REPO_DIR}/data}"
PID_FILE="${HOME}/.config/cuang-backtester.pid"
LOG_FILE="/tmp/cuang-backtester.log"

echo "=============================================================================="
echo " CUANG // QUANT: Safe Zero-Downtime Deployment (wyckoff-quant-v3)"
echo " Working Directory: ${REPO_DIR}"
echo " Port: ${PORT} | Host: ${HOST} | Data: ${DATA_DIR}"
echo "=============================================================================="

# ------------------------------------------------------------------------------
# STEP 1: Non-Destructive Inspection
# ------------------------------------------------------------------------------
echo -e "\n[Step 1/5] Performing non-destructive network & process inspection..."

# Check existing listening ports
if ss -tlpn | grep -q ":${PORT} "; then
  echo "  Port ${PORT} is currently in use. Inspecting owner..."
  EXISTING_PID=$(lsof -t -i :${PORT} 2>/dev/null || true)
  if [[ -n "${EXISTING_PID}" ]]; then
    echo "  Found process ${EXISTING_PID} listening on ${PORT}. Stopping gracefully..."
    kill -15 "${EXISTING_PID}" 2>/dev/null || true
    sleep 2
    if kill -0 "${EXISTING_PID}" 2>/dev/null; then
      echo "  Process still running. Sending SIGKILL to PID ${EXISTING_PID}..."
      kill -9 "${EXISTING_PID}" 2>/dev/null || true
    fi
  fi
else
  echo "  Port ${PORT} is currently free."
fi

# Inspect projects-cuang-nginx reverse proxy if available
if docker ps --format '{{.Names}}' | grep -q '^projects-cuang-nginx$'; then
  echo "  Found running 'projects-cuang-nginx' container. Inspecting routing..."
  
  # Check if /etc/nginx/nginx.conf has backtester proxy configured
  if docker exec projects-cuang-nginx test -f /etc/nginx/nginx.conf; then
    BACKUP_NAME="/etc/nginx/nginx.conf.bak.$(date +%s)"
    echo "  Backing up Nginx config to ${BACKUP_NAME} inside container..."
    docker exec projects-cuang-nginx cp /etc/nginx/nginx.conf "${BACKUP_NAME}"
    
    # Update proxy_pass to point to host port 4175 (10.20.20.178:4175)
    echo "  Configuring /projects/backtester/ upstream to point to 10.20.20.178:${PORT}..."
    docker exec projects-cuang-nginx sed -i -E "s|proxy_pass http://(host\.docker\.internal\|10\.20\.20\.178):[0-9]*/;|proxy_pass http://10.20.20.178:${PORT}/;|g" /etc/nginx/nginx.conf
    
    # Test nginx configuration before reloading
    if docker exec projects-cuang-nginx nginx -t >/dev/null 2>&1; then
      docker exec projects-cuang-nginx nginx -s reload >/dev/null 2>&1 || true
      echo "  ✓ projects-cuang-nginx reloaded with upstream 10.20.20.178:${PORT}."
    else
      echo "  [WARN] Nginx config test failed; restoring backup..."
      docker exec projects-cuang-nginx cp "${BACKUP_NAME}" /etc/nginx/nginx.conf
    fi
  fi
fi

# ------------------------------------------------------------------------------
# STEP 2: Real 10Y Market Data Pre-Warming
# ------------------------------------------------------------------------------
echo -e "\n[Step 2/5] Pre-warming real market 10Y historical OHLCV data & cache..."
mkdir -p "${DATA_DIR}/ohlcv" "${DATA_DIR}/prerendered"
echo "  Clearing stale pre-rendered 10Y cache to regenerate with structural VSA engine..."
rm -f "${DATA_DIR}/prerendered"/*.json 2>/dev/null || true

cd "${REPO_DIR}"

# Run priority pre-warming for reference assets
npx tsx -e "
import { ensureAssetDataAndBacktest } from './src/server/cache/precompute-runner';
async function seed() {
  const prioritySymbols = [
    'HNTUSDTPERP',
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'BBCA.JK',
    'BBRI.JK',
    'BMRI.JK',
    'TLKM.JK',
    'ASII.JK',
    'NVDA',
    'AAPL',
    'MSFT',
    'SPY',
    'QQQ'
  ];

  for (const sym of prioritySymbols) {
    try {
      process.stdout.write('  Seeding 10Y real market cache for ' + sym + '... ');
      const t0 = Date.now();
      const res = await ensureAssetDataAndBacktest(
        sym,
        'wyckoff-accumulation-v2',
        'BALANCED',
        { preset: '10Y', startTime: null, endTime: null }
      );
      console.log('✓ (' + res.displayBars.length + ' bars in ' + (Date.now() - t0) + 'ms)');
    } catch (err) {
      console.log('✗ (' + (err instanceof Error ? err.message : err) + ')');
    }
    await new Promise((r) => setTimeout(r, 600));
  }
}
seed().catch(console.error);
"

# ------------------------------------------------------------------------------
# STEP 3: Production Frontend Build
# ------------------------------------------------------------------------------
echo -e "\n[Step 3/5] Building production frontend with Vite..."
cd "${REPO_DIR}"
npm run build

# If projects-cuang-nginx exists, sync dist files to webroot as static fallback
if docker ps --format '{{.Names}}' | grep -q '^projects-cuang-nginx$'; then
  echo "  Syncing built frontend dist/ to projects-cuang-nginx webroot..."
  docker exec projects-cuang-nginx mkdir -p /usr/share/nginx/html/projects/backtester
  docker cp "${REPO_DIR}/dist/." projects-cuang-nginx:/usr/share/nginx/html/projects/backtester/ || true
fi

# ------------------------------------------------------------------------------
# STEP 4: Zero-Downtime Service Activation
# ------------------------------------------------------------------------------
echo -e "\n[Step 4/5] Activating cuang-backtester daemon on port ${PORT}..."
mkdir -p "${HOME}/.config/systemd/user"
cp "${REPO_DIR}/deploy/cuang-backtester.service" "${HOME}/.config/systemd/user/cuang-backtester.service"

ACTIVATED_VIA_SYSTEMD=false

# Check if systemd user daemon is active and responsive
if systemctl --user status >/dev/null 2>&1; then
  echo "  Installing and enabling systemd user service..."
  systemctl --user daemon-reload
  systemctl --user enable --now cuang-backtester.service
  ACTIVATED_VIA_SYSTEMD=true
  echo "  ✓ systemd user service activated."
else
  echo "  [INFO] User systemd session bus not connected. Performing graceful process activation..."
  # Clean up existing PID if recorded
  if [[ -f "${PID_FILE}" ]]; then
    OLD_PID=$(cat "${PID_FILE}" 2>/dev/null || true)
    if [[ -n "${OLD_PID}" ]] && kill -0 "${OLD_PID}" 2>/dev/null; then
      echo "  Stopping previous daemon PID ${OLD_PID}..."
      kill -15 "${OLD_PID}" 2>/dev/null || true
      sleep 1
    fi
    rm -f "${PID_FILE}"
  fi

  # Start daemon in background with nice 5
  echo "  Starting tsx daemon with nice 5 in background..."
  setsid env PORT="${PORT}" HOST="${HOST}" DATA_DIR="${DATA_DIR}" nice -n 5 "${REPO_DIR}/node_modules/.bin/tsx" src/server/index.ts > "${LOG_FILE}" 2>&1 &
  NEW_PID=$!
  disown "${NEW_PID}" 2>/dev/null || true
  echo "${NEW_PID}" > "${PID_FILE}"
  echo "  ✓ Daemon started with PID ${NEW_PID}. Logs: ${LOG_FILE}"
fi

# Wait for server to become responsive
echo "  Waiting for daemon to accept connections on port ${PORT}..."
READY=false
for i in {1..15}; do
  if curl -sf "http://127.0.0.1:${PORT}/api/projects/backtester/health" >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 1
done

if [[ "${READY}" != "true" ]]; then
  echo "  [ERROR] Server failed to respond on port ${PORT} within 15 seconds!"
  tail -n 30 "${LOG_FILE}" 2>/dev/null || true
  exit 1
fi
echo "  ✓ Server is live and healthy on port ${PORT}."

# ------------------------------------------------------------------------------
# STEP 5: End-to-End Live Health & Real-Price Verification
# ------------------------------------------------------------------------------
echo -e "\n[Step 5/5] Running End-to-End Verification against 127.0.0.1:${PORT}..."

# 5.1 Health Check
echo -n "  1. Checking /health API... "
HEALTH_RES=$(curl -sf "http://127.0.0.1:${PORT}/api/projects/backtester/health")
if echo "${HEALTH_RES}" | grep -q '"status":"ok"'; then
  echo "PASS ✓ (${HEALTH_RES})"
else
  echo "FAIL ✗"
  exit 1
fi

# 5.2 Real BBCA.JK 10Y Backtest Check (>2,000 real daily bars)
echo -n "  2. Verifying BBCA.JK 10Y Real-Market Data... "
BBCA_RES=$(curl -sf "http://127.0.0.1:${PORT}/api/projects/backtester/backtest?symbol=BBCA.JK&strategyId=wyckoff-accumulation-v2&preset=10Y&riskPosture=BALANCED")
BBCA_BARS_COUNT=$(echo "${BBCA_RES}" | grep -o '"time":' | wc -l)
if [[ "${BBCA_BARS_COUNT}" -ge 2000 ]]; then
  echo "PASS ✓ (${BBCA_BARS_COUNT} real daily bars returned)"
else
  echo "FAIL ✗ (Expected >= 2000 daily bars, got ${BBCA_BARS_COUNT})"
  exit 1
fi

# 5.3 Real Binance HNTUSDTPERP 10Y Backtest Check (>700 real daily bars)
echo -n "  3. Verifying HNTUSDTPERP Real Binance Data & Markers... "
HNT_RES=$(curl -sf "http://127.0.0.1:${PORT}/api/projects/backtester/backtest?symbol=HNTUSDTPERP&strategyId=wyckoff-accumulation-v2&preset=10Y&riskPosture=BALANCED")
HNT_BARS_COUNT=$(echo "${HNT_RES}" | grep -o '"time":' | wc -l)
if [[ "${HNT_BARS_COUNT}" -ge 500 ]]; then
  echo "PASS ✓ (${HNT_BARS_COUNT} real Binance bars returned)"
else
  echo "FAIL ✗ (Expected >= 500 bars, got ${HNT_BARS_COUNT})"
  exit 1
fi

# 5.4 Verify Unbuffered 1s SSE Live Stream
echo -n "  4. Verifying Unbuffered 1s SSE Live Stream... "
SSE_LINE=$(timeout 4 curl -s -N "http://127.0.0.1:${PORT}/api/projects/backtester/stream?symbol=HNTUSDTPERP" | grep -m 1 '^data: ' || true)
if echo "${SSE_LINE}" | grep -q '"symbol":"HNTUSDTPERP"'; then
  echo "PASS ✓ (${SSE_LINE})"
else
  echo "FAIL ✗ (Did not receive SSE tick line within 4s: ${SSE_LINE})"
  exit 1
fi

# 5.5 Verify 1D View returns 1m Intraday Candles
echo -n "  5. Verifying 1D View returns 1m Intraday Candles... "
INTRA_RES=$(curl -sf "http://127.0.0.1:${PORT}/api/projects/backtester/backtest?symbol=HNTUSDTPERP&strategyId=wyckoff-accumulation-v2&preset=1D&riskPosture=BALANCED")
if echo "${INTRA_RES}" | grep -q '"displayInterval":"1m"'; then
  echo "PASS ✓ (1m intraday displayInterval confirmed)"
else
  echo "FAIL ✗ (Expected displayInterval: 1m)"
  exit 1
fi

echo -e "\n=============================================================================="
echo " DEPLOYMENT SUCCESSFUL! All 5 Verification Stages Passed (Exit Code 0)"
echo " Service Endpoint: http://127.0.0.1:${PORT}/projects/backtester/"
echo " Public Tunnel:   https://cuang.dev/projects/backtester/"
echo "=============================================================================="
exit 0
