# Platform exchange: phased plan (2026-11-08)

Starts with conventions, then one table that turns today's saved page templates into
exchange items, then discovery, assistant reads and credit. Each phase is small, additive
and reversible; no phase rewrites a live Puck doc. Migrations below are proposals: none is
written or numbered (take the number with `/new-migration` when the owner approves; 262 was
the last on 2026-11-08).

## 1. Starting point (verified 2026-11-08)

- Saved page templates exist: `site_page_templates` (mig 257, applied), written by Site
  Builder "Save as template" (`packages/actions/src/server/sb-runners.ts:159-164`), read per
  org only (`packages/hub/src/server/site-builder.ts:226-228`, `WHERE t.org_id = …`). Rows
  with `org_id NULL` are allowed but no reader lists them yet.
- Code templates: `STORE_TEMPLATES` and person templates (`packages/blocks/src/templates/`),
  `pageStarts` per app (`apps/sunjay/src/lib/hub-site.ts:24`), the editor Templates tab
  (`packages/page-builder/src/templates/templates-plugin.tsx`).
- Presets: platform only, in code (`packages/studio/src/forms/presets.ts`); the store is a
  later forms pass (`content_prefs`, `CONTENT_LIBRARY_COMPONENT_2026-11-08.md` §4).
- Routines: `channel_routines` (live), LMS courses with immutable versions (mig 140); ladders
  are designs only (`docs/open/channel-handoff/ladders/`).
- Catalogue precedent: `packages/actions/src/catalogue.ts`; MCP slice 1 live on
  arts-collective (`packages/mcp/src/server/tools.ts`, read-only, default-deny exposure).

## 2. Phase 0: conventions and docs (this folder; no code)

| Step | Output | Owner |
|---|---|---|
| 0.1 | This workspace: `EXCHANGE.md`, `VERSIONING.md`, `CONTRIBUTING.md`, `PLAN.md`, `DECISIONS.md` | design session, done 2026-11-08 |
| 0.2 | Owner decides D-1 (code licence), D-2 (content licence), D-3 (reviewers), D-4 (storage) | Justin |
| 0.3 | Root `LICENSE` and `CONTRIBUTING.md` (moved from here), `NOTICE` kept | PM, after D-1/D-2 |
| 0.4 | `docs/reference/frozen-contracts.md`: one list of stored ids per site (block ids, props, parts, route and Studio keys, look values), seeded from kit §4 and the action catalogue | lane D owner |
| 0.5 | Changelog convention adopted: empty `CHANGELOG.md` with `## Unreleased` in the nine exchange-facing packages (`VERSIONING.md` §1) | PM, at the next train |
| 0.6 | Train tags `train-YYYYMMDD-N` from the next train (`VERSIONING.md` §5.4) | PM |
| 0.7 | Follow-ups, code (not in phase 0): `"private": true` on the 15 packages without it; install a secret scanner on eris (D-8) | fixer session |

Done when: the owner has answered D-1 to D-4 and 0.3–0.6 are in.

## 3. Phase 1: the exchange table and envelope, reusing `site_page_templates`

Scope: kind `page` only, reach `org` and `network` (network = rows created by staff;
submissions come in phase 2).

### 3.1 Migration A (proposed): `NNN_exchange_items.sql`
```sql
CREATE TABLE IF NOT EXISTS exchange_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,                 -- page:<org|network>/<slug>, never reused
  kind          text NOT NULL CHECK (kind IN ('page','route','block','routine','preset','look','brand')),
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  summary       text NOT NULL DEFAULT '',
  owner_org_id  varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,  -- NULL = network-held
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  credits       jsonb NOT NULL DEFAULT '[]',
  licence       text NOT NULL DEFAULT 'org-only',
  forked_from_item uuid REFERENCES exchange_items(id) ON DELETE SET NULL,
  forked_from_version integer,
  reach         text NOT NULL DEFAULT 'org' CHECK (reach IN ('draft','org','network','retired')),
  current_version integer NOT NULL DEFAULT 1,
  covers        jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  retired_at    timestamptz
);
CREATE TABLE IF NOT EXISTS exchange_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid NOT NULL REFERENCES exchange_items(id) ON DELETE CASCADE,
  version_no   integer NOT NULL,
  change_kind  varchar(12) NOT NULL DEFAULT 'structural' CHECK (change_kind IN ('fix','structural')),
  note         text NOT NULL DEFAULT '',
  payload      jsonb,                                  -- preset, look, route
  payload_ref  text,                                   -- 'site_page_templates:<uuid>', 'lms_course_versions:<id>'
  compat       jsonb NOT NULL DEFAULT '{}',            -- derived at publish (blocks, kinds, hosts)
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, version_no),
  CHECK (payload IS NOT NULL OR payload_ref IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS exchange_uses (
  id          bigserial PRIMARY KEY,
  item_id     uuid NOT NULL REFERENCES exchange_items(id) ON DELETE CASCADE,
  version_no  integer NOT NULL,
  org_id      varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target      text NOT NULL,                           -- 'page:/about', 'preset:gathering'
  applied_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS exchange_uses_item ON exchange_uses (item_id, org_id);
ALTER TABLE site_page_templates
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES exchange_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_no integer;
```
Backfill in the same file: one item (`kind 'page'`, `reach 'org'`, or `'network'` where
`org_id IS NULL`) and one version (`payload_ref 'site_page_templates:<id>'`) per existing
row. Additive only; `site_page_templates` keeps working unchanged for the current reader.
Tenant reads: `owner_org_id = app_org_id() OR reach = 'network'`; writes through the server
path only (no `eac_tenant` write policy), as the prototype doc's RLS section sets out.

### 3.2 Code (for the build session, not this one)
- `packages/exchange` (new, source-exported): `./catalogue` (client-safe; code items from
  existing constants), `./server` (`listItems`, `getItem`, `recordUse`, `publishVersion`).
- `sb-runners.ts`: "Save as template" also writes item + version; "Update template" writes
  version n+1 with a note; applying a saved or network template calls `recordUse`.
- `site-builder.ts` `loadDetail`: add network items (`reach 'network'`) beside the org's own;
  `NewPageDialog.tsx` shows them as "From the network", greyed where `compat` fails.
- Staff-only "Make network template" in arts-collective `/hub/admin` (no submissions yet).

### 3.3 Done when
- Every existing saved template is an item at v1; a new save creates one.
- One network template is visible in the New page dialog on sunjay (the Site Builder pilot)
  and on one other Site Builder host, and applying it leaves a use row.
- Type checks pass for `exchange`, `hub`, `actions`, sunjay, arts-collective; a page applied
  from a template renders as before (no stored doc changed).

## 4. Phase 2: discovery and sharing

- **Exchange hub card** (`defineHubCard`, `packages/hub`): face = counts by kind and the
  current picks; pop-up = list with filters (kind, works on this site, newest, most orgs),
  item page (covers, versions with notes, credits, used on N sites), Apply / Fork /
  Offer to the network. Pilot on arts-collective `/hub`, then Site Builder hosts.
- **Submissions and review.** Migration B (proposed): `exchange_submissions` and
  `exchange_submission_events`, after `block_submissions` /
  `block_submission_events` in `PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md` §3
  (frozen version snapshot, checks jsonb, status, decision note). Queue rendered by the
  shared ReviewQueue (`da5c17fe`). Needs a network reviewer capability (D-3; the
  `org_capabilities` proposal is already a listed blocker on the PM board).
- Fork and "v3 is out" notices on Site Builder page rows.
- Covers: uploaded by the author (thumbnail capture is a later pass, hub-cards PLAN line 136).

## 5. Phase 3: MCP read tools

- `exchange_search` (kind, text, works-on org), `exchange_item` (envelope, versions, notes,
  credits, uses count; no payload body beyond a block list), `exchange_uses` (an org's own).
- Generated through the same reader; exposure opt-in like registry entries (mcp-foundations
  D-7); one audit row per call (D-9 there).
- Later, a draft write: registry entry `exchange-apply` (scope org) that creates an
  unpublished page from an item; a person publishes (mcp-foundations D-10 rule: drafts only).

## 6. Phase 4: celebrate

- Migration C (proposed): `exchange_picks (item_id, picked_by, reason, starts_at, ends_at)`.
- Item signals: distinct orgs, applies, forks; "kept after 30 days" weekly query.
- `/credits` page per site from `exchange_uses` (opt-in; D-6); "Made for the exchange" on
  person pages; a monthly notes post written by a person.

## 7. Kinds join as their stores land (parallel track after phase 1)

| Kind | Waits on | Payload |
|---|---|---|
| `preset` | the forms preset store (`content_prefs` / lane A2, forms pass 4) | `payload` jsonb |
| `routine` | ladders as LMS courses (routines plan §2.6 phase 3, Q10) | `payload_ref` → course version |
| `route` | `defineRouteTemplate` (kit §5 step 3) | `payload` Puck doc |
| `look` | the converged Looks resolver (kit §2.6) | `payload` values |
| `block` | phase 1 code catalogue | none (code; semver) |
| `brand` | the brand kit | references |

## 8. Risks

- Template payloads carry another org's words and pictures to the network; mitigated by
  placeholder replacement and the `Private/` check (D-5).
- An app-only block in a network template fails elsewhere; mitigated by derived `compat`.
- A second template system grows beside `site_page_templates`; mitigated by D-4 (reuse it as
  the page payload store).
- Cross-org reads widening tenant policies; mitigated by server-path reads (§3.1).
- Usage counts becoming a popularity contest; mitigated by counting distinct orgs and picks
  with written reasons (`EXCHANGE.md` §4).
