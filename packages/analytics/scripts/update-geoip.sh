#!/usr/bin/env bash
# Downloads the MaxMind GeoLite2 City database to var/geoip/GeoLite2-City.mmdb,
# which packages/analytics/src/geo.ts reads. Needs a free MaxMind account:
#   MAXMIND_ACCOUNT_ID=… MAXMIND_LICENSE_KEY=… packages/analytics/scripts/update-geoip.sh
# Not run yet (no key supplied, 2026-10-01); the download URL follows MaxMind's
# documented direct-download endpoint and is unverified. GeoLite2 is updated
# twice a week; run monthly from cron at most.
set -euo pipefail
: "${MAXMIND_ACCOUNT_ID:?set MAXMIND_ACCOUNT_ID}" "${MAXMIND_LICENSE_KEY:?set MAXMIND_LICENSE_KEY}"
root="$(cd "$(dirname "$0")/../../.." && pwd)"
dest="$root/var/geoip"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$dest"
curl -fsSL -u "$MAXMIND_ACCOUNT_ID:$MAXMIND_LICENSE_KEY" \
  "https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz" -o "$tmp/db.tgz"
tar -xzf "$tmp/db.tgz" -C "$tmp"
mv "$(find "$tmp" -name 'GeoLite2-City.mmdb' | head -1)" "$dest/GeoLite2-City.mmdb.new"
mv "$dest/GeoLite2-City.mmdb.new" "$dest/GeoLite2-City.mmdb"
echo "installed $dest/GeoLite2-City.mmdb"
