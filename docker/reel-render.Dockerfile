# Reel renderer: Remotion + Chrome Headless Shell (docs/reference/video.md).
#
# Not built on eac-dev: Remotion does not support Alpine/musl (its docs name
# a >10 s Rust start-up penalty per render and Chrome version drift), so this
# is Debian. For the same reason it does not use the workspace node_modules,
# which holds musl builds: the renderer and its compositor live in /opt/reel,
# installed here from packages/reels/render/image-deps.json. Templates are
# read from the bind-mounted repo, so editing one needs no rebuild.
#
#
# Two more tools for the worker's own jobs (2026-11-01):
# - a full static ffmpeg/ffprobe 9.0.2 in /usr/local/bin. Remotion keeps
#   its own (n7.1, linked to its compositor, few filters); render.mjs uses
#   this one for cut-only renders, audio for transcripts and filters.
# - whisper.cpp v1.9.5 (whisper-cli) with the ggml-small.en model in
#   /opt/whisper, for transcripts (subtitles in the clip editor).
#
#   docker build -f docker/reel-render.Dockerfile -t eac-reel-render .
FROM mwader/static-ffmpeg:9.0.2-1 AS ffmpeg

FROM debian:bookworm-slim AS whisper
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake git ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch v1.9.5 https://github.com/ggml-org/whisper.cpp /src \
    && cmake -S /src -B /build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
         -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF \
    && cmake --build /build -j 8 --target whisper-cli
RUN curl -fL -o /ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin \
    && echo "c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d  /ggml-small.en.bin" | sha256sum -c

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates libgomp1 \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 \
      libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 \
      libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
      fonts-liberation fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/reel
COPY packages/reels/render/image-deps.json package.json
RUN npm install --omit=dev --no-audit --no-fund \
    && node -e "require('@remotion/renderer').ensureBrowser().then(()=>console.log('browser ok'))" \
    && chmod -R a+rX /opt/reel
RUN mkdir -p /work && chmod 1777 /work
ENV HOME=/tmp
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
COPY --from=whisper /build/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=whisper /ggml-small.en.bin /opt/whisper/ggml-small.en.bin
