#!/bin/sh
set -e

APP_MODE="${1:-${APP_MODE:-api}}"

echo "[ENTRYPOINT] APP_MODE=$APP_MODE"
echo "[ENTRYPOINT] NODE_ENV=${NODE_ENV:-development}"

if [ "$APP_MODE" = "worker" ]; then
  echo "[ENTRYPOINT] Starting simulation worker..."
  exec node apps/api/src/simulation/worker/worker.js
else
  echo "[ENTRYPOINT] Starting API server..."
  exec node apps/api/src/index.js
fi