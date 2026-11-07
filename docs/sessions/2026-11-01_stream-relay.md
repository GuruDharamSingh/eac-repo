# Handover: stream relay (2026-11-01)

Session B of `docs/open/BROADCAST_BOOTH_AND_RELAY_PLAN_2026-11-01.md`: the
server OBS streams once to our own relay, which copies the stream to every
ticked destination; feeds in publish to the relay and OBS reads them as
scenes. Built, deployed and verified on 2026-11-01. The full description and
evidence are in `docs/reference/nextcloud.md` "Stream relay". Nothing is committed.

## Current state
- `relay` compose service running (`eac-relay`; `docker/relay/{Dockerfile,start.sh,agent.mjs}`),
  eac-network only. `.env` gained `RELAY_AGENT_SECRET` and `RELAY_OBS_PASS`
  (`.env.example` lists them); compose passes them to relay, obs
  (`RELAY_OBS_PASS`) and arts-collective (`RELAY_AGENT_URL`, `RELAY_AGENT_SECRET`).
- Migrations 225 (another session's, pending ahead) and 226 applied 2026-11-01
  at the developer's go-ahead. Both relay tables are empty.
- OBS agent (`docker/obs/agent.mjs`): `POST /stream/relay`, `POST /feeds/add`.
  Services: `@elkdonis/services/relay`; `obsStreamToRelay`, `obsAddFeedScene` in `obs.ts`.
- arts-collective rebuilt and recreated 04:46 UTC by the booth session (one
  build for both sessions); `/studio` passes `relay` to the Go live card.
- OBS's stream settings point at the relay since the test run.

## Files
`docker/relay/*`, `docker-compose.yml` (relay service, three env lines,
`relay-data` volume), `.env.example`, `packages/db/migrations/226_stream_destinations.sql`,
`packages/services/src/relay.ts`, `packages/services/package.json` (`./relay`),
`packages/services/src/obs.ts` (two helpers), `docker/obs/agent.mjs` (routes, `addFeedScene`),
`apps/arts-collective/src/lib/relay-actions.ts`, `apps/arts-collective/src/app/studio/page.tsx`,
`packages/reels/src/editor/{RelayPanel.tsx,relay-types.ts,LiveCard.tsx,index.ts,video-studio.css}`.

## Open items
- Signed-in check passed 2026-11-01 (throwaway admin, deleted after). It found
  that Stop did not release the lease (`value: undefined` dropped by the
  server action); fixed in `RelayPanel.tsx`, rebuilt (05:30 UTC) and verified.
- One real YouTube or Facebook key end to end.
- Internet ingest for Zoom: publish 1935, forward it, show the public address.
- Feeds in on the console and desk: added 2026-11-01 (`extra` slot + `BroadcastTabContext`).
