# Critical review: Silex ↔ Nextcloud ↔ DB, and a second look at today's work

Date: 2026-09-06
Prompted by: *"second guess if these are best practice or are we being compliant to earlier
laziness because we don't know the strength of the intention when the code was written."*

Fair challenge. Below is what I found looking at the database and provisioning with fresh
eyes, and where I think **I** took the lazy path today.

---

## Part 1 — Where I complied with legacy instead of questioning it

### 1.1 I wrote *new* code against a table that was supposed to be retired
This morning I added `ap.role_title AS facilitator_role` to `getOrgWorkshopForTemplate`, joining
**`artist_profiles`** — a table migrations 084–087 explicitly unified into `users` +
`org_profiles`. The field registry's own comment says the correct target is
`org_profiles.role_title`.

So to make a render path work I *deepened* a dependency on the legacy table. That is exactly
"compliance to earlier laziness". The honest options were (a) join `users`/`org_profiles`, or
(b) don't bind it and name the profile migration as the prerequisite. I did neither.

### 1.2 I stepped over a correctness bug in the same query
```sql
LEFT JOIN artist_profiles ap ON ap.org_id = t.org_id
```
That joins **any** profile belonging to the org — not the workshop's author. The manifest
documents the intent: *"Data source is threads.author_id → artist_profiles."* For any org with
more than one artist, the facilitator shown on a workshop page is arbitrary. I noticed, filed
it as out of scope, and moved on.

### 1.3 I preserved `<eac-embed>` without checking whether the plan had moved on
`client-config.js` says, in its own header: *"Phase 2 will replace that single polymorphic type
with proper Web Component registrations (eac-org-feed, eac-rsvp, …) and Phase 3 will drop
eac-embed entirely."* A stated intention. I built around it rather than asking whether it still
holds.

### 1.4 The biggest one: I made `data-trait` better without asking if it should be visible
The binding engine is **server-side only**. The Silex editor knows nothing about it. An owner
drops an `eac-ws-hero` block and sees *"A focused session for practice and study"* — lorem —
with no indication that it will be replaced by their workshop's real title at render time.
There is no way for them to tell which text they should edit and which is filled from the
database.

For the stated goal — *Silex working well for non-technical users* — that is the gap that
matters most, and I widened the system without touching it. See Part 3.

### 1.5 Smaller ones
- I added `descriptionLongExtra` / `showLongDescription` to a validator **ignore list** rather
  than fixing the template's read-more split, which no column backs.
- I never questioned whether **41 editable hooks on one page** is a sane authoring surface for
  a non-technical owner. It probably isn't.

---

## Part 2 — What the database actually says (nothing had reviewed this)

### 2.1 Three different Nextcloud root conventions are live in production

```
EAC-Network/fourth_way_book_readers      ← hyphen         (1 org)
EAC_Network/justing, market, saw, …      ← underscore     (7 orgs)
eac/hidden-enneagram                     ← lowercase      (1 org — the ONLY Silex org)
(null)                                   ← never provisioned (6 orgs)
```
6 of 15 orgs — including `elkdonis`, `sunjay`, `ifac`, `oad`, `pigeonshoot` — have **no
`nextcloud_folder_path` at all**.

`SILEX_SESSION_HANDOFF.md` documents the root as `EAC-Network`; the code default is
`EAC_Network`. The doc and the code have never agreed.

### 2.2 The abstraction exists and is almost universally ignored
`packages/nextcloud/src/org-folders.ts` provides `DEFAULT_ORG_ROOT_FOLDER`,
`getOrgRootFolder()` (env-overridable via `NEXTCLOUD_ORG_ROOT_FOLDER`) and
`getOrgFolderPath(orgId)`.

Almost nothing uses them. **`EAC_Network` is hardcoded in ~60+ places** — every app's media and
upload route, `packages/services/src/nextcloud.ts`, `packages/blog-server/src/media.ts`,
`packages/hooks`, `packages/ui`. `NEXTCLOUD_ORG_ROOT_FOLDER` is therefore a lie: setting it
would move provisioning while leaving sixty read paths pointing at the old root.

`packages/services/src/nextcloud.ts` also **re-implements the whole standard subfolder tree**
that `org-folders.ts` already defines. Two provisioning implementations.

### 2.3 Live bug: the one Silex org's media proxy rejects its own files
`apps/hidden-enneagram/.../api/media/[...path]/route.ts` gates on:
```ts
if (!filePath.startsWith(`EAC_Network/${siteConfig.orgId}/`)) …reject
```
but that org's folder is **`eac/hidden-enneagram`**. Its published site renders (that goes
through `silex_published_path` + `/api/silex/assets/…`), but the `/api/media/…` proxy — used by
the manage UI's media field — cannot serve anything for the only org running Silex.

### 2.4 Live bug: tier names don't match, so paid tiers get no quota
```ts
export type OrgTier = 'free' | 'standard' | 'patron';
export const TIER_QUOTAS: Record<OrgTier, string> = { free: '1 GB', standard: '10 GB', patron: '50 GB' };
```
The database CHECK constraint is:
```sql
tier = ANY ('free', 'supported', 'partner')
```
Only `free` overlaps. `TIER_QUOTAS['supported']` and `TIER_QUOTAS['partner']` are `undefined`,
so `applyTierQuota` passes `undefined` to `setUserQuota` for **exactly the tiers that pay**.
The rename landed in migration 082 (`project_multitenant_domains_tiers`) and never reached
this package.

### 2.5 On "free and supported are all still on eac-network"
That is the intended design, and it is written down clearly in `org-provisioning.ts`: all org
files live under the **service account** at `EAC_Network/{orgId}/`; owners and guides never own
org files, they receive shares. Ownership transfer is revoke + grant, no migration. That is a
good model and I would keep it.

What is *not* holding up:
- the root name is inconsistent (2.1) and unabstracted (2.2), so the service-account model has
  three different shapes on disk;
- tier does nothing meaningful today (2.4), so "free vs supported" has no enforced difference;
- 6 orgs were never provisioned at all, so the model is aspirational for 40% of rows.

---

## Part 3 — What this means for the actual goal (non-technical users + blocks)

### 3.1 Make bindings visible in the editor — the highest-value next move
The manifest now declares, per section, exactly which hook is filled from which field. The
editor shows none of it. Feeding `bindings` into the GrapesJS **trait panel** would let an
owner select a block and see:

> **Title** — filled from your workshop's title *(edit in the workshop form)*
> **Eyebrow** — Discipline · Series label
> **Intro paragraph** — yours to write

`client-config.js` already registers component types with a `traits` array built from the
manifest; it currently maps `traits: string[]` to generic text inputs. Pointing that at
`bindings` instead would (a) label them properly, (b) mark bound ones read-only in the canvas
so an owner can't waste effort typing over text that will be overwritten, and (c) make the
lorem problem self-explaining. **This is the single change that would most improve Silex for
non-technical users**, and it is mostly wiring that already exists.

### 3.2 On "simple blocks"
The current library is 97 blocks across 12 categories. For a non-technical owner that is not a
library, it is a wall. Worth considering:
- a **`mode=simple`** block set (the connector already reads `?mode=simple`) — maybe 8–12
  blocks: heading, paragraph, image, gallery, quote, button, section, one live slot;
- retiring or hiding the raw `EAC Layout` primitives (two-col, three-col, feature-split, stack)
  for that mode — those are layout tools, and layout is where GrapesJS loses people;
- templates as the entry point rather than blocks: start from a whole page, edit in place.

### 3.3 Template binding coverage is the honest backlog
```
workshop             38 bindings · 0 errors, 0 warnings
brochure             not migrated — 13 sections, 42 hooks render placeholder text
portfolio            not migrated —  8 sections, 27 hooks
dossier-classified   not migrated —  6 sections, 14 hooks
enneagram            not migrated — 20 sections,  7 hooks
```
A `brochure` template (13 sections) arrived in the working tree from another session while I
was working. 90 hooks across four templates currently render lorem on any real site.

---

## Recommended order

1. **Fix the two live bugs** — `TIER_QUOTAS` keys (2.4) and hidden-enneagram's media prefix
   (2.3). Both are small and both are wrong right now.
2. **Pick one root convention and make it the only one.** Route every hardcoded `EAC_Network`
   through `getOrgFolderPath()`, decide whether `eac/hidden-enneagram` migrates or the helper
   learns per-org roots (the column already exists — `nextcloud_folder_path` — so the honest
   fix may be "always read the column, never construct the path"). Then backfill the 6 null orgs.
   A `scripts/check-nextcloud-paths.mjs` in the gate would keep it fixed.
3. **Surface bindings in the editor trait panel** (3.1). Biggest UX win per hour.
4. **Fix the facilitator join** (`threads.author_id`) and move facilitator fields off
   `artist_profiles` onto `users` + `org_profiles` — this also resolves the `roleTitle`
   read/write split I created today.
5. **Then** the simple-mode block set (3.2) and the remaining template migrations (3.3).

I would do 1 and 2 before any more feature work. They are cheap, they are provably broken, and
every new Silex org inherits them.
