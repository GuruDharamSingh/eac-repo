#!/usr/bin/env bash
# Cross-tenant smoke test (2026-11-01). Run from anywhere with curl:
#   scripts/tenant-smoke.sh            # default hosts
#   scripts/tenant-smoke.sh tara ifac  # these org subdomains
#
# For each org subdomain of the network host it checks, through the public edge:
#   1. the home page answers 200;
#   2. /sites/<another org> is a 404 (an org host shows only that org);
#   3. /sites/<itself>/center redirects (308) to the canonical path.
# Exit status is the number of failures, so it can run from cron.
set -u

NETWORK_HOST="${NETWORK_HOST:-arts-collective.com}"
if [ "$#" -gt 0 ]; then ORGS=("$@"); else ORGS=(tara justing buddhasengines); fi
OTHER="${OTHER_ORG:-ifac}"

fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "PASS $1 ($3)"; else echo "FAIL $1 (expected $2, got $3)"; fail=$((fail + 1)); fi
}
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1"; }

for org in "${ORGS[@]}"; do
  base="https://${org}.${NETWORK_HOST}"
  check "$org home" 200 "$(code "$base/")"
  other="$OTHER"; [ "$org" = "$OTHER" ] && other="tara"
  check "$org cannot show /sites/$other" 404 "$(code "$base/sites/$other")"
  check "$org /sites/$org/center redirects to canonical" 308 "$(code "$base/sites/$org/center")"
done

exit "$fail"
