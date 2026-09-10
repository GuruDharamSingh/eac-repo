#!/usr/bin/env bash
#
# sync-nextcloud-access.sh
# ========================
# Brings Nextcloud into line with whatever the platform database currently
# says about orgs and membership. Safe to run repeatedly — every step is
# idempotent, and re-running is the intended way to use it.
#
# It exists because org access is derived state: someone joins an org, an org
# is created, a person connects a Nextcloud account — and until this runs,
# Nextcloud does not know. Rather than trying to mutate Nextcloud from inside
# each of those app flows (which cannot work: attaching circles and writing
# ACLs go through endpoints gated by #[PasswordConfirmationRequired], which
# needs a live browser session and can never be satisfied by an API
# credential), the platform just writes rows and this reconciles.
#
# Two halves, deliberately in this order:
#   1. provision-org-circles.mjs — folders, Circles, membership, shares.
#      Runs entirely over OCS as the service account. No host privileges.
#   2. apply-team-folder-acls.mjs --apply — the Team folder ACLs. Needs `occ`,
#      so this half is why the script runs on the HOST rather than in an app
#      container.
#
# MUST run on the Docker host (it shells into the Nextcloud container).
#
# Cron example — every 10 minutes, output to syslog:
#   */10 * * * * /mnt/pool1/home/guru/eac/scripts/sync-nextcloud-access.sh 2>&1 | logger -t nc-access-sync
#
# Env: reads the repo .env for DATABASE_URL/Nextcloud credentials unless they
# are already set in the environment.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Pull credentials from .env only for values not already provided, so a
# systemd unit or CI can override without editing the file.
if [ -f .env ]; then
  : "${POSTGRES_PASSWORD:=$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)}"
  : "${NEXTCLOUD_ADMIN_PASSWORD:=$(grep -E '^NEXTCLOUD_ADMIN_PASSWORD=' .env | cut -d= -f2-)}"
  : "${NEXTCLOUD_ADMIN_USER:=$(grep -E '^NEXTCLOUD_ADMIN_USER=' .env | cut -d= -f2-)}"
fi

: "${DATABASE_URL:=postgres://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/elkdonis_dev}"
# The container-internal hostname is not resolvable from the host; use the
# published port instead.
: "${NEXTCLOUD_URL:=http://127.0.0.1:11000}"

export DATABASE_URL NEXTCLOUD_URL NEXTCLOUD_ADMIN_USER NEXTCLOUD_ADMIN_PASSWORD

echo "[$(date -Is)] nc-access-sync starting"

echo "--- 1/2 folders, circles, membership, shares (OCS) ---"
node scripts/provision-org-circles.mjs

echo "--- 2/2 team folder ACLs (occ) ---"
node scripts/apply-team-folder-acls.mjs --apply

echo "[$(date -Is)] nc-access-sync done"
