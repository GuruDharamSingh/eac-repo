# Kickoff prompt — commerce & stores

Paste the block below to the next agent.

---

You're picking up commerce work on the Elkdonis monorepo (`/mnt/pool1/home/guru/eac`).

**Read `COMMERCE_HANDOVER_2026-09-05.md` at the repo root first.** It records what
was verified against the live database on 2026-09-05, which questions the user
has already answered, and which are still open. Don't re-derive it — but do
re-verify anything you're about to depend on, because several "existing"
features in this repo are complete code with zero rows.

Then read `CLAUDE.md` and the memory index.

## Start here

Roadmap step 2: **the `store` table**. Generalise store ownership so a store can
be owned by a **user or an org**, fold `marketplace_artists` in as the user case,
and add a nullable `stripe_account_id`. All the commerce tables are empty
(0 stores, 0 artwork, 1 test order), so this is the cheap window.

Constraints already decided — do not relitigate:

- **No `closes_at`.** Temporary/alternative stores are deferred.
- **No commission changes.** Leave the flat 30%.
- **An associated org can only sell once a real member claims it as owner.**
- **One cart per store**, so an order maps to exactly one payee.
- **Stripe Express *and* the core NFP account**, routed per payee: a store with
  `stripe_account_id` takes a destination charge, one without falls back to the
  platform account with manual settlement. The fallback is mandatory — Express
  onboarding is KYC and some payees never finish it.

## The thing most likely to be got wrong

When you reach the ledger (roadmap step 6), **make the party polymorphic from
the start** — `party_kind ('user' | 'org' | 'platform')`, not `artist_user_id`.
The existing `payout` table hardcodes a user FK, which is exactly why an org's
share can't be held today. Retrofitting means rewriting every payout query.

Balance is **derived by summing an append-only ledger**, never stored and
mutated. A reversal is a new negative entry.

## Repo conventions that will bite you

- **Data, not DDL** — prefer a table or an app-validated column to a CHECK enum.
  See migrations 073, 091, 093.
- **Next migration number is 094.** Two migrations briefly shared 092; that was
  fixed by renumbering *and* updating `app_schema_migrations` (tracking is by
  filename with a checksum — renaming a file alone makes the runner re-apply it).
- **Run `pnpm check-barrels`** (also runs inside `check-types`). Anything in a
  client-reachable package importing `@elkdonis/db` or `@elkdonis/services` needs
  its own subpath export, not a line in `index.ts`.
- **art-auction compiles without `strict`** — discriminated unions don't narrow
  there. Use flat `{ ok, error? }` result shapes.
- **Check `packages/` before writing anything shared.** This repo has repeatedly
  built a good shared thing and had one app adopt it while others kept copies —
  five slug helpers, five excerpt helpers, three content forms, four poll
  systems.
- Identity lives on `users`; an org controls only how it *presents* someone
  (`org_profiles`). See the header of `packages/services/src/profiles.ts`.

## Ask, don't assume

Two questions are still open and marked as such in the brief (§4): whose Stripe
account receives payout for an **org-owned** store, and what "resolved" means for
held org money. Both change the schema.

## Environment notes

Apps run in Docker off a bind-mounted tree. Most are `next dev`; inner-gathering
was switched to production mode (228 MiB vs 4.9 GiB) — `next build` needs *more*
memory than dev serving, so its `mem_limit` clears the build, not steady state.
Don't run a bare `pnpm install` on the host: the pnpm store path recorded in
`node_modules/.modules.yaml` is the container's, so host-pnpm offers to wipe all
42 workspace `node_modules`. Run installs inside a container instead.
