#!/usr/bin/env bash
# ── backup.sh ────────────────────────────────────────────────
# Faz dump do Postgres e comprime. Configure no cron:
#   0 2 * * * bash /opt/neotek/vps/scripts/backup.sh >> /var/log/neotek-backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/neotek/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
DATE="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/neotek_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Iniciando backup..."

# Dump dentro do container Postgres
docker exec postgres pg_dumpall -U neotek \
  | gzip > "$FILE"

SIZE=$(du -sh "$FILE" | cut -f1)
echo "[$(date)] Backup criado: $FILE ($SIZE)"

# Remover backups antigos
find "$BACKUP_DIR" -name "neotek_*.sql.gz" -mtime +${KEEP_DAYS} -delete
echo "[$(date)] Backups mais antigos que ${KEEP_DAYS} dias removidos."
echo "[$(date)] Backups disponíveis:"
ls -lh "$BACKUP_DIR"/neotek_*.sql.gz 2>/dev/null || echo "  (nenhum)"
