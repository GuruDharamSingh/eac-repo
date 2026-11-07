# Bundles render-published.ts and runs it with the clock and Math.random frozen, so two runs of one tree are identical.
# In read-only eac-dev, no network, no database:
#   docker run --rm -u 3003 --network none -e TZ=UTC -v /mnt/pool1/home/guru/eac:/app:ro -v "$S:/w" --entrypoint sh eac-dev /w/h3/render-published.sh /w/render-now.json
set -e
OUT=${1:?where to write the JSON}
ES=$(ls -d /app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/bin/esbuild)
cd /app/apps/arts-collective
NODE_PATH=/app/packages/page-builder/node_modules:/app/apps/innergathering/node_modules $ES /w/h3/render-published.ts --bundle --platform=node --format=cjs --jsx=automatic --outfile=/w/h3/render-published.js --log-level=error --define:process.env.NODE_ENV=\"production\" --external:node:* --external:jsdom
cat > /w/h3/render-run.cjs <<'JS'
const FIXED = Date.parse("2026-11-04T12:00:00Z"), Real = Date;
class Frozen extends Real { constructor(...a) { if (a.length) super(...a); else super(FIXED); } static now() { return FIXED; } }
globalThis.Date = Frozen;
let seed = 1; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
require("/w/h3/render-published.js");
JS
NODE_PATH=/app/apps/innergathering/node_modules:$(ls -d /app/node_modules/.pnpm/jsdom@*/node_modules | head -1) node /w/h3/render-run.cjs > "$OUT"
