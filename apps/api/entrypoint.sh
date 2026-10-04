#!/bin/sh
set -e

APP_MODE="${1:-${APP_MODE:-api}}"

echo "[ENTRYPOINT] APP_MODE=$APP_MODE"
echo "[ENTRYPOINT] NODE_ENV=${NODE_ENV:-development}"

# Schema and client ship together, but NOTHING else applies migrations:
# without this, a schema change 500s every query touching the table
# (P2022 column-missing) while the server looks healthy. Fail loud here
# instead of serving broken traffic. Safe under api+worker concurrent boot
# (migrate deploy takes an advisory lock).
echo "[ENTRYPOINT] Applying database migrations..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

if [ "$APP_MODE" = "worker" ]; then
  echo "[ENTRYPOINT] Starting simulation worker..."
  exec node apps/api/src/simulation/worker/worker.js
else
  echo "[ENTRYPOINT] Starting API server..."
  exec node apps/api/src/index.js
fi