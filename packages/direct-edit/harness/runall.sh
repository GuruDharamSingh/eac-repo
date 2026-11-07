docker run --rm -u 3003 --network none -v /mnt/pool1/home/guru/eac:/app:ro -v "${S:?set S to a scratch folder holding h3/}:/w" --entrypoint sh eac-dev /w/h3/hb.sh >/dev/null
for d in "$@"; do
  N=shot-ct-$$; docker run -d --name $N --network none --shm-size=512m --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank >/dev/null; sleep 3
  echo "== $d"; docker run --rm -u 3003 --network container:$N -e ONLY="$ONLY" -v "$S/h3:/h" -w /h node:24-alpine timeout 170 node $d 2>&1 | grep -E '^( *FAIL|ERR|pass |parity|published|sequence|TRACE)'
  docker rm -f $N >/dev/null
done
