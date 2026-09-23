# Testing and verification

How to show that a change works on this host: what counts as evidence, how to
get an authenticated render, how to test origin-dependent behaviour, how to
screenshot, and how to exercise webhooks and bulk operations without damage.
Last verified: 2026-09-23 (tooling checked with `docker images`, `curl` to the
CDP endpoint, and the code cited; the session-minting procedure was not re-run
on this date).

## Current state

- There is no test suite and no CI. No `*.test.*` or `*.spec.*` files exist
  under `apps/` or `packages/` (find, 2026-09-23); the `CLAUDE.md` example
  `pnpm test src/app/api/posts/route.test.ts` refers to a file that does not
  exist. `pnpm test` runs smoke scripts in five packages: `astro`, `blocks`,
  `primitives`, `cms-bindings`, `tokens`.
- Root `pnpm check-types` = `turbo run check-types` + `scripts/check-client-barrels.mjs`
  + `scripts/check-workshop-fields.mjs`. Turbo only runs a workspace script
  named exactly `check-types`. `tsc` resolves shared packages through their
  built `dist`, so a stale `dist` can hide or invent errors; rebuild the package
  first when its types changed.
- Production-mode apps serve a prebuilt `.next`; a source edit has no effect
  there until the app is rebuilt (list and build dates in
  `docs/reference/ops.md`). Verify in a dev-mode app, or rebuild deliberately.
- Headless browser: the host has no runnable Chromium (the Playwright download
  in `~/.cache/ms-playwright` lacks `libatk-1.0.so.0`). The image
  `zenika/alpine-chrome:latest` (Chromium 124.0.6367.78) is pulled, and
  `playwright-core` 1.60.0 is installed at `/tmp/node_modules`. Host Node is
  v20.20.2. `node:22-alpine` and `node:24-alpine` images are present.
- Auth cookie: name is `SUPABASE_AUTH_STORAGE_KEY` or `sb-eac-auth`
  (`packages/auth-server/src/index.ts:50-52`), `@supabase/ssr` 0.5.2. GoTrue is
  reachable from the host at `http://localhost:9999` (no `/auth/v1` prefix).
  The service key is in `.env` as `SUPABASE_SERVICE_KEY`.
- A trigger `on_auth_user_created` on `auth.users` runs `handle_new_user()` and
  creates the `public.users` row. Check constraint
  `users_auth_user_id_matches_id` requires `users.id = users.auth_user_id`.
- Request-derived origins: `currentOrigin()`
  (`packages/auth-server/src/handoff.ts:45`) reads `x-forwarded-proto`, then
  `x-forwarded-host` or `host`. `nextUrl.origin` reports `0.0.0.0` inside these
  containers.
- Rich-text sanitizer: `sanitizeRichText` (`packages/utils/src/sanitize.ts:112`)
  with `ALLOWED_TAGS` (`:19`) and `ALLOWED_ATTR` (`:40`).

## What counts as evidence

- A status code proves the route compiled and nothing more: a 307 to `/login`
  on every route told nothing about the wiki UI (2026-09-11). Render the page
  and read the markup, or screenshot it.
- Assert on markup only the change can produce (a `data-*` attribute, a
  section heading), not on prose that may already be on the page.
- On a dev server, fetch twice and assert on the second response; the first
  request after a package rebuild can be served from the previous compile.
- Turbopack dev can serve a stale CSS chunk across a restart, because the chunk
  name is path-derived and `.next` is a volume. Fetch the chunk and grep for the
  value you wrote; fix with `rm -rf .next/*` inside the container, then restart.
- Features whose value is structural (trees, backlinks, tables of contents)
  need representative data before they can be judged.
- Some failures only show in a browser: a Radix `<SelectItem value="">` throws
  on the client while the server render is correct; a JSX attribute such as
  `glyph="✚"` renders the escape literally.

## Minting a session cookie
Procedure used 2026-09-13 to 2026-09-16; not re-run 2026-09-23.

1. Use a purpose-made email/password account. A Google-OAuth session's JSON is
   too large for one cookie, and the chunked form (`name.0`, `name.1`) written
   by hand was not reassembled (`/api/auth/session` returned `{user:null}`).
   A password account's session came to about 2,400 base64 characters.
2. Create it: `POST http://localhost:9999/admin/users`
   (`Authorization: Bearer $SUPABASE_SERVICE_KEY`,
   `{email, password, email_confirm: true}`). Do not insert the `users` row;
   the trigger does it. Add a `user_organizations` row only if the test needs a
   role.
3. Get tokens: `POST /admin/generate_link` `{type:"magiclink", email}` returns
   `hashed_token`; `POST /verify` `{type:"magiclink", token_hash}` returns the
   session. A password grant (`POST /token?grant_type=password`) also returns a
   session (**assumed**, not recorded as tried).
4. Cookie `sb-eac-auth=base64-<base64(JSON.stringify(session))>`. Appending
   `-auth-token` to the name does not authenticate.
5. `curl -H "Cookie: sb-eac-auth=…"` (with `-H`; `curl -b` mangled this cookie
   in an earlier session). Strip `<script>`, `<style>`, `<template>` before
   asserting on text.
6. Cross-check a doubtful cookie against a second app: a valid cookie
   authenticates on every app sharing the storage key.
7. Clean up in reverse: delete `user_organizations`, then `users`, then
   `DELETE /admin/users/<uid>` on GoTrue. A leftover `users` row with a slug and
   display name appears in public member rosters.

### Test accounts get purged
Other sessions delete test rows from `public.users` while GoTrue keeps the auth
user. The cookie still authenticates and `getCurrentUser()` returns an id, but
every membership query returns empty. When an authenticated render takes the
signed-out or no-membership branch, re-query the account's `users` and
`user_organizations` rows before investigating code.

### Without a session
To check an auth-gated client component, render it with `react-dom/server`
from a script inside the app directory (outside it, `react-dom` does not
resolve). Next apps set `jsx: "preserve"`, so use a sibling
`tsconfig.render.json` extending the app's config with `"jsx": "react-jsx"`,
`"module": "ESNext"`, `"moduleResolution": "Bundler"` and run
`tsx --tsconfig tsconfig.render.json <script>.mts`.

## Host headers and origins
`curl http://localhost:<port>` sends `Host: localhost:<port>`, so anything the
app derives from the request (SSO handoff targets, OAuth redirects, canonical
links, absolute URLs in email, Stripe return URLs) comes back wrong in a way
that looks like misconfiguration. On 2026-09-20 this caused an unnecessary
rebuild of the live IFAC site. Either send the proxy's headers:

    curl -H "Host: ifacgroup.com" -H "X-Forwarded-Host: ifacgroup.com" \
         -H "X-Forwarded-Proto: https" http://localhost:3008/login

or test through the edge with the right SNI (preferred):

    curl -k --resolve <host>:30022:127.0.0.1 https://<host>:30022/<path>

`https://127.0.0.1:30022` sends no SNI and nginx answers `unrecognized name`.
Before blaming an env var for a wrong origin, find whether the value is
request-derived or env-derived (`NEXT_PUBLIC_APP_URL`, baked at build); see
`docs/reference/ops.md`.

## Screenshots and browser checks
1. Start your own Chrome container with a unique name and host port; other
   sessions run `eac-shotter` on 9222 and `eac-shotter-captions` on 9241:

       docker run -d --name shot-<you> --network guru-eac_eac-network \
         --shm-size=512m -p 127.0.0.1:<port>:9222 --entrypoint chromium-browser \
         zenika/alpine-chrome --headless --no-sandbox --disable-gpu \
         --disable-dev-shm-usage --remote-debugging-address=0.0.0.0 \
         --remote-debugging-port=9222 --remote-allow-origins='*' about:blank

2. Drive it either from the host with
   `require('/tmp/node_modules/playwright-core').chromium.connectOverCDP('http://127.0.0.1:<port>')`
   (verified 2026-09-17), or with raw CDP from a throwaway
   `docker run --rm --network guru-eac_eac-network -v "$PWD":/work -w /work node:24-alpine node shot.mjs`
   (Node 22+ has a global `WebSocket`). CDP rejects a non-IP `Host` header, so
   connect by IP.
3. Connect to the existing page target's `webSocketDebuggerUrl` from
   `/json/list`. A new target made with `Target.createTarget` +
   `attachToTarget {flatten:true}` hung on every renderer call on Chrome 124.
4. Reach apps by compose service name (`http://art-auction:3009`) or by the
   container's IP on `guru-eac_eac-network`. `--network host` does not reach the
   published ports on this host. App containers have two IPs; select the one on
   the shared network:
   `docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{if eq $k "guru-eac_eac-network"}}{{$v.IPAddress}}{{end}}{{end}}' <c>`.
   The wrong IP gives `ERR_CONNECTION_TIMED_OUT` and a blank screenshot.
5. Set the cookie with `Network.setCookie` for the host you navigate to.
6. Use `waitUntil: "domcontentloaded"` and poll `document.readyState`. Dev
   servers hold an HMR connection open, so `load`, `networkidle` and the CLI
   `--screenshot` flag never finish.
7. Scroll the whole page before a full-page capture: cards use
   `loading="lazy"` and otherwise render as empty boxes.
8. Listen for `Runtime.exceptionThrown` / `page.on('pageerror')`, and check
   `document.documentElement.scrollWidth` against the viewport for overflow.
9. WebGL (three.js) pages need `--use-gl=angle --use-angle=swiftshader
   --enable-unsafe-swiftshader` instead of `--disable-gpu`.
10. Give every CDP call its own timeout, and write log lines to a file as you
    go: `process.exit(0)` drops buffered stdout. After many navigations a page
    target stops answering; recreate the container.
11. Remove the container afterwards and keep PNGs in the scratchpad, not the repo.

React input in scripted checks: set values through the prototype setter
(`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set`) and
dispatch `new FocusEvent('focusout',{bubbles:true})`; React's `onBlur` listens
to `focusout`, not `blur`. Then assert the row in Postgres.

### Previewing without touching a live app
Run a second container from `eac-dev` with the repo mounted and its own named
volume for `.next` (create the volume and chown it to 3003 first; a fresh
volume is root-owned and `next dev` fails with `EACCES`). Do not use
`--volumes-from` the live container: `next dev` would overwrite its production
build. Copy the live container's environment, raise
`NODE_OPTIONS=--max-old-space-size` (1024 is too small for a dev compile), and
note that `pnpm dev` listens on the port in its own `--port` flag.

Do not start a dev server inside a live app container with `docker exec`. On
2026-09-23 `next dev -p 3998` was run inside `eac-danamccool`, with a Chrome
container in its network namespace; about ten minutes later the container
had exited with code 0, was not marked OOM-killed and was not restarted by
`unless-stopped`. danamccool.com was down about 2.5 minutes until
`docker start`. The cause was not established; the host had about 2 GB free.
Check `free -m` before starting a preview. A dev server reached by container
IP rejects `/_next/*` requests and the HMR websocket (`allowedDevOrigins`), so
the page reloads in a loop.

## Testing through the write path
- A `tsx` probe that calls `packages/services/src/*` skips what the server
  action does first, including `sanitizeRichText`. The dictionary feature
  (2026-09-12) passed 27 assertions while `<dfn data-term>` was stripped on
  every real save.
- When editor output gains an element or attribute, add it to `ALLOWED_TAGS` /
  `ALLOWED_ATTR` and write at least one assertion through `sanitizeRichText`,
  with negative cases (`<script>`, `onerror`, `javascript:` URLs).
- Confirm by rendering a real saved row end to end.
- Postgres `timestamptz` keeps microseconds and a JS `Date` keeps milliseconds;
  compare round-tripped timestamps with `date_trunc('milliseconds', …)` on both
  sides.

## Webhooks
- Stripe uses one endpoint for the whole network:
  `https://market.arts-collective.com/api/stripe/webhook`
  (`apps/art-auction/src/app/api/stripe/webhook/route.ts`). Keys are live.
- `parseWebhook` (`packages/payments/src/providers/stripe.ts:231`) tries
  `STRIPE_WEBHOOK_SECRET`, then `STRIPE_CONNECT_WEBHOOK_SECRET`. Connected-account
  events (`account.updated`) reach only an endpoint created with `connect: true`,
  which has its own secret.
- The Stripe CLI is not installed on the host. To exercise the handler locally,
  sign a payload with `stripe.webhooks.generateTestHeaderString({payload, secret})`
  and POST it to `http://localhost:3009/api/stripe/webhook` (**assumed**, not
  run). The handler writes real rows (orders, seats); point it at a test order
  and remove the rows afterwards.
- To find out whether Stripe delivered anything, list events: the platform
  stream shows only `account: null` events; pass `Stripe-Account: <id>` to see a
  connected account's stream, where `pending_webhooks: 0` means no endpoint was
  listening.

## Bulk operations and data changes
- Run the dry-run first. Scripts with `--dry-run` or a separate `--apply`:
  `provision-org-circles.mjs`, `provision-org-deck-boards.mjs`,
  `provision-org-talk-rooms.mjs`, `provision-org-calendars.mjs`,
  `provision-user-folders.mjs`, `backfill-org-nextcloud.mjs`,
  `migrate-member-media-to-user-folders.mjs`, `apply-team-folder-acls.mjs`.
  Calendar reconciliation takes `{dryRun: true}` and returns `detail`.
- For deletes, run the statement inside `BEGIN; … ROLLBACK;` first: `users` has
  about 40 inbound foreign keys and several are `RESTRICT`.
- Confirm the exact target set with the user before acting on more than one
  row or org.

## Rules and constraints
- Render the page before reporting UI work done: status codes and service-level
  tests do not show the interface.
- Send forwarded headers or go through the edge when checking origins: localhost
  requests carry the wrong `Host`.
- Re-query the test account's rows before debugging an empty-membership render:
  other sessions delete them.
- Assert through `sanitizeRichText` for any editor-output change: the sanitizer,
  not the editor, decides what persists.
- Use your own browser container name and port and remove it afterwards: other
  sessions run their own on 9222 and 9241.
- Dry-run bulk scripts and wrap trial deletes in a rolled-back transaction.

## Open items
- No automated tests or CI; `CLAUDE.md`'s test command example is stale.
- The session-minting steps are not scripted; a small script under `scripts/`
  would stop each session from reconstructing them.
- The Stripe local-signing method is untested here.

## Sources
Memory: `feedback_verify_ui_by_rendering`, `screenshot_this_box`,
`localhost_curl_misreports_host`, `feedback_test_accounts_get_purged`,
`feedback_test_through_the_boundary`, plus the webhook facts from
`stripe_connect_webhook` and dry-run notes from `project_calendar_two_way` and
`org_structure_core_members` (those three remain with their own areas).

Correction recorded 2026-09-23: `feedback_verify_ui_by_rendering` says (2026-09-16)
that `eac-silex` left `guru-eac_eac-network`. On 2026-09-23 it is on both
`guru-eac_eac-network` and `nextcloud-aio` and runs Node 24.18.0. Do not drive
CDP from it regardless: it is a live service. Use the host `playwright-core`
route or a throwaway `node:24-alpine` container.
