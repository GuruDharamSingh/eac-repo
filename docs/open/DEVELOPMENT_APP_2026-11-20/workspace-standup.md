# Standing up /workspace on elkdonis-arts.org (innergathering, org `inner_group`)

Status: PLAN, 2026-11-22. Read-only investigation on eris (code reads, SELECT counts, `atlas:q`). Nothing edited, built, migrated or written. Author: PM worker "Workspace stand-up plan".

Inputs read: `LIAISON/HOUSE_EDITOR_PM.md`, `WORKSPACE_CONTRACT.md`, `WORKSPACE_ROUND2.md`, `WORKSPACE_ROUND3_NOTES.md`, `apps/development/src/workspace/**` (types.ts, store.tsx), `HOUSE_EDITOR_ONE_2026-11-20/workshop-one-page.md` and `PLAN.md` section 9, `MANJUSHRI_2026-11-20/HANDOFF.md`. Paths below are in `~/eac`.

---

## 1. The plain answer: what else do we need to stand this up?

**Already there, only needs wiring** (no new building):
- **People and who counts as in.** Sign-in, the org roles (owner, guide, member, viewer), and "enrolled" (an RSVP of yes, or a paid join) already exist on innergathering. Today: 6 owners, 1 guide, 5 members, 4 viewers.
- **Pictures and files.** The picture chooser (upload + the org library) is already used on innergathering; so are the workshop materials folder in Nextcloud and the media route that serves files with range requests (a PDF streams fine).
- **The shared pop-up frame.** innergathering already wraps every page in the shared surface system (`HubSurfaces`), so the Journal frame and the profile pop-up have a home.
- **Profile.** "Your account" and the profile pop-up already edit name, bio, city and picture; the workspace just links to them.
- **Talk room.** A workshop already carries a Nextcloud Talk room (`threads.nextcloud_talk_token`) and the page already shows a "Talk room" button; a pasted Zoom link has a column too (`threads.meeting_url`).
- **The learning engine.** `@elkdonis/lms` already has courses, modules, steps, completion, reflections with who-can-see-it (me / guide / group), a group ("cohort run") that can be bound to a workshop, and a one-call "bring the RSVPs in" (`syncWorkshopEnrolments`). arts-collective and sophia use it; **innergathering does not yet depend on it.**

**Must be built** (the real work):
1. **A real home for the prototype's state.** The prototype keeps everything in the browser. Almost all of it can live in tables that already exist (section 3); a small migration covers the rest.
2. **The safe save for workshops** (the earlier one-page design's "step 0"), because the workspace edits the same records. Today an editor save can write raw columns without checks.
3. **A server-backed version of the workspace** (the prototype's components moved into a shared package, with real saves instead of browser storage).
4. **Four things the learning engine lacks**: deadlines and timers on steps, photo/recording/quiz steps, a journal view across all steps (today it lists one step at a time), and participants commenting on each other's entries (today only the guide answers).
5. **The PDF reader as a shared piece.** It exists only inside the Books app (`fourthwayBookreaders`), with its own copy of the pdf.js files.
6. **The content picker on innergathering.** The "choose a piece" picker lives only in arts-collective (Channel). innergathering has the picture picker but not the content library.
7. **A chat that is only this workshop's room.** The shared chat is org-wide; a room-per-workshop version has to be added.
8. **Presence** (who is online). Nothing real-time is running on any site; a prototype hook exists and is unused.

**Needs your decision** (section 8; my picks are marked): whether steps live in the learning engine or a lighter workshop-only table; one address or two for a workshop; whether a participant sees other people's journals by default; what a "space" is next to a workshop; whether emails fire.

**Needs a database migration:** yes, one, small: one new table and five added columns (section 3). Not applied by me. Note migration 263 is still pending on eris and must not be swept up with it.

**Risky:**
- innergathering has uncommitted edits across the tree (and so do the shared packages: 936 changed files, last commit 2026-11-17). An innergathering rebuild ships the whole tree.
- Journals are private writing: the visibility rule must be enforced on the server for every read, not in the screen.
- Emails and payments must not fire from editing or from rehearsing.
- innergathering currently has **0 published workshops** (6 archived, 1 course). The list page will look empty until one is published, which is a feature for a safe first test.

---

## 2. What exists to hook to (with paths)

Counts are `inner_group` SELECTs on 2026-11-22.

### 2.1 Workshops today
- Tables: `threads` (kind workshop), `workshop_pages` (35 columns: banner, hero, subtitle, price_member, theme_overrides, background_color, banner_focal_y...), `workshop_sessions` (id, thread_id, session_number, topic, scheduled_at, duration_minutes, `notes` jsonb), `thread_rsvps`, `workshop_join_requests` (payments, status pending/paid/cancelled).
- Counts: 6 workshops, all **archived** (5 under section `general`, 1 under `offerings`); 7 pages; 7 sessions; 1 RSVP total; 3 join requests table-wide. 0 published.
- Code: `apps/innergathering/src/lib/cms/workshop-actions.ts` (52 lines; `saveWorkshopAction` -> `upsertWorkshopOffering`, then ensures the materials folder and the author's Nextcloud share), `workshop-adapter.ts`, `components/workshop-view.tsx` (233), `components/workshop-materials.tsx` (152), the workshop branch of `app/[feed]/[slug]/page.tsx` (lines ~129-200), `app/api/workshops/[id]/materials/route.ts` (editors write; enrolled read), `app/workshops/[id]/page.tsx` (legacy redirect), `lib/workshop-share.ts`.
- Compose: `/hub/compose?kind=workshop`, the Studio Workshops tab (`packages/studio/src/kinds.ts:26`, `ready:false`).
- Service layer: `packages/services/src/workshop-offerings.ts` (`upsertWorkshopOffering`, `getWorkshopOfferingById`, `replaceWorkshopSessions` at ~723, `isEnrolledInWorkshop` at ~796, materials functions at ~844-940).
- **Who is a participant:** `isEnrolledInWorkshop` = an RSVP with status yes, OR a `workshop_join_requests` row with status paid. Owners and guides are deliberately not "enrolled" (they run it). The same rule gates the media route (`canAccessWorkshopMaterials`).
- **Payments:** `ig-rsvp-join` (atlas: money, emails, others) takes the RSVP and, when `price` is set, the Stripe checkout. Nothing to build; the workspace must never call it.
- Known findings from the earlier design that still stand: (1) the page route 404s for drafts (`getThreadBySlug` and `getWorkshopOffering` filter published); (2) `replaceWorkshopSessions` deletes and re-inserts every session with new ids; (3) arts-collective `actions.ts:331` builds a raw `UPDATE threads SET ...` (unsanitised; can also write `users.*`); (4) `excerpt` vs `description_short` are two homes.

### 2.2 The learning package
- `packages/lms/src/`: `content.ts` (courses, draft/publish versions), `authoring.ts` (`editOutline`, `updateRun`, `syncWorkshopEnrolments`, `addRunGuideByEmail`), `delivery.ts` (runs, enrolments, `getLearnerOutline`, `listRoster`), `record.ts` (`completeStep`, `saveResponse`, `listJournal`, `listCircleResponses`, `acknowledge`), `unlock.ts` (sequential, open, after_module, date, offset_days), `tasks.ts` (steps that tick themselves from the platform), `step-types.ts` (registry: reading, practice, reflection, session, thread, resource, task; `registerStepType` adds more), `types.ts`.
- UI: `packages/lms-ui` is page-level, server-rendered and form-post (`renderLmsRoute`, `handleLmsAction`); it is not made of embeddable parts, so the workspace uses `@elkdonis/lms` functions directly and does not need lms-ui. (`steps/StepBody.tsx` could be exported if wanted.)
- Tables (migrations 140-145, 175, 177, 275, 277): `lms_courses`, `lms_steps`, `lms_step_drafts`, `lms_step_versions`, `lms_course_versions` (outline jsonb), `lms_course_staff`, `lms_runs`, `lms_run_staff`, `lms_entitlements`, `lms_enrolments`, `lms_step_state`, `lms_responses`, `lms_acknowledgements`, `lms_events`, `lms_awards`, `lms_run_discussions`, `lms_pool_items`, `lms_workshop_listings`.
- Facts that shape the plan:
  - A run can **be** a workshop: `lms_runs.workshop_thread_id` (migration 141) and `syncWorkshopEnrolments` grants an entitlement and an enrolment to every RSVP-yes or paid person.
  - `lms_responses`: kind in (reflection, practice_log, note), visibility in (me, guide, circle, public), body text only; `step_id` NOT NULL; no media, no comments from peers. `lms_runs.default_visibility` in (me, guide, circle).
  - `listCircleResponses` lists one step at a time, only visibility circle/public, and **excludes kind note**. There is no whole-journal-of-the-group read.
  - A course is frozen into versions on publish (changeKind fix/structural); a step's content is draft until published.
  - Step settings are an open record (`StepSettings` has `[key: string]: unknown`), so `due`, `timeLimit`, quiz options fit with no migration.
- Who mounts it: arts-collective (`app/learn/[[...segments]]`, `api/lms/[action]`, `lib/lms/connectors.tsx`) and sophia. innergathering's `package.json` has neither `@elkdonis/lms` nor `@elkdonis/lms-ui`.
- inner_group already has 1 LMS course ("Ritual Theatre Lab, Sacred Obligation series", visibility **public**) and 0 runs of its own. Two runs elsewhere (org `elkdonis`, mode cohort, one draft one open) are bound to the same test workshop thread `th_dGHRz2WI1FgS6_jOKt`, so `workshop_thread_id` cannot be made unique. The public catalogue (`listCatalogue`) lists only visibility public, so workspace courses must be **private**.

### 2.3 The content picker
Two different pickers; the owner's phrase covers both.
- **Files and pictures** (shared, already on innergathering): `packages/cms-ui/src/files/MediaPicker.tsx` (Upload tab + libraries), `MediaBrowser.tsx`, `FilesCard.tsx` (the hub "Files" card), `make-choose-picture.tsx` (`makeChoosePicture({uploadEndpoint, libraries})`). innergathering mounts it from `components/landing/page-picture-chooser.tsx`, `components/hub/compose-workspace.tsx`, `app/hub/files`. Routes: `app/api/upload/route.ts` and `app/api/media/library/route.ts` are **editors only**.
- **Content library / "choose a piece"** (record picker): `packages/content` (`@elkdonis/content`: `ui/ContentLibrary.tsx`, `ui/PieceLightbox.tsx`, `server/list.ts` `listContent`). Its picker form is `apps/arts-collective/src/components/channel/Library.tsx` (`LibrarySurface({ onPick })`), opened through the surface system (`channel/context.tsx`). That is the one that began in `packages/channel` and became a hub card. It is **arts-collective only**: innergathering does not depend on `@elkdonis/content`. apps/development `ideas/pickers-in-puck.tsx` is the inventory of pickers.
- How a site mounts it: the host passes upload/library endpoints (picker) or its listed pieces (content library) and opens it as a surface layer.

### 2.4 The PDF viewer (/books)
- `apps/fourthwayBookreaders/src/components/circle/pdf-reader.tsx` (230 lines). **App-local.** `PdfReader({ url, title, startPage, onClose })`: pdf.js (`pdfjs-dist` ^5.4.296 in that app's package.json), pages drawn to canvases as they scroll in, opens at a start page; works on phones.
- Needs: the `pdfjs-dist` dependency; the worker, WASM decoders and standard fonts served from `public/pdfjs/5.7.284/` (2.3 MB, copied from node_modules; folder name must equal the version); `withBase()` for its base path (`/books`); a file URL fetched with `withCredentials: true` (same-origin cookie); range requests are already handled by `serveMedia` in services (PDFs are served `inline`).
- innergathering `public/` has no pdfjs folder.

### 2.5 Profile and settings
- `apps/innergathering/src/app/account/page.tsx` + `components/profile-edit-form.tsx` + `lib/account-actions.ts` `updateOwnProfileAction` (bio, photoUrl, city, slug; always the caller's own, no userId parameter). `/profile/[userId]` and `/about/<slug>` display it. The surface system offers a "View profile" pop-up (`createHubConnectors` with `profile: true`, plus the "What your page carries" panel).
- Homes: `users.display_name / avatar_url / bio / city / slug`; org role title in `org_profiles`. A "profile in the sheet" should call `getProfile` for display and link out to the existing editor (or open the existing profile pop-up); it must not grow its own copy. Avatar upload: `uploadRoutes` has kind `avatar`; innergathering mounts only `site`.

### 2.6 Talk rooms and calls
- `packages/services/src/nextcloud.ts` `createTalkRoom` (line ~353; public or private group via `talkRoomPolicy`), `meeting-content.ts`; stored as `threads.nextcloud_talk_token`. The page builds `NEXT_PUBLIC_NEXTCLOUD_URL/call/<token>` and shows a "Talk room" link. 3 of the 6 archived workshops have a room.
- **Chat can be embedded** (read and post through the app), not only linked: `packages/chat` (`ChatTranscript` polls every 6 s; members post as Talk guest sessions, migration 102). But `routes.ts` and `services/src/org-chat.ts` are org-scoped (the token comes from `organizations.talk_room_token`, never from the caller). A workshop version needs the same functions reading `threads.nextcloud_talk_token`, gated by enrolment.
- A pasted Zoom/Meet link: `threads.meeting_url` (written by `upsertWorkshopOffering` as `meetingUrl`). One "video call" button reads: Talk token, else `meeting_url`.

### 2.7 Notifications and email
- `packages/email`: templates `rsvp-guest`, `rsvp-owner`, `reminder`, `meeting-trigger`, `contact-owner`, `welcome`...; per-thread overrides `rsvp-guest:<threadId>` / `reminder:<threadId>` in `email_template_settings`; `threads.reminder_minutes_before`; the reminder tick (`services/src/attendee-reminders.ts`, filters published).
- In-app: a `notifications` table exists (user_id, kind varchar(40), thread_id, reply_id, actor_id, data jsonb, read_at) fed by the forum (reply, heart, mention); 7 rows; the hub page reads it. A new `kind` needs no migration.
- No digest anywhere for workshops; `services` mentions "digest" only for the showcase.

### 2.8 Presence and live messaging
- Running: `eac-supabase-realtime` container (up 6 days). In code: `packages/hooks/src/usePresence.ts`, `useRealtimeFeed.ts`, `useRealtimeNotifications.ts`, `useRealtimeAttendees.ts` (supabase-js channels). **No app uses `@elkdonis/hooks`** (innergathering does not depend on it). Chat polls; the forum is request/response. `services/src/presence.ts` is "where you show" (directory switches), not online status.
- So: real presence is nothing today; the prototype's "online" dots would be the first use.

### 2.9 The surface frame
- `packages/cms-ui/src/surface`: `SurfaceProvider`, `SurfaceFrame` (head / rail / body / foot), `SurfaceStage`, `SurfaceCard`. A page must sit under `<SurfaceProvider connectors>` and open a layer with a descriptor; custom layers are registered by key (Channel does `type: "custom", key: "channel:library"`).
- innergathering **already does this**: `app/layout.tsx` wraps the site in `components/hub/HubSurfaces.tsx` (`createHubConnectors`, a `custom:` map for cloud, plan-ahead, whiteboard, compose). The workspace registers one more custom surface (the Journal frame). Caution: `packages/cms-ui/src/surface/*` has uncommitted edits (SurfaceShell, SurfaceProvider, types, kinds) from another session.

### 2.10 Auth and gates
- `apps/innergathering/src/lib/auth.ts`: `getViewer()` returns `{ userId, role, canEdit (owner|guide), isMember (owner|guide|member), isAffiliate }` or null; `requireOrgEditor`, `getApiEditor`. A signed-in person with no org row (a guest who RSVPed) is a valid participant with `role: null`.
- Per-workshop roles are thinner than the prototype's: the **guide** of a workshop is its author (`threads.author_id`) plus, if an LMS run exists, `lms_run_staff` (`isRunGuide`), plus any org owner/guide (who may edit every workshop). No co-guide on the thread itself.
- Drafts: `threads.status` draft is invisible on the page route (404). The workspace must read with `getWorkshopOfferingById` for the author, run staff and org editors.

### 2.11 The action atlas (existing ids to reuse)
`atlas:q -- workshop` (23), `-- lms` (about 55), `-- journal` (4, none relevant).
- Reuse: `workshop-save` (create/update offering), `ig-workshop-material-add` / `-remove`, `ig-rsvp-join` / `ig-rsvp-cancel` (unchanged), `upload-image`, `pkg-lms-course-create`, `pkg-lms-outline-save`, `pkg-lms-step-draft`, `pkg-lms-course-publish`, `pkg-lms-run-create`, `pkg-lms-run-update`, `pkg-lms-run-guide-add`, `pkg-lms-run-sync-rsvps`, `pkg-lms-enrol`, `pkg-lms-step-complete`, `pkg-lms-step-touch`, `pkg-lms-response-save`, `pkg-lms-response-delete`, `pkg-lms-acknowledge`, `pkg-lms-run-adopt-version`.
- Proposed from the earlier design (not yet in the atlas): `workshop-draft-create`, `workshop-field-save`, `workshop-session-save` / `-add` / `-move` / `-remove`, `workshop-room-ensure`, `workshop-publish`, `workshop-unpublish`.
- New for the workspace: `workspace-create` (thread + course + run + guide, one call), `workspace-step-save`, `workspace-publish-steps`, `workspace-step-begin-timer`, `workspace-entry-save` (response with media/meta), `workspace-comment-add` / `-remove`, `workspace-prefs-save`, `workspace-room-ensure` (thread-scoped Talk), `workspace-message-post`.

---

## 3. The data question: where each prototype value lives

Principle (PLAN 9.3): every value has one home; any editor may write it through the one checked door; the screen says "this changes the workshop itself" when it writes a record.

The pick behind the table: **a workspace is a workshop thread plus a private LMS course plus one bound cohort run.** The thread owns who/when/where/price/page; the LMS owns steps, completion, journal and the group. The prototype's "module" is a workshop session (as Justin said: workshop = course, session = module).

| Prototype value | Real home | Notes |
|---|---|---|
| Course.title | `threads.title` | slug does not move once published |
| Course.line | `threads.excerpt` | `description_short` is the second home (R5); save keeps it in step |
| Course.price ("Free" / "CA$ 180") | `threads.price`, `threads.currency` (+ `workshop_pages.price_member`) | save keeps the member-price mirror rule (R6); warn when paid places exist |
| Course.when | `threads.scheduled_at` (first session date wins for display) | "dates later" = null |
| Course.where (In person / Online / Both) | `threads.format` (in_person / online / hybrid), `threads.location` | online or both makes the Talk room |
| Course.bannerLabel (placeholder) | `workshop_pages.banner_image_url`, `banner_focal_y` | picture chooser writes it |
| Course.about | `threads.body` HTML | needs the sanitiser |
| Course.guideId | `threads.author_id` (+ `lms_run_staff` for co-guides) | role is derived, never stored on the person |
| Course.status draft/published | `threads.status` | one "Publish" calls both the thread publish and the course publish |
| Course.journals (private / concurrent) | `lms_runs.default_visibility` (guide = private, circle = concurrent) | "public" is dropped (Justin, round 3) |
| Course.journalComments (guide / everyone) | **new** `lms_runs.journal_comments` | |
| Course.modules | `workshop_sessions` rows + the course outline's modules, linked by `sessionId` | outline module gets an optional `sessionId`; its title is a cache written only by the workspace save |
| Module.title | `workshop_sessions.topic` | |
| Module.date, length | `workshop_sessions.scheduled_at`, `duration_minutes` | |
| Module.description | `workshop_sessions.notes.description` | |
| Module.coverLabel (placeholder) | `workshop_sessions.notes.mediaUrl` | |
| Module.hasVideo | `workshop_sessions.notes.videoUrl` (recording link) | theatre reads it |
| Module.colour | `workshop_sessions.notes.backgroundColor` | |
| Module.fill {row, pane, title, buttons} | `workshop_sessions.notes.fill` (jsonb, no migration) | titleFont is dropped (direct edit later) |
| Module order | `workshop_sessions.session_number` + outline order | one writer keeps both in step |
| Material (name, open / participants) | chapter file: `workshop_sessions.notes.resources[]` {id, title, type, url, isPublic}; workshop-wide file: the Nextcloud materials folder | open = `isPublic: true`; participants-only = false, served by the enrolment-gated media route |
| Step (kind, title, prompt, required) | `lms_steps` (type) + `lms_step_drafts/versions` (title, summary, bodyHtml, settings, refs) + outline step ref (`required`, order, unlock) | |
| Step kinds | reading, practice, reflection, resource: as is. **watch** = a reading step with `refs.media` video. gathering = `session` type. conversation = `thread`. setup = `task`. **photo, recording, quiz** = new registered types (`registerStepType`), no table change | quiz options/answer in `settings`; answer given in the response `meta` |
| Step.due (deadline) | step `settings.due` (ISO) | versioned content: editing it republishes steps |
| Step.timeLimit | step `settings.timeLimit` (minutes) | |
| Timer running for one person | **new** `lms_step_state.timer_started_at` | elapsed = now minus this; one home per person per step |
| done[personId][] | `lms_step_state` (status completed) via `completeStep` | |
| Entry (reflection, practice, photo, recording, note, quiz) | `lms_responses` | needs the migration below: kinds photo/recording/quiz, `meta` jsonb, nullable `step_id` and a `session_id` for notes |
| Entry.text | `lms_responses.body` | |
| Entry.minutes, timestamp ("06:30"), mediaLabel -> media | `lms_responses.meta` {minutes, t, media:[{url,kind}]} | media files go to a participant-scoped upload (new route), not the editors-only one |
| Entry.at | `lms_responses.created_at` | |
| Entry.moduleId | derived: step -> outline module -> sessionId; or `lms_responses.session_id` for loose notes | |
| Entry visibility | `lms_responses.visibility` (me / guide / circle) | a person's default: `lms_enrolments.prefs.shareDefault` |
| Comment (peer or guide) | **new** `lms_response_comments` | a guide's existing "answer" (`lms_acknowledgements`, with audio and email) stays for /learn; the journal shows both, the workspace writes only comments |
| Message (group thread in the sheet) | the workshop's Talk room (`threads.nextcloud_talk_token`) | per Justin round 3; no table. Fallback: forum replies on the thread (`replies.thread_id`, `session_id` null) |
| Person.name / picture / bio | `users.display_name / avatar_url / bio` | edited only through "Your account" / the profile pop-up |
| Person.role | derived (author, run staff, org editor = guide; enrolled = participant) | |
| Person.online | presence channel (slice 8); nothing stored | |
| Person.shareJournal | `lms_enrolments.prefs.shareDefault` | |
| Participant notification settings | `lms_enrolments.prefs.notify` | |
| Talk room / Zoom link | `threads.nextcloud_talk_token` / `threads.meeting_url` | |
| mode (edit / participant / guide), selected, sheet, frame, theater, openStep | not data: derived from the viewer (edit for the guide) and kept in the address (`?module=&sheet=&frame=`); "Preview as participant" forces `enrolled` | |
| Pinned material, interval, Cohort Space (round 3) | later: `lms_runs.rhythm` jsonb {intervalDays, mode}; pinned = a step flag in `settings` | held until Justin confirms the name |

### The migration to propose (not written): `284_workspace_on_lms.sql`
Next free number is 284 (283 is the last); do not apply with the pending 263.
- `lms_responses`: widen `lms_responses_kind_check` to add `photo`, `recording`, `quiz`; add `meta jsonb not null default '{}'`; add `session_id text null references workshop_sessions(id) on delete set null`; make `step_id` nullable (loose notes). Risk: lms code assumes a step; audit `record.ts` joins.
- NEW `lms_response_comments`: `id text pk`, `response_id text not null references lms_responses(id) on delete cascade`, `user_id uuid not null references users(id)`, `org_id varchar(50) not null`, `body text not null`, `created_at timestamptz default now()`, `edited_at timestamptz null`, `deleted_at timestamptz null`; index on `(response_id, created_at)`.
- `lms_runs`: add `journal_comments varchar(10) not null default 'guide'` with check (guide, everyone).
- `lms_enrolments`: add `prefs jsonb not null default '{}'`.
- `lms_step_state`: add `timer_started_at timestamptz null`.
- No change to `threads`, `workshop_pages`, `workshop_sessions` (their `notes` jsonb carries the module look).
Existing rows are unaffected (11 responses; defaults only).

Also needed in code, no migration: `OutlineModule.sessionId?` in `packages/lms/src/types.ts`; a group-wide journal read (`listRunJournal(viewer, runId, {personId?, sessionId?})`, aggregated feed plus filter by participant, per round 3 item 8) that includes kind note and enforces visibility on the server; an `enrolFromWorkshop(threadId, userId)` so a person who joins is enrolled when they first open the workspace.

---

## 4. The route

- **`/workspace`** (innergathering): signed-in only. Lists the workshops and spaces the person can enter: ones they run (author, run staff, org editor; drafts included, marked Draft) and ones they are enrolled in; a "New workshop" button (editors, and anyone the owner allows). Shows, per card: title, line, next date, role chip, "3 steps waiting", unread messages. Empty today: 0 published workshops.
- **`/workspace/<slug>`**: the workspace (`slug` = the thread slug). Not enrolled and not staff: redirect to the public page. Query: `?module=<sessionId>&sheet=home|steps|journal|profile|people&frame=journal|step&step=<id>`.
- **Relationship to the existing page and offerings list: two routes, one data.** `/<feed>/<slug>` (e.g. `/offerings/x`) stays the public shop window: banner, text, price, Join, RSVP and checkout, visitors and non-members. `/workspace/<slug>` is the inside, for people in. The public page gets one added button for the enrolled and the guide: "Open workspace". No redirect in either direction (RSVP, payment returns, shares and search results all land on the public page). The earlier one-page design (`workshop-one-page.md`) put both on one address; this plan supersedes that only for the enrolled view, and its pieces (safe save, draft read, the Fields-lens fields, `createWorkshopDraft`) are the same pieces the workspace edit mode needs. Revisit merging after slice 5. (Decision D2.)
- Static `/workspace` outranks the `[feed]` dynamic route; `workspace` is not an `org_feeds` slug on inner_group (feeds: blog, general, offerings, book-reading-ideas, marketing, guided-tours-work, weekly-workshop-ideas, lms, substackpublications, branding, member-benefits, strategy). Add `workspace` to the reserved list so no feed can ever take it.
- The existing `/hub/compose?kind=workshop` and the Studio Workshops tab later point at the same "New workshop" sheet.

### Where the code lives
- **`packages/workshop-site` (`@elkdonis/workshop-site`)**, modelled on `@elkdonis/series-site` and exactly the package named in the one-page design. Sub-paths: `/config` (a `WorkspaceSite` object: org id, `getViewer`, picture chooser, content-library opener, upload/materials/room routes, surface key), `/workspace` (client components), `/server` (loaders, the `workspace-*` actions, the guards), `/routes` (materials, comments, messages, upload, pdf asset), `/css`.
- **The prototype's components move, not rewrite.** The prototype is already written against one contract, `WorkspaceApi` in `store.tsx`. Keep that contract and write a second provider: `ServerWorkspaceProvider(initialData, actions)` doing optimistic updates and calling server actions, beside the existing `LocalWorkspaceProvider` (localStorage). `apps/development` keeps `/development/workspace` as the design lab using the local provider and the same components imported from the package; innergathering mounts the server provider. Two caveats: store.tsx keeps `done`, `entries` etc. keyed to sample people, so the server provider derives them from real rows; the local look-alike frame in `journal/JournalFrame.tsx` is replaced by the real `SurfaceFrame`.
- **Server logic** goes where its subject lives: workshop writes in `@elkdonis/services` (the safe save and per-session writers from the earlier design); LMS rules in `@elkdonis/lms` (`listRunJournal`, comments, timers, `enrolFromWorkshop`); the orchestration (`workspace-create`: thread + course + run + guide) in `workshop-site/server`, which may depend on both.
- **innergathering** adds dependencies on `@elkdonis/lms` and `@elkdonis/workshop-site`, plus one `lib/workshop-site.ts`, `app/workspace/page.tsx`, `app/workspace/[slug]/page.tsx`, and the thin route files.

---

## 5. Slices, in order

Each slice is shippable alone and tested signed in on a localhost dev copy of innergathering (test editor account, saves aborted or on a throwaway workshop, per the board rule). Sizes: S under a day, M one to three days, L more than three. Nothing is built until the owner says. No slice rebuilds innergathering by itself; see section 6.

| # | Slice | Size | Packages touched | Migration | Owner sees | Main risks |
|---|---|---|---|---|---|---|
| 0 | **Prerequisites from the one-page design**: the safe workshop save (allow-list, limits, sanitiser, audit) + editor-only draft read + per-session writers | M-L | services, actions atlas, arts-collective shim | no | nothing new on screen; arts-collective's raw UPDATE is fixed the same day | R1 unsanitised save; touches the sessions delete-and-reinsert |
| 1 | **Read-only workspace + list page.** `/workspace` lists real workshops; `/workspace/<slug>` shows the prototype shell on real data: module list from `workshop_sessions`, overview, materials, room button, people (roster), profile link. Guards for guide / participant / outsider. New `@elkdonis/workshop-site` package with the server provider (read-only). Publish one test workshop first (all 6 are archived). | M | workshop-site (new), innergathering (3 files, 1 dep), services (a loader) | no | Open /workspace, see the test workshop, click in, see its sessions as modules and materials | Drafts 404; guard must mirror `canAccessWorkshopMaterials`; shell CSS inside innergathering's theme |
| 2 | **Create with four questions + safe in-place saves.** "New workshop" sheet -> `workspace-create` (thread draft, first session, materials folder, private course + cohort run, author as run guide); edit title, line, price, where, module title/date/length/description/colour in place; draft bar, Publish with checklist. | M | workshop-site, services, lms (create path) | no | Click New, answer four questions, land in edit mode on a draft; type a title and it saves; Publish | emails firing on publish (R2): publish must not send the joining mail; price on a workshop with paid places |
| 3 | **Modules and materials: content picker + PDF viewer.** Add/move/remove sessions; cover picture via the picker; chapter files (open / participants-only) via a participant-gated upload and the picker; open a PDF in the shared `PdfReader` inside theatre/sheet; the content library "choose a piece" as a second source (needs `@elkdonis/content` on innergathering). | L | cms-ui (move PdfReader + pdf.js assets in, or into workshop-site), content, workshop-site, innergathering (public/pdfjs or a route) | no | Add a module, pick a cover, drop a PDF, read it in the page | pdf.js assets and base path; content library depends on cms-ui surface files with uncommitted edits; media route stays enrolment-gated |
| 4 | **Steps via the LMS + completion.** innergathering gets `@elkdonis/lms`. Steps in the sheet from the course outline, doing view, mark complete (`completeStep`), required/locked from unlock rules; kinds reading, watch, practice, reflection, resource, gathering, setup, plus registered `photo`, `recording`, `quiz`; auto-enrol from RSVP (`enrolFromWorkshop`); "Put on the page" = publish steps + adopt the latest version. | L | lms (`OutlineModule.sessionId`, step types, `enrolFromWorkshop`), workshop-site | yes (kinds, meta, nullable step) | Add steps, switch to participant preview, tick them off, see "3 of 5" | LMS draft/publish vs live editing feel; versions frozen under running people; the `step_id` nullability audit |
| 5 | **Journal from LMS responses + comments + frame + visibility.** Entries saved as responses with meta and media; group journal (aggregate feed + filter by participant), per-entry Private/Group; participants and guide comment; the real surface frame (custom surface in `HubSurfaces`); export. | L | lms (`listRunJournal`, comments), workshop-site, innergathering `HubSurfaces`, cms-ui surface (read only) | yes (comments table, `journal_comments`, prefs) | Write a reflection in a step, see it in the Journal, share it with the group, comment on another's | **privacy**: server-side visibility on every read; guide sees "guide" and "circle" only, not "me"; deleting a comment/response; export contents |
| 6 | **Talk room / call link + sheet chat.** `workspace-room-ensure` (create Talk if online/hybrid, or paste a Zoom link in settings -> `meeting_url`); one "Video call" button; a thread-scoped chat route (token from the thread, never the caller) and `ChatTranscript` in the sheet. | M | services (thread-scoped Talk read/post), chat (endpoint prop exists), workshop-site | no | A room button and a live-ish message thread in the sheet | Nextcloud guest sessions per member; private vs public room policy (`talkRoomPolicy`); abandoned rooms |
| 7 | **Deadlines, timers, notifications.** Step `due` shown in "Coming up"; timed steps with a server-held start (`timer_started_at`); in-app notifications (`notifications` kinds `workspace_post`, `workspace_comment`, `workspace_due`); optional email via new templates, **off by default**. | M | lms, email (templates + `TEMPLATE_KEYS`), services (notification writer), workshop-site | no (uses slice-4/5 columns) | A bell count and a "due in 2 days" line; a timed step that cannot be restarted | emails (see section 6); reminder tick scope; spam control |
| 8 | **Presence.** `@elkdonis/hooks` `usePresence` over the existing realtime service, channel per workspace; "N online" on home. | S-M | hooks, workshop-site, innergathering dep (+ supabase-js, an anon key, a public realtime URL) | no | Dots for people currently in the workspace | first real-time use on any site: deploy, keys, and CSP; keep it optional |

Critical path: 0 -> 1 -> 2; 3 and 6 can run in parallel after 1; 4 before 5; 7 and 8 last. Slices 0-2 give a creatable, publishable, editable workspace with no LMS and no migration, which is the safest first look.

---

## 6. Risks and collisions

1. **Uncommitted work, everywhere.** `git status` on eris shows 936 changed paths (last commit 2026-11-17), including innergathering (`app/layout.tsx`, `page.tsx`, `components/landing/*`, `site-header.tsx`, studio, `package.json`, `next.config.ts`, deleted `ui/dialog` and `ui/sheet`...) and shared packages (`cms-ui/src/surface/*`, `cms-ui/src/files/index.ts`, `direct-edit`, `blocks`, `checkout`, `commerce`, `booking`). Each slice must list the files it takes on the board first and avoid `cms-ui/surface`, `HubSurfaces` hunks unless coordinated. New code goes in a new package and new route files by design to keep the overlap small.
2. **An innergathering rebuild ships the whole tree**, including other sessions' unfinished source. Board rule: do not rebuild innergathering until the PM agrees; every editor-adjacent change is seen signed in on a dev copy first (a signed-out pixel check does not cover it). Plan: slices 0-3 are source only until the owner picks a ship moment; the first build carries only what has been seen working.
3. **Journal privacy.** Reflections are personal writing. Rules to enforce in `@elkdonis/lms` queries, not in screens: `me` = author only; `guide` = author + run guides; `circle` = enrolled members and guides; never `public` from the workspace. Default for new entries: `guide` for a Private workshop, `circle` only if the workshop is Concurrent AND the person has not opted out (`prefs.shareDefault`); the owner's pick is D3. Tests: a participant must not be able to read another's `me` entry by any route, including export, notifications text and comment previews.
4. **Emails firing.** Joining mail and reminders need a published thread (a draft sends nothing), so the risk is republish and the new workspace emails. Rules: Save and Publish are separate; publish never re-sends; new workspace emails default off and never send from a dev copy (set the mail sink off there); test-send goes to the author only.
5. **Payments.** The workspace never calls `ig-rsvp-join` or checkout. Price edits warn when paid places exist and apply to new joiners only (R4 of the one-page design). Joining stays on the public page.
6. **A private LMS course for every workshop.** `listCatalogue` lists public courses only, so these must be created private (the existing inner_group course is public and untouched). Courses and runs created on a dev copy must be removed after testing.
7. **The LMS draft/publish model vs live editing.** Steps are versioned; a structural change under a running cohort may orphan progress. Use the LMS's own change kinds and `adoptLatestVersion`; show the guide a plain "N people are partway through" warning.
8. **Migration safety.** One small migration, applied alone, with a backup; widening a check and making `step_id` nullable touch a live table (11 rows). Do not apply together with the pending 263. Not applied by this plan.
9. **Real-time and Talk are new load.** Chat polls every 6 s per open sheet; Talk guest sessions are per member; presence is the first realtime use on any site. Keep both optional and off by default.
10. **File and upload safety.** The upload route is editors-only today; participants need a narrow, size-capped, type-sniffed upload kind scoped to their own folder (`uploadRoutes` supports kinds). PDFs are served inline; SVG is already refused.
11. **Two edit paths.** arts-collective's live overlay and the house editor's Fields lens must not both mount on one page; the workspace edit mode uses the lens plus the services door only.
12. **Prototype drift.** `/development/workspace` keeps changing (rounds 2 and 3). Moving components into the package early (slice 1) stops two copies diverging.

---

## 7. What I could not verify
- No browser run; "exists" means the code is there and wired. Not checked: that the Talk room link, the surface pop-up and the materials folder all work signed in on innergathering today.
- Whether `isEntitled` for a private course lets `syncWorkshopEnrolments`-created people through without a visit to `/learn` (it grants an entitlement, so it should).
- The exact number of `record.ts` readers that assume a non-null `step_id`.
- Who else, besides arts-collective, has the raw by-trait save (the earlier doc lists 5 hosts for `edit-workshop-live`).
- The reason `lms_runs.workshop_thread_id` is shared by two runs on the test thread (looks like test data).

---

## 8. Decisions for the owner

**D1. Where do steps live?**
- (a) In the learning engine: a private course per workshop, one bound cohort run. Reuses completion, reflections, visibility, roster, RSVP sync. Costs: the publish/version model and a small migration. **Pick.** It is the "grounded in what the LMS package set out" you asked for in round 3.
- (b) A workshop-only steps table. Faster to a first demo, but a second learning system beside the first.
- (c) Start with (b) in slices 1-3 and move to (a) at slice 4. Possible but moves data twice; not recommended.

**D2. One address or two for a workshop?**
- (a) Two: `/<feed>/<slug>` stays the public page; `/workspace/<slug>` is the inside; a button links them. **Pick** (safe: RSVP, payment and shares keep landing where they do).
- (b) One address that grows when you join (the earlier one-page design). Cleaner for visitors; needs the public page and the workspace merged. Revisit after slice 5.
- (c) Redirect enrolled people from the public page to the workspace. Easy but breaks payment returns and shared links.

**D3. Default visibility of a journal entry?**
- (a) Private to me and the guide; sharing with the group is a per-entry choice, and "Concurrent" workshops make the group option prominent. **Pick.**
- (b) Shared with the group by default in a Concurrent workshop.
- (c) Only me.

**D4. What is a "space" next to a workshop?** (He said "workshops/spaces".)
- (a) A space is a workshop with one Cohort Space module (round 3); same data, same list, a different card label. **Pick** pending the name.
- (b) A separate kind with its own table. Not recommended before the first workspace is proven.

**D5. Who may create a workspace on innergathering?**
- (a) Org owners and guides only (as compose is today). **Pick.**
- (b) Any member. Needs per-person quotas and moderation first.

**D6. Chat: Talk room or forum replies?**
- (a) The workshop's Talk room (per your round-3 notes; live feel, members as Talk guests). **Pick.**
- (b) Forum replies on the workshop thread (already has notifications and unread), slower feel, no Nextcloud dependency.

**D7. Emails and notifications from the workspace.**
- (a) In-app notifications first; emails (new comment, step due) built in slice 7 but **off by default**, opt-in per person. **Pick.**
- (b) Emails on from day one. Not recommended.

**D8. The PDF viewer: move or copy?**
- (a) Move `PdfReader` and its pdf.js assets into a shared package (cms-ui or workshop-site) and have Books import it; one reader. **Pick**, but only after workspace slice 3 proves it, and Books is touched in its own session.
- (b) Copy it into the workspace package now. Fastest; two copies to drift.

**D9. Test data.** Publish one throwaway workshop on a dev copy (never live) for slices 1-3, and create the first real workspace only after you have clicked through it on the dev copy.

**D10. Presence.** Build in slice 8 or leave out? **Pick:** leave until slices 1-7 are in use; it is the only slice that adds a new running service dependency.
