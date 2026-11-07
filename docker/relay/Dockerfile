# Stream relay (docs/reference/nextcloud.md "Stream relay"): one stream in from
# the server OBS, copied out to every enabled destination; feeds in from
# outside (Zoom, a phone, another OBS) that OBS picks up as sources.
#
# MediaMTX (static binary from the official image) is the RTMP server;
# ffmpeg does the fan-out with stream copy (no encode); agent.mjs (Node,
# bind-mounted) answers MediaMTX's auth calls, runs the ffmpeg outputs and
# serves the HTTP API arts-collective calls.
#
#   docker build -t eac-relay docker/relay
FROM bluenviron/mediamtx:1.21.1 AS mediamtx

FROM node:22-alpine
RUN apk add --no-cache ffmpeg ca-certificates tini
COPY --from=mediamtx /mediamtx /usr/local/bin/mediamtx
COPY start.sh /usr/local/bin/relay-start
RUN chmod 755 /usr/local/bin/relay-start && mkdir -p /data /etc/mediamtx && chmod 1777 /data /etc/mediamtx
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/relay-start"]
