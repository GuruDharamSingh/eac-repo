#!/bin/bash
W=${W:?scratch folder with an h/ directory holding these files, site.css and node_modules/playwright-core}
docker run --rm --name lc-build-$$ -u 3003 --network none --memory 4g -v /mnt/pool1/home/guru/eac:/app:ro -v $W:/w --entrypoint sh eac-dev /w/build.sh || exit 1
ls -la $W/h/live.js | cut -c20-
N=lc-chrome-$$
docker run -d --name $N --network none --memory 4g --shm-size=512m --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank >/dev/null
sleep 3
PW=$(readlink -f $W/h/node_modules)
docker run --rm --name lc-node-$$ -u 3003 --memory 2g --network container:$N -v $W/h:/h -v $PW:/h/node_modules:ro -w /h node:24-alpine timeout 170 node $1 2>&1
docker rm -f $N >/dev/null
