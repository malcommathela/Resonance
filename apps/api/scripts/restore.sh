#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# L13: Disaster Recovery — Verified Restore Procedure
# ============================================================================
# Usage:
#   docker compose exec backup /scripts/restore.sh /backups/resonance_resonance_20260723_020000.sql.gz
# ============================================================================

BACKUP_FILE="${1:-}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_NAME="${POSTGRES_DB:-resonance}"
DB_USER="${POSTGRES_USER:-resonance}"
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"

if [ -z "$BACKUP_FILE" ]; then
  echo "[ERROR] Usage: $0 <backup_file.gz>"
  echo "[INFO] Available backups:"
  ls -1t "${BACKUP_DIR}/resonance_${DB_NAME}_"*.sql.gz 2>/dev/null || echo "  (none found)"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[ERROR] Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[WARN] This will DROP and recreate database: $DB_NAME"
echo "[WARN] All current data will be lost."
read -p "Are you sure? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "[INFO] Restore cancelled"
  exit 0
fi

echo "[INFO] Step 1/4 — Creating temporary validation database..."
TEMP_DB="resonance_restore_$(date +%s)"

PGPASSWORD="${POSTGRES_PASSWORD:-resonance_dev_password}" psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$TEMP_DB\";"

echo "[INFO] Step 2/4 — Restoring to temporary database for validation..."
gunzip -c "$BACKUP_FILE" | PGPASSWORD="${POSTGRES_PASSWORD:-resonance_dev_password}" psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMP_DB" -v ON_ERROR_STOP=1

echo "[INFO] Step 3/4 — Validation successful. Swapping databases..."

# Terminate connections, drop old, rename temp
PGPASSWORD="${POSTGRES_PASSWORD:-resonance_dev_password}" psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres <<EOF
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS "$DB_NAME";
ALTER DATABASE "$TEMP_DB" RENAME TO "$DB_NAME";
EOF

echo "[INFO] Step 4/4 — Restore complete."
echo "[INFO] Database '$DB_NAME' is live."
echo "[INFO] Verify with: psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM users;\""