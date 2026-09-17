#!/usr/bin/env bash
# Nightly logical backup of the network database (and GoTrue's auth schema,
# which lives in the same database). Custom format: restore with
#   docker exec -i eac-postgres pg_restore -U postgres -d elkdonis_dev --clean < file.dump
# Keeps 14 dailies plus the first dump of each month for a year.
set -euo pipefail

DEST="${EAC_BACKUP_DIR:-$HOME/eac-backups}"
DB="${POSTGRES_DB:-elkdonis_dev}"
mkdir -p "$DEST"; chmod 700 "$DEST"

out="$DEST/${DB}_$(date +%Y%m%d-%H%M%S).dump"
docker exec eac-postgres pg_dump -U "${POSTGRES_USER:-postgres}" -Fc "$DB" > "$out.partial"

# A dump that cannot be listed is not a backup.
docker exec -i eac-postgres pg_restore -l < "$out.partial" > /dev/null
mv "$out.partial" "$out"

find "$DEST" -name "${DB}_*.dump" ! -name "${DB}_??????01-*.dump" -mtime +14 -delete
find "$DEST" -name "${DB}_??????01-*.dump" -mtime +365 -delete
echo "$(date -Is) ok $(basename "$out") $(stat -c %s "$out") bytes" >> "$DEST/backup.log"
