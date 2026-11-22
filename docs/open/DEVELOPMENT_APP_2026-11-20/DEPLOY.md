# apps/development: go-live notes (prepared, NOT applied)

Served at arts-collective.com/development, network admins only. Source is in apps/development.

## 1. Install (once, by the PM)
`pnpm install` so the lockfile gains the `apps/development` importer. Until then, these node_modules
symlinks were made by hand (a real install replaces them):
- apps/development/node_modules/@elkdonis/{auth-server,blocks,cms-ui,db,direct-edit,page-builder,primitives,services,types,utils} -> ../../../../packages/<name>
- apps/development/node_modules/{next,react,react-dom,tailwindcss,typescript} (copied from sunjay: relative links into node_modules/.pnpm)
- apps/development/node_modules/@types/{node,react,react-dom}, @tailwindcss/postcss, @puckeditor/core (copied from sunjay)

## 2. docker-compose service (add beside fourthway-bookreaders; port 3031 was unused at write time, re-check `ss -ltn`)
```yaml
  # Port 3031: Development (apps/development), network admins only, served at
  # arts-collective.com/development. Same production shape as fourthway-bookreaders.
  development:
    build:
      context: .
      dockerfile: Dockerfile
      target: development
    image: eac-dev
    user: "${EAC_UID:-3003}:${EAC_GID:-3003}"
    container_name: eac-development
    restart: unless-stopped
    mem_limit: 5g
    depends_on:
      postgres:
        condition: service_healthy
      supabase-auth:
        condition: service_started
    environment:
      JWT_SECRET: ${JWT_SECRET:?set JWT_SECRET in .env}
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}@postgres:5432/${POSTGRES_DB:-elkdonis_dev}
      NEXT_PUBLIC_APP_URL: ${DEVELOPMENT_URL:-https://arts-collective.com/development}
      NEXT_PUBLIC_BASE_PATH: ${DEVELOPMENT_BASE_PATH-/development}
      NEXT_PUBLIC_ARTS_COLLECTIVE_URL: ${ARTS_COLLECTIVE_URL:-https://arts-collective.com}
      NEXT_PUBLIC_NETWORK_HOST: ${NEXT_PUBLIC_NETWORK_HOST:-arts-collective.com}
      INTER_APP_JWT_SECRET: ${INTER_APP_JWT_SECRET}
      NODE_ENV: production
      PORT: 3031
      NODE_OPTIONS: --max-old-space-size=1024
      SUPABASE_URL: http://supabase-auth:9999
      NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL:-http://localhost:9999}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY:?set SUPABASE_SERVICE_KEY in .env}
      REDIS_URL: redis://redis:6379
    volumes:
      - .:/app
      - /app/apps/development/.next
    ports:
      - "3031:3031"
    command: sh -c "cd apps/development && { [ -f .next/BUILD_ID ] && [ -f .next/server/pages-manifest.json ] || NODE_OPTIONS=--max-old-space-size=3072 NEXT_BUILD_CPUS=4 pnpm build; } && pnpm docker:start"
    networks:
      - eac-network
```
(Copy SUPABASE_ANON_KEY defaults from the fourthway block if .env does not set them.) No Nextcloud env needed: the app reads no media.

## 3. Proxy note (Nginx Proxy Manager, host arts-collective.com)
Add a custom location BEFORE the catch-all that sends the hub:
```
location /development {
    proxy_pass http://<docker host>:3031;     # same upstream style as the /books location on elkdonis-arts.org
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;   # Next HMR/streaming
    proxy_set_header Connection $connection_upgrade;
}
```
Do not strip the prefix: Next runs with basePath `/development`. `/development` and `/development/...` both match. The session cookie is the network's, so a signed-in admin arrives already signed in.

## 4. Gate
- Every page and the root layout call `requireNetworkAdmin()` (src/lib/gate.ts): `isAdmin(userId)` from @elkdonis/auth-server (users.is_admin).
- Signed out: 307 to `https://arts-collective.com/login?next=/development/<path>`. Signed in, not admin: 404.
- The app has NO server actions and NO route handlers. If one is added, call `getNetworkAdmin()` inside it.
- The block and theme data is read in server components and passed as props: not in the public JS. The block CODE is in the JS chunks under /development/_next/static (not secret: the same packages ship on every site).

## 5. Refreshing data
`node apps/development/scripts/refresh-data.mjs` copies blocks.json, themes.json, design-system.json from docs/open/DEVELOPMENT_APP_2026-11-20 into src/data (needs a rebuild to show).

## 6. Not done / unblocking app-only blocks
Blocks from apps/*/src/blocks use their app's "@/" alias, server code and CSS. To draw one here: export its block list from a workspace package (no "@/" imports, a sample() for data-driven ones), add a source in src/registry/sources.ts, and ship its CSS as a scoped sheet.
