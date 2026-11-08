# Channel routines as LMS courses ("option B"): plan (2026-11-07)

This plan covers option B: Channel's routines and follow-ups are LMS courses whose
steps are Channel registry entries, so the board, the dock and a later assistant
(MCP) perform the same actions through one write path. It answers six questions:
the model, the cadence gap, the dock, the assistant door, notifications, and
phases. Written 2026-11-07 from a code read and `\d` schema reads on
`elkdonis_dev`; nothing is built. Recommendation in one line: one course per
template, in two shapes (a cadence routine whose subject is a computed slot; a
follow-up ladder whose subject is a piece, stored as a subject run under the
person's one enrolment); Channel keeps generating slots from `channel_routines`,
which stays the single cadence store and points at its course.

## 1. Current state (2026-11-07)

### 1.1 Channel (`docs/open/channel.md`)
- `channel_routines` (migration 252): `owner_kind` user|org, `outlet`, `cadence jsonb`,
  `source` CHECK 'channel'|'sophia', `source_ref text`, `created_by`; no actor kind
  (verified: `\d channel_routines`). Rows are only ever written with source 'channel'
  (`packages/services/src/channel.ts:200`).
- Cadence vocabulary: weekdays, `monthDay` 1-28, `nthWeekday` n 1-4, `time` HH:MM
  (`channel.ts:110-116`, `cleanCadence` :172-184). No "last weekday", no every-other-week.
- Slots are computed, never stored (`routineSlots`, `channel.ts:281-297`; default time
  10:00 at :293), in one zone, `CHANNEL_TIME_ZONE` default America/Toronto
  (`apps/arts-collective/src/lib/channel/load.ts:79`). `users` has no time-zone column
  (verified: `\d users`).
- Suggestions are derived per request inside `loadChannelModel`: hard-coded gap rules
  (`load.ts:649-663`: Instagram/Facebook per connected identity, video for artwork,
  writing, newsletter when a newsletter routine exists), placed in the next open slot of
  a routine with the same outlet and owner, else three days before the piece's date, else
  the tray (`load.ts:593-630`). Suggestion id: `<pieceKey>|<outlet>|<identityId>` (`:638`).
- Accept (`acceptSuggestionsAction`, `apps/arts-collective/src/lib/channel/actions.ts:158-187`)
  takes `text`, `at` and `routineId` from the client (`:172-176`), checks `mayTouch`
  (`:103-125`), writes a draft delivery and a plan step. The ownership helpers (`acting`,
  `ownerFor`, `mayTouch`, `:58-125`) are app-local; the actor is always kind 'user' (`:64`).
- Attribution columns exist: `channel_deliveries.actor_kind`, `channel_plan_events.actor_kind`
  + `actor_id` (text), `channel_plans.updated_by_actor`, each 'user'|'agent'.
  `channel_todos` has only `created_by` (verified: `\d`).
- `channel_deliveries` has no unique index on an open (owner, subject, outlet, identity);
  double accepts are pre-checked, not prevented (verified: `\d`; channel.md §4 item 8).
- The loader counts `email_sends` rows of kind 'notification' with a `thread_id` as the
  piece's Letter (`load.ts:317-318`).

### 1.2 LMS routines (`docs/open/DAILY_ROUTINE_BRIEF_2026-11-06.md`)
- A routine is a course whose task steps carry `repeat: 'daily'`
  (`packages/lms/src/types.ts:80-95`); `settleTaskStep` never records them (`tasks.ts:58-60`).
  The course-level `routine: { cadence, zone, subject }` of that brief's §3.1 was not built
  (verified: grep of `seed-akhand-path-daily.mts`); `lms_courses` has no settings column
  (verified: `\d`).
- Unlock rules: sequential, open, after_module, date, `offset_days` from the enrolment
  anchor (`types.ts:27-37`). Nothing for weekly or monthly repeats, time of day, zone,
  per-enrolment values, or a subject.
- Progress is `lms_step_state` keyed (enrolment, step) (verified: `\d`). One enrolment per
  course is assumed by readers: `getActiveEnrolment` returns the most recent
  (`packages/lms/src/delivery.ts:186-191`). `continueStep` counts required steps only
  (`record.ts:37`).
- Enrolments belong to a user (`lms_enrolments.user_id` NOT NULL); an org cannot enrol.
- `lms_events.actor_type` is 'human'|'ai'|'system' (verified: `\d`).

### 1.3 Registry and dock (`docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md` §5a-5g)
- Catalogue: 24 committed entries, none for Channel (verified: grep of `packages/actions/src`,
  2026-11-07 14:07 EST; uncommitted Channel entries appeared by 14:11, §1.5). Scopes person|org|thread; a `thread` subject is a post only
  (`packages/actions/src/server/run.ts:52-58`); `COURSE_ACTIONS` leaves `thread` out
  (`catalogue.ts:78`).
- Door rule: publish, pin and editing a published post only via 'app' (`run.ts:66`).
- `StatusContext.day` exists (`server/status.ts:26`); the dock does not pass it
  (`server/dock.ts:135`).
- The dock takes the first open step that is not recorded done (`dock.ts:128`). For a
  repeating course nothing is ever recorded, so it shows step 1 even when today's step 1
  is done (assumed from the code; not rendered).
- The dock route tries `getting-started`, then other enrolments
  (`apps/arts-collective/src/app/api/actions/dock/route.ts:24`). Actions go through
  `runDockAction` → `runAction` (via 'app'), allowed by `isDockAction`: every entry that is
  not thread-scoped, plus publish and pin (`dock.ts:207-211`). Mounted at
  `apps/arts-collective/src/app/layout.tsx:55`; hub host only (host-only cookie).

### 1.4 Attribution and notifications
- `action_events.actor_type` exists (CHECK human|ai|system, default 'human'), but
  `record()` never sets it (`run.ts:403-410`); there is no column for an agent's id; `via`
  is varchar(20) (verified: `\d action_events`).
- `notifications`: `user_id`, `kind`, `thread_id`, `data jsonb`, `read_at`; no `org_id`
  (verified: `\d`). Written by the forum (`packages/services/src/forum-write.ts:207`) and
  presence (`presence.ts:364`); read as an unread count by `getViewerAlerts`
  (`viewer-alerts.ts`), whose header says no host serves an inbox.
- No person preferences table (verified: `\dt *pref*` empty) and no web push in the repo
  (verified: grep for PushSubscription/VAPID).
- Daily jobs run in `video-worker` (`docker-compose.yml:1161-1199`,
  `packages/services/src/connection-maintenance.ts`).

### 1.5 Work running alongside
- Another session is adding Channel entries to `packages/actions` and a "next" row on
  Channel Home (brief named in its comments: `docs/open/CHANNEL_REGISTRY_AND_BOARD_2026-11-07.md`,
  not yet written at 14:11 EST). Read at 14:11 EST, uncommitted and in progress: a new scope
  `channel` (the person's channel, or an org's on a claim honoured for owners and guides,
  never `oad`; `server/org.ts` `resolveChannelOrg`); entries `channel-next` (read only),
  `channel-suggestion-accept`, `channel-suggestion-dismiss` ("only from the host's own
  pages"), `channel-slot-fill`, `channel-plan-step`; `ActionStatus.next` as a list of
  `ChannelNextMove` (kinds slot, suggestion, gap, follow-up, step, todo, draft, note, live;
  `packages/actions/src/channel.ts`); `CHANNEL_DOCK_ACTIONS` (accept, slot-fill, plan-step;
  not dismiss); `COURSE_ACTIONS` leaves `channel` out until `@elkdonis/lms` `stepTask` knows
  the scope. Runners not yet read. This plan builds on that layer; phase 0 (§2.6) lists what
  it needs from it.
- `docs/open/channel-research/FOLLOW_UPS_RESEARCH_2026-11-07.md` (tools, timing, nudge
  practice) and `FOLLOW_UPS_IDEAS_2026-11-07.md` (120 follow-ups, ladders 4.1-4.6, nudge
  rules §2) are the source for ladder content and limits below.

## 2. Plan

### 2.1 The model

Both shapes are "a course replayed per subject" (LMS brief §3.5):

| Shape | The course is | Subject | Stored per subject | Example |
|---|---|---|---|---|
| Cadence routine | what each slot asks for | a slot, `slot:<routineId>:<YYYY-MM-DD>` | nothing: computed from the routine, as Akhand Path days are | "Instagram twice a week": fill the slot; Facebook after the site |
| Follow-up ladder | a template timeline for a kind or goal | a piece, `thread:<id>` or `artwork:<id>` | a subject run: which ladder, anchor date, active or stopped | ideas doc 4.1 Light path, 4.2 Artwork to live, 4.4 Event |

**Recommendation: one course per template; the slot or the piece is the subject of a run
under the person's single enrolment in that course.** Reasons: course content stays
immutable and shared (one ladder, many pieces); `lms_step_state` and every reader keyed on
one enrolment per course stay unchanged; the same subject-run table serves the runbooks the
LMS brief already plans (series terms, org launch; its phase 4 test is "one runbook runs
twice for two subjects"); the assistant reads progress from one place.

Alternatives considered:
- A course per piece: rejected. Slugs are global (`lms_courses_slug_key`), published
  versions are immutable, each piece would need its own published version, and Sophia's
  catalogue would fill with them.
- An `lms_runs` row per piece with an enrolment per run: no schema change, but
  `getActiveEnrolment` returns one enrolment per course (`delivery.ts:186`), so the outline,
  dock and hub card would need a run id everywhere.
- The ladder held in Channel only (`channel_plans` gains a ladder reference; the course is
  text): cheapest, and the fallback if the owner refuses an LMS schema change. The LMS and
  the assistant would then read ladder progress through Channel's entries only.

Ladder details:
- Step timing lives in the task settings, carried opaque by the LMS like `params`:
  `StepTask.when = { anchor: 'start' | 'published' | 'event', offsetDays, windowDays? }`.
  Due = anchor + offset; a step expires after its window (ideas doc §2, "Expiry").
- Done by evidence: a step's status is the registry check for that piece (shares,
  `publish_jobs`, deliveries); dismissed is the existing `dismissed` delivery for that piece,
  outlet and identity. Nothing per step is stored in phase 3; snooze and "not for this kind"
  (ideas doc §2) can add a step-state table later.
- plan.md holds only accepted work: accepting a due ladder step runs the existing accept
  path, tagged "from <ladder>". This departs from the ideas doc §4, which writes every step
  into plan.md on start; the reason is one source of truth for "done" (evidence), not a
  checkbox that can disagree with it.
- Start is explicit ("Follow up with …" on the face or board, or `channel-ladder-start`),
  as the ideas doc proposes. Starting enrols the person in the ladder's default open run.
  The gap rules (`load.ts:649-663`) keep suggesting on the board without a start, as today;
  in phase 3 they are read from the Light path course, so there is one rule set.
- A run belongs to the person who started it; the piece's owner decides who sees it (an
  org's channel lists runs on its pieces for owners and guides). Starting one on an org's
  piece needs `mayTouch(…, 'deliver')`.
- Ladder and routine meet at the slot: a due step on an outlet with a routine is placed in
  that routine's next open slot (today's `placeIn`). Event-anchored steps keep their date and
  do not float with the slots (research §2, pattern 1).

### 2.2 The cadence gap

To hold Channel's cadences itself the LMS would need: weekday, month-day and nth-weekday
repeats, a time of day, a zone, values per owner (the person's chosen days, not the
template's), org ownership (no org enrolment exists) and an outlet. That is what a
`channel_routines` row already is.

**Decision: Channel keeps generating slots; `channel_routines` stays the one cadence store
for people and orgs; the LMS gets no cadence table.**
- Bridge: taking a routine course writes a `channel_routines` row with `source='sophia'`,
  `source_ref='<course id>'`, outlet and cadence from the course's first step's params
  (closed option lists, as the catalogue requires: outlet, pattern such as `tue,fri` or
  `first-sun`, time). The person edits the days in Channel's routine form. Rows with
  source 'channel' keep working with no course; their only step is "fill the slot".
  No migration: both columns exist.
- LMS: `StepTask.repeat` widens to `'daily' | 'slot'`; a slot step's period is named by the
  host (the slot as the status context's subject). The settle rule is unchanged: a repeating
  step is never recorded.
- One vocabulary: move `RoutineCadence`, `cleanCadence`, `routineSlots`, `zonedInstant` and
  `describeCadence` into `@elkdonis/utils/cadence` (both `lms` and `services` already depend
  on utils, verified in their `package.json`; no cycle) and re-export from
  `services/channel` for the current callers. The Akhand Path's daily repeat and Channel's
  slots then share one type.
- The Queue strip says which course a routine comes from and links to it; "Edit routines"
  stays Channel's form for days and time (owner question 6).

### 2.3 The dock

- `DockData` gains `next`: the first fitting `ChannelNextMove` from `channel-next`'s
  `status.next` (§1.5) for the person and the orgs they own or guide. One line, one primary
  button, one link:
  "Fri 10:00 · Instagram slot · Salt Marsh fits it  [Put it in]  Open".
  After the accept: "Draft in Friday's slot · Open".
- Which item, one only: (1) the page's own piece (`/channel/piece/<kind>/<id>`, an org post
  page, an artwork page): that piece's next due step; (2) an open slot of the person's own
  routines in the next 48 hours with a piece placed in it; (3) the next due step of a ladder
  the person started; (4) the course step, as today. Moves of kind `gap` and `follow-up`
  (unprompted) stay on the board and Home's row, not the dock (ideas doc §2, "How many at
  once"; owner question 2). On `/channel*` the dock stays a closed tab, because Home's
  "next" row shows the same item.
- Accept runs `channel-suggestion-accept` with `{ suggestion: <id> }` through
  `runDockAction` (via 'app'). The runner recomputes the suggestion from its id and calls the
  same service function as the board; the board's `acceptSuggestionsAction` moves to that
  function and to ids, so neither door takes text, time or routine from the caller. "Open"
  goes to the quick sheet or board for that piece (deep link defined by the parallel pass;
  today the URL keeps only `?piece=&tab=`, channel.md §1).
- Routine steps become period-aware: `dockStep` passes `day` (or the slot) to
  `actionStatus` and picks the first repeating step not done for the current period, so the
  Akhand Path card moves to step 2 once step 1 is done today.
- `isDockAction` allows Channel entries by id through `CHANNEL_DOCK_ACTIONS` (§1.5), not by
  scope: today any non-thread entry is dock-runnable (`dock.ts:210`), which would include
  `channel-suggestion-dismiss` once it exists.
- `channel-next` reads only routines, slots in the next 48 hours, deliveries in that window
  and pieces with started ladders, not `loadChannelModel` (160 threads, 120 artworks and a
  35-day horizon per load: channel.md §1, `load.ts:593`), because the dock reads on every
  page. A 60-second per-person cache is an assumed acceptable cost.

### 2.4 The assistant / MCP door

Entries it needs. Rows marked * are in the parallel pass's catalogue (§1.5); the others are
proposed here. The door column is this plan's proposal; where the parallel pass's runners
differ (its `channel-plan-step` also ticks, from a door not yet read), this plan asks for the
stricter rule on agent doors only.

| Entry | Does | Doors |
|---|---|---|
| `channel-next` * | the next moves, most pressing first | all |
| `channel-piece` | a piece's timeline, coverage, ladder steps and plan.md text | all |
| `channel-slots` | open slots in a date range | all |
| `channel-suggestion-accept` * | draft delivery and plan step | all |
| `channel-slot-fill` * | draft delivery in a slot, caption in `payload` | all; `scheduled` only via 'app' |
| `channel-plan-step` * | append a step; tick or untick | append: all; tick and whole-body save: 'app' and the dock |
| `channel-todo-add` | a to-do, dated or not | all |
| `channel-ladder-start` / `-stop` | a subject run | start: all; stop: 'app' |
| `channel-suggestion-dismiss` * | a `dismissed` row (permanent for the pair) | 'app' only |
| `channel-routine` | create from a course, archive | 'app' only |

Draft-only rule: any door other than 'app' writes drafts and additions; anything that will go
out, silences a suggestion, changes the calendar, or overwrites the person's text is 'app'
only. This extends `run.ts:66` and SYNTHESIS rule 10 (drafts-only generation). Nothing in
Channel sends yet (channel.md §1, Publishing).

Attribution:
- `ActorContext` gains `actorType` ('human'|'ai'|'system') and `agentId`; `record()` writes
  `actor_type` (column exists, unused) and a new `agent_id` column. `via` names the door:
  'app', 'http', 'assistant', 'mcp', 'worker'.
- Channel runners pass `ChannelActor { kind: actorType === 'human' ? 'user' : 'agent', id:
  agentId ?? userId, userId }` into the existing columns; `channel_todos` gains
  `actor_kind`. A subject run started by an agent writes `lms_events` with actor_type 'ai'.
- Agent rows show "added by the assistant" on chips and in the Plan tab's event list.

Where it could run (owner decides; LMS brief §7.2):

| Option | Acts as | For | Against |
|---|---|---|---|
| A. Inside the dock, server-side on arts-collective (Claude API tool use) | the person's session; via 'assistant' | no OAuth; same host as Channel and the dock | needs the API workspace (Astro Studio is blocked on `ANTHROPIC_WORKSPACE_ID`, CLAUDE.md; assumed to apply); hub host only until dock slice 2 |
| B. Remote MCP endpoint on arts-collective for outside Claude clients | OAuth 2.1 token, `sub` the person, `act.sub` the client (RFC 8693 tokens, `apps/admin/src/lib/oidc.ts:259`) | the person brings their own assistant; no model cost to the collective | client registration, consent screen, token audience (assumed from the MCP specification) |
| C. A worker (video-worker or its own) | 'system', or 'ai' under a standing consent | works without the person present (digests, overnight caption drafts) | consent and quotas; results unseen until opened |
| D. Sophia's host | tokens as in B (no network session there) | the LMS's home | farthest from Channel's data |

In the single-app direction (`centerRoutes`, `packages/services/src/center-routes.ts:13`;
`ORG_SITE_KIT_BRIEF_2026-11-06.md` "later") A and B become one app's action API. Proposed
order: no AI through phase 4; then B read-only; then A or B with draft writes.

### 2.5 Notifications

- Levels: the dock line (derived on page load, nothing stored); one notice row a day;
  an email digest; push later (none exists).
- Only accepted work notifies: open slots of the person's routines, due steps of started
  ladders, event-anchored steps inside their window. Unprompted gaps never notify (ideas doc
  §2; research §10: digest, not push).
- A daily job in `video-worker`, beside connection maintenance, computes the next 24 hours
  per person in their zone (Toronto until a zone exists).
- Store: one `notifications` row per person per local day, kind `routine_due`,
  `data = { day, count, items (5 at most), orgIds }`; `org_id` is not a column there, and
  notices follow the person across the network as forum notifications already do.
- Email: through `@elkdonis/email`, `email_sends` kind `routine_digest`, no `thread_id`
  (else `load.ts:317-318` counts it as a Letter); skipped when empty or when the person
  opened Channel in the last 24 hours (assumed rule).
- Starting limits (owner decides): dock 1 line; notice 1 a day; email weekly by default,
  daily or off by choice; quiet hours 21:00-08:00 local; an org routine notifies its creator
  only.
- Settings: a new `notice_settings` table (user, time zone, digest frequency, quiet hours),
  which also gives Channel a per-person zone (channel.md §4 item 7).

### 2.6 Phases

Migration numbers are "next": list `packages/db/migrations/` and use `/new-migration` at the
time (252 was the latest on 2026-11-07).

| Phase | Delivers | Migrations | Done when |
|---|---|---|---|
| 0 (parallel pass; review here) | the Channel entries and `channel` scope (§1.5); suggestion derivation, `ownerFor` and `mayTouch` in services rather than the app, so runners recompute a suggestion from its id; the board's accept on the same function | none | board accept and `runAction` accept write identical rows for one suggestion (throwaway owner); `check:registry` passes |
| 1 Dock line | `DockData.next`, selection order, Accept/Open, period-aware repeat steps, allow-list by id, narrow `channel-next`, `actor_type` written | none | dock on `/hub/network` names the slot and the piece; Accept writes the board's rows; Akhand Path card moves to step 2 |
| 2 Routine courses | `@elkdonis/utils/cadence`; `repeat: 'slot'`; one routine course seeded; `channel-routine` runner (app door) writing source 'sophia' rows; Queue strip link | none | one course taken by a person and by an org gives two independent slot sets; source 'channel' rows unchanged |
| 3 Ladders | `lms_subject_runs`; `StepTask.when`; `StepTask.scope` and the studio picker accept `channel`, with the run's piece as subject (then `COURSE_ACTIONS` includes Channel entries); ladders 4.1, 4.2, 4.4 seeded; start/stop; due steps as suggestions with expiry; Plan tab ladder strip; dock shows started steps; gap rules read from the Light path | next: `lms_subject_runs` (id, org_id, enrolment_id, course_id, course_version_id, subject_kind, subject_id, subject_org_id, anchor, anchor_at, status, created_by, timestamps; one active run per enrolment and subject); next: partial unique index on open `channel_deliveries` | one ladder on two pieces with separate progress; a dismissed step stays dismissed; expired steps leave |
| 4 Notices | worker job, notice rows, email digest, settings page | next: `notice_settings`; next: dedupe index for `routine_due` notices | one notice and one digest for a due slot; a second run the same day writes nothing |
| 5 Assistant door | `agentId`, door rules for agents, the chosen option (read-only first, then drafts) | next: `action_events.agent_id`, `channel_todos.actor_kind` | an agent's draft shows "added by the assistant"; a schedule or dismiss from that door is refused |

Each phase ends in one arts-collective rebuild, which ships the whole uncommitted tree
(`docs/reference/ops.md`); Sophia is rebuilt when `lms-ui` changes.

### 2.7 Risks
- Two truths for "done" if ladder steps are copied into plan.md checkboxes: kept out by §2.1.
- Client-supplied suggestion fields (`actions.ts:172-176`) become an agent's input unless
  runners recompute from the id.
- More doors (board, dock, assistant) raise double-accept races until the unique index lands.
- Dock cost on every page if `channel-next` reuses the full loader.
- Org routines can nag several owners and guides; the creator-only default limits it.
- Routine and ladder courses never complete (repeating steps are never recorded): course
  completion, awards and the hub course card must skip them.
- `packages/dock` and `packages/actions/src/server/dock.ts` belong to the action-layer work
  and the parallel pass is editing `packages/actions` now: coordinate before editing
  (DAILY_ROUTINE brief §4).
- Seeds and throwaway tests write to production; `lms_events` and `action_events` keep
  their rows (append-only).

## 3. Rules and constraints
- Give each Channel action one service function that the board and every runner call: copied
  wrappers drift (`journey-actions.ts` copies differed by 89 lines, LMS brief §2).
- Recompute a suggestion from its id in the runner; never take text, time or routine from
  input: every door's input is caller-controlled.
- Keep subject kinds and `when` opaque to `@elkdonis/lms`: core does not import the registry
  (LMS brief §4).
- Keep run-specific data off course step pages: step content is public, indexable HTML
  (`.claude/rules/areas/workshops.md`).
- Notify only for work the person accepted (a routine they keep, a ladder they started).
- Send routine mail with its own `email_sends` kind and no `thread_id`: Channel reads kind
  'notification' with a thread as a Letter.

## 4. Open questions for the owner
1. Ladders: started only by the person (recommended, as the ideas doc proposes), or a default
   ladder per kind on every published piece?
2. Dock: only accepted work (own routines' slots, started ladders), or also unprompted gap
   suggestions, given that "suggestions act like notifications"?
3. Ladder authoring: network-seeded from the research docs first, org owners later? Per-org
   defaults for members?
4. Assistant: which option in §2.4 first, and read-only or draft writes as its first scope?
5. Notification limits: digest default (weekly, daily, off), quiet hours, and whether an org
   routine notifies its creator or every owner and guide.
6. "Edit routines ↗": days and time in Channel's form with steps edited in Sophia's studio
   (recommended), or all in Sophia?
7. `channel_routines` stays Channel-owned (this plan assumes yes).
8. A time zone per person (a column in `notice_settings`), or the fixed Toronto zone for now?
9. May an agent start a ladder or fill a slot as a draft without the person confirming first?
10. If an LMS schema change for subject runs is not wanted now: hold ladders in Channel
    (`channel_plans` reference) as the fallback in §2.1?

## 5. History
- 2026-11-07 14:15 EST: aligned with the parallel pass's uncommitted catalogue (scope
  `channel`, `ActionStatus.next`, `CHANNEL_DOCK_ACTIONS`), read at 14:11.
- 2026-11-07: written. Code read and `\d` of `channel_*`, `lms_*`, `action_events`,
  `notifications`, `users`, `email_sends`; no builds, migrations or data writes.

- 2026-11-07 (owner): open question 2 answered: "Gaps too". The dock shows unprompted gaps as well as accepted steps.
