#!/usr/bin/env bash
# Runs harness drivers, unchanged, in other browsers and on touch screens, on a test page that needs no network.
#
#   run-browsers.sh <page-folder> <outdir>
#
# <page-folder> is what harness/hb.sh builds (the "h3" folder): the page and the driver .cjs files side by side.
# It is copied into each container; nothing is written back to it.
#
# Env: PROFILES (default: all in profiles.cjs, control first), DRIVERS (default: walk.cjs walk2.cjs drive13.cjs plus the
#      phone layout probe), ONLY (passed to drive13), SOFT=1, DRIVER_LIMIT=900 seconds, BENCH_IMAGE, BENCH_VENDOR.
# One container at a time, --network none, 4 GB cap, removed on exit. Output: <outdir>/<profile>/<driver>.log and shots/;
# <outdir>/results.tsv and a table from results.py.
set -u
PAGE=${1:?usage: run-browsers.sh <page-folder> <outdir>}
OUT=${2:?usage: run-browsers.sh <page-folder> <outdir>}
HERE=$(cd "$(dirname "$0")" && pwd)
PAGE=$(cd "$PAGE" && pwd); mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
BENCH_IMAGE=${BENCH_IMAGE:-mcr.microsoft.com/playwright:v1.60.0-noble}
BENCH_VENDOR=${BENCH_VENDOR:-$HOME/eac-backups/direct-edit/bench-vendor}
PROFILES=${PROFILES:-chromium-desktop firefox-desktop webkit-desktop chromium-touch-390 webkit-touch-390 chromium-touch-820 webkit-touch-820}
DRIVERS=${DRIVERS:-walk.cjs walk2.cjs drive13.cjs /bench/layout-probe.cjs}
[ -d "$BENCH_VENDOR/node_modules/playwright-core" ] || { echo "no playwright-core in $BENCH_VENDOR (see bench/README.md)" >&2; exit 2; }

for p in $PROFILES; do
  echo "== $p"
  sg docker -c "docker run --rm --name bench-$p-$$ --network none --memory 4g --shm-size=1g --init \
    -u 3003:3003 -e HOME=/tmp --tmpfs /h:rw,size=512m,uid=3003,gid=3003,mode=755 \
    -e PROFILE=$p -e DRIVERS='$DRIVERS' -e ONLY='${ONLY:-}' -e SOFT='${SOFT:-1}' -e DRIVER_LIMIT='${DRIVER_LIMIT:-900}' \
    -v '$BENCH_VENDOR:/v:ro' -v '$HERE:/bench:ro' -v '$PAGE:/page:ro' -v '$OUT:/out' \
    $BENCH_IMAGE node /bench/run-profile.cjs" 2>&1 | tail -n 12
done
python3 "$HERE/results.py" "$OUT"
