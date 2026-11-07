# A host with no contract, before and after a stone: the same interactions on bundles of the baseline source and of the
# tree, recording panel HTML, menu rows, stored documents, saves and computed styles, on the tree, classifieds tree,
# landing, classifieds and cards editors. Stone 1's comparison (416 states, a 36-step flow), kept here.
#   sg docker -c "P=<scratch> BASE=<unpacked baseline holding packages/> bash parity/run.sh"
# P holds base/h3 and now/h3, each a copy of the harness with node_modules, land.css and land-body.html (see section 7
# of docs/sessions/2026-11-02_canvas-direct-edit-layer.md). Writes parity.json and flow.json in each h3; compare them with
# cmp.py and cmpflow.py. Differences expected from stone 1's run: a reveal transition caught mid-fade
# and a timeout's millisecond text. Set SKIP_BASE=1 to reuse a base already built and probed.
set -u
P=${P:?scratch}; BASE=${BASE:?baseline}; HERE=$(dirname "$0")
cp "$HERE"/probe.cjs "$HERE"/probe2.cjs "$HERE"/flow.cjs "$P/now/h3/"; cp "$HERE"/probe.cjs "$HERE"/probe2.cjs "$HERE"/flow.cjs "$P/base/h3/"
build() { docker run --rm -u 3003 --network none -v /mnt/pool1/home/guru/eac:/app:ro "$@" --entrypoint sh eac-dev /build.sh; }
if [ -z "${SKIP_BASE:-}" ]; then
  build -v "$BASE/packages/direct-edit/src:/app/packages/direct-edit/src:ro" -v "$BASE/packages/blocks/src:/app/packages/blocks/src:ro" -v "$BASE/packages/page-builder/src:/app/packages/page-builder/src:ro" -v "$P/base:/w" -v "/mnt/pool1/home/guru/eac/packages/direct-edit/harness/parity/build.sh:/build.sh:ro"
fi
build -v "$P/now:/w" -v "/mnt/pool1/home/guru/eac/packages/direct-edit/harness/parity/build.sh:/build.sh:ro"
DIRS="now"; [ -z "${SKIP_BASE:-}" ] && DIRS="base now"
for d in $DIRS; do
  for f in probe.cjs flow.cjs; do
    N=par-$$-$d; docker run -d --name $N --network none --shm-size=512m --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank >/dev/null; sleep 3
    echo "== $f $d"; docker run --rm -u 3003 --network container:$N -v "$P/$d/h3:/h" -w /h node:24-alpine timeout 400 node $f 2>&1 | tail -2
    docker rm -f $N >/dev/null
  done
done
ls -la "$P"/base/h3/*.json "$P"/now/h3/*.json 2>/dev/null | awk '{print $5,$9}'
