# The exchange: model (2026-11-08)

The exchange is a catalogue of reusable building blocks, held as one envelope per item over
payloads that stay where their kind already lives. An org can save an item for itself, share
it with the network, and apply, fork or update items others made. Every application leaves a
use row, so "used on 7 sites" and "made from Katie's Piece page v2" are queries, not guesses.
Design only; nothing here is built.

## 1. What an exchange item is

### 1.1 Kinds

| Kind | What it is | Payload | Payload lives today | Applied by | Apply means |
|---|---|---|---|---|---|
| `page` | a Puck page layout (blocks, words, layout) | sanitised Puck doc | DB: `site_page_templates.puck_data` (mig 257); code: `STORE_TEMPLATES` (`packages/blocks/src/templates/store.ts:38`), person templates, app `pageStarts` (`apps/sunjay/src/lib/hub-site.ts:24`) | Site Builder New page (`NewPageDialog.tsx`), editor Templates tab (`templates-plugin.tsx`) | copy |
| `route` | the Studio page for a record route (`post`, `service`, `piece-detail`) | Puck doc keyed `(orgId, key)` | app defaults (`lib/default-pages.ts`), org-published docs (kit §6.2) | `defineRouteTemplate` (proposed, kit §2.1) | copy into the org's `(orgId, key)` |
| `block` | a block or smart component, or a hub card | code (`defineBlock`, `defineHubCard`) | `packages/blocks`, app `src/blocks/`, `packages/hub` | the host's catalogue (`createCatalogue`) | follow (deploys) |
| `routine` | a cadence routine or a follow-up ladder | an LMS course and its versions | `lms_courses` / `lms_course_versions` (mig 140); ladder designs in `docs/open/channel-handoff/ladders/` | enrol, or "Follow up with…" (routines plan §2.1) | follow a pinned version |
| `preset` | settings for a form kind, never content | `{ kind, values }` within `PRESET_KEYS[kind]` | code: `PLATFORM_PRESETS` (`packages/studio/src/forms/presets.ts`); DB later: `content_prefs` / lane A2 store | forms "Start from…" | copy |
| `look` | a site style preset, a block look set, an org palette, a gradient ramp | token values / look ids | `site_themes` + `site_config site-style:*`; `defineLooks`; `packages/gradients`, `packages/tokens`; forms themes (Broadsheet, `forms/broadsheet.css`), Industry (hub cards) | Site style, block `look` prop | copy (values) or follow (code looks) |
| `brand` (later) | brand-kit pieces: logo set, type pair, caption style | references into Nextcloud + a DB index | lane A2 (coming) | `content_prefs` cascade item → org → person → platform | follow by reference |

Two apply modes, fixed per kind:
- **Copy**: the applier gets their own snapshot. Changing or retiring the item never touches
  what was made from it. This is the rule mig 257 already states for page templates.
- **Follow**: the applier references the item. Code items follow deploys; routines follow a
  pinned course version under the LMS rules (`VERSIONING.md` §3.4).

### 1.2 The common envelope

One record per item, the same for every kind:

| Field | Meaning |
|---|---|
| `id` | uuid |
| `key` | stable human key `<kind>:<owner>/<slug>`, owner = org id or `network`; never reused. Example `page:katie-the-potter/piece-detail` |
| `kind` | one of §1.1 |
| `name`, `summary` | picker title (1–120 chars, as mig 257) and one or two lines |
| `version` | current published version: integer for content items, semver for code (`VERSIONING.md` §1–2) |
| `owner_org_id` | the org that holds it; NULL = network-held |
| `author_user_id`, `credits` | the person who published; `credits` = `[{ user_id?, org_id?, role }]`, carried through forks |
| `licence` | an SPDX id: `CC-BY-4.0` (content default, D-2), `AGPL-3.0-or-later` (code, D-1), or `org-only` |
| `forked_from` | `{ item_id, version }` or NULL |
| `reach` | `draft` · `org` (members of the owner org) · `network` (every org) · `retired` |
| `compat` | what it needs to apply: `{ blocks: ["ktp-piece", …], kinds: ["post"], hosts: ["shell", "hidden-enneagram"], packages: { "@elkdonis/blocks": ">=0.2" }, needs: ["commerce"] }` |
| `covers` | 0–4 image paths (Nextcloud, `Private/` unless `reach = network`) |
| `uses` | derived: distinct orgs that applied it, total applies, forks |
| `created_at`, `updated_at`, `retired_at` | dates |

`compat.blocks` is derived at publish from the payload (every `type` in the Puck doc), not
typed by the author. An item whose blocks a host's catalogue lacks is listed there as "needs
blocks this site does not have" and cannot be applied.

## 2. Where items live

- **DB items** (org-made or network-held): the envelope in `exchange_items`, immutable
  version rows in `exchange_versions`, uses in `exchange_uses` (`PLAN.md` §3). Payload stays
  where its kind lives: `site_page_templates` rows for `page`, LMS course versions for
  `routine`, the version row's `payload jsonb` for `preset`, `look` and `route`.
- **Code items** (platform-shipped): blocks, hub cards, starter page templates, platform
  presets, code looks. They are declared in a client-safe catalogue, following
  `packages/actions/src/catalogue.ts` (plain data, no dependencies, ids frozen because stored
  data names them). Proposed home: `packages/exchange/src/catalogue.ts`, which imports the
  existing constants (`STORE_TEMPLATES`, `PLATFORM_PRESETS`, block metas) rather than copying
  them. Code items have `key` `<kind>:platform/<id>` and `version` = the package's semver.
- **One reader** (`@elkdonis/exchange/server`, `listItems(site, viewer, query)`) merges code
  and DB items, filters by `reach` and the viewer's orgs, and marks `compat` against the
  site's catalogue. The hub card, the New page dialog and the MCP tools all call it.

Not in the exchange: an org's live pages, live routines and saved settings. Those are uses,
not items.

## 3. Lifecycle

### 3.1 Publish
1. **Save for the org.** Site Builder "Save as template" (today, `sb-runners.ts:159-164`)
   writes the `site_page_templates` row and, from phase 1, the envelope at `reach = org`,
   version 1. The doc is sanitised before it is stored (`sanitizeDoc`: `cleanBoxDoc` + resolved-key
   strip, mig 257 header), so resolved values are never pinned.
2. **Share with the network.** An org owner or guide presses "Offer to the network". This
   creates a submission, not a network item. Automatic checks run at submit and are stored
   with it:
   - every block in `compat.blocks` exists in the network catalogue (not an app-only `he-*`
     or `ktp-*` block, unless the item is marked for that host);
   - no media path under `Private/`; pictures replaced by placeholders unless the author
     ticks "these pictures may travel" (D-5);
   - no email address, phone number or link to a person's page in text (prototype 3 check);
   - a `look` passes WCAG 4.5:1 for body text on its ground.
3. **Review.** A network reviewer (D-3) approves, or sends back with a note. The queue reuses
   `@elkdonis/hub` ReviewQueue (`da5c17fe`) and the prototype-3 diff view
   (`PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md` §3). Approval copies the submitted
   version into a network item (`owner_org_id` stays the author org, `reach = network`); it
   does not link to the org's live template.

### 3.2 Discover
- The **Exchange hub card** on arts-collective `/hub` (phase 2): filter by kind, "works on
  this site", newest, most used, picks; item page with covers, versions, credits, "used on
  N sites" and Apply / Fork.
- In place: the Site Builder New page dialog gains "From the network" beside the app's
  `pageStarts` and the org's saved templates; forms "Start from…" lists network presets
  after the platform ones.
- Assistants: MCP read tools `exchange_search`, `exchange_item` (phase 3), through the same
  reader.

### 3.3 Apply
- Copy kinds: payload copied with fresh node ids (as `templates-plugin.tsx` `instantiate`
  already does), then a `exchange_uses` row `(item_id, version, org_id, target, applied_by)`.
  Target examples: `page:/about`, `route:post`, `preset:gathering`.
- Provenance is kept in `exchange_uses`, not inside the Puck doc, so applying never adds a
  stored prop to a live document.
- Follow kinds: the reference is the use (an enrolment pins `course_version_id`; a code block
  is used by being in a saved doc and is counted by a periodic scan of `site_config puck:%`).

### 3.4 Fork
- "Fork" = apply into the forker's org as a new item at version 1, `forked_from` set,
  `credits` = the parent's credits plus the forker. The parent's licence must allow it
  (`CC-BY-4.0` and `CC-BY-SA-4.0` do; `org-only` items are not forkable outside the org).
- A fork offered back to the network goes through review like any submission; the reviewer
  sees the diff against its parent.

### 3.5 Update
- The owner org publishes a new version (immutable row, `change_kind` fix or structural,
  a one-line note). Network items need review again for structural changes; fixes from the
  author org go live without review (D-9).
- Copies do not change. Their owners see "v3 is out: <note>" on the page's row in Site
  Builder, with "Open v3 beside this page"; nothing is merged automatically.
- Routines follow the LMS rule: a fix fast-forwards open runs, a structural version is
  adopted explicitly (`140_lms_content.sql:102-105`).
- Retire: hidden from discovery and from new applies; versions, uses and copies stay. Network
  items are never deleted, because uses and forks cite them.

## 4. Celebrating better designs

Modest, concrete and computed from rows that exist for other reasons.

- **Signals** (item page and sorting):
  - **distinct orgs that applied it** is the primary number; raw applies are shown second;
  - forks (each one credits the parent);
  - kept: copies still published 30 days after apply (a weekly query over `exchange_uses`
    joined to `site_config puck:%` / `site_page_meta`); phase 5.
  - No stars, likes or view counts in the first phases: they reward the first item in a
    list, not the better design.
- **Picks:** a reviewer can pick an item with a one-line reason ("the clearest event page on
  the network: date and place before anything else"). At most six live picks; each lasts 60
  days; shown first on the hub card and in "From the network". One table, `exchange_picks`.
- **Credits on sites:** an org may show a credits line on its own `/credits` page (generated
  from its `exchange_uses`): "Layout of Events from IFAC's Event page (v2), CC BY 4.0". Off by
  default in footers (D-6); `CC-BY` attribution is met by the credits page plus the item page.
- **Credits on people:** the author's person page (`PERSON_PAGES_BRIEF_2026-09-26.md`) gains a
  "Made for the exchange" list once they have a network item.
- **Notes:** a monthly network post, written by a person, listing new network items, picks
  and their reasons. Not automated.
- **Build patterns:** when a design is picked twice or applied by five orgs, the PM considers
  lifting it into code (a platform starter, a kit primitive or a block), credited to its
  author in the code catalogue and `NOTICE`-style attribution (`CONTRIBUTING.md` §7). This is
  how org designs become platform patterns.

## 5. Rules and constraints

- Never store a resolved value or a fresh-from-load doc as a payload without `sanitizeDoc`:
  resolver output saved into a doc freezes live data (kit §3).
- Never rename a stored id to fit the exchange; keys and ids are frozen (`VERSIONING.md` §3).
- Run the cross-org reader with the global `db` after a permission check, not by widening
  `eac_tenant` policies: the prototype doc §RLS keeps the tenant floor intact.
- A network item is readable by every org; its payload may only reference public media.
- Count orgs, not clicks: usage numbers are distinct orgs from `exchange_uses`.

## 6. Open questions

- Should hub cards themselves be `block` items, or a separate `card` kind once a second host
  app mounts one (today: sunjay pilot, `c50f354d`)? Treated as `block` until then.
- Route templates depend on `defineRouteTemplate` (kit §5 step 3); until it lands, `route`
  items exist only for hidden-enneagram and katie.
- Whether ladders become LMS courses (routines plan Q10) decides where `routine` payloads
  live; the envelope does not change either way.
