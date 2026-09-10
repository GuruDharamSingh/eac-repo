# Network state audit — 2026-09-06

Seven-agent investigation: five parallel lane audits, one adversarial verification
pass, one cross-reference synthesis, then a mutual cross-check between those two.
Source reports were written to a session scratchpad; this file is the consolidated
result and is the only durable copy.

**Method note.** Every claim below survived at least one independent re-proof.
Claims that did *not* survive are recorded in "Corrections" rather than deleted,
because several of them are in earlier briefs and memory and will otherwise be
repeated. Read the caveat at the end before quoting any number.

---

## The verdict in one paragraph

The substrates are good and almost nothing adopts them. Across five independent
lanes the same shape recurred ~20 times: a well-built shared package, migration,
or engine, with 0–3 consumers, while the real work happens in per-app copies that
drift apart and rot separately. The two migrations that *fully* landed
(`threads` 030, `org_feeds` 073) are the only two that **dropped their predecessor
table**. That is the mechanism, and it is the most actionable finding in the audit:
in this repo, a migration lands when the old thing is deleted, and stalls
indefinitely when it is merely superseded.

---

## A. Security and data loss

Ranked by risk (severity × likelihood of being hit).

### A.1 — Open org self-join escalates to private media, and the leak is permanent
`apps/arts-collective/src/app/api/org/join/route.ts` lets any logged-in user join
any org as `member`, with no gate. `member` is exactly the role accepted by
`isOrgAffiliate`, `org_feeds.min_role`, and `canClaimStore`. Two requests, no
preconditions, and it defeats the entire `canReadMedia` programme by design.

Worse in combination: the new `canReadMedia` patch caches *authorized private*
media as `public, immutable` (6 routes + the shared factory). So an authorized
fetch is cached for a year — **revoking the membership row does not revoke the
leak**. Two routes already do this correctly (`inner-gathering:93`,
`pigeonshoot:100`); the fix was never propagated.

### A.2 — Unbounded write: one facilitator edit rewrites every member's profile
`apps/arts-collective/src/lib/cms/actions.ts:329-332`
```sql
UPDATE artist_profiles SET … WHERE org_id = (SELECT org_id FROM threads …)
```
No user filter, no LIMIT. Reachable through four live-editor traits, because
`packages/cms-bindings/src/workshop/field-registry.ts` declares five bindings on
that table. Highest *severity* single action in the repo. Un-fired only because
`elkdonis` — which holds 10 such rows — has zero workshops.

### A.3 — `elkdonis-arts-collective/api/media/file` is an anonymous groupfolder read
No session check, **no `/Private/` check**, admin credentials, serves SVG, no
`nosniff`. Worse than any single report stated. Relevant because that app is
slated to merge into the running inner-gathering.

### A.4 — SVG stored-XSS on four upload routes
`artdirect`, `amrit-canada`, `hidden-enneagram`, `ifac` accept `image/svg+xml`
and skip `validateUploadBuffer` — which already exists in `@elkdonis/utils` and is
used by four other apps. Two of the four are on live production domains.

### A.5 — A private individual is published as the organisation, on all 15 subdomains
`apps/arts-collective/src/lib/org.ts:103` still runs
`SELECT * FROM artist_profiles WHERE org_id = X LIMIT 1` — no `ORDER BY` — and
`community-dark/page.tsx` renders the result as the org's name, bio and city.
This is the debrief's "bug #1, fixed by migration 099." **It is not fixed.** 099
landed 15/15 in the data and 0% in the code it was written to delete. Verified
200 on `/sites/{elkdonis,inner-gathering,ifac}/community-dark` and via `Host:`
rewrite.

One report called this file dead; it is not. But it *is* the only consumer of
`org.ts:103` — so deleting it closes a live public bug and 958 lines at once.

---

## B. Broken for users today

| What | Where | Evidence |
|---|---|---|
| Most published content 404s on its own subdomain | `lib/org.ts:475` renders only `kind='workshop'`, but `/profile` links every feed item | 1 workshop 200s; a post, 2 meetings, a service all 404 |
| `apps/forum` is wholly non-functional | `getForumFeed`/`getThread`/`deleteThread` query `posts`/`meetings` | Both tables dropped by migration 030 (`to_regclass` → NULL) |
| Silex editor dead for every user | `/api/silex/token` needs a per-user app password | 1 of 50 users has one; it returns 401 |
| Blog authoring is create-only | `updatePost`/`deletePost` exist in `@elkdonis/services` with **zero** app callers | 0 draft rows; editor never sends `status` |
| `/artists` renders 29 duplicate React keys | roster falls back to `org_id='elkdonis'` for 29 of 35 people | 29 identical "Visit site" links |
| inner-gathering profiles show stale or empty data | reads legacy `artist_profiles` | 13 rows vs 35 people; 3 disagree with `users` |
| The one published Silex site is one row from vanishing | `packages/silex-render/src/published.ts:62-65` resolves username and password through independent `??` chains | yields `owner_username` + `admin_password` → 401, swallowed as "missing page" |

---

## C. Structurally blocking

- **Money.** Not a missing feature — `/studio/apply` writes `payout_email` and
  makes it required. **14 of 35 people already pass `canClaimStore` today and not
  one has ever opened the page.** `store` has 0 rows. There is no org-store UI.
  `packages/payments` is dead code — the registry is never instantiated, `stripe`
  isn't installed, and the live eTransfer path is `packages/commerce/src/etransfer/`.
  Whoever does Stripe wires the registry in for the first time.
- **The auction is not an auction.** `placeBid` is careful (row lock, increments,
  anti-snipe) but nothing ever *creates* a lot and nothing ever *closes* one — no
  code assigns `ended`/`sold`/`passed`, no cron, `reserve_minor` display-only,
  stored proxy maxima never read.
- **7 of 15 orgs have zero owners**, including `elkdonis` (11 members) and `ifac`
  (18 roster rows). ArtDirect's steward check is dead twice over — `'admin'` isn't
  a legal role *and* there are no owners — so everything falls to global `is_admin`.
  **Trap:** IFAC's "legacy" email allowlist is currently its *only* administrator
  path. Removing it as cleanup makes IFAC unadministrable.
- **Nothing is typechecked.** 0 of 15 apps define a `check-types` script, so
  `turbo run check-types --filter=<app>` silently runs a dependency's task.
- **Several apps cannot `next build`** because of the bare-exported `handleSignup`.
  The repo's own comment at `inner-gathering/api/auth/signup/route.ts:7` documents
  this. Fixed only in the apps that went to production.
- **No `template_id` column**, so template choice is hardcoded. The binding engine
  covers 1 template of 5; 90 hooks across four templates render lorem.

---

## D. The root causes, collapsed

Findings that looked like separate bugs and are not:

1. **Four Nextcloud "path bugs" are one bug.**
   `organizations.nextcloud_folder_path` — the column that records where an org's
   files live — is read by three arts-collective Silex routes and *nothing else*.
   All 15 media proxies hardcode `EAC_Network/${orgId}/`. The authoritative column
   drifts freely and each mismatch surfaces as a 404 in a different app: four live
   root conventions, art-auction writing `marketplace/…` its own proxy rejects,
   hidden-enneagram's proxy demanding a path that isn't where its folder is.
   `EAC_Network` is hardcoded 127 times across 67 files; `getOrgRootFolder()` is
   used nowhere outside its own package.

2. **`EAC_Network` is a Nextcloud *groupfolder* (id 2), which no code knows.**
   The repo treats it as a plain WebDAV path, which works only because the
   groupfolder mounts into the service account's namespace. Its all-orgs
   `read,write,share,delete` grant is in direct tension with the per-org share
   model in `org-provisioning.ts` — and `/api/silex/token` provisions new users
   straight into that group.

3. **`artist_profiles` is a live second identity system**, not legacy debt — ~20
   SQL sites across 3 apps and 3 shared packages, including the workshop field
   registry and `packages/commerce`.

4. **Per-user Nextcloud credentials do not exist.** `generateAppPassword()`
   returns the argument it was given. One credential is stored across 50 users and
   it 401s. Six linked users have NULL passwords by design, yet all seven carry
   `nextcloud_synced = true`, so anything gating on that flag is being lied to.
   Admin user-creation is blocked by a real password-confirmation gate on
   Nextcloud **33.0.6**, and the service account isn't an admin at all — it's
   subadmin of two groups. SSO is the working path, and the connect route exists
   only in inner-gathering.

5. **Authoring: six mechanisms, ~12 surfaces, one finished and used.**
   Per-app bespoke forms carry 100% of real content and have no shared substrate.
   The four substrates built to replace them have 3, 3, 1 and 0 adopters.
   Media routes: 15 read, 15 upload, 6 use the factory (3–4 lines each); the rest
   are hand-rolled at ≈1,860 lines — which is why one security fix has to be
   applied sixteen times.

---

## E. Corrections to earlier briefs and memory

| Claim | Reality |
|---|---|
| "Migration 099 fixed the org-identity bug" | Data yes, code no — still live on a public URL |
| "Three consumers of `artist_profiles`" | ~20 SQL sites, 3 apps + 3 packages |
| "No payment can complete network-wide" | Overstated. The UI exists and requires `payout_email`; nobody has applied |
| "`packages/payments` registry seam exists" | Dead code; never instantiated |
| "ArtDirect needs its own upload route" | It has one, and it's complete |
| "~10 media proxy / ~6 upload routes" | 15 / 15, with 6 factory files |
| "Nextcloud 29" / "localhost:8080" | 33.0.6, and the apps point at production `cloud.elkdonis-arts.org` |
| Service account name | Misspelled `eac_intergration` |
| "14 orgs" | 15 (`justing` created 2026-09-06) |
| Duplicate-092 collision | Genuinely resolved. But duplicate pairs `052` and `054` remain, with the same replay-order hazard |

Migrations are clean: 98 files, 98 applied, highest number 101, gaps at 001 and
026–029, zero checksum drift under independent sha256 diff.

---

## F. Two operational facts

**There is one database, and it is production.** Every container reads
`elkdonis_dev` *and* production Nextcloud. `psql \l` shows one database exists —
`elkdonis_dev` is a misnomer. This audit was read-only throughout, but every
observation above is of live production state.

**The instance has drifted ahead of the repo in both directions.** 35 Nextcloud
user folders exist, created by scripts that are still untracked. `amrit-canada`
was in an unrecoverable crash loop — its `.next` volume had a
`prerender-manifest.json` but no `server/` dir, so the compose sentinel guard
skipped the rebuild forever; root cause is an OOM kill at 31 workers under a 5GB
cap leaving a half-written `.next`. It recovered at 13:26. The memory cap was
then applied to `arts-collective`, which runs in dev mode and cannot hit the bug,
and **not** to either production-mode app. Both sentinel guards are unchanged.

---

## Caveat — do not quote these numbers without re-running

The working tree went from 9 modified files at session start, to 42 mid-audit, to
72 by the end, with `next.config.ts` touched 14 seconds before one agent's clock
read and `arts-collective`'s signup route fixed at 13:31:43 — *inside* the window
where an agent had already grepped it. A parallel session was actively editing the
same files this audit was reading.

Two consequences: the reported `tsc` error for arts-collective is retroactively
invalid (nobody re-ran it after 13:31), and the bare-export count moved during the
audit. **Whether arts-collective typechecks clean right now is an open question.**
Also unresolved: there is no ingress in this compose project, so where public DNS
actually terminates could not be proven from inside.
