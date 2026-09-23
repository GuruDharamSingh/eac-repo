# Findings index — referenced, with conflicts and open questions

Companion to `AUDIT_2026-09-06_network_state.md`. That file is the narrative; this
one is the citation list, organised for going through part by part.

Seven agents produced this: five lane audits (`01` Nextcloud, `02` DB/org layout,
`03` arts-collective, `04` ArtDirect + art-auction, `05` blog/Silex/authoring),
one adversarial verifier (`06`), one cross-reference synthesist (`07`). `06` and
`07` then reviewed each other. Attributions below name which agent found what, so
you can see whether a claim was cross-checked or rests on one pass.

## Legend

| Mark | Meaning |
|---|---|
| **[V]** | Verified — a command was run and its output read |
| **[A]** | Assumed — read from code, not exercised |
| **[!]** | Agents disagreed; resolution given |
| **[?]** | Open question — needs your decision, not more investigation |
| **[~]** | Moving/stale — the tree changed during the audit; re-run before quoting |

---

# 1. Storage — Nextcloud and `EAC_Network`

**Your decision, recorded:** `EAC_Network` is the main root path. Everything below
is measured against that.

### 1.1 `EAC_Network` is a groupfolder, and no code knows it **[V, 01]**
Groupfolder id 2, backed by group `EAC_Network`, on disk at
`/mnt/ncdata/__groupfolders/2/files/`. The repo treats it as a plain WebDAV path
under the service account — which works only because the groupfolder mounts into
that account's namespace. `occ groupfolders:list` output in `01 §1`.

Consequence to weigh against your permissions work: the groupfolder grants
`read, write, share, delete` to **every member of the group, for every org's
files**. That is a broader grant than the per-org share model in
`packages/nextcloud/src/org-provisioning.ts` intends. Both are live and they
disagree. `apps/arts-collective/src/app/api/silex/token/route.ts:54` provisions
new users straight into that group. **[?]** — `01` and `07` both flagged this as
unresolvable from code: which model is the intended end state?

### 1.2 Four root conventions live in one column **[V, 01]**
`organizations.nextcloud_folder_path`:

| Value | Orgs |
|---|---|
| `EAC_Network/<org>` | 9 |
| `EAC-Network/fourth_way_book_readers` | 1 — **hyphen typo, points at nothing** |
| `eac/hidden-enneagram` | 1 — legacy lowercase |
| NULL | 6 — incl. `ifac` and `pigeonshoot`, which have real populated folders |

`apps/arts-collective/src/app/api/silex/token/route.ts:133-135` has an escape
hatch whose regex `^EAC[_-]Network\/` **accepts the hyphen typo** rather than
flagging it.

### 1.3 The path bugs in three apps are one bug **[V, 07 — the best structural insight in the set]**
`organizations.nextcloud_folder_path` is read by **three** arts-collective Silex
routes and by nothing else. All 15 media proxies hardcode `EAC_Network/${orgId}/`.
So the authoritative column drifts freely and each mismatch surfaces as a 404 in a
different app:

- `apps/hidden-enneagram/src/app/api/media/[...path]/route.ts:39` requires
  `EAC_Network/hidden-enneagram/`; that org's folder is `eac/hidden-enneagram`.
  Its media proxy rejects every one of its own files. **[V, 01 + 05 + 06]**
- `apps/art-auction/src/app/api/upload/route.ts:15,112` writes `marketplace/…`;
  `apps/art-auction/src/app/api/media/[...path]/route.ts:31` accepts only
  `EAC_Network/`. `MARKETPLACE_NEXTCLOUD_ROOT` is empty in the container. Every
  upload returns a URL its own proxy 404s. **[V, 04]**
- `packages/services/src/media-authz.ts:34,62` `parseMediaPath` accepts only
  `^EAC[_-]Network$` as segment 0 and denies otherwise — so `eac/`-rooted media is
  now denied twice over. **[V, 06]**

**Given your decision, the fix is mechanical:** normalise the two non-conforming
rows and the six NULLs onto `EAC_Network/<org>`, then make the column the single
read path. `getOrgRootFolder()` / `getOrgFolderPath()` already exist for this.

### 1.4 The abstraction nobody uses **[V, 01; count corrected by 06]** **[!]**
`EAC_Network` is hardcoded in **127 places across 67 files** (01 said 166/72; 06
re-ran it — 06 is right, 01's substance stands).
`getOrgRootFolder` / `getOrgFolderPath` / `NEXTCLOUD_ORG_ROOT_FOLDER` are
referenced **only** inside `packages/nextcloud/src/` plus two untracked scripts.
Zero app code. Setting the env var today would relocate provisioning and break
113 read paths.

### 1.5 The fake app password — what it actually means **[V, 01; re-confirmed 06]**
You said you don't know what to make of this. Here is the whole of it:

`packages/nextcloud/src/users.ts:176-185`:
```ts
export async function generateAppPassword(
  _adminClient: NextcloudClient, _userId: string, fallbackPassword: string
): Promise<string> {
  // Today we store the same credential we set on the Nextcloud user.
  return fallbackPassword;
}
```
Both client arguments are discarded. So `users.nextcloud_app_password` holds the
**account password**, not a scoped app password: it confers full account access
and is revoked by any password change.

What follows from that:
- **1 of 35 persons has a stored credential, and it returns 401** when tested live
  **[V, 01]**. Effective count of working per-user credentials: **zero**.
- The other linked users are stored with NULL passwords **by design**
  (`users.ts:62-63` — "we don't know this account's real password"), yet **all of
  them carry `nextcloud_synced = true`**. Anything gating on that flag is being
  lied to. **[V, 01]**
- Minting real ones is blocked: `POST /ocs/v2.php/cloud/users` → **403 "Password
  confirmation is required"** on Nextcloud **33.0.6** (not 29 as CLAUDE.md says),
  and independently the service account `eac_intergration` (**misspelled**) is not
  an admin at all — subadmin of two groups. **[V, 01]**
- The working path is self-service SSO via `sociallogin` 6.5.4. The connect route
  exists at `apps/inner-gathering/src/app/api/nextcloud/connect/route.ts` and
  **has no equivalent in arts-collective**. **[V, 01]**

**So the practical reading:** per-user Nextcloud credentials are not a broken
feature, they are an unimplemented one with no path forward on this Nextcloud
version. The service account works everywhere (207/200 verified). Everything that
matters already uses it — all 15 media proxies, and `/api/silex/layout` was
migrated with a comment explaining why. The remaining per-user consumers are
`/api/silex/token`, Talk room creation, calendar sync, the calendar webhook, the
admin calendar debug route, and the session credential cache (`01 §4` has the
table). **The decision this really poses is whether Silex should use the service
account too** — which would make the editor work for everyone instead of nobody.

### 1.6 The latent Silex bug you flagged for a subagent **[V, 01; re-confirmed 06]**
`packages/silex-render/src/published.ts:62-65`:
```ts
const username = owner?.nextcloud_user_id ?? process.env.NEXTCLOUD_ADMIN_USER ?? null;
const password = owner?.nextcloud_app_password ?? process.env.NEXTCLOUD_ADMIN_PASSWORD ?? null;
```
Two `??` chains evaluated **independently**. A row with a non-NULL
`nextcloud_user_id` and a NULL password — which is 7 of the 8 linked users —
yields `username = <that user>` paired with `password = <service account>`.
Guaranteed 401, and `published.ts:71-75` swallows it, so it surfaces as a
**missing page**, not an auth error.

Not firing today only because the one published Silex site names
`elkdonis-2097f920-…`, which has no `users` row, so both chains fall through
cleanly. **It is one linked user away from the only working Silex site silently
vanishing.** This is a genuinely small fix (resolve the pair together, or drop to
the service account) and does not need a subagent unless you want the wider
"should Silex use the service account" question answered with it.

### 1.7 Instance leads the repo **[V, 01]**
`ensureUserFolder()` in `org-folders.ts` is an unstaged diff;
`scripts/provision-user-folders.mjs` and
`scripts/migrate-member-media-to-user-folders.mjs` are untracked — yet **35 user
folders exist live** under `EAC_Network/users/`, exactly the 35 person-users, with
the 15 org-entity users correctly skipped. This is your groupfolder work. Worth
committing so the repo describes the instance.

Also live and probably unwanted: `EAC_Network/artdirect/Media/Images/claude-hub-test/`
(the `@deprecated` pseudo-org path from `org-folders.ts:159-165`), a loose
`openbook.jpg` at the groupfolder root, and permanent folders for obvious test
rows (`lkhsdgfikusydfg`, `jane-doe`, `testesagfsdfsdfsadgsfgdh4ety457635gwrsvr11`).

**[?]** `hidden-enneagram` exists in **four** places (groupfolder, service
account's `eac/`, and two directories inside `elkdonis-2097f920-…`, one of them a
*personal* folder literally named `EAC_Network` shadowing the groupfolder). `01`
could not determine which is authoritative and the Silex publish path names the
personal account.

---

# 2. Identity — closing down `artist_profiles`

**Your decision, recorded:** it goes. Merge into `users`; a side table for
questionnaire answers is acceptable; keep it reachable from `account` on any hub
page.

### 2.1 Why it never died: 099 landed in the data and 0% in the code **[V, 02 + 06 + 07]**
All 15 orgs have a `profile_user_id` → `entity_type='organization'` users row.
But `apps/arts-collective/src/lib/org.ts:103` still runs the exact query migration
099 was written to delete:
```sql
SELECT * FROM artist_profiles WHERE org_id = … LIMIT 1   -- no ORDER BY
```
and the result renders as the org's own name/bio/city at
`apps/arts-collective/src/app/sites/[slug]/community-dark/page.tsx:928-936`.

**[!] The one conflict that changed severity.** `03` called `community-dark` dead
code (0 external referrers). `06` proved it **200s publicly** on every org
subdomain, both via `/sites/…` and via `Host:` rewrite, because
`middleware.ts:132-140` rewrites any non-passthrough first segment. `07` had
inherited `03`'s error and written the bug off as latent; it accepted the
correction. **Resolution: `02` and `06` are right.** The bug is live, public and
unauthenticated on all 15 org subdomains — and `elkdonis`, with 10
`artist_profiles` rows, is exactly where it produces the most wrong output.

Silver lining `06` found: `community-dark` is the **only** consumer of
`org.profile`, so deleting that file closes the public bug and 958 lines at once.

### 2.2 The unbounded UPDATE — highest severity single action **[V, 02; re-proved 06]**
`apps/arts-collective/src/lib/cms/actions.ts:329-332`:
```sql
UPDATE artist_profiles SET ${db(apCols)}
WHERE org_id = (SELECT org_id FROM threads WHERE id = ${threadId})
```
No `user_id`, no `LIMIT`. One inline facilitator edit rewrites **every member's
personal profile row in that org**.

It is **committed code, not in-flight** — `06` checked `git diff` on that file.
It is reachable: `updateWorkshopFieldByTraitAction` (`actions.ts:232`) resolves
through `fieldRegistry` and routes four editable traits into this arm —
`fullName`, `pronouns`, `facilitatorBio`, `photoPath`
(`packages/cms-bindings/src/workshop/field-registry.ts:241,249,272,286`;
`roleTitle` at `:264` is readonly and blocked at `actions.ts:239`).

Blast radius: `elkdonis` has 10 rows and 0 workshops; `inner_group` has 1 row and
the only published workshop. **One workshop created under `elkdonis` turns a
facilitator-name edit into a 10-row identity wipe.**

### 2.3 The authoritative consumer list **[V, 06 §3.5 — both earlier counts were wrong]** **[!]**
The debrief said 3 consumers. `02` said 8 modules across 5 apps and 2 packages.
`07` said 20 source files across 5 apps and 4 packages. `06` re-grepped, excluded
comment-only files, and settled it: **20 SQL sites across 3 apps and 3 packages.**

`07`'s inflation came from counting header comments *explaining that the table was
superseded* (`packages/services/src/profiles.ts:7,18,27`) as evidence the
migration is incomplete — it accepted this correction.

**Writers — 8 modules, 2 apps:**

| Location | Op |
|---|---|
| `apps/arts-collective/src/app/api/wizard/save/route.ts:72,79` | INSERT + UPDATE |
| `apps/arts-collective/src/app/api/wizard/submit/route.ts:40` | INSERT |
| `apps/arts-collective/src/app/api/wizard/business/save/route.ts:65,71` | INSERT + UPDATE |
| `apps/arts-collective/src/app/api/wizard/business/submit/route.ts:58` | INSERT |
| `apps/arts-collective/src/app/wizard/confirm/actions.ts:13` | UPDATE |
| `apps/arts-collective/src/app/api/org/create/route.ts:101` | INSERT |
| **`apps/arts-collective/src/lib/cms/actions.ts:330`** | **UPDATE — unbounded (§2.2)** |
| `apps/inner-gathering/src/app/api/profile/route.ts:78-139` | INSERT … ON CONFLICT, 26 cols |

**Readers — 12 SQL sites, 3 apps + 2 packages:**

| Location | Shape |
|---|---|
| `apps/arts-collective/src/lib/org.ts:103` | `WHERE org_id … LIMIT 1`, no ORDER BY — §2.1 |
| `apps/arts-collective/src/lib/org.ts:424` | `LEFT JOIN ap ON ap.org_id = t.org_id` → facilitator |
| `apps/arts-collective/src/lib/org.ts:473` | same, single-workshop fetch |
| `apps/arts-collective/src/lib/network.ts:104` | same join, for event `city` |
| `apps/arts-collective/src/lib/profile.ts:62` | `WHERE user_id` — safe shape |
| `apps/inner-gathering/src/app/api/profile/route.ts:20` | GET |
| `apps/inner-gathering/src/app/api/profile/[userId]/route.ts:32` | GET |
| `apps/inner-gathering/src/app/(app)/profile/[userId]/page.tsx:32` | page render |
| `apps/amrit-canada/src/lib/data.ts:361` | user-scoped — safe |
| `apps/amrit-canada/src/app/manage/people/page.tsx:44` | `WHERE org_id` |
| **`packages/silex-render/src/queries.ts:168`** | shared pkg — same facilitator join |
| **`packages/commerce/src/queries/index.ts:1190,1196`** | shared pkg — `EXISTS` membership tests |

Plus **`packages/cms-bindings/src/workshop/field-registry.ts`** declares 5 bindings
against the table (`:241,249,264,272,286`) and `audit.ts:47` lists it in
`MODELLED_TABLES`. It does not query — but it is **what routes writes into §2.2**.

`directory_profiles` is near-dead: **1 row** (a "Jane Doe" stub under `org_id='oad'`
with `user_id = NULL`), one live consumer —
`packages/cms-bindings/src/dossier/field-registry.ts:11` hardcodes
`table: "directory_profiles"` for 12 bindings.

### 2.4 What the divergence already costs users **[V, 02]**
13 `artist_profiles` rows against 35 people; only 3 non-stub; 3 disagree with
`users`:

| Org | `users.display_name` | `artist_profiles.display_name` | Note |
|---|---|---|---|
| hidden-enneagram | `aeon` | `Ario` | |
| elkdonis | `sarahchodos452` | `sarah chodos` | |
| elkdonis | `Dana McCool` | `Dana McCool` | **bio + avatar in `users`, both EMPTY in `artist_profiles`** |

Because `apps/inner-gathering/src/app/(app)/profile/[userId]/page.tsx:32` reads the
legacy table, that app shows the stale values and shows **nothing at all for the 22
of 35 people who have no row**. This is the same "near-empty network" symptom
`network.ts:24-30` documents having fixed for arts-collective's surfaces and did
not generalise.

### 2.5 For the "keep it reachable from account" half
`apps/arts-collective/src/lib/hub-cards.ts` — only 2 of 8 `HUB_CARDS` are
`available: true`, and both point at the wizard that writes `artist_profiles`
(`/wizard`, `/wizard/business`). `apps/arts-collective/src/lib/profile.ts` is the
"profile complete?" logic and reads the legacy table. Those are the two places the
questionnaire side-table would attach. **[V, 03]**

**[?] `02` left open:** `scripts/check-workshop-fields.mjs:58-72` flags that the
workshop facilitator read/write paths disagree on `artist_profiles.role_title`,
dated 2026-09-06, in an untracked file. Mid-fix or known-open? It sits directly on
the §2.2 path.

---

# 3. Membership authority and naming

**Your decision, recorded:** align IFAC and all orgs to a standard naming
convention with real weight.

### 3.1 The naming problem is in the data, not just the code **[V, 02]**
`organizations.id` and `.slug` disagree for **3 of 15**:

| id | slug |
|---|---|
| `amrit_canada` | `amrit-canada` |
| `inner_group` | `inner-gathering` |
| `fourth_way_book_readers` | `4th-way-book-readers` |

The `id` is what every `org_id` column and every hardcoded app constant uses; the
`slug` is what URLs and domains use. `02` names this as **the source of the
underscore/hyphen confusion throughout the code** — and it is the same split that
produced the `EAC-Network` vs `EAC_Network` typo in §1.2.

Also: `market`'s org-identity user took the slug `market-org` because `market` is
in `RESERVED_SLUGS` (`packages/utils/src/reserved-slugs.ts:16`) — the only org
whose profile slug ≠ org slug.

### 3.2 Six mechanisms decide "can this user edit this org" **[V, 02 §5 + 07 Seam 3]**

| Mechanism | Rule | Verdict |
|---|---|---|
| `packages/services/src/org-membership.ts` | `user_organizations.role`; cannot grant global admin | **AUTHORITATIVE** — 20+ call sites |
| ~15 raw-SQL checks | each re-implements the subquery | **DRIFTING** — incl. two *inside* `packages/services` itself (`profiles.ts:402`, `org-domains.ts:118`), which don't call their own sibling |
| `packages/auth-server/src/index.ts:212-237` `checkOrgAccess` | raw, `auth_user_id` fallback join | **DRIFTING** — a second shared package duplicating `hasOrgRole` |
| `apps/ifac/src/lib/data.ts:122` email allowlist | `siteConfig.ownerEmails`, checked **first** | **LOAD-BEARING — see 3.4** |
| `apps/artdirect/src/lib/oad.ts:294-298` | `role IN ('owner','admin')` on `elkdonis` | **STRUCTURALLY DEAD — see 3.3** |
| `POST /api/org/join` | none | **NO GATE — see 3.5** |
| `packages/services/src/media-authz.ts:124` `isOrgAffiliate` | `user_organizations` OR `org_profiles` | **deliberate, documented exception** |
| `apps/ifac/src/app/api/admin/users/route.ts:32` | raw `INSERT … ON CONFLICT DO UPDATE SET role` | role grants that never pass through `setOrgRole` |

The legal roles are `owner | guide | member | viewer` (CHECK on
`user_organizations`).

### 3.3 Two checks are structurally unreachable **[V, 07; re-proved 06]**
**7 of 15 orgs have zero owners** — including the two most-built-out:

| Org | Members | Owners |
|---|---|---|
| `elkdonis` | 11 | **0** |
| `ifac` | 1 (18 `org_profiles` roster rows) | **0** |
| `guru-dharam`, `market`, `oad`, `fourth_way_book_readers`, `sunjay` | 0 | 0 |

So `apps/artdirect/src/lib/oad.ts:294-298` is dead **twice over**: `'admin'` is not
a legal role *and* `elkdonis` has no owners. Every ArtDirect steward decision falls
through to global `users.is_admin`. The identical `'admin'` bug is documented as
already-fixed at `apps/arts-collective/src/lib/org.ts:142`.

`network-admin.ts:172` already reports "no owner" as a health issue and nothing
acts on it.

### 3.4 The IFAC trap — read this before touching the allowlist **[V, 07; confirmed 06]**
`apps/ifac/src/lib/data.ts:120-140` `canManageIfac` checks
`siteConfig.ownerEmails` (`info@ifacgroup.com`) **before** the role query. Every
other app's comments say the allowlist was removed. But IFAC has **0 owners and 1
guide** — so **the allowlist is currently IFAC's only administrator path.**
Removing it as cleanup makes IFAC unadministrable. Neither `06` nor any of the
five named this; `07` found it and `06` confirmed and called it a real trap.

The alignment order that avoids the trap: **seed owners first, then remove the
allowlist.**

### 3.5 The open self-join — ranked #1 by both reviewers **[V, 02 + 06 + 07]**
`apps/arts-collective/src/app/api/org/join/route.ts` (47 lines, read in full by
two agents): `requireUser()` → look up org by slug → `INSERT INTO
user_organizations (…, 'member')`. No invitation, no approval, no per-org setting.

`member` is exactly the role that satisfies all three of:
- `org_feeds.min_role='member'` — gates `hidden-enneagram/inner-work`, the only
  non-public feed in the network **[V, 02]**
- `packages/services/src/media-authz.ts:124-142` `isOrgAffiliate` — **grants
  private media read for that org** **[V, 06]**
- `packages/commerce/src/server/index.ts:753-764` `canClaimStore` — any role in any
  org **[V, 06]**

`06` traced the two-request chain: `POST /api/org/join {"slug":"inner-gathering"}`
then `GET /api/media/EAC_Network/inner_group/Private/Media/Images/<anything>`.
**Not executed** — step 1 is a database write — but both halves were read verbatim
by two agents and there is no intervening check. **[A on the chain, V on both halves]**

Compounding it: §4.4 below means the authorized response is then cached
`public, immutable` for a year, so **revoking the membership row does not revoke
the leak**.

**[?]** `02` calls this a policy hole; `03` notes it is reached deliberately from
`/login?org=<slug>` (`login-form.tsx:32`) and calls it "a design question, not
necessarily a bug". The route carries no comment either way. It is load-bearing
for onboarding *and* it is the escalation path. **This one is yours to decide.**

### 3.6 `entity_type` filtering is applied where it bit, not at the boundary **[V, 02]**
Filtered correctly in 4 places, notably `apps/arts-collective/src/lib/network.ts:66`
(with a comment naming exactly the roster bug it fixed).

Not filtered in the shared reader everything else goes through:
`packages/services/src/profiles.ts:256` `listOrgProfiles` — consumed by
`apps/ifac/src/lib/directory.ts:124,149`, `apps/amrit-canada/src/lib/data.ts:452`,
`apps/hidden-enneagram/src/lib/data.ts:220`,
`packages/silex-render/src/embeds.tsx:619`. Also unfiltered:
`profiles.ts:278`, `:309`, `org-membership.ts:75` `listOrgMembers`.

Harmless today — 0 of 33 `org_profiles` and 0 of 27 `user_organizations` rows point
at an org-entity user — but ungeneralised.

---

# 4. Duplication — your stated focus for this pass

### 4.1 The pattern, named **[05 §6; endorsed by 06 and 07 as the best framing produced]**
**The substrate is built; the last mile is never walked.** ~20 instances. In every
one the hard part is finished, tested, often documented with a comment explaining
what it fixes — and the one-line adoption is missing.

`06` found a fresh instance *inside a same-session security fix* (§4.4). `07` found
the mechanism: **the only two migrations that fully landed (030 `threads`, 073
`org_feeds`) are the only two that dropped their predecessor.** Everything that
merely superseded — 084-087, 099 — stalled. That is the argument for your
§2 decision to actually delete `artist_profiles` rather than deprecate it.

### 4.2 Media and upload routes — the authoritative enumeration **[V, 06 §3.3]** **[!]**
Four different counts appeared across the reports. `06` enumerated them:

**15 media read routes.** `[A]` = has `canReadMedia`; `[N]` = nosniff +
Content-Disposition.

| Route | Lines | Authz | Headers |
|---|--:|---|---|
| `apps/amrit-canada/.../api/media/[...path]` | 99 | **[A]** | — |
| `apps/amrit-canada/.../api/media/library` | 79 | editor gate | — |
| `apps/art-auction/.../api/media/[...path]` | 87 | **NONE — `/Private/` substring only** | **[N]** |
| `apps/artdirect/.../api/media/[...path]` | 92 | **[A]** | — |
| `apps/arts-collective/.../api/media/[...path]` | 78 | **[A]** | **[N]** |
| `apps/blog-{guru-dharam,sunjay,tester}/.../api/media/[...path]` | 3 each | via factory | — |
| `apps/elkdonis-arts-collective/.../api/media/file` | 54 | **NONE AT ALL — §4.3** | — |
| `apps/hidden-enneagram/.../api/media/[...path]` | 90 | **[A]** | — |
| `apps/hidden-enneagram/.../api/media/library` | 57 | editor gate | — |
| `apps/ifac/.../api/media/[...path]` | 97 | **[A]** | — |
| `apps/inner-gathering/.../api/media/[...path]` | 114 | **[A]** | **[N]** |
| `apps/inner-gathering/.../api/media/file` | 67 | **[A]** | — |
| `apps/pigeonshoot/.../api/media/[...path]` | 121 | **[A]** | **[N]** |

**11 upload routes** (`06` and `05` agree; `07`'s "15" is unreconciled **[!]** —
treat 11 as the number). Magic-byte validation via `validateUploadBuffer`: 4 have
it (art-auction, arts-collective, inner-gathering, pigeonshoot); **4 do not**
(amrit-canada, artdirect, hidden-enneagram, ifac) and gate on the client-supplied
MIME string alone, so `image/svg+xml` passes — **stored XSS, and two of the four
serve live verified production domains** (`ifacgroup.com`, `amritcanada.ca`).
`04` reported this as ArtDirect only; `06` corrected it to 4×.

**The factory** — `createMediaGetHandler` (`packages/blog-server/src/media.ts:107`)
and `createMediaUploadHandler` (`:170`) — is adopted by **3 apps / 6 of 26 routes**.
Adopters are 3–4 lines each; the rest are 54–276 lines, **≈1,860 lines of
duplication**. This is exactly what you identified: the factory *was* the intended
central path.

### 4.3 The worst single route **[V, 06 §4.6]**
`apps/elkdonis-arts-collective/src/app/api/media/file/route.ts` — read in full:
no session lookup, **no `/Private/` check** (unlike every other unprotected proxy),
serves with admin service-account credentials, MIME map includes
`svg: 'image/svg+xml'`, sets no `nosniff`. So
`GET /api/media/file?path=EAC_Network/<any org>/Private/…` serves any org's private
file to an anonymous caller.

Mitigated today only because that container exited two months ago. **CLAUDE.md's
own "In Progress" section says this app is being folded into `inner-gathering`,
which is running.** Whoever does that merge must not carry this route over.

### 4.4 The security fix that shipped a cache bug **[V, 06 §4.4]**
The in-flight `canReadMedia` work is sound (`packages/services/src/media-authz.ts`,
207 lines). The routes adopting it are not:

```ts
if (!(await canReadMedia(viewerId, filePath))) return 404;
…
headers.set("Cache-Control", "public, max-age=31536000, immutable");
```

A response whose visibility was just decided **per-viewer** is marked `public` and
`immutable` for a year. Present in **6 adopting routes plus the shared factory**
(`packages/blog-server/src/media.ts:160`).

**Two routes already got it right**, which proves it is a known problem that was
not propagated: `apps/inner-gathering/.../api/media/[...path]/route.ts:37-39`
(with the comment "private media must never be stored by a shared cache") and
`apps/pigeonshoot/.../route.ts:100`.

### 4.5 Form and component duplication **[V, 03 §6 + 05 §6]**

| Item | Detail |
|---|---|
| **shadcn UI kit** | 19 of 20 `apps/arts-collective/src/components/ui/*.tsx` **byte-identical** to amrit-canada's; `button.tsx` is the same hash in **four** apps. `@elkdonis/ui` is Mantine, so this needs a sibling package |
| **Bespoke content forms** | ≈3,400 lines: `inner-gathering/create-content-form.tsx` 753, `arts-collective/WorkshopForm.tsx` 878, `amrit-canada/manage/content-form.tsx` 488, `hidden-enneagram/manage/content-form.tsx` 429 (the last two are the same two-kind form), `event-page-editor.tsx` 462, plus pigeonshoot/artdirect/art-auction/admin equivalents |
| **Two wizard engines in one app** | `packages/cms-ui/src/wizard/*` is explicitly a fork-and-fix of `apps/arts-collective/src/components/wizard/*` — `StepIndicator.tsx:6` says the local one "was aria-hidden and inert, which made its final 'some earlier step is invalid' state a dead end." Local `WizardProvider` 115 lines vs package 356. **The profile wizard still uses the inferior local copy** |
| **Workshop sidecar upsert** | The same ~35-column `INSERT … ON CONFLICT` written **twice in one file** (`cms/actions.ts:435` and `:665`) and a third time in inner-gathering. `actions.ts:535`'s own comment proposes moving it to `@elkdonis/cms-bindings` |
| **`/api/talk/join`** | `route.ts:7` says "mirrors apps/inner-gathering/api/talk/join" — 120 vs 91 lines, 174 diff lines |
| **`x-org-domain` block** | Identical 8-line host-resolution snippet in `OfferingPage.tsx:34-45`, `profile/page.tsx:47-58`, `community/page.tsx:46-57`, `workshop/[workshopSlug]/page.tsx:62-72` |
| **Dead, delete rather than move** | `sites/[slug]/community-dark/page.tsx` (958 ln — but see §2.1, it is publicly reachable), `components/hub/SilexLaunchButton.tsx` (0 importers) |

---

# 5. Authoring — the six mechanisms

**Your reading is right:** the factory was the intended central path, and the same
intent shows up four more times.

| # | Mechanism | Adoption | State |
|---|---|---|---|
| 1 | **Bespoke per-app server-action forms** | every app | **The only finished-and-used one. All 35 content rows came through it.** No shared substrate, no drift protection |
| 2 | Shared blog editor (`blog-client`/`blog-server`) | 3 apps | Properly factored, **create-only** |
| 3 | Manifest-derived wizard (`cms-ui` + `cms-bindings`) | 0 reachable surfaces | ~90% built, route exists, **nothing links to it** |
| 4 | In-place live editor (`@elkdonis/live-editor`) | 3 apps | **The most genuinely adopted shared substrate** |
| 5 | Silex visual builder | 1 org | Loop works; editor unusable (§1.5) |
| 6 | Structural/theme editors (`org_site_sections`, `org_feeds`, `site_themes`) | small | Works; a fourth independent notion of "site shape" |

### 5.1 Blog authoring is create-only **[V, 05]**
`updatePost` (`packages/services/src/posts.ts:187`) and `deletePost` (`:240`) exist
with **zero app callers repo-wide**. `BlogPostEditor` never sends a `status` (0
occurrences in the file). **0 draft rows** across all 35 threads.
`BlogAdminPage.tsx:22` calls `getPublishedPosts` — it cannot show a draft if one
existed, and renders no action column. No comments in any blog app.

**A blog author can write a post and publish it. They cannot draft, edit, delete,
or receive comments.**

### 5.2 The threads consolidation is the one that fully landed **[V, 05; confirmed 06]**
`to_regclass` → NULL for `posts`, `meetings`, `event_pages`. All 35 content rows in
`threads`. No `kind` CHECK (new thread kinds need no migration), no `section` CHECK
(073's `org_feeds` replacement confirmed, 7 rows).

**But `06` chased the consumer nobody did:** `packages/db/src/queries/forum.ts`
still queries all three dropped tables at `:128, :172, :223, :224, :284, :336,
:721, :726`, re-exported by `packages/db/src/index.ts:7`. `getForumFeed`,
`getThread`, `deleteThread` are consumed only by `apps/forum`, whose three pages
all read through them. **Every page of the forum app would 500.** (`getReplies` /
`createReply` from the same module are fine — `replies` still exists — and
inner-gathering uses them.) You've deferred forum; this is why it can't just be
started.

### 5.3 The guided wizard — built, orphaned, and carrying a data-loss bug **[V, 03 + 05; deepened by 06]**
`apps/arts-collective/src/app/hub/workshops/[orgSlug]/guided/page.tsx:43` declares
`let initialAnswers` and **never assigns it** — not even inside the `if (threadId)`
branch, which assigns only `serverUpdatedAt` and `optionalSections`. It is passed
at `:98` always `undefined`. `06` confirmed no other mechanism supplies it.

`06` found the consequence is worse than either report said: `saveWorkshopAction`
does a **full-column `UPDATE threads`** (`actions.ts:632-655` — title, body,
excerpt, scheduled_at, location, format, price, sessions, visibility) *before* the
31-column `ON CONFLICT … SET … = EXCLUDED.…` at `:696-727`. **A guided edit that
reaches save wipes the thread row, not just the sidecar.**

Mitigating: `workshopFullSchema` requires `title` (min 2, `schema.ts:172`), so a
completely blank save fails validation. Narrows the window; doesn't close it.
Unexploited only because **nothing links to the route** — `grep -rn "guided"`
returns only the two files themselves, and `PublishSection.tsx:173` plus both
buttons on `/hub/workshops/[orgSlug]` still point at `/new` (the 878-line
`WorkshopForm`).

### 5.4 What the in-flight session got right **[V, 05]**
The drift/schema half is finished and genuinely good: `scripts/check-workshop-fields.mjs`
is wired into the repo gate and runs clean (46 registry columns / 49 schema keys);
`schema.ts`'s `workshopSidecarFields` is declared once and spread, closing a real
drift where 6 columns were writable by inner-gathering and the field registry but
not by arts-collective; `validate-template.mts` now auto-discovers templates.

### 5.5 Binding engine covers 1 template of 5 **[V, 05]**
`workshop` 38 bindings / 0 errors, 24 tests pass. `brochure` (13 sections, 42
hooks), `dossier-classified` (6/14), `enneagram` (20/7), `portfolio` (8/27) have
**zero bindings — 90 hooks rendering lorem**. `portfolio` is referenced by no code
path at all. There is **no `template_id` column** on `organizations` or
`workshop_pages`; `guided/page.tsx:62` literally reads
`loadTemplateManifest("workshop")`.

The in-flight `brochure` template is code-complete but **404s live** — the
connector was edited 19 minutes after Silex booted and needs
`docker compose restart silex`. **[V, 05; reproduced by 06]**

**Honest caveat `05` volunteered:** its 33 filled workshop hooks came from
`/preview/workshop`, fed by a hardcoded `PLACEHOLDER` object
(`preview/workshop/page.tsx:14`). It proves the engine, not the data path — and
the only published workshop in the DB **has no `workshop_pages` row**, so those 38
bindings have nothing real to bind from today.

---

# 6. Build and gate — addressed this pass

### 6.1 Nothing was typechecked **[V, 03; confirmed 06]**
**0 of 15 apps** define a `check-types` script; **2 of 27 packages** do
(`cms-bindings`, `blog-client`). So `turbo run check-types --filter=<app>` runs one
task — a *dependency's*. `turbo.json:24-28` has no `outputs` and only
`dependsOn: ["^check-types"]`, so nothing fills the gap. **This is why the bare
export survived in 7 apps.**

### 6.2 `handleSignup` — **fixed this session**
Was 6 apps at the time I started (7 originally; arts-collective was fixed by your
parallel session at 13:31:43, mid-audit). Now wrapped in all of:
`art-auction`, `blog-guru-dharam`, `blog-sunjay`, `blog-tester`,
`elkdonis-arts-collective`, `forum`.

The bug, per the repo's own comment at
`apps/inner-gathering/src/app/api/auth/signup/route.ts:7`: `handleSignup` takes an
optional second `SignupOrgOptions` parameter, structurally incompatible with the
`{ params }` context Next passes, so the route violates `RouteHandlerConfig`. **Dev
never type-checks routes — it only fails `next build`.** The correlation `06`
found is exact: it was fixed in precisely the apps that had crossed into
production mode.

Verified after the change: `art-auction` **exit 0** (I also closed its second,
pre-existing error — the `UploadValidation` narrowing at `api/upload/route.ts:121`
— using the `"reason" in validation` idiom arts-collective already documents);
`elkdonis-arts-collective` **exit 0**; `blog-sunjay` **exit 0**; `blog-tester`
**exit 0**. `forum`'s only remaining errors are missing `vitest` devDependencies;
`blog-guru-dharam` has 3 pre-existing unrelated errors (`getClientAuth` not
exported from `@elkdonis/auth-client`, and two in its `button.tsx`).

### 6.3 `next start` / the crash loop — **fixed this session**
`amrit-canada` was in an unrecoverable restart loop (12 restarts, port 3006 dead,
`amritcanada.ca` live). **[V, 06 §4.1]** It recovered at 13:26 via your parallel
session, but only the symptom.

Root cause, proven from the anonymous volume: `prerender-manifest.json` present,
**no `.next/server` directory at all**, `diagnostics/build-diagnostics.json` =
`{"buildStage": "static-generation"}`. Mechanism, confirmed by the `next.config.ts`
comment your session added: **OOM kill at 31 workers under a 5 GB cap** (32-core
host), leaving a half-written `.next`.

The kill shot was the compose guard: the sentinel file existed, so the rebuild was
skipped, so `next start` died, so it restarted — **it could never self-heal**. The
compose comment above it documents that this same sentinel pattern had *already*
failed once with `BUILD_ID` and was "fixed" by switching files. **The pattern was
the bug, not the choice of file.**

What I changed:
- Both guards now key on **`.next/server/pages-manifest.json`** — the file
  `next start` actually opens, and one only a *completed* build writes.
  `BUILD_ID` is wrong because `next dev` writes one too; `prerender-manifest.json`
  is wrong because it lands *before* page collection.
- Both now build with `NEXT_BUILD_CPUS=4`.
- Added the `experimental.cpus` cap to `apps/amrit-canada/next.config.ts` and
  `apps/inner-gathering/next.config.ts`. Your session had put it on
  `arts-collective` — **which runs in dev mode and cannot hit the bug** — and not
  on either production-mode app. `inner-gathering` was still on the weaker
  `BUILD_ID` sentinel that had already failed once: one interrupted build from the
  identical loop.

**Not changed, flagged instead:** both production-mode apps set
`output: 'standalone'` and then run `next start`. Next 16 logs *"next start does
not work with output: standalone configuration"* — it boots anyway, and this is
why `.next/server` vs `.next/standalone` divergence bites. Switching to
`node .next/standalone/server.js` in a bind-mounted monorepo is fiddly enough that
I didn't want to do it untested. **[V, 06 §X.4]**

---

# 7. Deferred by your instruction — recorded so it isn't re-derived

### 7.1 Commerce **[V, 04; corrected by 06 and 07]** **[!]**
The most-corrected finding in the set. Three passes:

- `04`: "no payment can complete network-wide; `resolveSettlement` throws; no UI
  writes `payout_email`" — **filed the UI question as Unknown.**
- `06`: overstated twice. The throw is inside the `makerUserId != null` branch;
  `settlement.ts:71-86` settles maker-less items cleanly to `HOST_PAYOUT_EMAIL`,
  and `artwork.artist_user_id` **is nullable**. And the UI exists —
  `apps/art-auction/src/app/studio/_components/artist-profile-form.tsx:58` makes
  `payoutEmail` a **required** field → `applyForStore` →
  `packages/commerce/src/server/index.ts:860`.
- `07`: the write is gated behind `canClaimStore` (any org membership).
- `06` final: `07`'s "admin approval" step is wrong — `payout_email` lands at
  `:860`, *before* the store insert and long before approval, and
  `resolveSettlement` reads only `users`, never `store.status`. **Approval gates
  selling, not paying.** And `canClaimStore` is already satisfied by **14 of 35
  people**.

**Settled account:** `threads.author_id` is `NOT NULL`, so every service and
workshop order has a maker and throws. `artwork.artist_user_id` is nullable, so an
org-owned artwork would not. **The network cannot take money because not one of
the 14 already-eligible members has ever opened `/studio/apply`.**

`packages/payments` is dead code: `PaymentProviderRegistry` never instantiated
outside a docblock (`index.ts:5`), `createStripeProvider` exported (`index.ts:24`)
but never registered, `stripe` not installed in any workspace. The live path is
`packages/commerce/src/etransfer/`. **Whoever does Stripe wires the registry in for
the first time.**

Also: `arts-collective` 402s any priced workshop
(`api/threads/[id]/rsvp/route.ts:106-112`) with no alternative — but
**inner-gathering already ships an eTransfer paid-join**
(`join-workshop-modal.tsx` → `/api/workshops/[id]/join` →
`@elkdonis/commerce/etransfer`). An un-lifted sibling, not a greenfield build.
Latent hole beside it: that route selects `COALESCE(wp.price_member, t.price)`, so
`price_member = 0` admits anyone free without checking membership.

### 7.2 The auction is not an auction **[V, 04; negative re-proved exhaustively by 06]**
`placeBid` is genuinely careful — `SELECT … FOR UPDATE` in a transaction, start/end
windows, increments, prior bids marked `outbid`, working anti-snipe
(`packages/commerce/src/server/index.ts:597-687`). But there are exactly **six**
`auction_lot` references in the whole tree and **one write**
(`index.ts:664-673`), which sets `status = 'live'`. Zero `INSERT INTO auction_lot`
anywhere; no auction fields in the studio artwork form; no cron, no worker, no
scheduler (the repo's only server-side interval is inner-gathering's RSVP reminder
tick at `instrumentation.ts:26`). `reserve_minor` appears only in display code.
`winner_user_id` is overwritten on every bid — a running high-bidder, not a winner.
Proxy maxima stored, never read.

**At close: nothing happens. The lot sits `live` forever.**

### 7.3 ArtDirect is the healthy one **[V, 04]**
Not a commerce app — the standalone Online Artist Directory. 40 real dossiers (25
persons + 15 orgs), typechecks **exit 0**, every route correct, the cleanest
adopter of the unified profile schema in the repo. arts-collective's `/directory`
is a pure redirect into it. Its one real defect is the SVG upload gap (§4.2), and
`04`'s "it still needs its own upload route" was **refuted** — the route exists and
is complete.

---

# 8. Conflict register — where the agents disagreed

| # | Conflict | Resolution |
|---|---|---|
| 1 | `community-dark` dead (`03`) vs live (`02`) | **`02` right.** `06` curl-proved 200 on every org subdomain, both routes. `07` had inherited `03`'s error and corrected it. Changes the identity bug from latent to live-public |
| 2 | Migrations "98" (`02`) vs "101" (`04`) | **Never a conflict.** 98 files; highest number 101; gaps at 001 and 026-029; duplicate pairs at 052 and 054. Both were measuring different things |
| 3 | `artist_profiles` consumers: 3 (debrief) / 8 across 5 apps (`02`) / 20 across 5 apps + 4 pkgs (`07`) | **`06` settled it: 20 SQL sites, 3 apps + 3 packages.** `07`'s count included comment-only files; it accepted the correction |
| 4 | `EAC_Network` hardcoded 166/72 (`01`) | **127/67** (`06` re-ran). Substance unchanged |
| 5 | Media routes: ~10/~6 (brief) / 15+11 (`05`) / "5 apps patched" (`03`) / 15 upload (`07`) | **`06`'s enumeration is authoritative: 15 read, 11 upload, 6 factory files, 3 apps.** `07`'s 15-upload figure is **unreconciled [!]** — treat 11 as the number |
| 6 | `canReadMedia` gaps: 6 (`05`) | **4**, and 2 of the 6 had editor gates all along. Only **2 genuinely serve bytes with no viewer check** |
| 7 | SVG/`validateUploadBuffer` gap: ArtDirect only (`04`) | **4 routes**, two on live production domains |
| 8 | "Every purchase throws" (`04`, repeated by `07`) | **False** for maker-less artwork; true for the service/workshop rail. See §7.1 |
| 9 | "No UI writes `payout_email`" (`04`) | **False** — required field at `/studio/apply` |
| 10 | Bare export count: 7 (`06`) vs 10 (`07`) | **Both wrong.** `07` grepped importers, not the pattern, counting 3 already-fixed apps; `06`'s list included arts-collective, fixed at 13:31:43 *inside its own window*. It was 6 when I started; it is **0 now** |
| 11 | User counts: 50 (`01`) vs 35 (`03`) | Same table. **50 rows = 35 persons + 15 org-identity rows.** Correct denominator for Nextcloud credentials is **1 of 35 persons** |
| 12 | Production vs dev — "the largest single uncertainty" (`07`) | **Dissolved by `06`.** `psql \l` shows one database; every container reads `elkdonis_dev` and the production Nextcloud. `elkdonis_dev` is a misnomer. No cross-report inference joins two worlds |

---

# 9. Open questions — yours to decide, not to investigate

1. **`/api/org/join`** — intended onboarding or an oversight? It is load-bearing
   for `/login?org=<slug>` *and* it is the escalation path to private media,
   private feeds and store claims. (§3.5)
2. **Groupfolder group-membership vs per-org shares** — both live, granting
   different things. `/api/silex/token:54` provisions into the group;
   `org-provisioning.ts` shares per-org. (§1.1)
3. **Should Silex use the service account?** That would make the editor work for
   everyone rather than nobody, and would moot the per-user credential problem
   entirely. (§1.5)
4. **Which of the four `hidden-enneagram` copies is authoritative**, and should the
   published site be served from the service account (which works) or the personal
   account (which the DB names)? (§1.7)
5. **`artist_profiles.role_title` read/write disagreement** — flagged by an
   untracked script dated 2026-09-06; mid-fix or known-open? Sits on the §2.2 path.
6. **`org_agreements` / `store` / `org_followers`** — pre-launch or abandoned?
   Substantial code (13 / 20+ / 6 refs), zero rows; `org_followers` got its
   first-ever caller this session, which reads as pre-launch.
7. **`justing`** — created 2026-09-06, `subdomain_confirmed=false`, 1 owner, 0
   content, and it has a live Nextcloud folder. Deliberate or a test artifact?
8. **Test data on public surfaces** — `claude-hub-test` is a listed dossier on
   ArtDirect; `jane-doe`, `lkhsdgfikusydfg` and
   `testesagfsdfsdfsadgsfgdh4ety457635gwrsvr11` now have permanent Nextcloud
   folders.

---

# 10. Re-run before quoting

The working tree went **9 → 42 → 72** modified files during the audit, with files
changing 14 seconds before one agent's clock read. Your groupfolder/permissions
work was landing on the same files these reports were reading. Specifically stale:

- Every raw count in every report.
- "amrit-canada is crash-looping" — recovered 13:26; the structural cause is what
  §6.3 addresses.
- "Seven apps cannot `next build`" → was 6 when I started, **0 now**.
- "Four media read routes lack `canReadMedia`" — two were patched mid-window;
  assume more since.
- "1 of 35 persons has a Nextcloud credential / 7 linked" → 8 linked by the time
  `06` ran. Moving.
- The `tsc` error counts in `03` and `04` — both predate fixes; I re-ran them and
  the numbers in §6.2 are current as of this session.

The one thing nobody could settle from inside: **there is no ingress service in
this compose project**, so where public DNS for `amritcanada.ca` and friends
actually terminates cannot be proven from this host.
