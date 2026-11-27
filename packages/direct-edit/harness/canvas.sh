#!/bin/sh
# Usage: cv.sh <driver.cjs...>  runs package harness drivers; resize.ts is built here (hb.sh builds the others).
docker() { sudo -n /usr/bin/docker "$@"; }
export -f docker 2>/dev/null
S=$HOME/scratch/manjushri/canvas/run
rm -rf $S; mkdir -p $S/h3; cp -r $HOME/eac/packages/direct-edit/harness/. $S/h3/
cp $HOME/scratch/manjushri/canvas/resize.ts $HOME/scratch/manjushri/canvas/resize.html $HOME/scratch/manjushri/canvas/drive17-resize.cjs $S/h3/
chmod -R a+rwX $S
cat > $S/h3/hb2.sh <<'EOS'
set -e
ES=$(ls -d /app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/bin/esbuild)
cd /app/apps/arts-collective
$ES /w/h3/visual.ts --bundle --format=iife --outfile=/w/h3/visual.js --log-level=warning --define:process.env.NODE_ENV=\"development\"
cp /app/packages/direct-edit/src/direct-edit.css /w/h3/visual.css
cp /app/packages/blocks/src/blocks.css /w/h3/blocks.css
for f in resize content tree view-blocks; do
NODE_PATH=/app/packages/page-builder/node_modules:/app/apps/innergathering/node_modules $ES /w/h3/$f.ts --bundle --format=iife --jsx=automatic --outfile=/w/h3/$f.js --log-level=error --define:process.env.NODE_ENV=\"development\" --external:node:*
done
EOS
docker run --rm -u 3003 --network none -v /mnt/pool1/home/guru/eac:/app:ro -v $S:/w --entrypoint sh eac-dev /w/h3/hb2.sh >$S/build.log 2>&1 || { echo BUILD FAILED; tail -8 $S/build.log; exit 1; }
for d in "$@"; do
  N=shot-cv-$$; docker run -d --name $N --network none --ipc=host --memory 3g --entrypoint /ms-playwright/chromium-1223/chrome-linux64/chrome mcr.microsoft.com/playwright:v1.60.0-noble --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origin='*' about:blank >/dev/null 2>&1 || docker run -d --name $N --network none --ipc=host --memory 3g --entrypoint /ms-playwright/chromium-1223/chrome-linux64/chrome mcr.microsoft.com/playwright:v1.60.0-noble --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank >/dev/null; sleep 3
  echo "== $d"; docker run --rm -u 3003 --network container:$N -v "$S/h3:/h" -v $HOME/scratch/inception/h/node_modules:/h/node_modules:ro -w /h node:24-alpine timeout 300 node $d > $S/$d.out 2>&1; grep -c -E '^ *FAIL' $S/$d.out | sed "s/^/FAIL lines: /"; grep -E '^( *FAIL|ERR)' $S/$d.out | cut -c1-400 | head -20; tail -2 $S/$d.out | cut -c1-300
  docker rm -f $N >/dev/null
done
mkdir -p $HOME/scratch/manjushri/canvas/shots; cp $S/h3/shots/s17-* $HOME/scratch/manjushri/canvas/shots/ 2>/dev/null
