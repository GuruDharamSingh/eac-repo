# Patterns, versions and review: three prototypes (2026-11-01)

Status: experiment. Three standalone clickable prototypes (vanilla JS, one HTML file
each, private claude.ai artifacts). No repo code, database or migration was touched.
They extend Phase 4 of `DIRECT_EDITING_PANEL_PLAN_2026-11-01.md` ("Org blocks,
patterns, versions, review") and use the same visual language as the first
prototype (cyan = selected, magenta = hover or changed, amber = outside the family;
the new "key" black diamond = a value this ad sets for itself).

| # | Prototype | Artifact |
|---|---|---|
| 1 | Org patterns with instances | https://claude.ai/artifact/HgYs7WAoQZtc3UgbYC6pPL |
| 2 | Drafts and revisions | https://claude.ai/artifact/R2X9C3sbPcx7uE1iZ72dqM |
| 3 | Pattern review queue | https://claude.ai/artifact/JW7NnaNkBVyL8BQKhWbRZ5 |

Sources (if the artifacts are gone): the Windows scratchpad
`...\scratchpad\prototypes\{p1,p2,p3}.html`; they are self-contained apart from Google Fonts.

All three show the same fictional org (Salt Lane Studios, a studio and print-room
collective) and realistic classified ads. All data lives in memory; reload resets it.

The three share one idea of the data, so read them as one proposal:

```
family (code today)  ->  template or pattern (data)  ->  ad instance  { content, overrides }
                              |                              |
                  revisions + published pointer     revisions + published pointer
                              |
                  submission -> review -> network template (provenance: org, rev)
```

Resolution order, unchanged from `effective()` in `catalog.ts`, with one layer added:
family defaults, then the pattern's layers, then the instance's content, then the
instance's overrides.

---

## 1. Org patterns with instances

**Question.** Can an org save a multi-layer block once, place it many times, change
it in one place, and still let one ad differ or break away, without anyone having to
understand "templates" first?

**What it shows.**
- A pattern library for the org: Studio listing (5 layers: header, title, photo
  slot, body, price row with price and terms), Class notice, Wanted. Each card
  lists its instances and how many values each instance sets itself.
- A sheet of six ads: four instances, one free copy (detached), one plain ad.
  Badges on the sheet say which is which. A black diamond on a layer means "this ad
  sets this value".
- The inspector has one switch: **This ad** or **The pattern (n ads)**. In pattern
  mode every ad that follows it gets a dotted outline and edits show on the sheet at
  once, with a line such as "Ad 2 keeps its own title size". "Done editing" saves
  the pattern as the next revision.
- On an instance, every field is either followed, content (a fill-in slot, no
  mark), or an override (diamond, "own value", reset arrow). Values outside the
  family still get the amber "outside family" flag (Ad 2's title is 32 px in a
  15 to 30 family).
- **Detach** asks first, then bakes the resolved layers into the ad, with Undo.
  **Re-link** goes back, keeping the ad's words and dropping its own styling.
  **Save as pattern** turns a plain or free ad into pattern plus first instance.
  **Place on sheet** adds an instance that stores a link and nothing else.
- "What this stores" tab: the instance record, the pattern record, and what
  renders (derived, never stored), plus a byte comparison: Ad 2 as an instance is
  371 bytes; detached it would be 1,240 bytes and stop following.

**Two kinds of per-ad difference (the main design call).** Words and pictures are
*content*: a pattern declares which layers are fill-in **slots**, and an instance
supplies those. That is not an override and is not marked. Everything else an ad
changes (size, alignment, header style, tone, even header text on a non-slot layer)
is an **override**: marked, resettable, and reported when the pattern changes
("2 of 3 ads keep their own"). Without this split every new instance would start
life covered in diamonds.

### Proposed data model

```sql
-- org-owned patterns and org templates (Phase 4 already names org_blocks)
CREATE TABLE org_blocks (
  id            text PRIMARY KEY,                 -- 'pt-studio'
  org_id        uuid NOT NULL REFERENCES organizations(id),
  kind          text NOT NULL CHECK (kind IN ('pattern','template')),
  name          text NOT NULL,
  family        text NOT NULL,                    -- style family id (code today)
  base_template text,                             -- nearest network template at creation, informational
  doc           jsonb NOT NULL,                   -- { span, layers:[...] } head, see below
  rev           int  NOT NULL DEFAULT 1,          -- rev of `doc`
  published_rev int,                              -- what instances follow (see prototype 2)
  created_by    uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  archived_at   timestamptz
);
```

Pattern `doc.layers` is a tree: `{ id, type: 'text'|'photo'|'row', role, slot, text,
style, children }`. **Layer ids are stable and never reused** (short random ids, not
the role name): overrides key on them.

An instance stays *inside the page document*, where ads already live
(`site_config` key `classifieds:page`, and later `puck:<slug>`). No instance table is
needed to start:

```jsonc
// follows a pattern: link + content + overrides (371 bytes)
{ "id": "ad2", "patternId": "pt-studio",
  "content":   { "title": "Printmaking room with a Vandercook",
                 "photo": { "scene": "press", "caption": "Proofing press, 40 inch bed" },
                 "body": "...", "price": "$610/mo", "terms": "Press time incl." },
  "overrides": { "header": { "text": "Press room to let" }, "title": { "size": 32 } } }

// detached: no link, whole resolved layout (about 1.2 KB). detachedFrom is reference only.
{ "id": "ad5", "patternId": null,
  "detachedFrom": { "patternId": "pt-studio", "name": "Studio listing", "rev": 2 },
  "doc": { "family": "altweekly", "span": 3, "layers": [ ... ] } }
```

Rules the prototype encodes:
- Setting an override equal to the pattern's value deletes it (no dead overrides).
- Resetting removes the key; an empty layer entry is removed.
- Editing the pattern never rewrites instances. Instances resolve on read.
- A layer deleted from the pattern leaves orphan overrides. Prototype does not
  cover it; proposal: drop them silently on next save of the instance, and list
  "n overrides on removed layers" in the pattern's "Done editing" summary.
- Changing the pattern's family changes every instance's look; overrides still apply.
- Today `Ad.o.parts` is keyed by the closed `PartName` enum and `userTemplates`
  sits inside the doc. Patterns need layer ids as keys and `userTemplates` to move
  into `org_blocks`. `effective()` becomes a recursive resolve like `buildFrom()`
  in the prototype.

### RLS and access
`org_blocks` is org-owned: add it to the migration 227 pattern
(`ENABLE ROW LEVEL SECURITY`, policy `tenant_isolation FOR ALL TO eac_tenant USING
(org_id::text = app_org_id()) WITH CHECK (...)`), and read and write it only through
`withOrg(orgId, ...)`. The public classifieds page already reads through `withOrg`
(site_config), so resolving `patternId` there is one more `withOrg` read. A pattern
from one org must never resolve for another org's page: the instance's `patternId`
is looked up in the *page's* org scope, and a miss renders as a detached fallback
(last resolved doc cached on the instance, optional) rather than an error.

### Open questions (Justin)
1. **Content versus override.** Is "slots are content" the right split? Alternative:
   everything is an override and the pattern just seeds sensible text.
2. **Should an instance pin a revision, or always follow?** Prototype follows live.
   With prototype 2's published pointer, instances follow `published_rev`, so
   pattern edits stay invisible to visitors until published. Do you want pinning
   ("this ad stays on r2") at all, or is Detach the only way off?
3. **Who can edit a pattern?** Any member of the org, or owners and guides only?
   One member editing a pattern restyles every other member's ads.
4. **Structural edits** (add, remove, reorder layers) in a pattern: allowed with
   instances present? The prototype only edits values.
5. Do free copies get a "this pattern has changed since you detached" nudge?

---

## 2. Versions and drafts

**Question.** Can editing feel like canvas autosave (type, never press Save, never
lose anything) while the public page only changes when someone says so?

**What it shows.**
- **History** on the left: newest first, grouped by day. Each row: revision number,
  an automatic one-line summary ("Edited title of 'North-light studio'", "Removed
  'Wanted: half a kiln'", "Style changed on 4 ads"), author, time, tags LIVE and
  DRAFT, and "n edits folded". Named revisions show their name in bold.
- **Autosave with folding.** Every keystroke saves. Edits by the same author within
  5 minutes fold into one autosave revision (r13 holds 3 edits), so history stays
  readable. A revision that is live, named, restored, or by someone else is never
  modified; the next edit starts a new one. "Ten minutes pass" and "Tobias saves a
  change" show both rules.
- **Published pointer.** Live is r9; the draft is r13, "4 ahead". The working sheet
  badges each ad "differs from live" and warns when the draft no longer contains
  an ad the live page still shows.
- **Compare.** Click any past revision: it appears beside Live (or the working
  draft, or its own parent) in two columns, changed ads outlined, with a field
  by field list of differences. Buttons: **Restore as new draft**, **Publish this
  revision**, **Name...**.
- **Restore never overwrites.** It appends a new revision (kind `restore`, note
  "Restored from r9"). **Publish** moves one pointer, and the banner offers "Point
  back to r9". Publishing a *past* revision directly is allowed.
- **Rough hands** (the careless member): delete the selected ad, clear all its
  words, switch every ad to another style, close the tab while typing (simulated
  flush), Tobias saves at the same time. After each, a banner says what happened,
  that the live page did not change, and gives a one-click undo that is itself a
  restore. Nothing needs "Ctrl+Z" to survive.
- Right panel: the actual rows (`page_revisions`: rev, parent, by, kind, size) and the two
  pointers, flashing as they change.

### Proposed data model

```sql
CREATE TABLE page_revisions (
  id         bigserial PRIMARY KEY,
  org_id     uuid NOT NULL REFERENCES organizations(id),
  doc_key    text NOT NULL,            -- 'classifieds:page', 'puck:<slug>', or 'block:<org_blocks.id>'
  rev        int  NOT NULL,            -- per (org_id, doc_key), gapless
  parent_rev int,                      -- linear for now (see Q1)
  author_id  uuid,                     -- NULL = system
  kind       text NOT NULL CHECK (kind IN ('autosave','named','restore','publish_note')),
  note       text,                     -- the name, or 'Restored from r9'
  edits      int  NOT NULL DEFAULT 1,  -- edits folded into this autosave
  doc        jsonb NOT NULL,           -- full snapshot (see Q2)
  created_at timestamptz DEFAULT now(),
  touched_at timestamptz DEFAULT now(),-- last fold, used for the 5 minute window
  UNIQUE (org_id, doc_key, rev)
);
-- the pointers live with the document, like lms_courses.published_version_id
ALTER TABLE <document table / site_config row>
  ADD head_rev int, ADD published_rev int, ADD published_at timestamptz, ADD published_by uuid;
-- publish history (who moved the pointer when), small and append-only:
CREATE TABLE page_publish_log (org_id uuid, doc_key text, rev int, prev_rev int,
  by_user uuid, at timestamptz DEFAULT now());
```

Rules: autosave = in one transaction, `UPDATE ... SET doc, edits = edits+1,
touched_at = now()` when head is `autosave`, same author, `touched_at` within 5 min,
`rev <> published_rev`, and `note IS NULL`; otherwise `INSERT` rev+1. Publish =
set `published_rev`, log it. Restore = insert a `restore` revision copying `doc`.
The public page reads the `published_rev` snapshot, never the head. This is the
`lms_course_versions` / `published_version_id` shape; here the "draft" is simply
the head revision, so there is no separate draft column that can drift.

Today `site_config` stores one row per key, overwritten on save
(`page-builder/src/store.ts:99`, 39 `puck:` rows). Cheapest path: keep `site_config`
as the *published* copy (so nothing public changes), write `page_revisions` beside it, and
have the editor load the head revision. Then no reader changes until a page opts in.

### RLS
`page_revisions` and `page_publish_log` have `org_id`; add both to the 227 policy
list, and always write through `withOrg`. A member of org A cannot list, preview
or restore org B's revisions. Test: under `withOrg(A)` select B's rows returns
nothing, and an insert with B's `org_id` fails the `WITH CHECK`.

### Open questions (Justin)
1. **Two people editing at once.** The prototype interleaves them in one line, last
   write wins within a fold window (the two authors never fold together). Is that
   enough, or do you want a "someone else changed this" prompt, or branches?
2. **Storage.** Full snapshots: a classifieds sheet is 1 to 3 KB, so 40 revisions a
   day for a year is tens of MB per org at worst. Fine for classifieds; Puck pages
   are bigger. Delta storage later, or thin old autosaves.
3. **Retention.** Proposal: keep named, restored and published revisions forever;
   thin autosaves older than 30 days to one a day; hard-delete none by default. Right?
4. **Who can publish?** Any member (prototype), or only owners and guides, with
   members able to "request publish" (this is exactly the prototype 3 flow, so we
   could reuse it)?
5. Do you want a named version to be allowed on any revision (prototype) or only
   the head?
6. Should publishing a *pattern* revision be gated differently from publishing a
   page, since it restyles many ads?

---

## 3. Review and promotion

**Question.** What does it take for an org's pattern to become a template for the
whole network, and what does a reviewer need on screen to say yes or no quickly?

**What it shows.** A switcher at the top: three member orgs and the network
reviewer.
- **Org side.** "Your patterns" with a status per pattern: private, waiting for a
  reviewer, in review, sent back, approved. Private patterns get **Submit to the
  network...**: nearest base, six automatic checks, a note to reviewers. Flagged
  checks do not block submission. A sent-back pattern shows the reviewer's note and
  comments and offers **Snap to family and resubmit as r4**. The right column lists
  every template the org can use: base templates plus promoted ones, each promoted
  one marked "from Salt Lane Studios, rev 4".
- **Reviewer side.** Queue with filter (Waiting, Sent back, Approved, All), each
  item showing org, revision, age, nearest base and a "n flagged" chip. Opening a
  waiting item moves it to *In review*.
- **Nearest base is computed.** The distance to every base template is the number
  of differing style values (a missing or extra layer counts 3). Studio listing is
  nearest to Event (7), not For sale (8), which a reviewer would not guess.
- **Side by side**: nearest base and the submission, drawn with the same words so
  only style differs, then a diff table (layer, value, base, submitted). Changed
  rows are magenta, added layers cyan, removed struck through, values outside the
  family or borrowed from another family carry an amber chip.
- **Automatic checks**: sizes inside the family range, fonts inside the family,
  fonts in the shared library, contrast (WCAG ratio for body on paper and for the
  header treatment), no contact details or links in placeholder text, at least one
  fill-in slot. These are computed in the prototype, not mocked.
- **Comments**: general, or anchored to one diff row ("title.size"); anchored rows
  are outlined and the thread shows the anchor.
- **Decide.** *Approve...* takes a network name and publishes v1. *Send back with
  notes...* requires a note, pre-filled from the failed checks. After approving,
  switch to another org: the template is first in their list with provenance.
  After sending back, switch to the submitting org to resubmit; the thread keeps
  both rounds.
- Stored tab: the `block_submissions` row and, once approved, the
  `network_templates` row.

### Proposed data model

```sql
CREATE TABLE block_submissions (
  id            uuid PRIMARY KEY,
  org_id        uuid NOT NULL REFERENCES organizations(id),   -- the submitting org
  org_block_id  text NOT NULL REFERENCES org_blocks(id),
  rev           int  NOT NULL,                                 -- the org_blocks rev submitted
  doc           jsonb NOT NULL,                                -- frozen snapshot of that rev
  status        text NOT NULL CHECK (status IN
                ('submitted','in_review','changes_requested','approved','withdrawn')),
  nearest_base  text,                                          -- network_templates.id
  diff_summary  jsonb,                                         -- {changed,added,removed,outsideFamily}
  checks        jsonb,                                         -- automatic results at submit time
  submitted_by  uuid, submitted_at timestamptz DEFAULT now(),
  reviewer_id   uuid, decided_at timestamptz, decision_note text,
  promoted_template_id text REFERENCES network_templates(id)
);
CREATE TABLE block_submission_events (
  id bigserial PRIMARY KEY, submission_id uuid REFERENCES block_submissions(id),
  kind text CHECK (kind IN ('submitted','review_started','comment','sent_back',
                            'resubmitted','approved','withdrawn')),
  author_id uuid, anchor text,        -- 'title.size', or NULL
  body text, at timestamptz DEFAULT now()
);
CREATE TABLE network_templates (      -- replaces BASE_TEMPLATES in catalog.ts
  id text PRIMARY KEY, name text NOT NULL, family text NOT NULL, doc jsonb NOT NULL,
  version int NOT NULL DEFAULT 1, status text DEFAULT 'active',  -- 'active'|'retired'
  source_org_id uuid, source_block_id text, source_rev int,       -- provenance
  source_submission_id uuid, approved_by uuid, approved_at timestamptz
);
```

State flow, reusing `user-pages.ts`: `submitted` ~ `pending`; reviewing ~ read of
`listPendingUserPages`; approve ~ `published` and send back ~ `archived` in
`reviewUserPage`, except that send back is not terminal here: the org resubmits a
new revision and the same submission goes back to `submitted` (one thread per
pattern, a new `rev`). Write the decision and the event in one transaction. Keep a
row in `events` like `reviewUserPage` does (`block_promoted`, `block_sent_back`).

Approval **copies** the snapshot into `network_templates`; it does not link to the
org's live pattern. The network template is frozen at the submitted revision with
its provenance. A later revision is submitted as an *update* and, if approved,
becomes v2 of the same template (existing ads keep working: they reference
`templateId` and, like patterns, follow the published version).

### RLS and access
- `block_submissions` and its events: **org-scoped read and write by the
  submitting org** (`org_id = app_org_id()` policy, via `withOrg`), so an org sees
  only its own submissions and the reviewers' comments on them.
- The reviewer queue crosses orgs, so it must not run under `withOrg`. It uses the
  global `db` after a permission check (like `canModerateOrg` in `user-pages.ts`,
  but a network-level capability; see Q1). Do not give `eac_tenant` a cross-org
  read policy to avoid weakening the floor.
- `network_templates`: readable by every org (`FOR SELECT TO eac_tenant USING
  (true)`), writable only by the reviewer path (no write policy for `eac_tenant`).
  Resolving a template inside a page is a normal read under `withOrg`.
- Frozen `doc` in `block_submissions` means a reviewer is never reading something
  the org can still change.

### Open questions (Justin)
1. **Who reviews.** Prototype acts as "Justin, network reviewer". Options: you
   only, a rota of org guides, or any guide of any org except the submitter.
   Needs a network-level permission; `org_grants` only allows `nextcloud_access`
   today (migration 139 CHECK), so this probably means the proposed `org_capabilities`.
2. **Does an automatic failure ever block?** Prototype: never, it only flags.
   Contrast below 4.5:1 might deserve a hard stop.
3. **Credit and visibility.** Should the template name the contributing org
   publicly ("from Night Market Co-op, rev 2") or only to admins? The prototype shows it to all.
4. **Updates.** When Salt Lane revises Studio listing after approval, is the
   promoted v1 untouched until they submit v2 (prototype), or should the org be
   able to push minor fixes without review?
5. **Retiring.** Can the network retire a template, and what happens to ads that
   use it (propose: they keep rendering; it just stops appearing in lists)?
6. **Org-specific templates that never get promoted** are just patterns (prototype
   1); the doc does not need a second concept. Agree?
7. Should reviewers be able to *edit* a submission (tidy a value) rather than
   only send back? The prototype only sends back.

---

## What the three have in common (build order if you want them)

1. `page_revisions` and the published pointer (prototype 2) first: it is useful on
   its own for the classifieds page, changes no reader, and makes everything below
   safer.
2. `org_blocks` plus instances in the classifieds doc (prototype 1). Replaces
   `userTemplates` in the doc; needs the layer-id keyed `parts` change.
3. Submissions, events, `network_templates` and the reviewer queue (prototype 3).
   `BASE_TEMPLATES` moves from `catalog.ts` into `network_templates` seed rows.

All three new table groups carry `org_id` (except `network_templates`, which is
deliberately network-wide) and belong in the migration 227 policy list. Migration
numbers: 232 was the latest I saw; use the next free one.

## Prototype limits (what is faked)

- Everything is in memory, one browser, no persistence, no real users. Time
  passing is simulated (a button), the closed-tab case is simulated.
- Prototype 1 edits values only: no adding, removing or reordering layers, no
  free drag. Prototype 2 diffs ads by field, not by layout. Prototype 3 does not
  edit the submission and does not render the approved template inside a real
  classifieds editor ("Use in my classifieds" is a toast).
- The three do not share a store: prototype 3's patterns are separate from
  prototype 1's, and there is no real revision list behind prototype 3's `rev`.
