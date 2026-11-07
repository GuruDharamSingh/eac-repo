# Builds and drives the sunjay try page in isolated Chromium. T: a scratch folder holding h3/ (with node_modules/playwright-core),
# build-next/ (a shadow build of apps/sunjay) and pics/ (the try document's pictures).
H=/mnt/pool1/home/guru/eac/packages/direct-edit/harness
cp $H/sunjay-* "${T:?set T}/h3/"
docker run --rm --name live-esbuild --memory 4g -u 3003 --network none -v /mnt/pool1/home/guru/eac:/app:ro -v "$T:/w" --entrypoint node eac-dev /w/h3/sunjay-try-build.mjs || exit 1
mkdir -p "$T/h3/next-static" "$T/h3/pics"; cp -r "$T/build-next/static/." "$T/h3/next-static/"; cp -r "$T/pics/." "$T/h3/pics/"
CLASS=$(grep -o '<html[^>]*class="[^"]*"' "$T/start/about.html" | sed 's/.*class="//; s/"$//')
LINKS=$(while read -r u; do printf '<link rel=stylesheet href="%s">' "$u"; done < "$T/start/css.txt")
python3 - "$T/h3/sunjay-try.html" "$CLASS" "$LINKS" <<'PY'
import sys
p,c,l=sys.argv[1:4]
s=open(p).read().replace("__FONTS__",c).replace("__CSS__",l)
open(p,"w").write(s)
PY
N=live-chrome; docker rm -f $N >/dev/null 2>&1
docker run -d --name $N --memory 2g --network none --shm-size=512m --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank >/dev/null; sleep 3
docker run --rm --name live-driver -u 3003 --network container:$N -v "$T/h3:/h" -w /h node:24-alpine timeout 280 node ${1:-sunjay-try-drive.cjs} 2>&1
docker rm -f $N >/dev/null
