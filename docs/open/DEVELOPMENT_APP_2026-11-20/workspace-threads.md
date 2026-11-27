# Workspaces: four shared building blocks, hosted by the LMS now (design note, 2026-11-23)

Status: DESIGN ONLY (revision 2, replaces the thread-first draft). No storage code, no migration written. Paths under `~/eac`.
Read: data-model.md (threads, audiences, series, rota), workshops-and-lms.md, `thread-audience.ts`, `thread-kinds.ts`,
`meeting-series.ts`, `packages/utils/src/recurrence.ts`, `docs/sessions/2026-11-16_dock-rails-atlas.md`.

## In five lines
1. The learning system stays the home of workspaces; slices 1, 3a and 5 stay as built. Nothing moves into `threads` now.
2. Four small building blocks, each keyed to a host: a repeating rhythm (interval), material, an entry with an audience, a comment.
3. A host is anything with a circle: the LMS run today, a recurring meeting, a series or a future experiment thread later. One small "circle resolver" says who is in, who guides, the time zone and the rhythm.
4. An experiment is a workspace preset: consent to take part, the ongoing session as the test log, and a final step that publishes the results (with each person's consent) as a post.
5. The dock and the platform assistant get workspace actions that obey the same privacy rules as the person they act for.

## 1. The LMS stays home (pick) · alt: thread-first (rejected: moves tested privacy code and delays the owner's experiments)
- A workspace = course + one group run (as built). Entries stay `lms_responses`; comments stay `lms_response_comments` (284). Step progress stays `lms_step_state`.
- Every new table below carries `(host_type, host_id)` (host_type `lms_run` now), written like `thread_gathers.target_ref`, so a thread can be a host later without renaming anything.

## 2. The four blocks
**Interval** (rhythm on a host): `every_days` (1 daily, N days, 7 weekly), `start_date`, optional `end_date`, `closes`, `read_first`, `show`; a host can have several (one per ongoing module, `scope_key` = module id). Key = the first calendar day of the interval in the WRITER'S zone ("2026-01-22"). It closes at the writer's local midnight (11:59 pm), so the same instant can be open for one person and closed for another and each entry files under its writer's day. Pure code already written: `packages/lms/src/intervals.ts` (no I/O; zone and clock injected; N-day and week arithmetic on dates, not milliseconds).
 - Relation to `expandOccurrences`/`recurrenceIntervalMs` (`utils/recurrence.ts`): those step in fixed UTC milliseconds (DAILY 24 h, WEEKLY 168 h, MONTHLY 30 d). That is unsound for local midnight and drifts an hour across DST (data-model.md, SERIES_KIND_DESIGN section 1). So: do NOT reuse it for keys or closing. Reuse it only to answer "when does this meeting start" for display. A thread host maps its zone-aware occurrence (`seriesOccurrencesFrom`, `occurrence_at`) to a key with `localDateKey(occurrence_at, zone)`; the DST rule stays where it is, untouched.
**Material** (per host and optionally per interval): note + items (name, url, access open/participants), keyed `(host, scope_key, interval_key or none)`. The role `meeting_occurrence_notes` (plan, materials) plays for meetings; same shape on purpose, so a thread host can answer from that table.
**Entry with an audience**: only me / me and the guide / the circle (the three the engine already stores: `me`, `guide`, `circle`) plus **published** (below). Stays `lms_responses` for the LMS host, plus a nullable `interval_key`. A host must provide to an agnostic version: an entry store with author, body, audience, optional interval key and step reference; one read rule "own, or circle for members, or guide-audience for guides, never another person's me; roles outside the circle (org staff, admins) add nothing".
**Comment** on any entry: author, body, optional parent. Readable by whoever can read the entry.

## 3. The circle resolver (one small interface)
`CircleHost { id: {type,id}; members(): seats; guides(): ids; timeZoneOf(user): zone (stored on the seat, else the browser, else America/Toronto); cadence(scope): IntervalSpec|null; mayRead(viewer, entry): boolean }`.
- LMS run (now): members = non-withdrawn `lms_enrolments`; guides = `lms_run_staff`; zone = new `lms_enrolments.tz`; cadence from the interval table; `mayRead` = the SQL already in `listRunJournal`.
- A thread host (later): members = `thread_rsvps 'yes'` (`isEnrolledInWorkshop`); guides = author + `meeting_hosts`; zone = `metadata.timeZone` plus a per-RSVP zone; cadence from `recurrence_pattern` (DAILY 1, WEEKLY 7) and `recurrence_until`; material from `meeting_occurrence_notes`. A future `experiment` thread kind (off-feed until published, in `OFF_FEED_KINDS`) implements the same five methods.
- Do the refactor only when the second host exists; today the functions keep their run-based signatures.

## 4. The 284 comment table (pick: KEEP as is) · alt: reshape now
- Keep `lms_response_comments`: it has a real foreign key to `lms_responses`, so deleting an entry deletes its comments, and it is correct for the LMS host. Note: it is not empty any more: my test runs put 4 test comments in it.
- When a second host exists, one small migration generalises it (drop the FK, add `host_type`, `entry_type`, `entry_id`, `parent_id`); it is cheap because the table is tiny. Reshaping now would build for a host that does not exist yet.

## 5. The experiment preset (a workspace with these switches)
- **Consent to take part**: shown at the seat (plain words, versioned), stored with the seat: `workspace_consents(host, user, kind 'participation'|'publish', wording, wording_version, given_at, withdrawn_at)`. No seat without it in an experiment.
- **Test log**: the ongoing session (interval + material), read-first off, closes on; entries are the observations; the guide planner sets each interval's material.
- **Formal setting**: closed circle, guides named, entries default to "me and the guide", comments for the guide's questions.
- **Publish the results**: a guide step "Compile results". The guide picks SHARED entries only; each is included only if its writer gave `publish` consent (per entry, anonymous or named, withdrawable until publication). Compilation writes a DRAFT thread (kind `post`, or a new off-feed-until-published kind `experiment_report`) through existing `createThread`; items are recorded in `workspace_results` / `workspace_result_items(entry, consent)`. Publishing flips the draft to published (a normal thread, normal feeds). After publication a writer can ask for takedown (item removed, thread re-saved). Bridge: LMS host in, thread out. A private workspace simply never uses this step.

## 6. Dock and platform assistant (MCP rails)
The rails idea (`2026-11-16_dock-rails-atlas.md`): course steps reference registry actions (`packages/actions`, fields address, confirm, risk, roles); the dock runs or routes them and always confirms before a change. Workspace actions to register (each runs with the acting person's own `LmsViewer`, never an elevated one, so an assistant reads only what that person may read):
- Read (no confirm): `workspace.my_state` (steps, done, next), `workspace.read_interval` (entries I may read for a day), `workspace.read_material`.
- Guide: `workspace.summarise_interval` (returns the visible entries for the assistant to summarise; no AI inside the platform), `workspace.plan_interval` and `workspace.add_material` (confirm, low risk), `workspace.draft_results` (confirm, creates a draft only).
- Participant: `workspace.log_entry`, `workspace.set_entry_audience`, `workspace.comment` (confirm). 
- High risk, always a confirm card: `workspace.publish_results` (checks every consent first), `workspace.make_all_private`.
Each is an atlas entry so `check-atlas --strict` keeps coverage; audience and consent checks live in the engine functions, never in the card.

## 7. Migrations (additive), order, and what changes
- 285: `lms_enrolments.tz`, `lms_responses.interval_key` (nullable) + partial unique index (one entry per person per interval), `workspace_cadences`, `workspace_materials` (host-keyed). 286: `workspace_consents`. 287: `workspace_results`, `workspace_result_items`. 288 (later): comment table generalisation. None changes an ordinary course.
- Order: (4a) intervals + cadence + entries by interval + closing on the server + the prototype's ongoing screens; seed in `clay-and-breath`. (4b) per-interval material and the planner (or slice 6). (6) settings and presets. (7) experiment preset: consent, results compile and publish. (8) dock/MCP actions. (9) thread host, only when a thread needs one.
- Existing code: slices 1, 3a, 5 unchanged. Small edits: `listRunJournal` and `getWorkspaceDoing` learn the interval column (others' interval entries only through the ongoing view, which applies the read-first gate); `intervals.ts` joins the package exports; failing soft until the migrations exist, as for 284.
