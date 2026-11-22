#!/bin/sh
set -e
T=$HOME/scratch/door/h
mkdir -p $T/site $T/shots
chmod -R a+rwX $T 2>/dev/null || true
sudo -n docker run --rm -u 3003 --memory 3g -v $HOME/eac:/app:ro -v $T:/out -w /app/packages/house-editor eac-dev node /out/bundle.cjs
sudo -n docker run --rm -u 3003 --memory 3g -v $HOME/eac:/app:ro -v $T:/out -e NODE_PATH=/app/node_modules/.pnpm/node_modules:/app/packages/house-editor/node_modules -w /app/packages/house-editor eac-dev node /out/render-page.cjs
python3 $T/mkindex.py
N=door-chrome-$$
sudo -n docker run -d --name $N --network none --memory 3g --shm-size=512m -v $T:/t:ro --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --hide-scrollbars --allow-file-access-from-files --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank >/dev/null
sleep 4
set +e
sudo -n docker run --rm -u 3003 --network container:$N --memory 2g -v $T:/t -v $HOME/scratch/inception/h/node_modules:/t/node_modules:ro -w /t node:24-alpine timeout 300 node drive.cjs
code=$?
sudo -n docker rm -f $N >/dev/null
exit $code
