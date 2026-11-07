# next build of apps/sunjay the way the service builds it, with the repo read-only and .next in $T/build-next: the check that the
# real rebuild will not take the site down, without touching it. T: a scratch folder. Run inside `sg docker -c` if needed.
R=/mnt/pool1/home/guru/eac; H=$R/packages/direct-edit/harness; : "${T:?set T}"
mkdir -p "$T/build-next" "$T/env"; cp "$R/apps/sunjay/next-env.d.ts" "$T/next-env.d.ts"
(cd $R && docker compose config --format json sunjay 2>/dev/null) | python3 "$H/sunjay-env.py" "$T/env/build.env"
docker run --rm --name live-build --memory 4g -u 3003 --env-file "$T/env/build.env" --network guru-eac_eac-network \
  -v $R:/app:ro -v "$T/build-next:/app/apps/sunjay/.next" -v "$T/next-env.d.ts:/app/apps/sunjay/next-env.d.ts" \
  --entrypoint sh -w /app eac-dev -c 'cd apps/sunjay && NEXT_BUILD_CPUS=4 pnpm build'
echo "build exit $?"
rm -f "$T/env/build.env"
