# Workspaces on Sophia first: the revised stand-up plan

Status: PLAN, 2026-11-22. Read-only investigation on eris (code reads, git status, a few HTTP status checks, SELECT counts taken from the earlier primer). Nothing edited, built, migrated or written to the database. Author: PM worker "Sophia-first plan". Paths are in `~/eac`.

**What this supersedes.** It replaces `workspace-standup.md` (the plan that started on innergathering, `/workspace` on elkdonis-arts.org) wherever the two disagree. That file stays in place; read it for the facts about innergathering, the content picker, the PDF reader, Talk rooms and email, which still hold. What changes here: the first home is Sophia (`/workspaces`), a workspace is a new kind of course, and the org-site `/workspace` becomes a thin door in the last slice. The round-3 words (workshop = course, session = module, step = activity; Private / Shared; the ongoing session) are used throughout.

Inputs read: `lms-primer.md`, `workspace-grounding.md`, `WORKSPACE_ROUND3.md`, `WORKSPACE_ROUND3_NOTES.md`, `workspace-standup.md`, the prototype (`apps/development/src/workspace/types.ts`, `store.tsx`), all of `apps/sophia/src`, `packages/lms/src` (types, unlock, step-types, content, authoring, delivery, record, util), `packages/lms-ui/src` (index, connectors, studio home), the lms migrations (140-145, 175, 177, 275, 277), `docker-compose.yml` (sophia), `docs/reference/ops.md`, `packages/services/src/media-authz.ts`, the board.

---

## 1. The plain answer

Sophia already does the heavy parts: sign-in, courses with modules and steps, people taking them together in a group, what they write with who-can-read-it, a guide who answers. A workspace is **a course set up a certain way plus one group**. So you do not build a second learning system; you build a new front door and a few new rules on the one that exists.

What you will be able to do on Sophia, slice by slice (each is tried signed in on a test copy of Sophia before anything goes live):

1. **Slice 1, look.** A "Workspaces" page lists the groups you are in and the ones you guide. Click one and see the workspace screen (module list, the page, the side sheet) filled with real course and group data. Read-only. Three groups exist today to look at.
2. **Slice 2, make.** Press "New", answer four questions, land in a workspace of your own. Rename it, give modules a date, colour, cover and files, say who can join (open, or invited), set an end date or none, publish. People can sign in and click in.
3. **Slice 3, do.** Add steps (reading, watching, practice, reflection, resource, a conversation, a set-up task). Participants tick them off and write reflections that only they and the guide read. Deadlines have a date and a time; handing in late is allowed and marked late. You can invite people by email.
4. **Slice 4, the ongoing session.** Turn a session into an ongoing one: one step that repeats every day or week, each with its own material you can set ahead, entries that close when the day or week ends, everyone's entries shown after you enter yours.
5. **Slice 5, shared journal.** A journal for the whole workspace: one feed, a filter by person, Private or Shared (from now on only), and comments from the guide and the others.
6. **Slice 6, settings and calls.** The full settings menu; a pasted call link; who gets emails and a weekly digest (switched off until you say).
7. **Slice 7, the door.** A thin `/workspace` page on each organisation's own site opens the same workspace. This is where a workshop page (price, RSVP, the organisation's own calendar) is joined to it.

**What stays pretend for now:** the timer, photo and recording and quiz entries, "who is online", the chat in the sheet and the "Create a Talk room" button, peer comments until slice 5, emails and the digest until slice 6 (and then off by default), price and paid places (they live on a workshop page, slice 7), and the files marked "participants only" (open files and links work from slice 2; the gated kind waits for one small change to the file gate, section 5).

**One thing to decide before anyone else can use it:** Sophia has no public address today. From eris, `localhost:3020` answers (200) and `https://sophia.arts-collective.com/` answers 404, which is what the ops notes describe as "no proxy host". Building and testing do not need one. Handing a workspace to a participant does. (Decision D9.)

---

## 2. What a workspace is in the learning system

**A workspace = one course (marked as a workspace) + one run + optionally one workshop thread.**

| Piece | Holds | Needed for slice 1? | Needed from |
|---|---|---|---|
| Course (`lms_courses`) | title, one line, description, cover, the modules and steps (the outline), who may author | yes (an existing one) | always |
| One run (`lms_runs`) | the group: guide(s), start and end dates, who may join (`enrol_policy`), the journal default (`default_visibility`), open or draft (`status`) | yes (an existing one) | always |
| Workshop thread (`threads`, kind workshop, bound by `lms_runs.workshop_thread_id`) | price, RSVP list, the organisation's public page, its calendar entry, its Talk room or pasted link | **no** | slice 7 (the org-site door); earlier only if you want a price |

**So the first slice, and slices 2 to 6, can be course plus run only.** Joining ("sign in and click in") is the existing enrolment, which is the RSVP for a free open workspace. The workshop thread is added when an organisation's site needs a page, a price or a calendar entry for it; it is created then, bound to the run, and from that moment it owns price, RSVP and the call link (section 3, last paragraph).

**How to mark it.** What the code offers today:
- `lms_courses.area` is a fixed list of eight (profile, publishing, business, site, production, artwork, email, organisation): wrong meaning, and a course without an area is the normal case.
- There is no tag table. `lms_realms` (inner or outer) is a two-value placement, not a kind.
- `lms_runs.mode` (open, drip, cohort, circle) says how a group walks a course; "cohort" or "circle" is exactly what a workspace's run is, but plenty of ordinary courses have such runs (2 do today), and a course can have several.
- A course has no kind (confirmed in `lms_courses`, migration 140, and the primer).

**Pick: one column, `lms_courses.kind`, values `course` (default) and `workspace`.** It is on the course, not the run, because what you author is the course and because three engine rules key off it (section 2.1). It is additive with a default, so the 29 existing courses are untouched. It is not needed for slice 1 (list the groups you are in or guide: runs of mode cohort or circle) but is needed from slice 2, when creation has to stamp it. Alternatives I rejected: a `workspace` tag in the outline JSON (frozen into every version, easy to lose on an edit), and "any course with one non-default run" (not honest: two existing courses already look like that).

### 2.1 Three rules the marker switches (all small, no migration beyond the column)

1. **No automatic "own pace" run.** Publishing a course creates an always-open default run (`ensureDefaultRun`), and anyone allowed to read the course can begin it. For a workspace that would let people in around the guide's invitation and outside the closing times. A workspace course gets no default run; `getLearnerOutline` for someone with no seat returns "you are not in this workspace" and not the default run's outline.
2. **Step summaries are not required.** Publishing a non-private course refuses any step without a one-line summary ("every public step page stands on its own"). An open workspace is `unlisted`, not private, so this would block every publish. For `kind = workspace` skip the check (the step page is not a public page).
3. **The course page sends people to the workspace.** `/<course>` for a workspace redirects people to `/workspaces/<slug>` (a `workspace` entry in `LmsHrefs`, one line in `CoursePage`), so there are not two front doors.

### 2.2 Visibility and joining, in the existing words

| Owner's word | How it is stored today |
|---|---|
| Free and open (sign in and click in) | course `unlisted` (not in the public catalogue; anyone with the link) + run `enrol_policy = open`. `enrol()` grants a free entitlement and a seat, which is the RSVP. |
| By invitation | course `private` + run `enrol_policy = invite`. Org members and staff see it; others need a grant. **Missing:** a guide cannot add a learner by email today (only a guide by email, and "bring in everyone who RSVP'd"). A small function `addLearnerByEmail(viewer, runId, email)` is needed (slice 3, no migration). |
| Draft / published | run `status` draft or open (enrolment refuses a draft run). The course must be published once to freeze steps. |
| End date optional | `lms_runs.ends_at`, null = no end. |
| Journal Private / Shared | `lms_runs.default_visibility`: `guide` for Private (each person and the guide), `circle` for Shared. This only sets the starting choice of each new entry. See 3.3. |
| Pacing (Open / In order / By date) | not stored at workspace level. The step's own unlock rule is the home (`open`, `sequential`, `date`). The settings control is a bulk setter that writes each step's rule; the screen shows "Mixed" when steps differ. |
| Guide(s) | `lms_run_staff` (role guide). Org owners and guides manage the run but do not read journals through that role alone (existing rule, kept). |

### 2.3 Creating one, in engine calls (no new table)

`workspace-create` runs, in one action: `createCourse` (kind workspace, `unlisted` or `private`) → `editOutline add-module` for each session (one is enough) → `upsertStepDraft` for one starter step per module (a reading called "Welcome" for a standard session; the repeating step for an ongoing one) because **a course cannot be published with no steps, and a run cannot be opened on an unpublished course** → `publishCourse` → `createRun` (mode cohort, the starting visibility, the creator named as guide). All of these exist. Org owners and guides only (`createCourse` refuses anyone else); see D3.

---

## 3. The one new concept: the ongoing session

In learning-system words: **a step that repeats once per interval; each occurrence has its own material and its own closing time; an entry belongs to one occurrence.** Everything else the round-3 design asks for is a setting, a screen or a join of things that exist.

Precedent in the code: `StepTask.repeat: 'daily'` already means "the same task each period, never recorded as completed". The repeating step follows that precedent.

### 3.1 The data shape (extends the engine, not beside it)

**On the step in the outline** (`OutlineStepRef` in `packages/lms/src/types.ts`; it lives in the outline JSON, so no column):

```
repeat?: { every: 'day' | 'week'; start: 'YYYY-MM-DD'; tz: string; closes: boolean; readFirst: boolean; show: 5 | 7 }
```

- A module whose step has `repeat` is an ongoing session. There is no separate module type: the shared-space screen is chosen by the presence of `repeat` (the prototype's `module.kind` is derived, not stored).
- The prototype's `Ongoing` object splits by how often it changes: the rhythm and rules above go in the step (changing `every`, `start` or `tz` counts as structural in `publishCourse`'s `shape()`, so running groups are moved on purpose); the per-interval material is a store (below); `show` is a screen choice kept with the rhythm for simplicity.
- Rules the engine enforces for a repeating step: it is `required: false` (so course completion never waits for a daily practice), it is never recorded as completed (`lms_step_state` stays `started`; progress is "entries made", counted), its unlock is its `start` (the date rule), and an author may have at most one per module (the owner's "ONE step").
- `tz` defaults to the site's `America/Toronto`. An interval is a calendar day (or Monday-based week from `start`) in that zone, so "closes when the interval ends" is a clear instant for everyone. D5.

**Interval key.** `'YYYY-MM-DD'`, the start date of the interval in `tz` (the same as the prototype's `IntervalPlan.key`). For a week it is the start date, `start + 7n`.

**Each interval's own material: a new store, not the outline.** Putting 365 daily plans in the outline would mint a new course version (a copy of the whole outline) on every material edit and would let a guide's "add tomorrow's material" go through the publish gate. So:

> **`lms_interval_plans`** (new table): `run_id` (FK `lms_runs`, cascade), `step_id` (FK `lms_steps`, cascade), `interval_key` varchar(10), `note` text null, `materials` jsonb (a list of `{id, name, url, access}`), `updated_by` uuid, `updated_at`. Primary key `(run_id, step_id, interval_key)`.

It is keyed by run, not course, because the keys are dates and a second run of the same course starts on other dates. Plans for future intervals are written by guides ahead of time; participants read only intervals up to and including the current one.

**Entries belong to an interval.**

> **`lms_responses.interval_key`** varchar(10) null (existing 11 rows stay null). A partial unique index on `(enrolment_id, step_id, interval_key)` where `interval_key is not null and kind <> 'note'` gives one entry per person per interval, editable until it closes (D6). An index on `(run_id, step_id, interval_key)` serves the feed.

### 3.2 The unlock and closing rule

One new pure function beside `unlock.ts` (no I/O, clock passed in), `intervalState(repeat, key, now) → 'future' | 'open' | 'closed'`:
- the interval containing `now` (in `tz`) is `open`;
- a later interval is `future` (nothing for participants, material visible to guides);
- an earlier interval is `closed` when `closes` is true, and `open` ("late") when it is false;
- before `repeat.start` everything is `future`.

`saveResponse` calls it for any step with `repeat` and refuses outside `open`: "That day has closed." (the engine decides, not the screen; today `saveResponse` writes regardless of access and only completion checks it, so this is a new check). `late` for ordinary steps is not stored; see 3.4.

**Read first.** `repeat.readFirst` false (default) means: for the open interval, a person sees others' entries only after making their own ("once entered, the form collapses and the pane shows everyone's"); true means they may read before writing. Closed intervals are readable by everyone in the workspace whether or not they entered (the owner's strip lets past ones be opened to read). Guides always see what authors chose to show them.

### 3.3 Visibility per entry, never widened afterwards

The engine already stores the visibility on every entry (`me`, `guide`, `circle`), chosen when written; the run's `default_visibility` only supplies the preset. So "Applies to entries made from now on" is how it works and needs no data change; the prototype's `canSee` (which read the course setting live and would expose old entries) must not be copied: the new group read checks each entry's own visibility. Specifically `listRunJournal(viewer, runId, { personId?, stepId?, intervalKey?, before?, limit })` in `packages/lms/src/record.ts`, enforced in the query:
- `me`: author only; never anyone else, in any route including export;
- `guide`: author and guides named on the run;
- `circle`: people with a live seat in the run, and its guides;
- never `public` from a workspace; notes (to the guide) are never in the group feed.

Switching Shared back to Private does **not** pull back what people already shared (it narrows only new entries); each person gets a "make my earlier entries private" button. D7.

### 3.4 Deadlines and late hand-in (ordinary steps, no migration)

`settings.due` on the step (an ISO date and time with offset) and `settings.minutes`; both already fit the open settings record. `late` is derived: an entry or completion is late when its `created_at` or `completed_at` is after the `due` of the step version it was made against (`step_version_id` is on both rows). Editing the deadline mints a step version through the usual publish, as a "fix".

### 3.5 Proposed migrations (table and column lists; no SQL written)

Numbers: `packages/db/migrations` ends at 283 (`283_development_org.sql`). **263 (`263_own_app_domains.sql`) is another session's and still pending: none of these is applied together with it.** Confirm the next free number on the day; 284 onward is free now.

| File (proposed) | Slice | Contents |
|---|---|---|
| `284_lms_course_kind` | 2 | `lms_courses.kind` varchar(12) not null default `'course'`, check in (`course`, `workspace`). One column. |
| `285_lms_ongoing_session` | 4 | `lms_responses.interval_key` varchar(10) null + the partial unique index + the feed index; new table `lms_interval_plans` (columns above). |
| `286_lms_workspace_journal` | 5 | new table `lms_response_comments`: `id` text pk, `response_id` text not null FK `lms_responses` cascade, `user_id` uuid not null FK `users`, `org_id` varchar(50) not null, `body` text not null (length-capped), `created_at`, `edited_at` null, `deleted_at` null; index `(response_id, created_at)`. `lms_runs.journal_comments` varchar(10) not null default `'guide'`, check in (`guide`, `everyone`). |
| `287_lms_workspace_settings` | 6 | `lms_runs.call_url` text null; `lms_runs.emails` jsonb not null default `'{}'` (who, when, remind). |

Everything else in the prototype needs no migration: module extras, step deadlines and minutes, the repeat rhythm, materials of standard modules, pacing, end date, join policy, Private/Shared. Photo, recording and quiz entries (a kind-check widening and a `meta` column) are deliberately not in this list.

**The call link has one home at a time.** With no workshop thread, `lms_runs.call_url`. When a thread is bound (slice 7), the thread's `meeting_url` becomes the home, written through the workshop's own save door, and the run's column is cleared by the same function. The settings screen says where it is writing.

---

## 4. Modules need more than a title

Today a module is `{ id, title, summary, steps }` inside the outline JSON (`draft_outline`, frozen into `lms_course_versions.outline` on publish). It has no table. The prototype's module has date, length, description, cover, colour and materials.

| Option | For | Against |
|---|---|---|
| **A. Extend `OutlineModule` in the outline JSON** | The module already lives there; no migration; `edit-module` already takes a title and summary; frozen with the version, so a person partway through sees the module as it was; `publishCourse`'s `shape()` ignores these fields, so editing them is a "fix" that auto-moves runs on `auto_fast_forward` | each edit needs a publish (the save action calls it); the outline grows with materials |
| B. Columns | none: modules are not rows | would need a new modules table |
| C. `workshop_sessions` rows (the earlier plan) | the org site's calendar and page already read them | exist only when a workshop thread exists; the earlier plan made them the home, which cannot be so when Sophia has no thread |

**Pick A.** `OutlineModule` gains optional `date` (ISO, with a time if wanted), `length`, `description`, `coverUrl`, `colour` and `materials: [{ id, name, url, access }]`. `editOutline`'s `edit-module` op grows the same fields. The workspace save is "write the draft, then publish as a fix"; that one function is the only writer, so the draft is never left ahead of what people see (the published-version rule remains for steps).

**One home.** The outline is the home for module date, cover, colour and materials in every case. When a workshop thread exists (slice 7) the org site's `workshop_sessions` rows are written from the outline by one function and are marked in the code as a cache for the org calendar, never edited on their own. Per-interval material for an ongoing session is a different thing and lives in `lms_interval_plans`.

**Files.** Covers and open materials use Sophia's existing `uploadMedia` connector (`uploadOrgFile` into the organisation's `Media/` folder, read back through `/api/media`). That folder is public media. **Participants-only files need the file gate to know about workspaces** (`canReadMedia` in `packages/services/src/media-authz.ts` knows org-private paths and workshop-thread folders, not runs); a small addition for a `workspace/<org>/<run>` path (live seat in that run) is needed. Until then the add-material control offers open files and links only.

---

## 5. Routes on Sophia

Sophia today: `/`, `/courses`, `/inner`, `/outer`, `/workshops`, `/schedule`, `/guides`, `/traditions`, `/care`, `/login`, `/journal`, `/guide` (redirects into the journal), `/studio` and its sub-pages, the catch-all `/[course]` and `/[course]/[step]`, `/api/lms/[action]`, `/api/media/[...path]`, `/api/auth/handoff/accept`.

| Route | What it is |
|---|---|
| `/workspaces` | The list. Three groups: "You are in" (live seats), "You guide" (run guides and the organisation's staff), and "New" (the four-question sheet, for those who may create). Empty states in plain words. |
| `/workspaces/<slug>` | The workspace: module list on the left, the page in the middle (a standard module's steps, or the ongoing session's strip, step, entry and feed), the sheet on the right, Settings for guides. `slug` is the course slug. State in the address: `?module=<id>&sheet=home|steps|journal|people&interval=<key>`. |
| `/workspaces/<slug>/journal` | The shared journal frame as its own page (feed and by-person). |
| `/workspaces/<slug>/settings` (`?section=`) | The settings menu: Workshop, Sessions, Steps, Shared journal, Emails, Call link, People. |
| `/api/workspaces/[action]` | Actions (`create`, `module`, `step`, `entry`, `plan`, `settings`, `invite`, ...), mounted like `/api/lms/[action]`. |

Why separate pages, not one: each is server-rendered and testable without scripts, and each can be checked on its own.

**Beside what exists.**
- `/[course]` and `/[course]/[step]` stay. For a workspace, `/<course>` redirects to the workspace (2.1). A step's own page is kept as "open this step large" and as the deep link from notices; it is the existing `StepPage`, unchanged.
- `/journal` (yours, across courses) stays the place for everything you wrote anywhere; workspace entries appear there like any other. The workspace journal is the group view of one workspace.
- `/studio` stays. Workspaces appear in "Your courses" marked as workspaces, with a link to their workspace; the existing step editor (`/studio/<course>/<step>`: rich text, media, links, the pool) is reused unchanged for "Edit this step's text and media". The workspace settings cover the workspace-level and the quick edits only.
- `/guide` still redirects to the journal's "To answer"; a guide answer on a workspace entry works as today (`acknowledge`).
- `/workshops` is Sophia's list of **organisations' live workshops** (threads). "Workshops" and "Workspaces" in one nav is a word collision (D8).
- `RESERVED_COURSE_SLUGS` gains `workspaces` (the static route would win anyway, but a course could otherwise be created that can never be reached).
- Header nav: "Workspaces" shown when signed in, beside Journal.

**Reuse from `@elkdonis/lms-ui`:** `LmsConnectors` and `Sophia`'s `connectors.ts` (viewer, hrefs, `uploadMedia`, the editor island, `notifyAcknowledged`), `ActionForm`, `Flash`, `fmtWhen`, `VISIBILITY_WORDS`, `StepBody` (renders a step's body, media and task), `StepPage` and the Studio step editor. Not reused: `JournalPage` (per person, across courses) and `CoursePage` (single column, one step at a time): the workspace layout is the prototype's.

**Where the prototype's components go.** Candidates: inside `lms-ui`, or a new package (the earlier plan named `@elkdonis/workshop-site`).

**Pick: a new package `packages/workspace-ui`, `@elkdonis/workspace-ui`**, depending on `@elkdonis/lms` and `@elkdonis/lms-ui` (never the reverse). Reasons:
- `lms-ui` is page-level, server-rendered, form-post and has no client state; the prototype is a client app (sheet, theatre, timers, strip) with four stylesheets. Mixing them would make every Sophia course page ride on the workspace's churn.
- The engine additions (`kind`, `repeat`, `intervalState`, `listRunJournal`, `addLearnerByEmail`, plan reads and writes) go in `@elkdonis/lms` where the rules belong; the screens go in `workspace-ui`; both are mounted by Sophia now and by org sites in slice 7 with that site's connectors.
- It keeps the prototype's contract: `WorkspaceApi` (the interface in `store.tsx`) stays, a `ServerWorkspaceProvider(initialData, actions)` is written beside the existing `LocalWorkspaceProvider`. `apps/development` keeps `/development/workspace` as the design lab and imports the same components from the package; Sophia mounts the server provider.
- The name: I would call it `workspace-ui` rather than `workshop-site`, because slice 7 is a door, not a site. (D8b: your call.)

---

## 6. Slices in order

Each is tested signed in on a dev copy of Sophia first (section 7). Sizes: S under a day, M one to three days, L more than three. Nothing is built until you say.

| # | Slice | Size | Migration | You see | Main risks |
|---|---|---|---|---|---|
| 0 | **Preparation** (section 7): regression baseline on a Sophia dev copy, test accounts, throwaway course | S | no | nothing new | the dev copy shares the real database |
| 1 | **List + read-only workspace.** `/workspaces` and `/workspaces/<slug>` over an existing course and run (runs of mode cohort or circle you are in or guide). New `workspace-ui` package with a read-only server provider; module list from the published outline, steps, the roster for guides. `workspaces` reserved slug; nav link. | M | **no** | Open Workspaces, see the three groups, click one, see its modules and steps in the prototype's layout | the prototype moves into a package while its round-3 files are still uncommitted (24 paths); clicking into a course with a missing run or version |
| 2 | **Make one.** `284` adds `kind`. "New" sheet (four questions) → `workspace-create`; edit title, line, join, end date, module title/date/colour/cover/description and open materials in place; save = draft + publish as fix; draft/open switch. The three rules of 2.1. | M-L | **yes, one column** | Press New, land in your own workspace, change a colour and a date and see it stay; the course page now sends people to the workspace | a half-created workspace if one call fails (needs a clean-up on error); summary rule and default-run rule must be right; org-staff-only creation |
| 3 | **Do it.** Add, order and remove steps of the existing kinds (reading, watch = reading with a video, practice, reflection, resource, conversation, set-up); the sheet's Steps and Doing views; complete, write reflections and practice logs (existing `saveResponse`); deadlines with date and time, late marked; pacing setter; join by invitation (`addLearnerByEmail`); the step's own page as the full view. Photo, recording, quiz hidden. | L | no | Participants tick steps and write; the guide sees who is where; invite a person by email | unlock rules vs live editing (use the engine's own fix/structural labelling and the "N people are partway" warning); invitation by email is new write access to enrolments |
| 4 | **The ongoing session.** `285`. `repeat` on the step, `intervalState`, closing enforced in `saveResponse`, `lms_interval_plans` reads and writes, "read first", the strip, entry, collapse-then-feed and by-person in the module pane, a planner in Settings → Sessions. | L | **yes** | Switch a session to Ongoing, add tomorrow's material, enter today's, see everyone's after you enter, see yesterday close | clock and time zone correctness (test with a controlled "now"); the new refusal in `saveResponse` must not touch ordinary courses; entry privacy |
| 5 | **Shared journal + comments.** `286`. `listRunJournal`, the feed and filter-by-person frame, per-entry Private/Shared with "from now on", the "make mine private" button, comments by guide or everyone, export. | L | **yes** | The whole workspace's journal in one place; comment on someone's entry | **privacy** (every read enforced in the engine; a test that a participant can never read another's `me` or `guide` entry by any route, including export and comment previews); deleting an entry must delete its comments |
| 6 | **Settings and calls.** `287`. The complete settings menu (Workshop, Sessions, Steps, Shared journal, Emails, Call link, People); a pasted call link; email choices stored; the weekly digest built but **off** and sending only to the guide when tested; presence and Talk room stay "later". | M | **yes** | One settings place for everything; the call button works | emails firing from a test copy (set the sink off); people list reading |
| 7 | **The door on each org site.** `/workspace` on elkdonis-arts.org and then the others: lists that site's workspaces, opens the same workspace, "Create a workshop page" binds a thread (price, RSVP, calendar), the call link moves to the thread, and "click in" on the site's RSVP enrols the person at once (a single-person enrolment instead of the guide's button). | L, then M per site | no (uses `workshop_thread_id`, which exists) | A workspace shows on the organisation's own site | innergathering's rebuild carries its whole tree; payments must never be called from the workspace; two runs already share one test thread so the thread id cannot be unique |

Critical path: 0 → 1 → 2 → 3 → 4; 5 can follow 3 (it does not need the ongoing session, but the interval feed in 4 reuses its read, so building 5's `listRunJournal` first is cheaper: swap 4 and 5 if you want the journal sooner); 6 and 7 last. Slices 1 to 3 give a workspace that exists, is edited and is used, with one tiny migration.

---

## 7. What must be true before building

1. **The commit pass.** The earlier plan said 936 uncommitted paths. That is out of date: at 11:29 today Manjushri committed the whole tree (`46284b9b`, "Snapshot of the working tree, 2026-11-17 to 2026-11-22", branch `work/2026-11-16`, not pushed). Today `git status` shows 24 paths: 20 modified files plus the untracked `workspace/ongoing/` folder under `apps/development/src/workspace/**` (the round-3 prototype work, still in flux), 2 modified files in `apps/elktours/src/components/mobile/`, and the board file. **In `apps/sophia`, `packages/lms` and `packages/lms-ui` there are 0 uncommitted paths.** So nothing in Sophia or the engine needs committing first. Two things do need doing:
   - Commit (or freeze) the prototype's round-3 files before copying them into the package, or the copy drifts on day one.
   - The snapshot is "everything on disk", not a tested state, and Sophia also transpiles `services`, `cms-ui`, `db`, `utils`, `actions`, `auth-server` and `email`. So the baseline check below is needed before any rebuild.
2. **Sophia's running state.** It runs as the container `eac-sophia` (compose service `sophia`) built from the development image target but run with `NODE_ENV=production`: `next build` once, then `next start` on port 3020, from the source mounted at `/app`. It builds only when `.next/BUILD_ID` is missing. So **editing source changes nothing on the running site until someone rebuilds**, and a rebuild ships everything in the transpiled packages as they then stand. `ops.md` says "dev, stopped, no proxy host"; today `localhost:3020` returns 200, so the notes are out of date (I could not read `docker ps`: no permission as my user).
3. **A dev copy of Sophia** (the board's rule: localhost only, source only). A second container from the same image running `next dev` with `NODE_ENV` not production, on its own port (for example 4020) and its own scratch `.next`, so it cannot disturb 3020. Sophia's `getViewer` already supports `SOPHIA_DEV_VIEWER_ID` (a `users.id`, ignored in production), which is how a test account signs in without the network handoff. **It uses the same database as the live site** (`elkdonis_dev`, the one the code reads here), so test rows are real rows.
4. **Test accounts.** `house-editor-test@example.com` is a guide on danamccool, elktours, sunjay and inner_group (board, 2026-11-21), and on Sophia the staff rule is "owner or guide of the organisation", so this one can create workspaces and guide them. A **participant** account (no staff role, one seat in the throwaway workspace) is also needed to test what participants can and cannot read. Ask: may I create `workspace-participant-test@example.com`? (D10.) The first password files live in `~/eac-backups/test-accounts/`.
5. **A throwaway workspace.** One course with a fixed slug such as `zz-test-workspace`, org `sunjay` or `inner_group`, `private`, created by the test editor, removed afterwards. Deleting the course cascades to its steps, runs, seats and entries. **`lms_events` is append-only (a trigger forbids delete) and has no foreign key, so a few log lines about the test will stay forever;** harmless, but know it. Also unset the email key on the dev copy (`notifyAcknowledged` sends real mail when a guide answers).
6. **A baseline click-through** of the existing screens on the dev copy from HEAD: course page, a step, journal, studio home and a course desk, publish refused when empty. Slice 1 starts from a known-good state.
7. **Agreement on who owns these files:** `packages/lms/src/{types,unlock,content,delivery,record,authoring}.ts`, `packages/lms-ui/src/{connectors,pages,actions}.ts(x)`, `apps/sophia/src/**`, the new `packages/workspace-ui`. They are clean today; they must be taken on the board before each slice.

---

## 8. Risks

1. **Private writing.** Reflections are personal. Every read goes through the engine and checks each entry's own visibility; screens never decide. The existing rule that org owners and guides manage a run without reading journals through the role alone stays.
2. **A new refusal in `saveResponse`** (closed interval) sits in code every course uses. It must apply only to steps with `repeat`; tested against the 11 existing entries' paths.
3. **The marker changes three engine rules** (default run, summary rule, course-page redirect). Each is guarded by `kind = workspace`; a bug there would affect only workspaces, but the default-run change is in a function every course calls.
4. **Publish gate and live editing.** Steps are versioned; an edit is live only after publish. Workspace saves publish as "fix" (auto-moves groups) and show "N people are partway through" for anything structural. A course cannot be published with no steps, so creation adds a starter step.
5. **Sophia is not on the public internet today.** Nothing a participant needs works until a proxy host and certificate exist (D9). Sophia's sign-in is the network's handoff, so participants also need a network account.
6. **A rebuild ships the tree.** A Sophia rebuild includes every transpiled package as it stands. Each slice is source-only until you pick a moment; the first rebuild carries only what you have seen working.
7. **Time.** Interval correctness is the single most testable and most error-prone part (zones, week starts, midnight). Pure function, one controlled clock, a fixed test table.
8. **Words.** "Workspaces" next to the existing "Workshops" page; the primer's note that an org's workshop (thread) and a Sophia workspace will meet in slice 7.
9. **Two edit paths for modules** (the outline now, `workshop_sessions` later): one writer, the other a labelled cache.
10. **Test data in the real database**, and the append-only log (section 7).
11. **Emails and payments.** No workspace slice calls RSVP or checkout. Emails are off by default, and never sent from a dev copy.
12. **Participants-only files** need the file gate change before they exist.
13. **Prototype drift**: the prototype keeps changing (rounds 2 and 3). Moving it into the package in slice 1 stops two copies diverging.

---

## 9. Decisions for the owner

Each with options; my pick is marked.

**D1. How to mark a workspace.**
(a) A `kind` column on the course. **Pick.** (b) A tag in the outline JSON. (c) Treat any course with a cohort run as one.

**D2. Where module date, colour, cover and materials live.**
(a) In the course outline. **Pick.** (b) In the workshop's `workshop_sessions` (only once a thread exists). (c) A new modules table.

**D3. Who may create a workspace on Sophia.**
(a) Organisation owners and guides, as for any course today. **Pick.** (b) Any signed-in member (needs a per-person limit and some moderation first).

**D4. How open joining is stored.**
(a) Course `unlisted` plus run open: not in the public catalogue; anyone with the link signs in and clicks in. **Pick.** (b) `public`, so it also appears in the course catalogue and search. (c) Add a "Open workspaces" browse section to `/workspaces` later.

**D5. Time zone for "closes when the interval ends".**
(a) One zone per workspace, default Toronto. **Pick.** (b) Each person's own zone (an entry can be in time for one person and late for another; harder to explain and test).

**D6. One entry or several per interval.**
(a) One per person, editable until it closes. **Pick.** (b) Several (a log).

**D7. Moving a workspace from Shared back to Private.**
(a) It applies to new entries only; each person can make their earlier ones private. **Pick** (matches "from now on" and never surprises someone who already wrote openly). (b) It hides all existing entries again (cannot be undone for those who already read them).

**D8. Names.**
(a) Nav label "Workspaces" next to the existing "Workshops". **Pick for now.** (b) Rename Sophia's "Workshops" to "Live workshops" or merge the two after slice 7.
(b-package) The package: `workspace-ui` (**pick**) or `workshop-site` as named before.

**D9. When Sophia gets a public address.**
(a) Decide before slice 2 is shown to anyone but you; slices 0 to 1 do not need it. **Pick.** (b) Not until slice 5. Either way, a participant cannot be given a workspace until it happens.

**D10. A second test account.**
(a) Yes, one participant account for testing privacy. **Pick.** (b) Test only as the guide (cannot check what participants are blocked from reading).

**D11. Where the first workspace is made for real.**
Pick: only after you have clicked through the throwaway one on the dev copy, and on an organisation you choose (not `inner_group` by default, because its site is the one carrying the most unfinished work).

---

## 10. What I could not verify

- No browser run: "exists" means the code is there and wired. I did not click Sophia signed in.
- I could not read `docker ps` (permission) and `psql` is not on my path, so the container state comes from HTTP status (`localhost:3020` 200, public host 404) and the compose file, and the counts (29 courses, 178 steps, 29 runs, 10 enrolments, 11 responses) come from the primer's SELECTs, not a fresh one.
- Whether the public 404 is "no proxy host" or something else on Sophia's address was not tested beyond the status code.
- That `ensureDefaultRun` is called only at first publish (the primer says so); I read its signature, not every caller.
- `canReadMedia`'s behaviour for files under a run: I read the code; no `workspace` path kind exists today.
- The three existing groups' state (which one is in which org, whether any has a published version) was not inspected.
- That `getViewerRoles` gives the test account a guide role on Sophia as it does elsewhere (read from code and the board, not tried).

---

## 11. Owner's decisions, recorded 2026-11-22 (these override sections 2, 3 and 9 where they differ)

- **D1 marker.** A workspace is a **kind** within the learning system, in the way a workshop is already a kind of thread. `lms_courses.kind` stands. Justin mused that courses could one day be threads too; that is an idea, not a decision. Do not build it without asking.
- **D3 who creates.** Organisation owners and guides. Yes.
- **D5 closing time. CHANGED from the pick.** An interval closes at **11:59 pm in each person's own local time**, not one zone per workspace. Consequences for slice 4:
  - the person's zone must be known on the server (store it on the seat or the user; the browser reports it; fall back to Toronto);
  - `intervalState` takes the writer's zone, so the same instant can be open for one person and closed for another;
  - an entry is filed under **its writer's day**, and the feed for "Thursday" shows each person's Thursday;
  - the test table needs at least two zones either side of midnight.
- **D6 entries.** One entry per person per interval. The writer can edit it until it closes. Others can comment on it. (The prototype does this since build `AfW_H9C5DulnnRc4Z-2YL`: a second save replaces the first and marks it "edited".)
- **D9 address.** Sophia is already public at **`sophia.elkdonis-arts.org`** (200, checked 2026-11-22). `sophia.arts-collective.com` is a 404 and is not the address. Section 8 risk 5 and section 10 are out of date on this point. This raises the care needed: a Sophia rebuild is visible to the public at once.
- **D10 second test account.** Yes, one participant account, with light testing.
- **Slices 0 and 1 approved** ("okay"). Slice 1 has no migration.
- **D7 still open.** Shared back to Private: does it leave already-shared entries shared? The pick (new entries only) stands until he answers. It does not affect slices 0 to 3.
- **Direction (2026-11-23).** Build out the logic and spirit of the mock-ups in `apps/development` (now `packages/workspace-ui` and its sample), preferring innovation over straight following of what the LMS already does. The prototype is the spec. Where the LMS shape gets in the way, add beside it (new engine functions, new tables by migration) rather than bending the mock. Existing LMS behaviour for ordinary courses stays unchanged; privacy stays enforced on the server.
