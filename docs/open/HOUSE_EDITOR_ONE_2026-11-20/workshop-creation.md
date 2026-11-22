# Workshop creation: innergathering's prototype vs everything else (read-only survey, 2026-11-20)

Question (Justin): innergathering was prototyping an early workshop creation; how does it live now beside the other workshop, event and offering creations, and should we go further in its direction?

Method: code reads on eris (`~/eac`), `atlas:q -- workshop`, atlas area greps, and SELECT-only counts. Nothing was edited, built or written to the DB. Limits: no browser run, so "live" means "the code path exists and is wired", not "clicked". Counts are `threads` rows by `kind`.

## 1. innergathering's prototype

### 1.1 Which thing it is (uncertain: Justin may mean a slightly different piece)

The "early workshop creation" is **not** the questionnaire. `createQuestionnaireAction` (`apps/innergathering/src/lib/cms/questionnaire-actions.ts:44`) makes polls and questionnaires for people to answer; it is a sibling kind in the same Compose catalogue, not a way of making a workshop. The workshop prototype is the retired app's **dedicated full-page workshop page**, plus the 2026-09 work that carried it into the shared platform:

- `archive/inner-gathering/src/components/workshop-create-page.tsx` (503 lines; app moved to `archive/` today). Its header comment states the intent: "Dedicated, full-page workshop creation/edit experience, distinct from the generic post/meeting drawer on purpose" (lines 36-48). Mantine, one scroll, in this order: title, description, price, page colour, "Create a Talk room", banner (with focal point), hero (image or video URL), hero text, card thumbnail, **sessions** (each with its own date/time, duration, online/in-person, image, video, background colour, uploaded files marked open or participants-only), **materials folder** (once saved), **workshop emails** (welcome, reminder, minutes-before). It was also "the single editing surface" (the separate "Edit page" drawer was removed).
- Same write path as the drawer: `useContentDraft` -> `/api/content` -> `threads` + `workshop_pages` + `workshop_sessions`.
- API: `archive/inner-gathering/src/app/api/workshops/{route,[id]/join,[id]/materials}`; join modal; `workshop-sections-nav`.
- Design record: `docs/archive/DEBRIEF_2026-09-01_workshop_wizard.md` (turn the authoring into a friendlier wizard; found `workshop_pages` has 35 columns and the shared input covered 14; "three write paths onto the same tables, the wizard must not add a fourth") and `docs/archive/WORKSHOP_WORKSPACE_2026-09-09.md` ("one URL that shows more as you get closer": feed card -> page -> workspace for the enrolled -> desk for the guide).

### 1.2 The flow, step by step (as the prototype worked)

1. A guide opens the dedicated page (not a popup). One long form, no steps, everything a workshop needs on screen.
2. Pitch and price first, then the look of the page (banner with focal point, hero, colour), then sessions as "chapters" (each can carry its own image, colour and files).
3. Saving a draft **also** creates the workshop's Nextcloud materials folder and gives the author the desk, so the workspace exists from the first draft (current code: `lib/cms/workshop-actions.ts:106-109`, `lib/forms/meeting-actions.ts:228-230`: `ensureWorkshopMaterialsFolder` then `shareWorkshopMaterials`).
4. Publish files it under a section (`offerings` by default) at `/<section>/<slug>`.
5. After publish the **same page** is the workspace: enrolment (RSVP yes, or a paid join) unlocks materials, participants-only files per session, recordings, the embedded Talk room and who else is coming. `components/workshop-view.tsx:6-32` documents this; the page is `app/[feed]/[slug]/page.tsx:129-165`.

### 1.3 What is distinctive

- **Page-first, record-deep.** The creation page mirrors the public page's parts (banner, hero, cover, sessions as chapters), and the same page deepens for people who join. Not questionnaire-driven, not conversation-first.
- **Workspace from draft one** (materials folder, Talk room, emails), not a later step.
- **Group-run recurrence is a separate sibling**, not part of workshop creation: the hub meeting plan/record (`app/api/hub/meeting/{rota,light,record,attendance}`, `lib/forms/meeting-actions.ts`): a host rota (self-assign allowed), a "is it happening" light set by the occurrence's host, and a note plus attendance record where Talk's call log is only a suggestion (`record/route.ts:9-14`). This is the rota/group flavour; it applies to `meeting` threads (19 inner-gathering meetings), not workshops.
- The landing's `OfferingCall` (`components/landing/OfferingCall.tsx`) is only the Talk room embedded in an offer card, not creation.

### 1.4 What is still live on innergathering today

| Piece | State | Evidence |
|---|---|---|
| `/workshops/[id]` | legacy redirect to `/<section>/<slug>`; no `/workshops` index (404 signed out) | `app/workshops/[id]/page.tsx:1-19` |
| Workshop page (banner, hero, sessions, materials, join) | live | `[feed]/[slug]/page.tsx:129`, `components/workshop-view.tsx`, `workshop-materials.tsx` |
| Hub Publish page | offers only "Writing" (to the network Studio) and "Event or meeting"; **no workshop door** | `app/hub/publish/page.tsx:36-56` |
| `/hub/compose?kind=workshop` | live, via the shared `ContentComposer` tier `full`, which still has Presentation and **Sessions** groups; saves with `saveWorkshopAction` -> `upsertWorkshopOffering` | `components/hub/compose-workspace.tsx:102-169`, `lib/cms/workshop-actions.ts:96-119` |
| Hub popup (`compose:workshop`) and `/manage/content/new?kind=workshop` | live, via the new shared Studio form (`siteWorkshopSaveAction`, atlas `workshop-save`) | `components/hub/HubSurfaces.tsx:231-232,277`, `lib/forms/meeting-actions.ts:209`, `components/manage/site-form-page.tsx:7-12` |
| Per-workshop materials add/remove | live, atlas `ig-workshop-material-add/remove` | `app/api/workshops/[id]/materials/route.ts` |
| Reminder tick and "minimum reached" mail | live | `lib/forms/site.tsx` comment, `lib/reminders.ts` |

**Regression to note (inferred from code, not clicked):** the new Studio workshop form `workshopKind` has sections Title, Why, When, Where, Price, What, Places, Presentation (subtitle, discipline, level), Cover, Goes on (`packages/studio-forms/src/forms/kinds/workshop/schema.ts:22-34`). Its header says "Sessions (workshop_sessions) and the materials folder stay with the site's workshop pages for now" (`schema.ts:5-7`). So the popup and `/manage/content/new` path drop what made the prototype distinctive (sessions as chapters, banner focal point, hero, page colour, emails). Only `/hub/compose` (old composer) still offers sessions. In the Studio, the `workshop` tab is `ready: false` (`packages/studio/src/kinds.ts:26`).

### 1.5 Usage (DB, 2026-11-20)

- `threads` kind `workshop`: **7**: inner-gathering 6 (all `archived`, created 2026-07-03 to 2026-08-03, titles like "tester", "jokes", "title-of-workshop"; 0 to 3 sessions each), buddhasengines 1 draft (test, 2026-10-10). Nothing created through any workshop path since August; **0 workshops on arts-collective**.
- `workshop_pages` 15 rows: 6 archived workshops, 1 draft workshop, 8 services (the sidecar is shared by offerings). `workshop_sessions` 7. `workshop_join_requests` 3. `lms_workshop_listings` 3.
- Neighbours on the same org: inner-gathering `meeting` 19 (15 archived, 4 published; two recent), `service` 1 (astrology-reading, 2026-11-11); `meeting_hosts` 19, `meeting_occurrence_notes` 21, `channel_plans` 17, `thread_rsvps` 49 (platform-wide).
- `questionnaires` 2 rows, both with no org and kind `wizard`: nothing came from the Compose questionnaire door.

## 2. Every other workshop, event or offering creation path

Columns: entry; steps/fields; stores; publish; house editor / Fields lens / Puck.

| # | Path | Entry | Steps and fields | Stores | Publish | Editor use |
|---|---|---|---|---|---|---|
| 1 | **arts-collective guided workshop wizard** | `/hub/workshops/<org>/guided` (`app/hub/workshops/[orgSlug]/guided/page.tsx`) | Steps derived from the workshop template manifest plus platform steps: Images and video, Sessions, Materials, Video room, Emails, Sharing, Review and publish (`packages/cms-bindings/src/workshop/wizard-config.ts:220-260`); saves as you go (draft cache); `GuidedWorkshopWizard.tsx` 284 lines | `threads` + `workshop_pages` + `workshop_sessions` via `saveWorkshopAction` -> `upsertWorkshopOffering` (`apps/arts-collective/src/lib/cms/actions.ts:615-783`) | last step | `cms-ui/wizard` `TemplateWizard`; no Puck. Page is a Silex-style template (`/sites/<slug>/workshop/<slug>`) |
| 2 | **arts-collective full form** | `/hub/workshops/<org>/new` | `WorkshopForm.tsx` 878 lines, "advanced, all-at-once"; its field list drifted from the registry (guided page comment) | same | Publish button | none |
| 3 | **arts-collective live edit** | `/sites/<slug>/<contentSlug>` as owner | `WorkshopLiveEditor` (45 lines) binds `@elkdonis/live-editor`; fields from `workshopFieldDefs`, CSS vars from `workshopCssVarDefs` (`[contentSlug]/page.tsx:15,83,101`) | `updateWorkshopFieldByTraitAction` (`actions.ts:284`), theme overrides in `workshop_pages.theme_overrides` (`:431`); atlas `edit-workshop-live` | edits are live on the row | **The Fields lens**: `fieldRegistry` drives both wizard and live editor ("one registry, two renderers") |
| 4 | **arts-collective create-content** | dialog `components/cms/create-content-dialog.tsx` (696 lines) | one dialog for post, workshop, event, meeting | `createThreadAction` (`actions.ts:38`), atlas `create-content` (8 hosts) | on save | none |
| 5 | **Studio forms (shared)** | `/studio?kind=meeting`, `service-form`, `artwork-form`; popups and `/manage/content/new` on sites via `@elkdonis/site-forms` | Essentials + More rail, rules, presets, preview; meeting (Repeat -> series), series (name, Why, cadence; planner after), service ("Offering": How it is held, Price, Description, Booking), workshop schema exists but tab not ready | `threads` via services (meeting content, `upsertServiceOffering`, `upsertWorkshopOffering`, series create) | Save/Publish with readiness line | The "one forms direction". Hosts: sunjay, innergathering, ifac, amrit, HE, elktours. Not Puck; body slot is the Studio essay canvas or rich text |
| 6 | **Studio Create + piece summary** | `/studio?kind=create` on arts-collective (`packages/studio/src/create/CreateKind.tsx`; `docs/sessions/2026-11-14_studio-create-summary.md`) | a **launcher**, not a form: New tiles, Bring in, Library with Make-into chips, Products (Offering -> `service-form`), Brand kit, Next from the queue | none itself | n/a | Launches forms; summary view per piece (`PieceSummary`) |
| 7 | **katie-the-potter Channel** | `/channel` | queue/board/out of posts, not workshops; shared `@elkdonis/channel/site` | `channel_plans`, threads | n/a | Channel, not workshop creation |
| 8 | **sunjay gathering / meeting / series** | hub compose popup (`HubSurfaces.tsx:169-219`, `hasSeries: true`), Channel "Edit here" quick tier (`components/channel/meeting-sheet-form.tsx`), `/manage/content/new\|[id]` | shared meeting form; series made by the series form then edited in the **series planner** (`/hub/series/<id>`, `@elkdonis/series-site`) | `threads` kind `meeting`/`series`/`series_session`; atlas `meeting-save` (7 hosts) | Save/Publish | shared Studio form; quick-tier-then-"More options" ladder |
| 9 | **hidden-enneagram offering** | `/hub?surface=compose:service` and `/studio` publish app | service form (title, held, price, booking, picture); `siteServiceSaveAction` (`lib/forms/actions.ts:128`) and `lib/studio/service-actions.ts` -> `saveContentAction` | `threads` kind `service` + `workshop_pages` sidecar | Save and Publish | shared service form; canvas Puck on HE is for pages only |
| 10 | **elktours create-tour popup** | hub card `office-create-tour` (`components/office/create-tour/create-tour-popup.tsx`) | three steps Description -> Route -> Details (lines 24-27); draft saved when leaving step 1, stops when leaving step 2 (`:214-225`); Publish; "Offer dates" opens the schedule popup | `threads` kind `tour` + `tour_stops` (103 rows) + booking offer; atlas `tour-create/save/publish` | Publish; listed on `/tours` once it has dates | cms-ui `surface` popup; tour page layout via canvas (`tours-tour-layout-publish`) |
| 11 | **elktours artist experience wizard** | `/artist` mobile, `artist-wizard-view.tsx` | 4 fixed-copy steps (lines 15, 105): About you / What will happen / When are you free / How it is offered | `saveExperienceDraftAction` (`lib/artist-wizard-actions.ts:81`): `threads` kind `experience`, `metadata.offer`, `experience_people`, availability | **submit for review**; office decides (`decideExperienceAction:166`: publish / members / send back with notes) | fixed-copy wizard; office side `/manage/experiences`; `app/studio/experience-detail` |
| 12 | **art-auction series** | `/admin/series` `createSeriesAction({title, subtitle})` (`app/admin/series/actions.ts:41`), then `/series/<slug>/manage/*` (weeks, lots, rules, team) and in-place `page-editor.tsx` | create is two fields; everything else is boards | `auction_series*` (1 series), commerce | `setStatusAction` draft/published/closed (`manage/actions.ts:77`) | own dialogs, RichTextEditor; stays bespoke per `art-auction-katie.md` |
| 13 | **ifac** | `HubSurfaces.tsx:259-267` (workshop popup in `dialog` mode); center journey own-service (`saveOffering`, author-only, homed in `oad`) | compose popup for workshop/meeting/series; own-service = author's offering on their ArtDirect page | `threads` (service/meeting/series), `saveOffering` | on save | shared forms; series planner |
| 14 | **admin promote** | atlas `admin-workshop-promote` (`apps/admin/.../meetings/[id]/workshop`) | turn a meeting into a listed workshop | `lms_workshop_listings` (3) | immediate | none |

### Usage of the neighbours (rows)

| Path | Rows |
|---|---|
| arts-collective workshops (1-4) | 0 |
| Studio-form kinds | meeting 35 (innergathering 19, ifac 10, sunjay 4, others 2), series 3 (ifac 1, sunjay 2 archived), series_session 18, service 8 |
| tours (10) | tour 13 (8 published, 3 draft, 2 archived) |
| experience wizard (11) | experience 2 (1 draft, 1 published; elktours) |
| art-auction series (12) | 1 series (ifac-fall-auction, published), 4 slots |
| questionnaires | 2 (org-less, kind `wizard`) |

## 3. Comparison

| Path | Guidance style | Data model | Shared packages | Maturity (rows) | Does best |
|---|---|---|---|---|---|
| innergathering prototype (archive page; now `/hub/compose` full composer + new form) | one page mirroring the public page; page-first | `threads` + `workshop_pages` + `workshop_sessions`; Nextcloud folder | `services` (`upsertWorkshopOffering`), `cms-ui/compose`, `studio-forms`; page view is app-local | 7 workshops, none after Aug | workspace from draft one; sessions as chapters; the same page deepens on joining |
| arts-collective guided wizard | wizard, steps from template manifest + platform steps | same tables | `cms-bindings` registry, `cms-ui/wizard` | 0 | one field registry feeding wizard and live edit; draft cache; template-aware |
| arts-collective full form / dialog | form | same | local | 0 | nothing unique; drifts |
| arts-collective live edit | live edit on the page | `workshop_pages` columns + theme overrides | `live-editor`, `cms-bindings` | 0 | in-place fields; the Fields lens exists here |
| Studio forms (meeting/series/service/workshop) | form with Essentials/More rail, rules, presets, preview | `threads` (+sidecars) | `studio-forms`, `site-forms`, `cms-ui/compose`, `services` | 35 meetings, 3 series, 8 services; workshop schema only | one UI for every site; readiness and validation; Make-into |
| Studio Create | launcher | none | `studio` | new (Nov 14) | one place to start any piece |
| elktours tours popup | 3-step wizard with map route | `threads` tour + `tour_stops` | `cms-ui/surface`, `commerce` | 13 tours, 103 stops | save-as-you-leave-step; map editing |
| elktours artist wizard | 4 fixed-copy steps + review | `threads` experience, `experience_people`, availability | local | 2 | outsider-friendly sign-up with office review |
| art-auction series | two-field create then workspace boards | `auction_series*` | `commerce`, `page-builder` | 1 | multi-person approval, money |
| sunjay/ifac series | form then planner | `threads` series + `series_session` + `meeting_hosts` | `series-site`, `studio-forms` | 18 sessions | recurring weeks, host rota |
| HE / ifac / elastrocal service | form | `threads` service + sidecar | `studio-forms`, `services` | 8 | booking + price fields |

Common spine: nearly everything ends in `threads` plus a sidecar, saved by `@elkdonis/services`. Only elktours (tours, artist wizard) and art-auction add models of their own. House editor use: none of these use Puck for creation; only arts-collective workshop live edit and artdirect/ifac profile use the Fields lens (`live-editor`); the canvas is for site pages, not for creating workshops.

## 4. Direction

### 4.1 Where the prototype was heading

Toward **a workshop as one deepening page**: one record whose page is both the sales page and the room, authored in a single place that shows the finished page's parts (banner, hero, sessions as chapters), with the workspace (materials, Talk, emails, and for repeats the rota and record) created at the first draft. That is "page-first, then deepen", which fits the surface principle and the Fields-lens-plus-canvas model better than a questionnaire. What the platform built since is the opposite split: a generic rail form (Studio forms) for what every kind shares, which dropped the workshop-specific parts.

### 4.2 Options

**Option A (smallest: finish the shared form and make it the one workshop door).**
- Add Sessions (`SessionsEditor` already in `cms-ui/compose`), Page look (banner + focal, hero, colour), Materials and Emails to `packages/studio-forms/src/forms/kinds/workshop/schema.ts`. Essentials stay the six rows (Title, Why, When, Where, Price, What) so quick compose still works; More gains Sessions, Page look, Materials, Emails.
- Flip `workshop` to `ready: true` in `packages/studio/src/kinds.ts:26`; add a Workshop tile in Studio Create; point `/hub/compose?kind=workshop` and popups at the same form; retire the composer's workshop branch, arts-collective `WorkshopForm` and the guided wizard after a parity check.
- Save stays `upsertWorkshopOffering`. After Save, "Open the page" lands on the workshop page where the Fields lens covers quick copy.
- Cost: low to medium, no migration. Risk: the form grows long.

**Option B (the innergathering direction proper: workspace page as a shared package, edited by Fields lens plus canvas).**
- Extract `WorkshopView`, `WorkshopMaterials`, the join/RSVP panel and the enrolled-depth logic (innergathering, and arts-collective `OfferingPage`) into one package like `series-site`, so every host serves the same deepening page.
- Fields lens: declare workshop fields once in the `cms-bindings` registry (already feeds `live-editor`) and offer title, Why, price, dates and session titles as in-place popovers on that page (extends F9 in `innergathering-sunjay.md`).
- Canvas: the page look (banner, hero, section order, colour) as a record-backed direct-edit/Puck template using `RecordSources`; the form keeps only what the page cannot show in place (sessions list, price, places, emails).
- Creation = Option A's quick tier (Title, Why, When) that creates the draft **and its workspace** (materials folder, Talk room) at once, then lands on the page already in edit mode.
- Cost: medium. Risk: needs `data-trait` on the shared page and a stale-version guard for field saves (gap list in `innergathering-sunjay.md` section 3).

**Option C (workshop = series with a price: reuse the series planner and the meeting rota).**
- Sessions become `series_session` threads under a workshop-flavoured series, so the host rota, "is it happening" light, record and attendance (`api/hub/meeting/*`) apply to workshop sessions; the series form gains Price, Materials and Page look.
- Collapses two session models (`workshop_sessions` JSON notes and `series_sessions`) into one.
- Cost: high. Moving 7 archived workshops is trivial; the cost is join/enrolment logic, the `workshop_pages` sidecar (shared with services) and the arts-collective template. Needs a migration plan and Justin's go.

Suggested order: A now (the shared form regressed the prototype's strengths; low risk), B as the real direction once the Fields-lens save contract is settled, C only if recurring workshops are the actual goal.

### 4.3 Open questions for Justin

1. Did he mean the archive page (July) or the 09-09 workspace consolidation? Both are described above; the page-first reading seems right.
2. Are recurring workshops (rota, light, record) part of "workshop creation", or do they stay "meeting series"?
3. Should the arts-collective template-manifest wizard survive (the only template-aware path, 0 rows), or retire once A ships?
4. Is the missing workshop door on innergathering's Publish page deliberate? `hub/publish/page.tsx` says poll and questionnaire are "not offered here for now" and mentions no workshop.

## 5. Uncertain

- Whether the Studio form path renders without Sessions in the browser (read from `schema.ts` only).
- The 15 `workshop_pages` rows mix workshops and services; the split is by joining `threads.kind`.
- `/workshops` 404 signed out is from `PROGRESS.md` (innergathering), not re-tested.
- The sunjay/ifac series planner was read from atlas and `HubSurfaces`, not opened. art-auction creation refs are to `/admin/series`.
