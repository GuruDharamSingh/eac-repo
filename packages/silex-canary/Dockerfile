FROM debian:bookworm-slim

ARG SILEX_VERSION=v3.7.3-canary.4

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && curl -fsSL "https://github.com/silexlabs/Silex/releases/download/${SILEX_VERSION}/silex-server-linux-amd64" -o /usr/local/bin/silex-server \
  && chmod +x /usr/local/bin/silex-server \
  && useradd --system --create-home --home-dir /silex --shell /usr/sbin/nologin silex \
  && mkdir -p /silex/data /silex/data/public \
  && chown -R silex:silex /silex \
  && apt-get purge -y --auto-remove curl \
  && rm -rf /var/lib/apt/lists/*

ENV SILEX_PORT=6805 \
  SILEX_URL=http://localhost:6805 \
  SILEX_DATA_PATH=/silex/data \
  SILEX_HOSTING_PATH=/silex/data/public \
  SILEX_DEFAULT_WEBSITE_ID=default

USER silex
WORKDIR /silex
EXPOSE 6805

CMD ["/usr/local/bin/silex-server"]