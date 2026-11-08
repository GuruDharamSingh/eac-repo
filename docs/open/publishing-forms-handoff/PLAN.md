# PLAN: publication forms, design to code (2026-11-08)

Owner: the bone (session `system32-cd`), for Justin, via the PM (`system32-08`).
Inputs: `BRIEF.md`, `README.md` and the three `.dc.html` files in this folder, the notes from
`system32-a1` (lane D), `NETWORK_SERVING_ARCHITECTURE_2026-11-08.md` and
`CONTENT_LIBRARY_COMPONENT_2026-11-08.md`.

## 0. The short version

- **Most of the circuitry already exists.** `cms-ui/compose/content-fields.ts` declares fields as
  data. Optional groups with a blurb are the design's More rows. A `quick` tier is the
  essentials variant. `switchContentKind` already carries a meeting into a series. The Studio's
  Meetings kind already renders that list. The design is mostly a **new face on this schema**,
  plus a state layer (presets, validation, rail statuses, summaries) that the schema lacks.
- **Package**: UI in **`@elkdonis/studio/forms`** (a new subpath). The schema stays in and grows
  in **`@elkdonis/cms-ui/compose`**. There is no `packages/compose`. Reasons are in §2.
- **Theme**: forms read `--frm-*` output tokens computed from `--eac-form-*` hooks, which fall
  back to the existing `--sf-*`/`--pr-*` vocabulary. Broadsheet is one theme file. Nothing
  Broadsheet-specific goes into a component.
- **Passes**: 1 shell + Post + Gathering in Studio focus. 2 Series-in-place + Artwork. 3 quick
  compose + Poll/Questions. 4 what needs migrations (presets store, per-thread emails, RSVP
  answer sets). Passes 1–3 need **no migration and no deploy**.
- **Seven owner questions** are in §8, and four of them block nothing.

---

## 1. Circuitry map

Status: **have** (reuse as is) · **extend** (reuse, add to it) · **gap** (UI implies it, code
has none) · **replace** (the new face supersedes it).

### 1.1 Form model and schema

| Design | Ours | Status | Note |
|---|---|---|---|
| Kind = sections of fields | `buildContentFields(kind, ctx, {tier})` → `ContentFieldGroup[]` | **extend** | Add `section: 'essentials'\|'more'`, `summary(answers, ctx) → string` (the More-row value line) and `defaultOpen`. The existing `blurb` stays as the empty-state summary. |
| Essentials vs quick compose | `tier: 'quick'` filter, `quick: true` per field | **have** | Quick compose = `tier:'quick'` + preset fill. |
| Dependent fields (switch reveals) | `dependsOn` | **have** | The Repeat block, the Where modes and the price modes are all `dependsOn`. |
| Gathering → Series in place | `switchContentKind(answers, 'meeting', 'series')` keeps what was typed | **extend** | Today it is a "One meeting \| Series" switch (`COMPOSE_GROUPS.gathering`). The design triggers it from Repeat on + "Present it as a series". Same function, new trigger. |
| `kind` names | code: `post`/`event`/`meeting`/`series`/`workshop`/`service`/`product` | naming | See §7 Q1. The UI word is "Gathering"; the code id stays `meeting`. `event` is an alias today. |
| Per-draft UI state (`openSections`, `previewOpen`, `validationAttempted`, `saveStatus`, `publishedAt`) | `ContentComposer` holds only `toggled` | **gap** | New `useFormState` in `studio/forms` (bone). |
| Rail statuses (done / optional-empty / error / warning) | none | **gap** | Derived: `sectionStatus(section, answers, issues)`. This is a pure function of the schema plus the rules, ported from `renderVals()`. |
| Readiness line | none | **gap** | Derived from the issues: "Ready to publish" / "N things to fix… M warnings" / "Published at…". |

### 1.2 Validation

| Design | Ours | Status | Note |
|---|---|---|---|
| Blocking and warning rules, per field | only `required` and server `fieldErrors` | **gap** | New `rules: FormRule[]` per kind: `{ id, severity: 'block'\|'warn', fields, test(answers, ctx), message }`. The client runs them; the server still parses and stays the authority. Server `fieldErrors` merge in as `block`. |
| Publish pressed with errors → save draft + alert summary + anchors | none | **gap** | The shell does this. Publish stays enabled until pressed (design §7). |
| Past start date, empty online link, min > cap | partly (`QuestionBuilder` has `validateQuestionFields`) | **gap** | Soft tissue writes the rules and copy. |

### 1.3 Presets ("Start from…")

| Design | Ours | Status | Note |
|---|---|---|---|
| Per-org presets, "your last post's settings" | none in forms. Channel presets (lane A2) are planned. `content_prefs` is proposed, **not migrated** | **gap** | Contract now (§4), store later. Pass 1 sources: (a) code presets per kind, (b) "last one's settings", derived from the person's latest record of that kind. No table is needed for either. |
| Field shows "from preset X" until edited | none | **gap** | UI state `fromPreset: Record<field, presetName>`, cleared on edit. |
| Cascade item → org → person → default, brand kit | proposed in the content doc §4 | **align** | The forms' `resolvePreset()` takes that cascade's output. It does not invent a second one. |
| `/studio?preset=` | the Studio reads only `org`, `id`, `kind` | **gap** | Pass 1 reads `?preset=` and `?focus=1`. `about`/`delivery` follow the content doc's contract (pass 3, with the Channel hook). |

### 1.4 Shell, layout, preview

| Design | Ours | Status | Note |
|---|---|---|---|
| Focus-mode shell: top bar, rail, form, preview | `StudioShell` focus mode (writing), `StudioColumns` for extensions (drawer/main/settings) | **extend** | The forms render as a StudioExtension inside the shell. Its top bar keeps "← Studio", the kind switch and "Making as". The form's top-bar actions go through `StudioTopActions`. The rail replaces the drawer *in focus*. The list drawer is still one click away. |
| Preview layout 2a toggle / 2b rail / split | none | **gap** | `layout: 'split'\|'toggle'\|'rail'` prop, as the design asks. Default is `toggle` until Justin picks (§7 Q4). |
| Preview card/page | cms-ui `surface` cards (`SurfaceCard`, kind cards), `series-card.ts` lines, `content` `PieceRow`; HE's own record blocks (`he-shelf`, `he-service`) | **beyond the design** | Render the **site's real card components** inside a preview frame themed with the *target org's* `site_themes` vars. Don't redraw Broadsheet cards. The card renderer is a **host connector**, `FormHost.preview.cards[kind]`, defaulting to the cms-ui surface cards; HE passes its record blocks. The neighbour item comes from the org's feed. |
| Kind switcher (caret) | the shell's kind switch, `STUDIO_KINDS` | **have** | |
| `history.replaceState` on mount | `StudioShell.tsx:310-331` | **fix first** (pass 1) | `system32-a1`: inside a frame it reloads the frame. The fix has two parts: (a) write the URL only when it differs from `location.href`; (b) add a `syncUrl` prop that a framed host sets to false. Don't rely on `window.top === window` alone, because it breaks with same-origin frames and "Open full screen". |
| Shell props hosts work around today | HE hides the stub tabs with CSS; `coming-kind.tsx` stubs stop "New ▾" from falling through to `/studio?kind=…` (Puck on HE) | **pass 1** | Add `personalOrg={false}` and a host link builder (below) to `StudioShell`. |
| Links to the Studio | `/studio` is hard-coded in `content` `studioNewHref` and in Studio links | **rule** | **Forms never hard-code `/studio`.** On katie, elktours, sunjay and HE, `/studio` is the Puck editor, and HE mounts authoring at `/publish`. Every link ("Open in Studio", "Keep editing", quick compose's hand-off) comes from the host, `FormHost.studioHref({kind, id, preset, focus})`. That is the architect's `ContentHost` / `org_sites.manage_paths`. |
| Hydration-safe ids | n/a | rule | Use Puck block id or field name for ids. Never `useId`/random ids in markup that SSRs (a1). |

### 1.5 Fields

| Design | Ours | Status | Note |
|---|---|---|---|
| Headline title, `.input`, seg, switch, checkbox rows, More row, tag input, people chips | `WizardFieldControl` (`cms-ui/wizard/fields`), `@elkdonis/primitives` (Switch, Checkbox, Tabs…) | **replace the face, keep the contract** | New field components take the same `WizardFieldSpec` + value + onChange, so the schema doesn't fork. Built on `primitives` behaviour (Radix) where it fits. No shadcn (`.design-sync/NOTES.md`). |
| Body: block editor (Post, focus) | Studio essay `Canvas` (tiptap, picture/gallery/pull quote/aside/thread cards) | **have** | It is the design's "+" menu list already. It goes in the body slot in focus only. |
| Toolbar editor (Description, quick compose) | `cms-ui/editor` `RichTextEditor` (tiptap) | **have, focus only** | Weight rule (a1 #6): `./forms` ships a **lite editor**, a textarea with a B/I/list/link toolbar that writes markdown-lite and converts to sanitised HTML on save. `./forms/focus` uses `RichTextEditor`. A site that already bundles tiptap can pass `RichTextEditor` through the `body` slot. That choice belongs to the host, so tiptap never enters the essentials bundle by default. |
| Media: Upload / Library / Camera, focal point | `MediaPicker` (`cms-ui/files`), `studio/capture` `PhoneHandoff`, `CoverFrame` (focal + zoom), `focal` input | **have** | Camera = the phone hand-off. |
| Icons: Phosphor duotone | the repo uses `lucide-react`. No Phosphor anywhere | **gap / decision** | Icons go through a small icon map owned by the theme (`theme.icons`). Broadsheet's map uses `@phosphor-icons/react` (a new dependency). Other themes can use lucide. §7 Q6. |

### 1.6 Per kind (server contracts)

| Design | Ours | Status |
|---|---|---|
| **Post**: title, body, cover, goes on, public/members | `StudioActions.savePiece`, `StudioPatch`, `setListing(orgIds)` | **have**. There are **two bindings** (a1 #7): the Studio's network `writing` pieces homed on `oad`, and a site's own `kind='post'` threads in a chosen feed (HE `src/lib/studio/writing-actions.ts`), which the site's pages read. The host binds its own `FormActions` for Post, and "Goes on" supplies the feed. |
| **Service** ("Offering"; a1 #1): title, subline, card summary, description, price + currency, sliding scale (floor + note), length, sessions, one-to-one/group/not live, online/in person/either, place, booking state, picture, visibility | `content-fields.ts` kind `service` (booking group, pricing, sliding scale), `upsertServiceOffering`, HE's `components/publish/service-kind.tsx` (the reference) | **have** schema and server; Studio kind `ready:false`. Pass 2. **Payee rule:** a service pays its thread author (`resolveSettlement`), so the adapter saves the **signed-in user** as author, never the org's service account (HE migration 253 fixed this after the fact). |
| Post: excerpt (lede), also show on (profile, other orgs) | `lede`, `StudioListing` | **have**. *Verify* that "their editors approve" exists for cross-org listings; if not, it is a **gap**. |
| Post: tags | `writing.ts` mentions tags; `StudioPatch` has no tags | **verify → likely gap** in the Studio contract |
| Post: schedule publish | no scheduled status on pieces (`content` model has `scheduled` for display only) | **gap** (needs a job; pass 4) |
| **Gathering**: when, duration, where (place/link/talk), description, RSVP cap/min/deadline, notify on min, hosts, Talk room, living doc | `MeetingActions.saveMeeting`, `MeetingInputView`, `meeting-content.ts` | **have**. These map 1:1 onto `location`/`meeting_url`/`create_talk_room`, `attendee_limit`/`min_attendees`/`rsvp_deadline`, `create_document`, `host_user_id`/`co_host_user_id`. |
| Gathering: hosts as a multi-person input | host + co-host from `hostCandidates` | **extend** (two slots now; N later) |
| Gathering: which RSVP answers are offered (Going/Maybe/Can't/Waitlist) | statuses exist (`yes\|no\|maybe\|waitlist\|subscribed`), no per-thread allowed set | **gap** (thread `metadata.rsvp.answers`; no migration, but every RSVP route must read it) |
| Gathering: Emails (confirmation, reminder N before, on change, thanks after, host digest) + "Edit wording" | triggers are per app and fragmented (EMAIL_RSVP_DEBRIEF). Series have `reminderDays`. Templates are keyed `rsvp-guest`/`reminder` | **gap, the biggest one.** Pass 1 stores the switches in `metadata.emails`, shows what each app honours today, and marks the rest "not sent yet". The single reminder engine is its own lane. |
| Talk room: guests without account, open early | `create_talk_room` (public, by link) | **have / gap**: guests is have; "open 10 min early" is a **gap** |
| Materials | series `MeetingMaterial`, standing-meeting materials, workshop `SessionResourceDraft` | **extend**: one materials field, three stores. Use the series/meeting one. |
| **Series** in place: every N weeks on a weekday, count or until, sessions list with skip/restore and per-session title/note | `SeriesSchedule` (`weekday`, `intervalWeeks`, `firstDate`, `lastDate`), `series_sessions`, `saveSeriesSession`, `cancelSeriesSession`/`restoreSeriesSession`, `SessionsEditor` (workshop) | **have** server-side. **Gap**: before the first save there are no `series_sessions` rows. Plan: a composite `series-create` adapter: create the thread → `saveSeriesSchedule` → `ensureSeriesSession` for titled/noted weeks → `cancelSeriesSession` for skipped ones. "8 sessions" is converted to `lastDate`. Planner list first; calendar/programme are pass 4. |
| Series page row (listed, slides, featured) | `series-page.ts` `saveSeriesPageSettings` | **have** |
| **Artwork**: pictures, credits, price modes, availability, details, edition, variants, where it shows | `ArtPieceComposer` + `ArtPieceInput`, commerce `ArtworkVariant`, `ArtworkStatus` (incl. `reserved`), `editionNumber/Total`, `InquiryStatus` | **have/extend**. Price "On request" = commerce **inquiries** (better than "emails you"; beyond the design). Variants: have. **Gaps**: credits with roles ("Printed by"), artist proofs count, multiple pictures in `ArtPieceInput` (one `imageUrl` today), gallery-on-profile flag (*verify*). |
| **Poll / Questions** add-on, attached or standalone | `question-polls.ts` (org-scoped, no thread link), `questionnaires.ts`, `QuestionBuilder`, `QuestionnaireComposer` | **have** standalone. **Gap**: attaching to a thread, and "ask something when people RSVP". |
| After publish: link, copy, view, keep editing, make another with these settings | `MeetingRecordView.href`; `StudioLinks.pieceBase` | **have**. "With these settings" = the preset from the record (§4). |
| **Hook: Channel hand-off** | content doc §3: `delivery=` work order | **hook only**: an `onPublished(record)` callback plus the delivery close. No visible share step (by request). |
| Write path through the registry (`thread-create`, `series-create`, `artwork-create`) | `packages/actions` has the catalogue shape and no create entries | **align**: the forms take a `FormActions` adapter (like `MeetingActions`). Hosts bind today's services now and registry entries later, with no form change. |

### 1.7 What gets replaced (later, not in pass 1)

- `ComposeSheet` + `ContentComposer` faces in the hub compose popups. They become quick compose
  in pass 3 per host. `ContentComposer` stays exported until the last caller moves.
- `SeriesComposer`'s card face. The schema groups `series-*` stay.
- The Studio Meetings kind's three-column layout gives way to the form shell. Its
  answers⇄input conversion (`toWallClock`, `formZone`, …) moves into the gathering adapter
  unchanged.
- `manage/compose` ×4 and `hub/compose` copies (per the architecture doc, step 7). This is per-app
  work after pass 3. It does not belong to this team.

---

## 2. Package decision: `@elkdonis/studio/forms` (UI) + `@elkdonis/cms-ui/compose` (schema)

Recommended over a new `packages/compose`:

1. **The schema already has a home.** `content-fields.ts` has 4+ consumers (Studio Meetings, the
   hub compose popups, ifac). Moving it would break them; forking it would recreate the four
   drifting forms its header was written to end. It stays in cms-ui and gains `section`/`summary`/rules.
2. **The UI needs the Studio's pieces**: the essay `Canvas` body, capture/phone hand-off, the frame
   (`StudioTopActions`, `useStudioFrame`), the image editor. A separate `packages/compose` would
   depend on studio anyway.
3. **The architecture doc already settled it** (`NETWORK_SERVING_ARCHITECTURE` §4 row 95, step
   7): `@elkdonis/studio/forms`, an essentials variant without tiptap.
4. **Weight control** is a subpath discipline, not a package boundary. `./forms` (essentials,
   quick compose: no tiptap, no three, no Remotion; the lite editor of §1.5) and `./forms/focus`
   (full, may import the Canvas and `RichTextEditor`). A site that imports only `./forms` never pulls the Studio's heavy modules. Apps that
   import `StudioShell` need the 3584 MB heap (a1). Apps that import only `./forms` should not,
   and pass 3 checks that on the pilot.

Layout:

```
packages/cms-ui/src/compose/         schema (extend): content-fields.ts sections, summaries, rules
packages/studio/src/forms/
  contract.ts      bone   FormKindSchema, FormState, FormRule, FormPreset, FormActions, FormTheme
  state.ts         bone   useFormState: answers, openSections, issues, rail statuses, readiness
  presets.ts       bone   resolvePreset(), presetFromRecord(), fromPreset tracking
  adapters/        bone   post.ts (StudioActions), gathering.ts + series.ts (MeetingActions + series services), artwork.ts
  shell/           tendons FormShell (focus), TopBar, Rail, Readiness, layout switch, AfterPublish
  fields/          tendons Title, Field, Seg, Switch, CheckRow, MoreRow, TagInput, PeopleInput, MediaField
  preview/         tendons PreviewFrame (org theme + real site cards), Card|Page seg
  quick/           tendons QuickCompose popover + bottom sheet
  theme/           tendons forms.css (--eac-form-* → --frm-*), broadsheet.css, icon map
  kinds/           soft tissue post/, gathering/ (+ series planner), artwork/, addons/ (poll, questions)
  rules/           soft tissue per-kind FormRule[] + copy
  harness/         tendons  a dev page that renders every canvas id (1a–1s) for screenshots
```

Exports: `./forms`, `./forms/focus`, `./forms.css`, `./forms/broadsheet.css`.

---

## 3. Form-state model (the bone's contract, pass 1)

```ts
type FormKindId = 'post' | 'gathering' | 'artwork' | 'service'; // 'series' is derived, never chosen
type CodeKind  = 'writing' | 'post' | 'meeting' | 'series' | 'artwork' | 'service'; // what the adapter saves

interface FormKindSchema {
  id: FormKindId;
  label: (s: FormState) => string;                 // "New gathering" | "New series"
  sections: FormSection[];                          // from buildContentFields + kind-only sections
  rules: FormRule[];
  derive?: (a: Answers) => { codeKind: CodeKind };  // gathering + repeat.enabled + repeat.asSeries → 'series'
  defaultOpen: string[];
}
interface FormSection { id; label; tier: 'essentials' | 'more'; quick?: boolean;
  fields: string[]; summary?: (a, ctx) => string; render?: SlotName }
interface FormRule { id; severity: 'block' | 'warn'; fields: string[]; test: (a, ctx) => boolean; message: string; anchor: string }
interface FormState { kind; answers; openSections: Set<string>; fromPreset: Record<string,string>;
  issues: Issue[]; validationAttempted: boolean; saveStatus: 'idle'|'saving'|'saved'|'error';
  savedAt?: string; publishedAt?: string; record?: unknown }
interface FormActions<R> { context(orgId); save(orgId, answers, intent: 'draft'|'published', id|null): Promise<StudioResult<{record: R; warnings: string[]}>>;
  load?(id); presets?(orgId, kind): Promise<FormPreset[]>; lastSettings?(orgId, kind): Promise<FormPreset|null>; onPublished?(record: R) }
interface FormHost {                                   // supplied by each host; nothing in forms assumes a route
  studioHref(o: { kind: FormKindId; id?: string; preset?: string; focus?: boolean }): string;
  viewHref?(record: unknown): string | null;
  preview: { cards?: Partial<Record<FormKindId | 'series', CardRenderer>>; themeVars?: Record<string, string> };
  feeds: Array<{ slug: string; name: string }>;        // "Goes on"
  actions: Partial<Record<FormKindId, FormActions<unknown>>>; // a host binds its own Post (site threads) or the Studio's
}
```

- **Answers keep today's keys** (`scheduled_at`, `meeting_url`, `is_rsvp_enabled`, …), so
  adapters and server parsers don't change. New design-only fields get new keys
  (`emails.*`, `rsvp_answers`, `repeat.count`, `credits[]`). On the server they are stored under **one root,
  `metadata.forms.*`** (`metadata.forms.emails`, `.rsvp_answers`, `.credits`), never top-level
  `metadata.*`, because sites already read top-level keys (a1 #8). Stored Puck documents are not touched. An
  adapter drops what its action can't store and returns a warning saying so.
- **Series is derived**: `repeat.enabled && repeat.asSeries` → `codeKind 'series'`, and the
  answers go through `switchContentKind('meeting','series')`. Turning it off goes back without
  losing anything typed.
- **Drafts**: the design shows "Draft saved 12:04". The Meetings kind deliberately does not autosave,
  because a saved meeting lands on the org calendar. Pass 1 keeps the server save explicit
  ("Save draft") and autosaves *form state* locally (per browser, keyed by kind+org+id, try/catch).
  §7 Q5 asks whether drafts should be server-side and off the calendar.

## 4. Preset contract

```ts
interface FormPreset { id: string; name: string; note: string; kind: FormKindId;
  source: 'item' | 'org' | 'person' | 'platform' | 'last'; values: Partial<Answers> }
```
- Applying one merges `values` into answers and records each key in `fromPreset`. Editing a field clears its key.
- Order: the content doc's cascade (item → org → person → platform), then "last one's settings".
- Pass 1 ships platform presets in code (Blank post, Announcement, Thursday-style gathering,
  Editioned print) plus `lastSettings` from the latest record. **No table.**
- Pass 4: `content_prefs` / the lane A2 preset store feeds `FormActions.presets()`. The form
  doesn't change. That step needs a migration, so it waits for Justin's OK.

## 5. Theming contract

- **Input hooks** `--eac-form-*` (bg, surface, text, muted, accent, accent-ink, accent-soft,
  accent-on, danger, danger-ink, danger-soft, warn, divider, radius-control, radius-panel,
  shadow-panel, shadow-pop, font-body, font-heading, heading-weight, title-size) → **output
  tokens** `--frm-*`, with the documented fallback chain: hook → `--sf-*`/`--pr-*`/cms-ui neutral
  (`--paper`, `--ink`, `--line`) → default.
- Components use **only `--frm-*`**. A subtree theme redefines `--frm-*` on a wrapper
  (`[data-form-theme="broadsheet"]`), as `forum-theme.css` does, because hooks are computed at `:root`.
- `broadsheet.css` maps every Broadsheet token (README "Design tokens") onto `--frm-*`, including
  the 100–900 ramps the states need (accent-100 fill, accent-2-100 alert, accent-700 small cyan text).
- An org's `site_themes` vars can set `--eac-form-*` directly. The token importer
  (`@elkdonis/tokens` `linkHooks`) can link a brand kit file onto them. Quoted font stacks
  are unstorable (known), so fonts come from `@elkdonis/fonts` by name.
- Each filled accent gets an explicit `-on` token (frontend-ui rule). `accent-ink` is pinned to a literal per theme.
- Icons come from `theme.icons`, a name map; components ask for `icon('calendar')`, never a library.

## 6. Passes

Each pass ends with: tsc clean on touched packages, harness screenshots of the canvas ids it
covers next to the design's, the bone's review, and a commit by explicit path. No deploys and no
migrations without Justin.

| Pass | Scope | Who | Needs |
|---|---|---|---|
| **0** (this plan is done; the stubs come next) | This plan; `forms/contract.ts`, `state.ts`, `presets.ts` stubs; the schema extension (`section`/`summary`/`rules` on content-fields, backward compatible) | bone | — |
| **1** | FormShell (focus) with the layout switch, rail, readiness and validation summary; fields; preview frame with host card connectors; `forms.css` + `broadsheet.css`; **Post** (both bindings) and **Gathering** wired to existing `StudioActions`/`MeetingActions`; `FormHost` contract; Studio reads `?focus=1` and `?preset=`; the two-part `replaceState` fix, `personalOrg={false}` and host links on `StudioShell`; harness for 1a, 2a, 2b, 1b, 1h, 1i, 1j, 1l–1n | tendons (shell/fields/preview/theme), soft tissue (post, gathering, rules, mobile), bone (state, adapters, review) | Studio route wiring in `apps/arts-collective` **waits for the PM's go**. Until then the work is in packages + harness only. |
| **2** | **Series in place** (Repeat → as series, list planner, skip/restore renumbering, Series page row), composite `series-create` adapter; **Artwork** (multi-picture, credits, price modes incl. inquiries, edition, variants) wired to commerce; **Service** ("Offering") from HE's `service-kind.tsx`, author = signed-in user | soft tissue (kinds), bone (series/artwork adapters), tendons (planner grid, variants grid joints) | Verify the artwork gaps (§1.6) first. |
| **3** | **Quick compose** popover + bottom sheet (`tier:'quick'` + preset line), "Open in Studio" carries the state (`?preset=` or a draft id) through `FormHost.studioHref`; the **framed-surface protocol** (below); quick compose registrable as the custom surface `popup:custom:compose:<kind>` (kit §2.5, `SMART_COMPONENTS_KIT_2026-11-08.md`); **Poll/Questions** add-ons standalone (`QuestionBuilder` underneath); `onPublished` hook + Channel `delivery` close; one pilot site | tendons (quick, protocol), soft tissue (addons), bone (hand-off contract, pilot) | **Pilot: hidden-enneagram** (PM ruling), run with `system32-a1`. `packages/content` `CREATE_KINDS.ready` flips once its owner frees it. |
| **4** | Needs Justin: presets store (`content_prefs` / lane A2), per-thread email switches read by one reminder engine, RSVP answer sets, poll attached to a thread, scheduled publishing, planner calendar + programme variants, N hosts | split per item | Migrations, cross-lane work |

**Framed-surface protocol** (pass 3, from HE `components/publish/bridge.ts`; it lives in
`studio/frame`, so no host re-implements it):
- `postMessage` types `saved`, `published`, `navigate` and `close`. `navigate` means the frame left
  its route: close the popup and navigate the parent.
- The receiver checks **both** `event.origin` and `event.source`.
- The caller refreshes **only after a save**, never on mount. A mount refresh fired twice under
  StrictMode and reloaded the frame mid-typing.
- "Open full screen" follows the item currently open, not the one the popup started with.

## 7. Agent split and file ownership

- **Bone (me)**: `forms/contract.ts`, `state.ts`, `presets.ts`, `adapters/*`, the
  `cms-ui/compose/content-fields.ts` extension, this plan, the gap list, and review of
  everything. I hold the naming and the kind schemas.
- **Tendons** (Sonnet or Opus, loads `design:design-system`, `design:design-handoff`,
  `artifact-design`): `forms/shell`, `fields`, `preview`, `quick`, `theme`, `harness`,
  `forms.css`/`broadsheet.css`. It must not touch kind folders or the contract; it asks the bone for a field.
- **Soft tissue**: `forms/kinds/*`, `forms/rules/*`, the copy, mobile reflow, the planner, and the Poll/Questions add-ons.
- **Off limits for all three**: `apps/arts-collective` and `packages/content` until the PM confirms
  arts-collective is live; `apps/hidden-enneagram`; `pnpm-lock.yaml` (a new dependency such as
  Phosphor is proposed, not installed, until the lockfile is free); `packages/studio/src/channel` (lane A).
- Sub-agents start after Justin answers Q1–Q3. Q4–Q7 can be answered while pass 1 runs.

## 8. Owner questions (for Justin, via the PM)

1. **Naming.** UI word "Gathering", code id `meeting`: OK? And the design's "Post" = writing, while
   the Studio's `post` = a social post. Proposal: rename the Studio tab to "Social posts" and keep
   "Post" for writing in the forms and the Publish card. A service's UI word: "Offering" (proposed)?
2. **Package**: `@elkdonis/studio/forms` for the UI, with the schema staying in `cms-ui/compose` (§2). Agree?
3. **Preview honesty**: render the *target site's* real cards in its own theme (my recommendation) rather than Broadsheet cards?
4. **Preview layout**: 2a toggle or 2b rail? Built as a switch either way. 2a is the default until you pick.
5. **Drafts**: should a draft gathering stay off the org calendar and autosave to the server? Today a saved meeting appears on the calendar, which is why the Meetings kind doesn't autosave.
6. **Icons**: add Phosphor duotone for the Broadsheet theme (a new dependency), or draw Broadsheet with lucide?
7. **Emails**: show all five switches now, honest about which ones send today, or only the ones that work?

## 9. Notes taken in (system32-a1, lane D)

- The `StudioShell` `replaceState` frame reload → fixed in pass 1 (§1.4).
- The StudioShell wishlist (`personalOrg:false`, a host href base, a service kind,
  `onSaved`/`onPublished`, a page/feed select): `onSaved`/`onPublished` and the feed select are
  part of the forms (`FormActions.onPublished`, "Goes on"). `personalOrg:false` and the href base go
  on the shell as props in pass 3, when quick compose needs them.
- hidden-enneagram `studio:compose` (the Studio framed same-origin from a block) is the precedent
  for quick compose's "Open in Studio" on a site. Pass 3 follows it.
- Hydration: ids from the block or field, never `useId`/random. Server code imports page-builder
  `/config` or `/server` only.

## 10. Review round 1 (system32-a1, 2026-11-08): all eight notes taken

1. The `service` kind was added (pass 2, "Offering"; HE `service-kind.tsx` is the reference; author = signed-in user).
2. `personalOrg={false}` and host links moved into pass 1.
3. No hard-coded `/studio`: every link comes from `FormHost.studioHref`.
4. `replaceState` gets the two-part fix (write only on change, plus a `syncUrl` prop).
5. The framed-surface protocol is standardised in `studio/frame`, and quick compose can be registered as `popup:custom:compose:<kind>`.
6. Weight: `./forms` uses a lite editor, and tiptap appears only in `./forms/focus` or when a host passes it in.
7. Post has two bindings, and the host binds its own `FormActions`.
8. New keys go under `metadata.forms.*`.

Q3 answered by a1: yes, with cards as a host connector. The PM accepted all eight and named
hidden-enneagram the pass 3 pilot. Q1–Q7 are still with Justin.

**One link builder.** `FormHost.studioHref` is the single source of Studio links. `@elkdonis/content`
`studioNewHref` already takes `base` (enough for HE's `/publish` today). When the contract lands
in pass 1, it gets a small change: `StudioHandoff.href?: FormHost['studioHref']`, used ahead of
`base`, with the kind mapping kept in `CREATE_KINDS`. That edit waits until the PM frees `packages/content`.
