#!/usr/bin/env bash
#
# Add a Nginx Proxy Manager host (and its Let's Encrypt certificate) from the
# command line, instead of clicking through the UI.
#
#   scripts/add-proxy-host.sh paratheater.arts-collective.com 3001
#   scripts/add-proxy-host.sh foo.arts-collective.com 3022 --no-ssl
#
# WHY THIS EXISTS
# Standing up an org site is otherwise a manual UI step every time, and it is
# the one step that cannot be replayed onto a rebuilt box. NPM's UI is just a
# client for its own REST API; this calls the same API.
#
# `certificate_id: "new"` is the important part — internal/proxy-host.js routes
# that to createQuickCertificate, so ONE request creates the host and requests
# the certificate. Doing it in two calls leaves a stray cert row if the second
# fails.
#
# CREDENTIALS — two ways, pick by how much you want to hand over.
#
# 1. NPM_TOKEN — a JWT, used as-is. NOTHING is stored and it expires on its own.
#    Whoever holds the password mints one with a deliberately short life:
#
#      curl -sS -X POST http://127.0.0.1:30020/api/tokens \
#        -H 'Content-Type: application/json' \
#        -d '{"identity":"you@example.com","secret":"...","expiry":"10m"}' | jq -r .token
#
#    then `NPM_TOKEN=<that> scripts/add-proxy-host.sh <host> <port>`. After ten
#    minutes the token is worthless, so it can be pasted into a chat without
#    handing over standing access to the proxy.
#
# 2. NPM_EMAIL / NPM_PASSWORD — the admin login, read from the environment,
#    then scripts/.env.npm, then the repo-root .env. Use this when the same
#    person runs the script routinely. scripts/.env.npm is preferred because a
#    separate file is easier to keep out of git than a line buried in .env.
#
# NPM has no API keys and no unauthenticated write path (/api/ci is CI-only and
# read-only), so one of these two is genuinely required.
#
# WHAT IT DOES NOT DO
# Nothing about DNS. `*.arts-collective.com` is a wildcard, so any subdomain
# already resolves and HTTP-01 validates immediately. A hostname OUTSIDE that
# wildcard needs its own DNS record first or certificate issuance will fail.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NPM_API="${NPM_API:-http://127.0.0.1:30020/api}"
FORWARD_HOST="${FORWARD_HOST:-192.168.0.11}"

usage() {
  cat >&2 <<EOF
usage: $(basename "$0") <hostname> <forward-port> [--no-ssl] [--force-ssl-off]

  <hostname>       e.g. paratheater.arts-collective.com
  <forward-port>   the app's internal port, e.g. 3001
  --no-ssl         create the host WITHOUT requesting a certificate (http only)
  --force-ssl-off  request the cert but do not force http -> https

env:
  NPM_TOKEN                 a JWT (skips login entirely; see header)
  NPM_EMAIL, NPM_PASSWORD   NPM admin login (or scripts/.env.npm, or .env)
  FORWARD_HOST              default ${FORWARD_HOST}
  NPM_API                   default ${NPM_API}
EOF
  exit 2
}

[ $# -ge 2 ] || usage
HOSTNAME_ARG="$1"; FORWARD_PORT="$2"; shift 2
WANT_SSL=1; FORCE_SSL=1
for arg in "$@"; do
  case "$arg" in
    --no-ssl)        WANT_SSL=0; FORCE_SSL=0 ;;
    --force-ssl-off) FORCE_SSL=0 ;;
    *) echo "unknown option: $arg" >&2; usage ;;
  esac
done

case "$FORWARD_PORT" in
  ''|*[!0-9]*) echo "forward-port must be a number, got '$FORWARD_PORT'" >&2; exit 2 ;;
esac

# Credentials: environment wins, then scripts/.env.npm, then .env. Parsed with
# a narrow grep rather than sourcing the file — these files hold values with
# characters the shell would otherwise reinterpret.
if [ -z "${NPM_TOKEN:-}" ]; then
  for credfile in "$REPO_ROOT/scripts/.env.npm" "$REPO_ROOT/.env"; do
    [ -n "${NPM_EMAIL:-}" ] && [ -n "${NPM_PASSWORD:-}" ] && break
    [ -f "$credfile" ] || continue
    NPM_EMAIL="${NPM_EMAIL:-$(grep -m1 '^NPM_EMAIL=' "$credfile" | cut -d= -f2- || true)}"
    NPM_PASSWORD="${NPM_PASSWORD:-$(grep -m1 '^NPM_PASSWORD=' "$credfile" | cut -d= -f2- || true)}"
    NPM_TOKEN="${NPM_TOKEN:-$(grep -m1 '^NPM_TOKEN=' "$credfile" | cut -d= -f2- || true)}"
  done
fi
if [ -z "${NPM_TOKEN:-}" ] && { [ -z "${NPM_EMAIL:-}" ] || [ -z "${NPM_PASSWORD:-}" ]; }; then
  cat >&2 <<EOF
error: no NPM credentials.

Either hand this script a short-lived token (nothing is stored):

  NPM_TOKEN=<jwt> $(basename "$0") <hostname> <port>

  # whoever has the password mints one, good for ten minutes:
  curl -sS -X POST ${NPM_API}/tokens -H 'Content-Type: application/json' \
    -d '{"identity":"you@example.com","secret":"...","expiry":"10m"}' | jq -r .token

or put the admin login in $REPO_ROOT/scripts/.env.npm (gitignored):

  NPM_EMAIL=nginx@stephan.wrede.ca
  NPM_PASSWORD=...
EOF
  exit 1
fi

need() { command -v "$1" >/dev/null || { echo "error: $1 is required" >&2; exit 1; }; }
need curl; need jq

api() { # api <method> <path> [json]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$NPM_API$path" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$body"
  else
    curl -sS -X "$method" "$NPM_API$path" -H "Authorization: Bearer $TOKEN"
  fi
}

if [ -n "${NPM_TOKEN:-}" ]; then
  echo "→ using supplied NPM_TOKEN"
  TOKEN="$NPM_TOKEN"
  # Probe a read before doing anything, so an expired token fails here with a
  # clear message instead of at the first write, where it surfaces as a
  # confusing permission error.
  if ! api GET /nginx/proxy-hosts | jq -e 'type == "array"' >/dev/null 2>&1; then
    echo "error: NPM_TOKEN was rejected — expired, or minted for another instance." >&2
    exit 1
  fi
else
  echo "→ authenticating to $NPM_API"
  TOKEN="$(curl -sS -X POST "$NPM_API/tokens" -H "Content-Type: application/json" \
    -d "$(jq -nc --arg i "$NPM_EMAIL" --arg s "$NPM_PASSWORD" '{identity:$i,secret:$s}')" \
    | jq -r '.token // empty')"
  [ -n "$TOKEN" ] || { echo "error: login failed — check NPM_EMAIL / NPM_PASSWORD" >&2; exit 1; }
fi

# Idempotent: re-running for an existing hostname must not create a duplicate
# server block. Two blocks for one server_name is not an error nginx reports —
# it silently serves the first and ignores the second, which is the kind of
# thing you debug for an hour.
EXISTING="$(api GET /nginx/proxy-hosts | jq -r --arg h "$HOSTNAME_ARG" \
  '.[] | select(.domain_names[]? == $h) | .id' | head -1)"
if [ -n "$EXISTING" ]; then
  echo "✓ already exists — proxy host $EXISTING serves $HOSTNAME_ARG (nothing to do)"
  api GET "/nginx/proxy-hosts/$EXISTING" \
    | jq '{id, domain_names, forward_host, forward_port, certificate_id, enabled, ssl_forced}'
  exit 0
fi

echo "→ creating proxy host  $HOSTNAME_ARG -> $FORWARD_HOST:$FORWARD_PORT  (ssl=$WANT_SSL force=$FORCE_SSL)"
PAYLOAD="$(jq -nc \
  --arg h "$HOSTNAME_ARG" --arg fh "$FORWARD_HOST" --argjson fp "$FORWARD_PORT" \
  --argjson ssl "$WANT_SSL" --argjson force "$FORCE_SSL" --arg email "$NPM_EMAIL" '
  {
    domain_names: [$h],
    forward_scheme: "http",
    forward_host: $fh,
    forward_port: $fp,
    # Websockets on by default: Next.js dev HMR and anything using a live
    # connection break without it, and it costs nothing when unused.
    allow_websocket_upgrade: true,
    block_exploits: false,
    caching_enabled: false,
    http2_support: false,
    hsts_enabled: false,
    hsts_subdomains: false,
    access_list_id: 0,
    advanced_config: "",
    locations: [],
    enabled: true,
    ssl_forced: ($force == 1),
    # "new" makes NPM request a Let'"'"'s Encrypt certificate as part of this
    # same call (internal/proxy-host.js -> createQuickCertificate).
    certificate_id: (if $ssl == 1 then "new" else 0 end)
  }
  + (if $ssl == 1 then {meta: {letsencrypt_email: $email, letsencrypt_agree: true, dns_challenge: false}} else {} end)
')"

RESP="$(api POST /nginx/proxy-hosts "$PAYLOAD")"
ID="$(echo "$RESP" | jq -r '.id // empty')"
if [ -z "$ID" ]; then
  echo "error: NPM rejected the request:" >&2
  echo "$RESP" | jq . >&2 2>/dev/null || echo "$RESP" >&2
  echo >&2
  echo "If this mentions the certificate, the host may exist without SSL — check the UI." >&2
  exit 1
fi

echo "✓ proxy host $ID created"
api GET "/nginx/proxy-hosts/$ID" \
  | jq '{id, domain_names, forward_host, forward_port, certificate_id, enabled, ssl_forced}'

echo
echo "→ verifying through the edge"
SCHEME=$([ "$WANT_SSL" = 1 ] && echo https || echo http)
PORT=$([ "$WANT_SSL" = 1 ] && echo 30022 || echo 30021)
# --resolve with the right SNI: hitting the IP directly sends no SNI and nginx
# answers "unrecognized name".
CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 25 \
  --resolve "$HOSTNAME_ARG:$PORT:127.0.0.1" "$SCHEME://$HOSTNAME_ARG:$PORT/" || echo 000)"
echo "   $SCHEME://$HOSTNAME_ARG -> $CODE"
case "$CODE" in
  200|301|302|307|308) echo "✓ serving" ;;
  000) echo "! no answer yet — a fresh certificate can take a few seconds; retry the curl above" ;;
  404) echo "! 404 from the default host — the server block is not live; check the UI" ;;
  *)   echo "! unexpected status; check: docker compose logs <service>" ;;
esac
