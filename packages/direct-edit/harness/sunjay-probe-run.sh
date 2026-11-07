# Next's real router, signed out, with sunjay-probe-page.tsx mounted over /studio. T: scratch holding h3/ (driver, node_modules/playwright-core, sunjay-event-detail.json
# from a read of puck:event-detail) and h3/saved.json from sunjay-try-drive. The env is sunjay-env.py's: read-only DB session, scheduler off, keys blank.
#   MODE=dev   next dev, .next in $T/preview-next
#   MODE=prod  next build with the probe mounted, then next start, .next in $T/probe-next
R=/mnt/pool1/home/guru/eac; H=$R/packages/direct-edit/harness; MODE=${MODE:-dev}; N=live-preview
cp $H/sunjay-probe-* "${T:?set T}/h3/"
mkdir -p "$T/env"; (cd $R && docker compose config --format json sunjay 2>/dev/null) | python3 "$H/sunjay-env.py" "$T/env/build.env"; cp "$R/apps/sunjay/next-env.d.ts" "$T/next-env.d.ts"
mkdir -p "$T/probe/" "$T/preview-next" "$T/probe-next" "$T/h3/shots"
cp $H/sunjay-try-page.json "$T/probe/seed.json"; cp "$T/h3/sunjay-event-detail.json" "$T/probe/event.json"; cp "$T/h3/saved.json" "$T/probe/saved.json"
cp "$T/next-env.d.ts" "$T/probe/next-env.d.ts"
docker rm -f $N live-chrome >/dev/null 2>&1
if [ "$MODE" = prod ]; then NEXTDIR=$T/probe-next; ENVX="-e NODE_ENV=production"; CMD='NEXT_BUILD_CPUS=4 pnpm build && pnpm docker:start'; else NEXTDIR=$T/preview-next; ENVX="-e NODE_ENV=development -e NODE_OPTIONS=--max-old-space-size=3072"; CMD='pnpm exec next dev -p 3001 -H 0.0.0.0'; fi
docker run -d --name $N --memory 4g -u 3003 --env-file "$T/env/build.env" $ENVX --network guru-eac_eac-network \
  -v $R:/app:ro -v "$NEXTDIR:/app/apps/sunjay/.next" -v "$T/probe/next-env.d.ts:/app/apps/sunjay/next-env.d.ts" \
  -v "$T/h3/sunjay-probe-page.tsx:/app/apps/sunjay/src/app/studio/page.tsx:ro" -v "$T/probe:/h:ro" \
  --entrypoint sh -w /app/apps/sunjay eac-dev -c "$CMD" >/dev/null
for i in $(seq 1 100); do docker logs $N 2>&1 | grep -q 'Ready in' && break; docker ps -q -f name=^$N$ | grep -q . || break; sleep 3; done
docker logs $N 2>&1 | grep -E 'Ready in|Compiled successfully|Failed to compile|rror:' | head -5 | cut -c1-200
docker run -d --name live-chrome --memory 2g --network container:$N --shm-size=512m --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank >/dev/null; sleep 3
docker run --rm --name live-driver -u 3003 --network container:$N -e TAG=$MODE -e THREAD="$THREAD" -v "$T/h3:/h" -w /h node:24-alpine timeout 560 node sunjay-probe-drive.cjs 2>&1
docker logs $N 2>&1 | grep -E -i ' error|cannot find|module not found|Ecmascript|Can.t resolve|Functions cannot|Only plain objects|read-only' | sort -u | head -12 | cut -c1-240
docker rm -f live-chrome $N >/dev/null
rm -f "$T/env/build.env"
