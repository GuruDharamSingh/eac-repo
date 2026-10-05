# Server-side OBS Studio (docs/reference/video.md "OBS"): one shared instance
# on a virtual display, controlled from the Studio through agent.mjs.
#
# Ubuntu 24.04 + OBS from the project's PPA (includes the browser source and
# obs-websocket 5). Xvfb is the display; x11vnc + noVNC show the full OBS
# window for setup (bound to 127.0.0.1 by compose). Mesa's VA-API driver lets
# OBS encode on the AMD iGPU when /dev/dri is passed in; without it, x264 on
# the CPU. Node comes from the official image (glibc 2.36 build; 24.04 has 2.39).
#
#   docker build -f docker/obs/Dockerfile -t eac-obs docker/obs
FROM node:22-bookworm-slim AS node

FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends software-properties-common gpg-agent \
    && add-apt-repository -y ppa:obsproject/obs-studio \
    && apt-get update && apt-get install -y --no-install-recommends \
      obs-studio \
      xvfb x11vnc novnc websockify fluxbox x11-utils \
      pulseaudio pulseaudio-utils \
      mesa-va-drivers mesa-vulkan-drivers libgl1-mesa-dri vainfo \
      ffmpeg ca-certificates curl \
      fonts-dejavu fonts-liberation fonts-noto-color-emoji \
    && apt-get purge -y software-properties-common && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY start.sh /usr/local/bin/obs-start
RUN chmod 755 /usr/local/bin/obs-start && mkdir -p /recordings /home/obs && chmod 1777 /recordings /home/obs
ENV HOME=/home/obs DISPLAY=:99
ENTRYPOINT ["/usr/local/bin/obs-start"]
