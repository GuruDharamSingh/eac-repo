# Handoff — 2026-09-17

Two changes on `elastrocal-and-network-work`, both uncommitted.

---

## 1. `@elkdonis/services` now exports SOURCE, not `dist`

**Why:** it was the only thing in the identity work that kept tripping. Two
distinct problems: (a) editing services did nothing until you rebuilt, and a
stale `dist` hid real errors; (b) `dist` is root-owned, so a host-side
`pnpm --filter @elkdonis/services build` dies with `EACCES` and must be run
inside a container.

**Precedent:** 24 of 34 packages already export source; only 10 still ship
`dist`. Seven apps *already* listed `@elkdonis/services` in
`transpilePackages` even though it shipped `dist`.

**What changed**

- `packages/services/package.json` — `main`/`types`/`exports` → `./src/…`
  (incl. the `./agreements` subpath); `build` + `dev` scripts removed; `files`
  dropped. Turbo's `build` is `dependsOn: ["^build"]`, so a package with no
  build script is simply skipped.
- `packages/services/tsup.config.ts` — deleted.
- `packages/services/dist/` — deleted (from inside the container; it was
  root-owned).
- `transpilePackages` gained `"@elkdonis/services"` in: **admin, art-auction,
  artdirect, arts-collective, elkdonis-arts-collective, ifac, inner-gathering**.
- `packages/openclaw-bridge/tsup.config.ts` — gained
  `noExternal: ['@elkdonis/services']`. It still ships `dist`, so it must now
  *bundle* services rather than leave an unresolvable `.ts` import.
- `packages/services/src/bytes.ts` — **new.** `asBody` / `asBodyOrBlob`:
  zero-copy `Buffer` → `Uint8Array<ArrayBuffer>` views. Compiling services
  source under an app's DOM-lib tsconfig rejected `Buffer` as `BodyInit`
  (2 sites: `media-serve.ts`, `nextcloud.ts`). Note `Uint8Array<ArrayBuffer>`,
  not the default `ArrayBufferLike` — since TS 5.7 the array is generic in its
  backing store and `BodyInit` refuses the union (it admits SharedArrayBuffer).

**There is no build step for services any more. Just edit it.**

### The trade-off you need to know about

`dist` gave *isolation*: a broken file in services could not fail an app's
typecheck. Source does not. **A half-finished file in `packages/services/src`
now fails `tsc` in every app.** Right now `gather.ts` (another session's live
file) contributes 2 errors everywhere — not from this work, and they move
around as that session edits.

### Verified

`tsc --noEmit` per app, after the switch:

| clean | pre-existing failures, unrelated |
|---|---|
| arts-collective **0**, art-auction 0, artdirect 0, amrit-canada 0, danamccool 0, forum 0, innergathering 0, hidden-enneagram 0, pigeonshoot 0 | admin (34: `@elkdonis/openclaw-bridge` unbuilt, root-owned `tsconfig.tsbuildinfo`, implicit `any`), ifac (4: stale `.next/types/validator.ts` pointing at the old `/api/admin/*` routes) |

`turbo run check-types` aborts early on a **pre-existing** `@elkdonis/cms-bindings`
failure (3 hub bindings with neither `from` nor `fallback`) — not this work.

---

## 2. Identity model: one account, several names

Full brief at **`IDENTITY_MODEL_BRIEF_2026-09-17.md`**. Short version:

`public.users` is an *identity*, not an account — 34 of its 54 rows have no
GoTrue login. Every content table points at the identity
(`threads.author_id`, `media.uploaded_by`, `store.owner_user_id`). So a pen
name is an ordinary `users` row with no login plus one recorded fact: which
account may speak as it. **No content table changed.**

- **`packages/db/migrations/132_identity_control.sql` — WRITTEN, DRY-RUN
  VERIFIED, NOT APPLIED.** The sandbox blocked the write. `129_email_template_
  config_decode.sql` is also pending and belongs to someone else; the runner
  applies *all* pending in order, so check first:
  `docker compose exec forum sh -c "cd /app/packages/db && node scripts/migrate.mjs --status"`
- Numbered **132** because another session already applied a `131_thread_gathers.sql`.
- `packages/services/src/identities.ts` — `getIdentityIds`, `listActingIdentities`,
  `resolveActor`, `createPseudonym`, `retire`/`restorePseudonym`, `accountForIdentity`.
- **`author_id = viewer` is a VISIBILITY GRANT here, not just an ownership
  test** — widened to `= ANY(identityIds)` in `forum.ts`, `forum-search.ts`,
  `forum-people.ts`, `forum-write.ts`, `media-authz.ts`. Un-widened, your first
  post under a pen name goes invisible to you.
- **`packages/services/src/gather.ts:122` has the same clause and was NOT
  widened** — it is another session's file. Failure mode is under-visibility,
  never a leak. Add `identityIds` to `GatherViewer` and swap the clause when
  that work lands.
- Rate limit moved from per-`author_id` to per-account.
- UI: `identities` surface + `IdentitiesFace` in `@elkdonis/cms-ui`, a **Signed**
  picker above compose's fields (new threads only), `/api/hub/identities` in
  arts-collective, `createThreadAction(input, { actingAs })` → `resolveActor`.
- `organizations.created_by` added. Backfill is an inference from the earliest
  owner, and **7 orgs have no owner row** so it stays NULL for them: `elkdonis`,
  `ifac`, `oad`, `market`, `sunjay`, `guru-dharam`, `fourth_way_book_readers`.

**Nothing has run end-to-end** — `identity_control` does not exist until the
migration runs. That is the one gate.

**Unsettled:** `users.payout_email` / `stripe_account_id` / `store.owner_user_id`
sit on the identity row, so a pen name would carry its own payout fields.
Under the settled money model (maker is payee, migrations 096–098) payouts must
resolve to the controlling account. Not enforced.

---

## Gotchas worth carrying

- This repo compiles with `strict: false`: `!result.ok` does **not** narrow a
  discriminated union. Use `result.ok === false` (their own convention).
- `@elkdonis/cms-ui` exports source (no build). `@elkdonis/db`,
  `@elkdonis/types`, `@elkdonis/auth-server`, `@elkdonis/openclaw-bridge` and
  six others still ship `dist` — same rebuild trap services just left.
- Don't restart `eac-arts-network`: its build is broken and its `.next` is empty.
