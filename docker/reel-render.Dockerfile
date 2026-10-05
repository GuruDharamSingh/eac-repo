# Reel renderer: Remotion + Chrome Headless Shell (docs/reference/video.md).
#
# Not built on eac-dev: Remotion does not support Alpine/musl (its docs name
# a >10 s Rust start-up penalty per render and Chrome version drift), so this
# is Debian. For the same reason it does not use the workspace node_modules,
# which holds musl builds: the renderer and its compositor live in /opt/reel,
# installed here from packages/reels/render/image-deps.json. Templates are
# read from the bind-mounted repo, so editing one needs no rebuild.
#
#   docker build -f docker/reel-render.Dockerfile -t eac-reel-render .
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
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
