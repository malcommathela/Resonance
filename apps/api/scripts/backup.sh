#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# L13: Automated PostgreSQL Backup with Rotation
# ============================================================================
# Usage:
#   docker compose exec backup /scripts/backup.sh
#   OR host cron: 0 2 * * * docker compose run --rm backup /scripts/backup.sh
# ============================================================================

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DB_NAME="${POSTGRES_DB:-resonance}"
DB_USER="${POSTGRES_USER:-resonance}"
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="resonance_${DB_NAME}_${TIMESTAMP}.sql.gz"
FULL_PATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

echo "[INFO] Starting backup: $FILENAME"

PGPASSWORD="${POSTGRES_PASSWORD:-resonance_dev_password}" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip > "$FULL_PATH"

FILESIZE=$(du -h "$FULL_PATH" | cut -f1)
echo "[INFO] Backup complete: $FULL_PATH ($FILESIZE)"

# Rotate old backups
echo "[INFO] Rotating backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name "resonance_${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

BACKUP_COUNT=$(find "$BACKUP_DIR" -name "resonance_${DB_NAME}_*.sql.gz" | wc -l)
echo "[INFO] Backup rotation complete. Total backups: $BACKUP_COUNT"