# Content cornerstone: handoff (2026-11-27)

The next PM session for the content library and search should start here. Then read CONTRACT.md (§1–§17), the last sections of LEDGER.md, EXTENDING.md, and RETROSPECTIVE.md. Everything is on eris in `~/eac/docs/open/CONTENT_CORNERSTONE_2026-11-26/`.

## 1. What exists and is live

| Piece | State |
|---|---|
| **One index** `content_index` | Holds threads (incl. 8 services since 2026-11-27), artworks, files (~1.9k), and people (73 listed identities). Migrations 293, 294, 298, 299 and 300, each applied alone (263 and 295 are other lanes' and still pending). |
| **Freshness** | Write-path hooks, plus queue triggers (all pin `search_path`) drained on each search, plus a nightly job at 03:40 (`scripts/content-reindex-nightly.sh`, guru's crontab, log `~/eac-backups/content-reindex.log`). |
| **Search** | `searchContent`: scopes mine (+ managed orgs), org, site, person, network. Views published, files, all, people and offers. Partial-word text match, facets, keyset paging, and one rights rule (`contentReadSql`). Also `resolveContentRefs` and `suggestContent`. |
| **Routes** | `contentRoutes(host, { payments?, limiter? })`: search, suggest, resolve, folders, upload, and checkout + return when payments are passed. |
| **UI** | `ContentLibrary`, one component for the library, file browser and picker. `MediaLibrary` is a wrapper over it. |
| **Hub cards** | The round-2 dark "Artworks" card (Collect Art ↔ The collective, large tiles, suggestions, in-stack Edit), the Channel card, and `HubCardMount`. |
| **Assistant** | MCP `content.search`, `content.resolve` and `content.suggest` on arts-collective. Registry entries `artwork-hide`, `artwork-show` and `sales-refund` (all human-only). |
| **Checkout (v1.4)** | Mounted on arts-collective, sunjay and artdirect (no page on sunjay or artdirect calls it yet). Seller of record `oad`; payee and settlement unchanged. Redis rate limits, CSRF guard, verified hosts, idempotency keys. Network-sold services write a booking (shown in artdirect /bookings). |
| **Admin** | arts-collective `/hub/admin/sales`: all Stripe sales, read-only, with CSV export and an admin refund that takes an advisory lock and a per-order Stripe key. |

**Live builds (2026-11-27):**
- art-auction `3Um5aFVL2F_x0ZdineAR6`
- arts-collective `a1MQrakVxJqBncVHiIgwm`
- sunjay `l_jEFhVCAgeQlOndWVSWf`
- artdirect `_A_MaSJCswLDTIBiPF1NG`
- katie-the-potter `JEantk4r0PIknL08YgP_T`
- development `OojZQL3cuh6gwpt785S7c`

Backups are in `~/eac-backups/next/`.

## 2. What's left

**Needs Justin:**
1. **One real purchase** of a priced workshop or service on arts-collective, then check `/hub/admin/sales`, and try a refund on that order. Stripe keys are live-mode, so nobody has run a real session yet. That one purchase verifies: the Stripe session, metadata `sellerOrgId 'oad'`, the line org (the thread's org), the booking row for a service, and the admin view itself.
2. **Keeper policy:** may keepers edit other sellers' artworks? Today only the store's owner or roll can (enforced by the commerce save), so the hub card's in-stack Edit has only been verified in the harness.
3. **Where checkout shows up:** which pages on sunjay and artdirect should show a pay button. The routes are mounted, but nothing calls them.

**Build or engineering:**
4. **development app:** rebuild once another session's `packages/cms-ui/src/offer-surface/templates/note.tsx` is type-clean (2 errors as of 11:05).
5. **Rate-limit status code:** "Too many attempts" answers 400. Prefer 429 (small change in `checkout.ts`).
6. **Market Channel:** it lists only stores the market org owns or pins (1 piece). A market-wide view needs a loader option in `packages/channel`.
7. **Retire the old copies** (Step 7 remainder):
   - the five `components/manage/content-row-actions.tsx`
   - the `MediaLibrary` wrapper (once elktours uses `ContentLibrary` directly)
   - `/admin/artworks` and `/admin/content` → redirect to `/hub/...` once the market lane redirects `/admin`
   - `packages/studio/src/channel/`
8. **Puck picker:** server-side search in the direct-edit drawer needs an optional `search` on `RecordSources`. That's shared editor code; go through `LIAISON/HOUSE_EDITOR_PM.md`.
9. **`listing_kind` facet** (artist / organization / associated): ArtDirect team, computed in the people-view query. Confirm it shipped.
10. **"Write about it" / "Use in a post"** on the piece frame: not drawn, because the package has no hrefs for them.
11. **ops.md is wrong about backups:** it says `backup-db.sh` runs from guru's crontab. It moved to root's TrueNAS cron on 2026-10-14. Confirm that job runs, and fix the doc.

**Deferred by Justin:** an owner opt-out from reuse (its home would be `content_prefs.never`).

## 3. Lanes on 2026-11-27

- **Market lane** (session "Market arts-collective /center page redesign"): owns `apps/art-auction/src/app/{center,hub}/**`. Its session had ended at last contact.
- **ArtDirect / WorkingArts team** (session "Store signup membership requirement"): owns v1.3 (people), v1.4 (offers, checkout, bookings, sales view) and artdirect. Its agents write in the main checkout at Justin's choice.
- **Media lane:** owns upload paths and elktours media. MediaLibrary is folded into ContentLibrary.

## 4. Rules that kept things safe (keep them)

- **Additive only. Type-clean at every save. Implementations first, exports last.** Prefer a worktree or overlay; copy in only when tsc is clean across importing apps.
- **Builds ship the shared tree.** Before building, wait for a quiet tree (`find packages/*/src apps/<app>/src -mmin -5`), run tsc, ask the other lanes to pause saves, and back up `.next`.
  - **Restoring a failed build:** `.next` is a mount point. Empty it in place (`find .next -mindepth 1 -maxdepth 1 ! -name cache -exec rm -rf {} +`) and untar the backup. Never `rm -rf .next` (ops.md has the note).
  - **A Google Fonts error is transient.** Rebuild.
  - **arts-collective** needs `docker update --memory 9g --memory-swap 14g` for the build, then back to 5g/10g.
- **Migrations go in ALONE:** the file plus its tracker row with sha256, under lock 7246001, then `--status` and `--verify`. Never a plain migrate.
- **Every trigger function pins `search_path`.** GoTrue writes `users` without `public` in its path. Migration 298 broke sign-ups for about 77 minutes, and 299 fixed it.
- **Test accounts only.** Signed-in checks seed through GoTrue and clean up with a zero-row proof (watch the side effects on `org_profiles` and `person:` queue keys). Use Stripe test mode only, or stop at the session URL when the keys are live.
- **Payments:** any payment-path code gets a PM review before it counts as done. Enabling checkout on an app needs Justin's go per app.
- **Privacy:** never return an email, never link a pseudonym to its account, and list only `directory_listed` identities. Raw cloud files never appear in network or person scopes (§14).

## 5. Useful commands

- **Checks:** `cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/packages/content admin ../db/node_modules/.bin/tsx scripts/check-search.mts`. Also `check-files.mts`, `check-suggest.mts`, `check-checkout.mts`.
- **Reindex:** `scripts/content-reindex.mts --reconcile --fix [--stores=thread]`; files with `scripts/content-files-reindex.mts --all`.
- **Harnesses:**
  - `scripts/channel-harness/` (library, lightbox, check-library)
  - `scripts/channel-harness/hub-content/` (the round-2 popup; its `shot.mjs` writes to `/png`, so mount `-v $H/png:/png`)
- **Design canvas:** https://claude.ai/artifact/22qV3uU48pYWQDzwoY9UQV (Round 1 and Round 2). The survey of the surface model: https://claude.ai/artifact/Nr2NjuTRMa727Y29Ng1Nyb.
