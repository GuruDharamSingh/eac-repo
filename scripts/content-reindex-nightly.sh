#!/bin/sh
# Nightly content index upkeep (Content cornerstone, docs/open/CONTENT_CORNERSTONE_2026-11-26/).
# 1. Drain the trigger queue and reconcile thread/artwork rows against their tables (fixes drift).
# 2. Re-list Nextcloud folders into file rows (listings only, never file bytes; unchanged entries are skipped).
# Writes only content_index / content_index_queue. Run from guru's crontab; docker via passwordless sudo.
set -u
cd /mnt/pool1/home/guru/eac || exit 1
echo "== $(date -Is) content-reindex start"
sudo -n docker compose run --rm --no-deps -w /app/packages/content admin ../db/node_modules/.bin/tsx scripts/content-reindex.mts --reconcile --fix 2>&1 | grep -v "npm notice"
sudo -n docker compose run --rm --no-deps -w /app/packages/content admin ../db/node_modules/.bin/tsx scripts/content-files-reindex.mts --all --limit 5000 2>&1 | grep -v "npm notice"
echo "== $(date -Is) content-reindex end"
