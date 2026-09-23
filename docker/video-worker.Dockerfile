# The video pipeline worker: the shared eac-dev runtime plus ffmpeg.
#
# Kept out of eac-dev on purpose — ffmpeg is ~100MB of codecs that seventeen
# web containers would carry and never call. The repo is bind-mounted over
# /app as for every other service, so this image supplies only the runtime.
#
#   docker build -f docker/video-worker.Dockerfile -t eac-video-worker .
FROM eac-dev
USER root
RUN apk add --no-cache ffmpeg
# A fresh named volume copies this directory's mode, so the worker (host uid,
# not root) can write its scratch there.
RUN mkdir -p /work && chmod 1777 /work
