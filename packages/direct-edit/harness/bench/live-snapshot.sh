#!/usr/bin/env bash
# Signed-out, GET-only snapshot of one live site, for a before/after comparison.
#
#   live-snapshot.sh <host> <outdir> [--like <earlier-snapshot>]
#
# --like visits every page of the earlier snapshot first, in its order, so an "after"
# run covers the "before" pages whatever the links now say; new links come after them.
#
# What it does, one request at a time:
#   1. crawls same-host <a href> links from / through the edge with curl (status, headers
#      of interest, HTML). Never follows a redirect off the host, never sends a cookie.
#      The rules for what is not followed are in live_links.py and are listed in skipped.tsv.
#   2. fetches each /_next/static js and css file the pages name, once, and records its
#      size and how often the editor markers occur in it. Files are not kept.
#   3. screenshots every 200 page at each width in each browser (shots.cjs, one container
#      at a time, one page at a time).
#
# Env: LIMIT=80 EDGE_PORT=30022 DELAY=0.3 BROWSERS="chromium firefox webkit"
#      WIDTHS="1440 390" SHOTS=1 SHOTS_ONLY=0 BENCH_IMAGE BENCH_VENDOR
# It runs for about 15 minutes on 80 pages: start it with nohup, a tool's time limit kills it part way.
set -u
HOST=${1:?usage: live-snapshot.sh <host> <outdir> [--like <earlier-snapshot>]}
OUT=${2:?usage: live-snapshot.sh <host> <outdir> [--like <earlier-snapshot>]}
LIKE=""
if [ "${3:-}" = "--like" ]; then LIKE=${4:?--like needs a snapshot folder}; fi
LIMIT=${LIMIT:-80}; EDGE_PORT=${EDGE_PORT:-30022}; DELAY=${DELAY:-0.3}
BROWSERS=${BROWSERS:-chromium firefox webkit}; WIDTHS=${WIDTHS:-1440 390}; SHOTS=${SHOTS:-1}
HERE=$(cd "$(dirname "$0")" && pwd)
BENCH_IMAGE=${BENCH_IMAGE:-mcr.microsoft.com/playwright:v1.60.0-noble}
BENCH_VENDOR=${BENCH_VENDOR:-$HOME/eac-backups/direct-edit/bench-vendor}
UA="eac-bench/1 live-snapshot"

SHOTS_ONLY=${SHOTS_ONLY:-0}
if [ "$SHOTS_ONLY" = 1 ]; then
  # Finish an interrupted snapshot: no crawl, the screenshots of the browsers in BROWSERS and widths in WIDTHS only.
  [ -e "$OUT/manifest.tsv" ] || { echo "SHOTS_ONLY: no manifest in $OUT" >&2; exit 2; }
else
if [ -e "$OUT/manifest.tsv" ]; then echo "refusing: $OUT already holds a snapshot" >&2; exit 2; fi
mkdir -p "$OUT/pages"
{
  echo "host=$HOST"; echo "started=$(date -u +%FT%TZ)"; echo "limit=$LIMIT"; echo "edge_port=$EDGE_PORT"
  echo "like=$LIKE"; echo "browsers=$BROWSERS"; echo "widths=$WIDTHS"
} > "$OUT/snapshot.info"

queue="$OUT/.queue"; seen="$OUT/.seen"; : > "$queue"; : > "$seen"
: > "$OUT/manifest.tsv"; : > "$OUT/skipped.tsv"
if [ -n "$LIKE" ]; then cut -f3 "$LIKE/manifest.tsv" >> "$queue"; else echo "/" >> "$queue"; fi

keyfor() { # a readable folder name, unique by hash
  local p=$1 s h
  s=$(printf '%s' "$p" | sed -e 's#^/##' -e 's#[^A-Za-z0-9._-]#_#g' | cut -c1-60); [ -n "$s" ] || s=root
  h=$(printf '%s' "$p" | sha1sum | cut -c1-8)
  printf '%s-%s' "$s" "$h"
}

take_links() { # verdict lines from live_links.py on stdin; from-page in $1
  local from=$1 verdict path reason
  while IFS=$'\t' read -r verdict path reason; do
    if [ "$verdict" = ok ]; then
      grep -qxF -- "$path" "$seen" || grep -qxF -- "$path" "$queue" || echo "$path" >> "$queue"
    else
      grep -qF -- "$path"$'\t' "$OUT/skipped.tsv" || printf '%s\t%s\t%s\n' "$path" "$reason" "$from" >> "$OUT/skipped.tsv"
    fi
  done
}

n=0; line=1
while [ "$n" -lt "$LIMIT" ]; do
  path=$(sed -n "${line}p" "$queue"); [ -n "$path" ] || break
  line=$((line + 1))
  grep -qxF -- "$path" "$seen" && continue
  echo "$path" >> "$seen"
  key=$(keyfor "$path"); d="$OUT/pages/$key"; mkdir -p "$d"
  status=$(curl -k -sS --max-time 40 -A "$UA" --resolve "$HOST:$EDGE_PORT:127.0.0.1" \
    -D "$d/headers.raw" -o "$d/body.html" -w '%{http_code}' "https://$HOST:$EDGE_PORT$path" 2>"$d/curl.err")
  [ -s "$d/curl.err" ] || rm -f "$d/curl.err"
  # Headers of interest. A Set-Cookie keeps its name only.
  tr -d '\r' < "$d/headers.raw" | grep -i -E '^(HTTP/|location:|content-type:|cache-control:|x-served-by:|x-powered-by:|content-security-policy:|x-frame-options:|strict-transport-security:|x-robots-tag:|x-nextjs-cache:|x-nextjs-prerender:|vary:|set-cookie:)' \
    | sed -E -e 's/^(set-cookie: *[^=]+)=.*/\1=…/I' > "$d/headers.txt"
  rm -f "$d/headers.raw"
  ctype=$(grep -i '^content-type:' "$d/headers.txt" | head -1 | cut -d: -f2- | tr -d ' ')
  n=$((n + 1))
  printf '%s\t%s\t%s\t%s\n' "$n" "$key" "$path" "$status" >> "$OUT/manifest.tsv"
  printf '%3d %s %s\n' "$n" "$status" "$path"
  case "$ctype" in
    text/html*) python3 "$HERE/live_links.py" "$d/body.html" "$HOST" "$path" | take_links "$path" ;;
  esac
  loc=$(grep -i '^location:' "$d/headers.txt" | head -1 | sed -E 's/^[^:]*: *//')
  if [ -n "$loc" ]; then
    # The edge's port is not part of a public URL.
    python3 "$HERE/live_links.py" --one "$(printf '%s' "$loc" | sed "s#:$EDGE_PORT/#/#")" "$HOST" "$path" | take_links "$path"
  fi
  sleep "$DELAY"
done
rm -f "$queue" "$seen"

# Step 2: the static files the pages name.
assets="$OUT/assets.tsv"; printf 'path\tstatus\tbytes\tsha256\tdata-tree-\tde-vpanel\tdata-de-ui\tmorph\n' > "$assets"
# Inline flight data names chunks too, with escaped quotes, so this reads the raw text.
find "$OUT/pages" -name body.html -print0 | xargs -0 cat 2>/dev/null \
  | grep -a -o -E '/_next/static/[A-Za-z0-9._/~%-]+\.(js|css)' | sort -u > "$OUT/.assets"
tmp=$(mktemp)
while read -r a; do
  st=$(curl -k -sS --max-time 40 -A "$UA" --resolve "$HOST:$EDGE_PORT:127.0.0.1" -o "$tmp" -w '%{http_code}' "https://$HOST:$EDGE_PORT$a" 2>/dev/null)
  bytes=$(wc -c < "$tmp"); sha=$(sha256sum "$tmp" | cut -c1-64)
  c() { grep -a -o -i -F -- "$1" "$tmp" | wc -l; }
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$a" "$st" "$bytes" "$sha" "$(c data-tree-)" "$(c de-vpanel)" "$(c data-de-ui)" "$(c morph)" >> "$assets"
  sleep "$DELAY"
done < "$OUT/.assets"
rm -f "$tmp" "$OUT/.assets"
echo "assets: $(($(wc -l < "$assets") - 1))"
fi # SHOTS_ONLY

# Step 3: screenshots.
if [ "$SHOTS" = 1 ]; then
  for b in $BROWSERS; do
    echo "== shots: $b"
    sg docker -c "docker run --rm --name bench-shots-$b-$$ --memory 4g --shm-size=1g --init \
      -u 3003:3003 -e HOME=/tmp -e NODE_PATH=/v/node_modules \
      -e HOST=$HOST -e EDGE_PORT=$EDGE_PORT -e BROWSER=$b -e WIDTHS='$WIDTHS' \
      --add-host host.docker.internal:host-gateway --add-host $HOST:127.0.0.1 \
      --sysctl net.ipv4.ip_unprivileged_port_start=0 \
      -v '$BENCH_VENDOR:/v:ro' -v '$HERE:/bench:ro' -v '$(cd "$OUT" && pwd):/out' \
      $BENCH_IMAGE node /bench/shots.cjs" 2>&1 | tail -n "${SHOT_TAIL:-6}"
  done
fi
echo "finished=$(date -u +%FT%TZ)" >> "$OUT/snapshot.info"
echo "snapshot: $OUT ($(wc -l < "$OUT/manifest.tsv") pages)"
