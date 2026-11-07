#!/bin/sh
# Write MediaMTX's config, then run MediaMTX and the agent. If either exits,
# the container exits (restart: unless-stopped brings both back).
#
# Auth is HTTP: MediaMTX asks the agent (127.0.0.1:4457/auth) about every
# publish and read, so feed keys can be added and removed without a reload.
# The API is on 127.0.0.1 only (the agent's view of paths and readers).
set -eu
CFG=/etc/mediamtx/mediamtx.yml
# "a, b" -> ["a", "b"]; "" -> []
yl() { printf '%s' "$1" | awk -F, 'BEGIN { printf "["; n = 0 } { for (i = 1; i <= NF; i++) { gsub(/^ +| +$/, "", $i); if ($i != "") printf "%s\"%s\"", (n++ ? ", " : ""), $i } } END { printf "]" }'; }
# WebRTC (WHIP guest cameras, 2026-11-01): ICE servers only when a TURN
# server is configured; AUTH_SECRET makes MediaMTX mint coturn's time-limited
# credentials from the shared secret.
ICE="[]"
if [ -n "${RELAY_TURN_URL:-}" ]; then
  ICE="[{url: \"${RELAY_TURN_URL}\", username: AUTH_SECRET, password: \"${RELAY_TURN_SECRET:-}\"}]"
fi
TCP_ICE=""
[ -n "${RELAY_WEBRTC_TCP:-}" ] && TCP_ICE=":8189"
cat > "$CFG" <<YML
logLevel: info
logDestinations: [stdout]
readTimeout: 10s
writeTimeout: 10s
writeQueueSize: 1024

authMethod: http
authHTTPAddress: http://127.0.0.1:${RELAY_AGENT_PORT:-4457}/auth
authHTTPExclude:
  - action: api
  - action: metrics

api: true
apiAddress: 127.0.0.1:9997

rtmp: true
rtmpAddress: :1935
# RTSP for OBS's media sources (carries Opus from browser guests); TCP only,
# eac-network only (not published).
rtsp: true
rtspTransports: [tcp]
rtspAddress: :8554
rtspAuthMethods: [basic]
hls: false
# WHIP publishing (browser guests) at /in/<key>/whip; 8889 and UDP 8189 are
# published on RELAY_WEBRTC_BIND (127.0.0.1 by default, closed).
webrtc: true
webrtcAddress: :8889
webrtcAllowOrigins: $(yl "${RELAY_WEBRTC_ALLOW_ORIGINS:-https://arts-collective.com}")
webrtcTrustedProxies: $(yl "${RELAY_WEBRTC_TRUSTED_PROXIES:-10.0.0.0/8,172.16.0.0/12,192.168.0.0/16}")
webrtcLocalUDPAddress: :8189
webrtcLocalTCPAddress: "${TCP_ICE}"
webrtcIPsFromInterfaces: true
# Not lo: 127.0.0.1 was offered first and clients that try only one
# candidate (ffmpeg's WHIP muxer) failed with "Connection refused".
webrtcIPsFromInterfacesList: $(yl "${RELAY_WEBRTC_INTERFACES:-eth0}")
webrtcAdditionalHosts: $(yl "${RELAY_WEBRTC_HOSTS:-}")
webrtcICEServers2: ${ICE}
srt: false
moq: false
playback: false

pathDefaults:
  record: false

paths:
  program:
  "~^in/[A-Za-z0-9_-]{8,64}$":
YML

mediamtx "$CFG" &
MTX=$!
node /opt/relay-agent/agent.mjs &
AGENT=$!

trap 'kill $MTX $AGENT 2>/dev/null' TERM INT
# Exit when either one does.
while kill -0 $MTX 2>/dev/null && kill -0 $AGENT 2>/dev/null; do sleep 2; done
echo "[relay-start] a process exited; stopping" >&2
kill $MTX $AGENT 2>/dev/null || true
wait
exit 1
