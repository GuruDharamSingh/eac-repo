#!/bin/bash
# W: scratch folder holding h/ (shims, site.css, node_modules/playwright-core). Usage: W=... run.sh [entry.tsx:out.js ...] -- driver.cjs
set -e
F=/mnt/pool1/home/guru/eac/packages/direct-edit/harness/frankenstein
: "${W:?set W}"
cp $F/build.cjs $W/; cp $F/*.cjs $W/h/; cp $F/../site-style/*.cjs $W/h/ 2>/dev/null || true
while [ "$1" != "--" ] && [ -n "$1" ]; do
  E=${1%%:*}; O=${1##*:}
  docker run --rm --name fk-build-$$ -u 3003 --network none --memory 4g -v /mnt/pool1/home/guru/eac:/app:ro -v $W:/w -w /app/apps/sunjay \
    -e ENTRY=/app/packages/direct-edit/harness/$E -e OUT=/w/h/$O -e ALIAS="$ALIAS" --entrypoint node eac-dev /w/build.cjs
  shift
done
shift
N=fk-chrome-$$
docker run -d --name $N --network none --memory 3g --shm-size=512m --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank >/dev/null
sleep 3
docker run --rm --name fk-node-$$ -u 3003 --memory 2g --network container:$N -v $W/h:/h -w /h node:24-alpine timeout 240 node "$@" 2>&1 || true
docker rm -f $N >/dev/null
