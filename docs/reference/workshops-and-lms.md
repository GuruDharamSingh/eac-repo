# Workshops, gatherings, RSVP and the LMS (Sophia)

Covers workshop offerings stored as threads, kind-agnostic RSVP and its route-level side effects, workshop
enrolment and the gated workspace, the workshop wizard, the meeting rota (migration 136), the unused
`@elkdonis/reading-wizard` package, and the Sophia LMS (`packages/lms`, `packages/lms-ui`, `apps/sophia`,
migrations 140–143 and 145). Payment mechanics are covered in [commerce.md](commerce.md); this document
covers only where payment meets enrolment. Last verified: 2026-09-23 (code read, schema and
`app_schema_migrations` queried, container state and HTTP reachability checked).

## Current state

### Workshop offerings are threads

- A workshop is a `threads` row with `kind = 'workshop'`, plus one `workshop_pages` sidecar row (page fields:
  banner and focal point, hero, colour, level, pricing, SEO, section toggles) and `workshop_sessions` rows
  (the chapters; `notes` JSONB carries per-session image, colour and `resources[]`).
- The shared service is `packages/services/src/workshop-offerings.ts`, the sibling of
  `service-offerings.ts` (`kind = 'service'`: paid, no RSVP; the commerce order is the registration).
  Key functions: `upsertWorkshopOffering` (:508), `replaceWorkshopSessions` (:711),
  `archiveWorkshopOffering` (:756), `isEnrolledInWorkshop` (:784), `workshopMaterialsFolder` (:841),
  `listWorkshopMaterials` / `ensureWorkshopMaterialsFolder` / `uploadWorkshopMaterial` /
  `deleteWorkshopMaterial` (:849–921).
- `upsertWorkshopOffering` writes all `workshop_pages` columns (it covered 14 of 35 before 2026-09-01),
  keeps `published_at` with `COALESCE`, writes thread and sidecar in one transaction, and sets
  `is_rsvp_enabled = TRUE` unless told otherwise (:563).
- Price is dual-written to `threads.price` and `workshop_pages.price_member`. Readers use
  `COALESCE(wp.price_member, t.price)`.
- Write paths onto the workshop tables (2026-09-23):
  1. `upsertWorkshopOffering` — innergathering composer, and arts-collective via `saveWorkshopAction`
     (`apps/arts-collective/src/lib/cms/actions.ts:615`, delegates at :688 since 2026-09-10).
  2. `updateWorkshopFieldAction` (`actions.ts:331`) — the live in-page editor; per-column `UPDATE`s on
     `threads`, `workshop_pages`, `users`, `org_profiles`. Still its own SQL.
  3. `apps/inner-gathering` (the hyphenated app, being retired) has its own `/api/content` write path.
- Migrations 115–116 (applied 2026-09-10) folded `workshop_details` into `workshop_pages`, dropped it, and
  recovered a double-encoded price.
- `threads.sessions` (JSON column) still exists with no writers. Readers found by grep:
  `apps/arts-collective/src/lib/org.ts:427` and `:575`. Sessions live in `workshop_sessions`.
- 2026-09-23 data: every `kind = 'workshop'` row is `archived` (7 rows, all `inner_group`). No published
  workshop exists on the network. Three `workshop_join_requests` rows exist, all `pending`.

### RSVP is kind-agnostic

- `thread_rsvps(thread_id, user_id, status, created_at, updated_at, flavour, promise_next)` has no `kind`
  column. Eligibility columns live on every thread: `is_rsvp_enabled`, `rsvp_deadline`, `attendee_limit`.
- `packages/services/src/thread-rsvp.ts` holds the primitives, all side-effect free:
  `checkRsvpEligibility(threadId, extraConfirmedCount)` (:29), `countConfirmedRsvps` (:63),
  `getRsvpStatus` (:72), `setRsvpStatus` (upsert, :80), `deleteRsvp` (:94). There is no `lib/thread-rsvp.ts`
  in any app; the memory index's reference to that path is wrong.
- Client hook: `packages/hooks/src/useThreadRsvp.ts`.
- Kind-specific side effects live in each app's `api/threads/[id]/rsvp/route.ts`: confirmation and owner
  emails, the one-shot `min_attendees_notified` nudge, and for workshops the Nextcloud materials share.
  Routes that use the shared eligibility check: innergathering, arts-collective, amrit-canada, sunjay,
  fourthwayBookreaders, `ifac/api/hub/rsvp`, and inner-gathering.
- Guest RSVP routes (`api/rsvp`) exist in innergathering, amrit-canada, sunjay, ifac and admin.
- A recurring gathering's RSVP expires with its cycle: innergathering's GET treats a row as current only if
  `isWithinCurrentCycle(updated_at, …)` (`apps/innergathering/src/app/api/threads/[id]/rsvp/route.ts`, GET).

### Paid seats: payment grants the seat

- innergathering member route (`apps/innergathering/src/app/api/threads/[id]/rsvp/route.ts:141`): when the
  thread's price is above zero and the viewer is not already `yes`, it creates a commerce order
  (`createThreadOrder`, kinds `workshop`/`event`) and returns a Stripe checkout URL. It never writes the RSVP
  itself. Returns 503 if card payment is not configured.
- The seat is granted by `confirmOrderPaid` (`packages/commerce/src/server/orders.ts:543`), which inserts
  `thread_rsvps … 'yes'` for each `workshop`/`event` line inside the payment transaction (:713). A guest
  order has no `customer_id` and cannot be enrolled, so paid joins require sign-in.
- innergathering guest route refuses priced threads (`apps/innergathering/src/app/api/rsvp/route.ts:74`).
- arts-collective member route refuses priced workshops with 402
  (`apps/arts-collective/src/app/api/threads/[id]/rsvp/route.ts:105–111`); it has no payment path.
- `workshop_join_requests.status` is never set to `'paid'` by any current code. `isEnrolledInWorkshop` and
  `syncWorkshopEnrolments` still honour `'paid'` rows; only inner-gathering creates join requests.
- The amrit-canada, sunjay, fourthwayBookreaders and ifac RSVP routes, and the amrit/sunjay/ifac/admin guest
  routes, have no price check (grep, 2026-09-23). No priced RSVP-enabled thread is published in those orgs
  today, so nothing is exposed now; see Open items.

### Enrolment and the workshop workspace

- Enrolment rule, one function: `isEnrolledInWorkshop(threadId, userId)` =
  `thread_rsvps.status = 'yes'` OR `workshop_join_requests.status = 'paid'`. It excludes author and org
  editors on purpose; callers compose it with `canEditOrgIdentity` or an author check.
- Design (2026-09-09): one URL that shows more as the viewer gets closer — feed card, public page, workspace
  (enrolled: materials folder, participants-only session resources, Talk room, roster), desk (guide/org
  editor: add and remove materials). Full rationale: `docs/archive/WORKSHOP_WORKSPACE_2026-09-09.md`.
- innergathering renders the workshop at `[feed]/[slug]`; the enrolment check is at
  `apps/innergathering/src/app/[feed]/[slug]/page.tsx:142–144`. Non-enrolled visitors see a file count.
  `/workshops/<id>` is a permanent redirect for old inner-gathering links.
- arts-collective's workspace is `<org>.arts-collective.com/workshop/<slug>`
  (`apps/arts-collective/src/app/sites/[slug]/workshop/[workshopSlug]/page.tsx:57`). Non-enrolled visitors are
  redirected to the promo page. Materials download: `api/workshops/[id]/materials/[filename]/route.ts:39`,
  filename matched against the folder listing.
- Storage: `EAC_Network/<org>/workshops/<threadId>/materials/` is canonical and org-owned. Participants'
  own folders never receive copies.
- Media authorisation: `parseMediaPath` classifies `EAC_Network/<org>/workshops/<threadId>/…` as target kind
  `workshop`, always private (`packages/services/src/media-authz.ts:86–89`), checked by
  `canAccessWorkshopMaterials` (:248) = author (any identity the account writes as) OR enrolled OR org
  editor. Before 2026-09-09 the folder parsed as a public org path and every media proxy served it to anyone
  with the URL.
- Nextcloud share mirror is optional and best-effort: innergathering `lib/workshop-share.ts:15`
  (`shareWorkshopMaterials`, called on RSVP at route :188 and on cancel at :285); arts-collective calls
  `grantMaterialsAccess` / `revokeMaterialsAccess` (`rsvp/route.ts:71–78`). Only accounts with a
  `nextcloud_user_id` receive a share. The page never depends on the share.

### Workshop wizard foundations

- Built 2026-09-01 in `packages/cms-bindings/src/workshop/`: `field-index.ts` (reverse
  `table.column → registry entry`), `wizard-config.ts` (`buildWorkshopWizardSteps`, steps derived from the
  template manifest's sections and their `cmsFields`), `offering-mapping.ts` (`answersToOfferingInput`),
  `audit.ts` (`pnpm --filter @elkdonis/cms-bindings audit:template`). UI shell in `packages/cms-ui/src/wizard/`
  (`WizardProvider`, `TemplateWizard`, `fields.tsx`).
- Consumed (verified 2026-09-23): arts-collective `/hub/workshops/[orgSlug]/guided`
  (`apps/arts-collective/src/app/hub/workshops/[orgSlug]/guided/page.tsx:70–71`, `buildWorkshopWizardSteps` →
  `toWizardUiSteps` → `GuidedWorkshopWizard`). Linked from the Elkdonis hub tab
  (`hub/(tabs)/elkdonis/page.tsx:92`). It saves through `saveWorkshopAction`
  (`components/hub/GuidedWorkshopWizard.tsx:232`) with its own `wizardAnswersToColumns` fold, so
  `answersToOfferingInput` has no consumer. No other app uses the wizard.
- Known limits: no `template_id` column on `threads` or `workshop_pages` (checked), so one workshop template;
  `getOrgWorkshopForTemplate` is `LIMIT 1` per org; the enneagram manifest declares `cmsFields` on 0 of 20
  sections; `roleTitle` is read-only as a stopgap. There is no repo-wide test runner. Details:
  `docs/archive/DEBRIEF_2026-09-01_workshop_wizard.md` §8.

### Meeting rota (migration 136, applied 2026-09-17; 159 applied 2026-09-21)

- A recurring gathering is one `threads` row; occurrences are derived by `expandOccurrences`
  (`packages/utils/src/recurrence.ts:120`) and have no id. Rota rows are keyed by `(thread_id, occurrence_at)`.
- Tables: `meeting_hosts` (PK `thread_id, occurrence_at, role`; `user_id` nullable) and
  `meeting_occurrence_notes` (`note`, `attended` JSONB, and from 159 `plan`, `planned_by`, `planned_at`).
  `thread_reminder_sends` PK is `(thread_id, occurrence_at, kind)` so host and attendee reminders do not
  collide.
- Service: `packages/services/src/meeting-rota.ts` — `getMeetingRota` (:120), `setOccurrencePlan` (:207),
  `assignMeetingRole` (:234), `clearMeetingRole` (:256), `getRoleHolder` (:278), `saveOccurrenceRecord`
  (:384), `suggestAttendanceFromTalk` (:427), `listHostRemindersDue` (:548), `claimHostReminder` (:605).
- Precision: `timestamptz` stores microseconds, JS stores milliseconds. The service never compares against
  `threads.scheduled_at` in SQL; occurrences are computed in JS and passed as
  `= ANY(${isos}::timestamptz[])` (:154, :162).
- DST: weekly occurrences step a fixed number of milliseconds in UTC (`recurrence.ts`), so local times drift
  an hour across DST. `occurrence_at` is the rota key, so a fix needs a data migration.
- Routes: `apps/innergathering/src/app/api/hub/meeting/{rota,record,attendance,light}` and the same set plus
  `history` in ifac. Permissions (`innergathering …/rota/route.ts`): reading is members only; a `plan` body is
  handled first (:106) and only an editor or that week's host/co-host may write it; an editor may assign
  anyone, a plain member only themselves (:135); a member may clear only their own row.
- `suggestAttendanceFromTalk` reads roughly the last 200 Talk messages and filters by window; it returns
  `scanned` so callers can tell "nobody came" from "too old to tell". Results are suggestions with a `source`.
- Host reminders: `apps/innergathering/src/instrumentation.ts:18–26` runs `runHostReminderTick`
  (`lib/reminders.ts:27`) every 5 minutes; the claim is taken before the send. End-to-end delivery has not
  been observed (**unknown**).
- UI: `StandingMeetingFace` `rota` prop (off by default) and `PlanAheadSurface` in
  `packages/cms-ui/src/hub/`; 5 `meeting_hosts` rows exist.

### Reading wizard package

`packages/reading-wizard` (`@elkdonis/reading-wizard`, built with tsup to `dist/`, dist dated 2026-05-30):
`ReadingImportWizard` component plus `createReadingWizardState` / `buildProgramPreview` planner and types for
importing a book (pdf/epub/audio/link) into reading units. No app or package depends on it or imports it
(grep of `apps/*/package.json`, `packages/*/package.json` and sources, 2026-09-23).

### Sophia LMS

- Uncommitted as of 2026-09-23: `apps/sophia/`, `packages/lms/`, `packages/lms-ui/`, `lms/` and migrations
  140–145 are untracked in git.
- Migrations applied (from `app_schema_migrations`): 140 `lms_content`, 141 `lms_delivery`, 142 `lms_record`
  (2026-09-18 16:24), 143 `lms_run_discussions` (16:30), 145 `lms_course_pool` (17:50). 144 is
  `nc_forum_sync`, another area. 19 `lms_*` tables exist.
- Model: three layers with one-way dependencies — content (`lms_courses`, `lms_course_versions`, `lms_steps`,
  `lms_step_versions`, `lms_step_drafts`, `lms_achievements`, `lms_slug_redirects`, `lms_course_staff`),
  delivery (`lms_runs` with mode `open|drip|cohort|circle` and `workshop_thread_id`, `lms_run_staff`,
  `lms_entitlements`, `lms_enrolments`, `lms_run_discussions`), record (`lms_step_state`, `lms_responses`,
  `lms_acknowledgements`, `lms_events` append-only, `lms_awards`). Plus `lms_pool_items` (145).
- `packages/lms` (source-exported, no build): `content.ts`, `delivery.ts`, `record.ts`, `unlock.ts`
  (`evaluateAccess`), `step-types.ts`, `refs.ts`, `seo.ts`, `authoring.ts`, `pool.ts`, `unfurl.ts`
  (SSRF-guarded OpenGraph fetch). Scripts: `seed:path`, `seed:test`, `test:unlock`.
- `packages/lms-ui`: server components with no client JS, plain `so-` CSS (`lms.css`), form posts to
  `/api/lms/[action]` answered with 303s (`actions.ts`), studio in `studio.tsx`.
- `apps/sophia`: thin host on port 3020, compose service `sophia` (container `eac-sophia`, dev mode, image
  `eac-dev`). Routes: `/`, `/[course]`, `/[course]/[step]`, `/journal`, `/guide`, `/care`, `/studio`,
  `/studio/[course]/{[stepId],pool}`, `/api/auth/handoff`, `/api/lms/[action]`, `/api/media`, sitemap, robots.
  Sign-in uses the network handoff, as the forum does.
- A cohort run is a workshop thread: `lms_runs.workshop_thread_id`. `syncWorkshopEnrolments`
  (`packages/lms/src/authoring.ts:202`) copies RSVP `yes` and join-request `paid` users into entitlements and
  enrolments; a guide presses a button, it is idempotent and never removes anyone. There is no automatic sync.
- Data: courses `elkdonis-path` (`unlisted`, published) and `sophia-test-course` (`private`), both org
  `elkdonis`; runs `open` ×2, `first-circle` (cohort, draft, bound to a workshop thread), `a-little-at-a-time`
  (drip), `test-circle` (cohort, bound). `lms_enrolments` has 0 rows. Flagship step texts are placeholders.
- Course media upload: `apps/sophia/src/lib/connectors.ts:51` writes via `uploadOrgFile` to
  `EAC_Network/<org>/Media/<folder>`, which `parseMediaPath` classifies as an org path (public unless a
  `Private` segment). There is no `course` target in `media-authz.ts`.
- Deployment (checked 2026-09-23): `eac-sophia` is `Exited (0)` since about 2026-09-19 (restart policy
  `unless-stopped`, so it was stopped deliberately — **assumed**). `localhost:3020` does not answer.
  `sophia.arts-collective.com` resolves in DNS (wildcard); `http://` returns 404 from the proxy and
  `https://` does not connect, so no NPM proxy host or certificate exists. `SOPHIA_URL` is set in `.env`.
  arts-collective's hub shows "Open the Elkdonis Path" only when `sophiaLive()` gets an answer
  (`apps/arts-collective/src/lib/elkdonis-hub.ts:62`, used at `hub/(tabs)/elkdonis/page.tsx:112`), so the
  button is hidden today.

### LMS research and design review (`/mnt/pool1/home/guru/eac/lms/`)

Left in place; summary only.

- `lms/README.md`, `lms/SYNTHESIS.md` — decisions of 2026-09-18 and the build log. Decisions: flagship
  first (one public, free Elkdonis course, then a few invited teachers; no marketplace or Stripe Connect in
  year one); default experience is a "quiet practice companion" (no streaks or points, private reflections,
  guide acknowledgement that never gates progress), with a "community classroom" run mode; content is
  LMS-owned and versioned (supersedes the "lessons are threads" proposal in
  `docs/archive/COURSE_RESEARCH_2026-09-18.md`); a cohort run is a workshop thread; step pages are
  SEO-first with version-free URLs and `Course`/`CourseInstance` JSON-LD. Contains ten build rules, the
  schema outline and phases 0–4.
- `lms/research/01_architecture.md` — domain model, versioning, records, plugins, tenancy.
- `lms/research/02_pedagogy_and_ux.md` — evidence-tagged pedagogy and UX principles.
- `lms/research/03_business.md` — revenue share, tiers, Canadian tax and privacy, go-to-market. Some repo
  facts in it (Stripe unkeyed, SendGrid placeholder) are superseded by [commerce.md](commerce.md).
- `lms/research/04_workshops_today.md` — which workshop machinery a run reuses.
- `lms/research/05_authoring_ui_and_pools.md` — authoring UI patterns and the course pool.
- `lms/review/DESIGN_REVIEW_2026-09-18.md` (+ `shots/`) — front-end review of Sophia: learner side fits the
  stated design; studio is hard for a non-technical author; accessibility and copy findings; a ten-item
  list. Items 1–5, 7, 8 and parts of 9–10 were applied the same day. Open: conditional rule fields (6),
  collapsing studio sections and merging upload with the rule form (10), outline arrow fixes, the token pass.
- `docs/archive/COURSE_RESEARCH_2026-09-18.md` — earlier integrate-or-build comparison; recommended
  native. Its `@elkdonis/courses`/`lesson` kind design was not built.

## Rules and constraints

- Keep `packages/services/src/thread-rsvp.ts` free of kind branches and side effects; put emails, shares and
  payment in the route. Reason: threads will carry more kinds (listings, products) and every app shares it.
- Before writing `thread_rsvps … 'yes'` in any route, refuse or redirect to checkout when
  `COALESCE(wp.price_member, t.price) > 0`. Reason: an RSVP of `yes` is enrolment, which opens gated
  materials; `upsertWorkshopOffering` enables RSVP on paid workshops.
- Grant paid seats only in `confirmOrderPaid`. Reason: it runs inside the payment transaction and is
  idempotent on webhook retry.
- Gate workshop content with `isEnrolledInWorkshop` (plus author/editor checks), not an inline query.
  Reason: page, listing and download must agree.
- Serve workshop files only through `serveMedia`/`canReadMedia` or a route that checks enrolment. Reason:
  a raw proxy reopens the pre-2026-09-09 leak of `workshops/<id>/` folders.
- Write workshops through `upsertWorkshopOffering`. Reason: it is transactional, keeps `published_at`, and
  dual-writes price; other paths have diverged before (sessions written to `threads.sessions` never showed).
- Pass objects or `db.json()` to JSONB columns, never `JSON.stringify` output. Reason:
  `workshop_sessions.notes` and a price blob were double-encoded this way.
- In rota code, compare occurrences with JS-computed values passed as `ANY($list::timestamptz[])`, never
  against `threads.scheduled_at` in SQL. Reason: µs vs ms mismatch makes equality fail.
- In a rota route, handle a `plan` body before the clear branch. Reason: otherwise a plan write removes the
  host.
- Keep LMS access inside `packages/lms` services with a viewer; `org_id` on every delivery and record row;
  reflections are private by default. Reason: SYNTHESIS rules 7–9.
- Do not reuse `listPendingReviews()` for course reflections. Reason: it is network-wide.
- Never delete a published course version; publish freezes a version in one transaction. Reason: runs pin
  versions and progress references `step_version_id`.

## Open items

1. RSVP routes in amrit-canada, sunjay, fourthwayBookreaders and ifac (member and guest) and the admin
   guest route lack a price check. Harmless while no priced RSVP-enabled thread exists in those orgs.
2. `workshop_join_requests` has no writer that reaches `'paid'`; decide whether to drop the table's role in
   `isEnrolledInWorkshop` once inner-gathering is retired.
3. `updateWorkshopFieldAction` is a second write path; `threads.sessions` readers at `org.ts:427,575` block
   dropping the column.
4. Workshop template: no `template_id`, `LIMIT 1` per org; `workshop_testimonials` table does not exist;
   facilitator fields and `roleTitle` unresolved; no guide desk tile; no participant contributions folder.
5. Wizard: `answersToOfferingInput` unconsumed; no runtime tests (no test runner).
6. Rota: DST drift; host reminder delivery unobserved.
7. Sophia: not running; needs an NPM proxy host and certificate for `sophia.arts-collective.com` → 3020
   (`./scripts/add-proxy-host.sh`), then a start. Not built: automatic RSVP → enrolment, enrolment-gated run
   discussions (currently ordinary threads in the `elkdonis-path` feed), a `course` media target, badge
   signing, payments. Flagship content is placeholder and awaits the guide.
8. Sophia code and migrations 140–145 are uncommitted.
9. `@elkdonis/reading-wizard` has no consumer; keep or remove is undecided.
10. **unknown**: whether any course or workshop email has been delivered end to end.

## Sources

Supersedes:
- `docs/archive/WORKSHOP_WORKSPACE_2026-09-09.md`
- `docs/archive/DEBRIEF_2026-09-01_workshop_wizard.md` (keep for §8 detail)
- `docs/archive/SESSION_BRIEF_2026-07-30.md` §1, §2, §5, §6 (other sections belong to other areas)
- `docs/archive/COURSE_RESEARCH_2026-09-18.md`
- `docs/archive/RSVP_EMAIL_TRIGGERS.md` (paths in it predate the route rename)
- Memory: `project_workshop_workspace`, `workshop_suite_progress`, `workshop_wizard_foundations`,
  `project_lms`, `project_meeting_rota`, `project_thread_kind_expansion` (RSVP part)

Linked, not superseded: `lms/**` (research and design review), [commerce.md](commerce.md).

Corrections to earlier sources (2026-09-23):
- `workshop_wizard_foundations` said nothing consumes the wizard, then that it saves via the app's own SQL.
  Both are out of date: arts-collective `/guided` consumes it and `saveWorkshopAction` delegates to
  `upsertWorkshopOffering`.
- `workshop_suite_progress` said paid enrolment is trust-based. innergathering now enrols on payment through
  `confirmOrderPaid`; only the `workshop_join_requests` path never reaches `'paid'`.
- The memory index cites `lib/thread-rsvp.ts`; the file is `packages/services/src/thread-rsvp.ts`.
- `project_lms` records Sophia as running in dev; the container has been stopped since about 2026-09-19.
