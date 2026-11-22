# Workspace, grounded: what the LMS already has, what good practice says, what to build first

Written 2026-11-22. Read-only review; nothing was changed. Companion to `WORKSPACE_ROUND3_NOTES.md` (the owner's ideas), `WORKSPACE_CONTRACT.md` and `WORKSPACE_ROUND2.md` (the click-through prototype in `apps/development/src/workspace/**`).

---
## 1. One-page summary (plain language)

**The short version.** Most of what you described is not a new invention. The platform's learning package (the LMS, used today by Sophia and by arts-collective /learn) already has a course made of modules made of steps, a private-or-shared "journal" for what learners write, a guide who reads and answers, a way to open modules a few days at a time, and a link between a course group and a workshop that has its own video room. What the LMS does not have is the shape you drew: a sheet beside the module, a group space as a place, pinned weekly material, timers and deadlines, and notifications. Those are the parts to build, and several can be built on top of what exists rather than beside it.

**What the LMS already does**
- A course has modules; a module has steps. A step can be a reading, a practice, a reflection, a gathering (a live event), a conversation (a forum thread), a resource, or "something to set up on the network".
- What a learner writes is kept as an entry: a reflection, a practice log, or a note to the guide. Each entry says who may read it: only me, my guide, my group. That choice is stored on each entry when it is written.
- A guide sees a queue of what people chose to show them and can answer in words. The learner is emailed.
- Steps can open one after another, on a date, or a number of days after you join. That is the "drip" you described.
- A course group (a "run") can be tied to a workshop. Everyone who said yes to the workshop becomes part of the group. The workshop already has either a Nextcloud Talk room or a pasted Zoom/Meet link.

**What it does not do yet:** pictures, recordings, quiz answers and video notes as entries; pinned material on a module; a day-or-week view of the journal; a place where the group is "in" together; deadlines (it only knows when things open, never when they close); timers; being told when someone posts (the only email today is "your guide answered").

**Good practice, in five lines**
1. Say who can read a journal before anyone writes in it, and never widen it after the fact. Sharing should apply to new entries, or each person opts in.
2. Soft, regular, suggested dates help people keep going; hard penalties and live countdowns are unproven. Open access with a suggested weekly rhythm does about as well as strict drip.
3. A side panel beside the content helps when it shows a quiet count ("5 here this week") and hurts when it pings. Keep live chat in one place, not three.
4. An embedded video room suits small groups; a pasted link is fine and what many platforms fall back on. Offer both, make the pasted link the easy default.
5. Default notifications to a daily digest, with an immediate message only for a reply to you or your guide answering.

**What I would keep, change, hold back**
- Keep: the word Concurrent for shared journals; two visibility states; the sheet open beside theater and documents; one Talk-or-link panel; the workshop as modules.
- Change: make "shared" apply only to entries written after the switch (the prototype currently would reveal old ones); a week is a module, not a new thing; the group space becomes a step type, not a new kind of course; chat is the Talk room (or the step's forum thread), not a new message system.
- Hold back: live presence dots, timers, deadlines as hard stops, per-post notifications.

**What you need to decide** (section 5): the name of the group space; whether shared entries are opt-in per person; one feed or sectioned by week; whether deadlines are "suggested by" dates only; whether the first real build is the plain version in 4.2.

---
## 2. Part 1: what `packages/lms` already sets out

Read: `packages/lms/src/{types,step-types,authoring,content,delivery,record,unlock,tasks,workshops,hub,pool,refs}.ts`; migrations 140, 141, 142, 143, 145, 175, 177, 245, 275, 277; `packages/lms-ui` (pages, parts, studio, connectors, steps); `apps/sophia`; `apps/arts-collective` (`/learn`, `lib/lms`, `api/mcp`); `docs/open/mcp-foundations/DOCK_RAILS_PLAN.md`; atlas rows for `lms` (all of them) and `course` (46 capabilities).

### 2.1 Three layers
Content (what is taught), then delivery (who takes it, when), then record (what each person did and wrote). Content is versioned: publishing freezes a course version, and a group (run) is pinned to a version.

### 2.2 Data model

| Thing | Table | Key fields |
|---|---|---|
| Course | `lms_courses` | org_id, slug, title, summary, description_html, cover_url, language, visibility (public / unlisted / private), draft_outline (JSON), published_version_id, area (277), archived_at |
| Module | not a table: lives in the outline JSON | id, title, summary, ordered list of step refs. No colour, cover, date, materials or settings on a module |
| Step | `lms_steps` + `lms_step_drafts` + `lms_step_versions` | type (open text), slug; content: title, summary, body_html, settings (JSON), refs (JSON) |
| Step in the outline | `OutlineStepRef` | stepId, required (default true), unlock rule |
| Course version | `lms_course_versions` | outline snapshot, change kind (fix / structural), notes |
| Run (a group taking it) | `lms_runs` | mode (open / drip / cohort / circle), status, starts_at, ends_at, capacity, enrol_policy (open / invite), default_visibility (me / guide / circle), workshop_thread_id, discussion_feed, auto_fast_forward |
| Guides | `lms_run_staff` (guide / mentor), `lms_course_staff` (author) | |
| Enrolment | `lms_enrolments` | run, user, status (active / paused / completed / withdrawn), anchor_at, last_step_id, last_seen_at, completed_at |
| Step state | `lms_step_state` | started / completed / waived per (enrolment, step), version done against |
| Learner writing | `lms_responses` | kind (reflection / practice_log / note), body (max 20,000 chars), visibility (me / guide / circle / public), `ai_readable` (column exists, nothing reads it), created / updated |
| Guide reply | `lms_acknowledgements` | text or audio link, seen_at |
| Log | `lms_events` | append-only (database trigger); records that something was written and how widely, never what |
| Awards | `lms_achievements`, `lms_awards` | only criterion today: course completed |
| Forum thread per step | `lms_run_discussions` | one thread per step per run |
| Pool | course pool (145) | notes, links, files collected for a course, tagged, "use in step" |
| Dock | `lms_dock_state` (275) | the step a person is following in the arts-collective dock |

Step `settings` carries: minutes, practice text, alternative way in, reflection prompt, task binding. Step `refs` carries: threadId, questionnaireId, media (audio / video / image / file with transcript), links.

### 2.3 Step types and what a learner leaves behind

| Step type | Completes how | Learner stores |
|---|---|---|
| reading | button: "I've taken this in" | nothing |
| practice | button; invites a reflection box | optional practice log |
| reflection | saving a response completes it ("never graded") | the reflection text |
| session ("Gathering") | button "I was there"; needs a thread | optional reflection |
| thread ("Conversation") | button; needs a thread | their forum posts live in the forum, not the journal |
| resource | "Seen" | nothing |
| task ("Something to set up") | ticks itself when the platform says the thing exists (profile, store, org); may repeat daily | nothing |

Step types are open text: an unknown type still loads as a placeholder. Adding a type is registering a definition (`registerStepType`) plus a renderer in lms-ui. That is the cheapest extension point.

Not stored today: photo, recording, quiz answer, video-timestamp note. `lms_responses.kind` has a CHECK limited to three values, so these need a migration.

### 2.4 Completion, unlock, drip
- Unlock rules (a short typed list, "no expression language, ever"): sequential (default: previous required step done), open, after another module's required steps, a calendar date, N days after the person's anchor (run start for a group, else enrolment date).
- Something already begun is never locked again by a rule change.
- Course completion is derived: every required step of the pinned version done. Staff bypass; a guide may waive a step.
- "Drip" is therefore: modules or steps with a date or offset-days unlock. There is no separate "interval" setting.
- Time: steps have an estimated `minutes`. No due dates, no time limits, no countdowns, no late flags. `lms_runs.ends_at` exists but only closes the group.

### 2.5 Awards, tasks, deadlines
- Awards: one achievement per course, awarded on completion; shown on the journal page.
- Tasks: the host reports whether a platform task is done and the step ticks; completion is pushed from the action layer.
- Practice days: the journal shows an 84-day practice heat-map.
- Deadlines: none (see 2.4).

### 2.6 How a course is authored today
In the Sophia studio or arts-collective `/learn` studio: create a course (org staff), add modules and steps with nine outline operations (add / edit / remove / move module, add / move / send / remove step, set unlock rule), edit each step's working copy, drop material in the pool, publish (creates a version, flagged fix or structural), then open a run. A published course gets an always-open "at your own pace" run automatically. Groups are opened by a guide, optionally tied to a workshop.

### 2.7 What `workshops.ts` links
Almost nothing about learning: it lists network workshops (threads of kind workshop, with pages and sessions) for the Education Hub, with the owner's choices in `lms_workshop_listings`: listed, what is offered after it ends (none / free / paid), a link override. The real link between a workshop and a course is in `delivery.ts` and `authoring.ts`: a run's `workshop_thread_id` binds it to a workshop or meeting (same organisation only), and `syncWorkshopEnrolments` enrols everyone who RSVP'd yes or paid, with an `rsvp` entitlement. A `session` step points at a thread. The video room (`threads.nextcloud_talk_token`) or pasted link (`threads.meeting_url`) lives on the thread, not in the LMS. Workshops have their own sessions (`workshop_sessions`) and an RSVP deadline (`threads.rsvp_deadline`); that is the only deadline near this, and it is for signing up.

### 2.8 What is served to other apps
- arts-collective `/learn` mounts the same `@elkdonis/lms-ui` pages (LearnHost) over one action route `api/lms/[action]`.
- Sophia is the full app: courses, journal, studio, guides, care, workshops, schedule, inner / outer.
- The dock (arts-collective layout) follows one step, runs allow-listed actions, and settles task steps.
- MCP (`packages/mcp`, route `arts-collective.com/api/mcp`): reads the learner's enrolments, the course, the outline, and each step's task status. It does not read responses or journals. The `ai_readable` flag is the reserved place for that decision; no assistant reads a learner's writing today.
- Registry atlas: 46 course capabilities; person-facing ones carry risk badges (reflection save "others", acknowledge "emails", delete response "irreversible").

### 2.9 Usage counts
I could not read the live database: the one command that would (psql inside the Postgres container) was blocked by the sandbox, and I did not work around it. From the repo docs (DOCK_RAILS_PLAN, 2026-11-16): published courses hold 73 steps in total; getting-started has 21 steps (16 bound to platform actions) and akhand-path-daily 4. The dock slice test notes expected zero `lms_responses`. Treat real learner responses as small to zero, and confirm with a SELECT count on `lms_courses`, `lms_steps`, `lms_responses`, `lms_enrolments` before any decision that depends on it.

### 2.10 Each of the owner's ideas against the LMS

| # | Idea | Verdict | What exists / what is missing |
|---|---|---|---|
| 1a | A step answered in the sheet or the module | Partly | One step has one response record per author; that is already one source. Missing: the sheet itself (the LMS is one page per step), and quiz / photo / recording as response kinds. |
| 1b | Sheet stays open in theater / document view | Not there | Pure layout; the LMS has no sheet. No data needed. |
| 2a | Talk room made by a setting, chat in the sheet | Partly | Workshops already get a Talk room (workshop-one-page plans `ensureWorkshopRoom`) and the workshop page embeds it. Missing: embedding it beside a module. |
| 2b | Same Talk, or a pasted Zoom link | There (in workshops) | The workshop panel already has "Create a room / Use my own link / Remove" (`nextcloud_talk_token` or `meeting_url`). Reuse it. |
| 3 | Journal: Private or shared with the group only, no outside public | Mostly there | Per entry: me / guide / circle; circle is readable only by people in the same run plus guides. Missing: a per-person opt-in, hiding "public" in this surface, and showing the rule at write time. |
| 4a | Pinned material | Partly | A step can carry media, links, resources; the course has a pool. A module has no materials of its own. |
| 4b | Interval of days / weeks | Partly | Opening by date or offset days exists per step; no week view or heading. |
| 4c | One feed or separated by interval | Not there | The journal today is grouped by course. |
| 4d | A specific journal plus the general one | Partly | The journal is general across courses; the group view is per step (`listCircleResponses`); no per-run or per-module list. |
| 4e | Notify when someone posts | Not there | Only "your guide answered" is emailed. |
| 5a | A "space" session type, pinned and concurrent | Not there | No module types. A step type is the available hook; the forum thread per step (`lms_run_discussions`) already gives a space its conversation. |
| 5b | A workshop as one section defined by one such step | Possible | One module with one step. |
| 7 | Stand up at `elkdonis-arts.org/workspace`, real org, content picker, PDF viewer, profile, LMS | Partly | Courses belong to an organisation; staff are checked by `isOrgStaff`; authoring calls are server functions in `@elkdonis/lms`; a new app can call them. The pool covers "add material". |
| - | Timers, deadlines, "coming up" | Not there | Only open-dates. "Coming up" can be derived from unlock dates and workshop sessions. |
| - | Presence ("who is online") | Not there | Nothing in the LMS. |

---
## 3. Part 2: good practice (sources)

The evidence is thin and mostly practitioner or vendor. Where I say "suggests", it is one study or one vendor.

**(a) Journal, portfolio, private or shared; feedback; export**
- Moodle's Journal is private to the learner and teacher; entries stay editable until a close date; teachers give feedback: [LSU Moodle journal guide](https://moodle.grok.lsu.edu/Article.aspx?articleid=20285), [mod_journal README](https://github.com/elearningsoftware/moodle-mod_journal/blob/master/README.md). The Diary plugin keeps data visible only to teachers and admins: [MoodleDocs Diary](https://docs.moodle.org/503/en/Diary).
- Three sharing levels recur: instructor only, the class, the open web. Decide whether reflection is for the instructor or for peers before students write, and tell them: [UAF Learner reflection](https://www.uaf.edu/ctl/pedagogy-resources/design/learner-reflection.php). One course kept reflection teacher-only because the course was personal: [OSU Ecampus](https://blogs.oregonstate.edu/inspire/2015/08/21/building-reflection-into-your-course-design/).
- A shared journal in teacher education struggled because students did not know its purpose: [Rethinking Reflective Journals](https://www.academia.edu/393957/Rethinking_Reflective_Journals_In_Teacher_Education). Journal feedback read as criticism unless it encouraged and engaged: [ASU article](https://cie.asu.edu/ojs/index.php/cieatasu/article/download/1596/641/). Reading and answering is real workload: [NIU guide](https://www.niu.edu/citl/resources/guides/instructional-guide/reflective-journals-and-learning-logs.shtml).
- Moodle's Q and A forum shows others' posts only after you have posted yourself; "separate groups" limits visibility to your group: [Clarkson forum types](https://bookstack.clarkson.edu/books/moodle/page/forum-types-in-moodle). A useful pattern for shared reflections.
- Mahara: a portfolio submitted for assessment is locked until released; sharing is set per page: [Bath guide](https://teachinghub.bath.ac.uk/guide/sharing-portfolios-for-feedback/), [Mahara manual](https://manual.mahara.org/en/26.04/portfolio/share.html).
- Export: I found no source that sets a standard. Not researched deeply; the learner downloading their own journal is the usual minimum.

**(b) Pacing, week pages, deadlines**
- Cohorts finish more often than open self-paced courses on one vendor's data (53.4% vs 41.9%), but dripped self-paced was 42.9%, about one point above open: [Ruzuku study](https://www.ruzuku.com/learn/articles/cohort-vs-self-paced-completion-study). Confounded (price, recruiting). Claims of a 20 to 40% drip lift are unsourced marketing: [Zanfia](https://zanfia.com/blog/drip-content-vs-all-access-courses-which-converts-2026/).
- Soft, regular, flexible deadlines do best: a randomised study found frequent deadlines improved spacing of study; a quasi-experiment found flexible deadlines outperformed frequent and self-imposed ones: [ACM, deadlines in a self-paced course](https://dl.acm.org/doi/abs/10.1145/3626252.3630837), [UCF thesis](https://stars.library.ucf.edu/etd/6640/), [healthcare executives study](https://www.researchgate.net/publication/257408401_Frequent_deadlines_Evaluating_the_effect_of_learner_control_on_healthcare_executives'_performance_in_online_learning). Self-imposed deadlines are weaker than evenly spaced ones set by others.
- A week page with pinned material and the week's tasks is the common cohort pattern: [Ruzuku cohort design](https://www.ruzuku.com/learn/articles/cohort-course-design). I found nothing on stress from timers; treat countdowns as unproven either way.

**(c) Side panel and presence**
- Presence helps people decide whether to reach out; it hurts when animated, noisy or a source of pressure. Put it at the edge; for larger groups show a count: [Ably collaborative UX](https://ably.com/blog/collaborative-ux-best-practices), [Affine on collaborative interfaces](https://affine.pro/blog/designing-interfaces). I found no study of chat panels beside learning content; that part is judgment.

**(d) Live sessions**
- Platforms split: built-in rooms (Ruzuku up to 60 in conference mode, Kajabi about 200), Zoom integration (Thinkific), or both (Coachful). Built-in rooms record straight to the lesson; Zoom recordings are uploaded by hand: [Ruzuku guide](https://support.ruzuku.com/article/980-cohort-based-courses-guide), [Coachful](https://www.coachful.co/blog/best-platform-for-cohort-based-courses), [platform comparison](https://www.mihaelcacic.com/best/best-cohort-based-course-platforms/). Hybrid is the common recommendation. No sourced comparison of chat alongside video found. Vendor claims; verify limits.

**(e) Notifications**
- Consistent in practitioner and open-source sources: instant only for direct, high-value events (a reply to you), daily digest for new posts in a space, weekly for general activity, none for reactions; all-or-nothing choices make people choose nothing: [SuprSend](https://www.suprsend.com/post/email-notification), [community fatigue guide](https://wppioneer.com/beginners-guide/community-notification-fatigue-settings/), [open-source digest PR](https://github.com/PauseAI/action-hub/pull/397). No controlled trials.

**(f) Privacy of reflections**
- Assessing or exposing reflective writing raises privacy questions, and learners hold back with people they do not trust: [Ethical concerns in journal writing](https://www.researchgate.net/publication/227969862_Ethical_concerns_relating_to_journal_writing), [Is reflective practice ethical?](https://www.researchgate.net/publication/233172015_Is_reflective_practice_ethical_The_case_of_the_reflective_portfolio), [UCD reflective assignment](https://www.ucd.ie/teaching/resources/assessmentfeedback/keyassessmenttypes/reflectiveassignment/).
- I found no authoritative rule on duty to report disclosures in journals. Safeguarding is a policy and legal question for the organisation, not something to settle from this research.
- Visibility changes after entries exist: Moodle and Mahara fix visibility by action (submit, share) rather than retroactively. That supports "applies to new entries". This is my inference from how those tools work, not a stated rule in a source.

**(g) Accessibility**
- WCAG 2.2.1 Timing Adjustable (Level A): any time limit must be turnable off, adjustable (at least ten times), or extendable (warning 20 seconds before, at least ten extensions). Real-time events and essential limits are exempt. Per-person extra time is accepted practice: [W3C Understanding 2.2.1](https://www.w3.org/WAI/WCAG21/Understanding/timing-adjustable).
- Step-by-step sheets: no specific source found; the general WCAG rules apply (keyboard order, visible focus, text transcripts for media, which the LMS already carries in `StepMedia.transcript`).

---
## 4. Part 3: each idea, grounded

| # | Idea | Call | One-line reason |
|---|---|---|---|
| 1a | Step answered in sheet or module | Keep, adjust | Both views read and write the one response per (person, step); never two copies. Done flags are derived, as in the LMS. |
| 1b | Sheet open beside theater / document | Keep | Layout only; cheap; matches the "steps beside the content" need. |
| 2a | Talk room with its chat in the sheet | Adjust | Embed the room the workshop already has; do not build a message system. Fall back to the step's forum thread if there is no room. |
| 2b | Same Talk or a pasted link | Keep | Workshops already have "create room / use my own link". Reuse that panel. |
| 3 | Journal: Private or Concurrent, no public | Keep, adjust | Matches LMS me / guide / circle. Drop "Public" from the prototype. Rule for existing entries below. |
| 4a | Pinned material | Adjust | A module gets a short materials list (small additive outline field). Until then use step media / links / pool. |
| 4b | Interval of days or weeks | Adjust | A week is a module with an offset-days unlock. No new "interval" concept. |
| 4c | One feed or sectioned | Adjust | Sectioned by module, with a "show all, newest first" switch. |
| 4d | A specific journal plus the general one | Keep | General journal exists; a space's journal is a filtered view of one run. |
| 4e | Notify on post | Defer | Off by default; daily digest when it arrives. Nothing in version one. |
| 5a | "Cohort Space" session type | Adjust | Build as a step type, not a new kind of module or course. |
| 5b | Workshop as one section | Keep | Falls out free: one module, one space step. |
| 7 | /workspace on elkdonis-arts.org | Keep, later | Call `@elkdonis/lms`; do not copy it. Needs an org (inner_group) and staff roles. |
| - | Presence dots | Defer | Fake in the prototype; real presence needs infrastructure. Start with "who is in the group" and "active this week". |
| - | Timers | Defer | If ever built: adjustable, pausable, per-person extra time (WCAG 2.2.1); never lose an answer at zero. |
| - | Deadlines | Adjust | "Suggested by" dates, soft, not blocking completion. |
| - | Quiz, photo, recording entries | Defer | Need a migration for response kinds; not needed to prove the shape. |

### 4.1 Decisions settled, with options and pick

**Journal visibility (two states).**
- Options: (1) Private = me and the guide, Concurrent = the group plus the guide; (2) three states including "me only"; (3) per-entry choice only.
- Pick: two group states, stored per entry, default from the workshop. Private (guide can read) and Concurrent (group can read). Keep LMS's "only me" as a per-entry choice a learner may use even in a Concurrent workshop; a note to the guide stays guide-only. The setting supplies the default for new entries and the visibility is stored on the entry when written, which is how the LMS already behaves (`saveResponse`, `default_visibility`).
- Switching Private to Concurrent: existing entries stay as they were. The prototype's `canSee(viewer, person, course)` reads the course setting live, so it would reveal old entries; replace it with a per-entry check before it touches real data. Offer each person "Share my earlier entries" as an explicit button and "Pull back what I shared" at any time. Show the rule at the moment of writing ("Everyone in the group can read this").
- Concurrent to Private: new entries are private; what was shared stays unless its author pulls it back; the guide cannot reach into someone's entries.
- Per-person opt-in on top (the prototype's "share my journal entries" toggle): keep; default off when the owner switches a running group to Concurrent, on for a new group so the first week is not silent. Optional variant from Moodle's Q and A forum: you see others' entries on a step after writing your own.
- Safeguarding (for the owner, not code): the guide reads Private entries, so say so at enrolment; decide a policy for a worrying entry before the first group runs.

**Interval journal.**
- Options: (1) one continuous feed; (2) sections by day or week with pinned material; (3) both.
- Pick: (3), sectioned by default. Section = module. The header shows the pinned material and that week's steps; entries sit under it; a "show all" switch gives the continuous feed. No new interval setting: the module's open date or offset days already says when the week begins. Research supports a regular suggested rhythm, not strict locking.

**The "space" session type, and its name.**
- Options: (1) a step type `space` inside a module; (2) a module-level flag; (3) a run mode.
- Pick: (1) a step type. It needs no migration (step type is open text), it is registered like the others, and a workshop as one section is one module with that one step. Pinned material comes from its own media and links; its conversation can be the step's existing forum thread; its journal is the group's `circle` entries across the run (one new read function, not a table). A module-level flag (2) is the second choice if a module with several steps must change layout.
- Name: the owner chose "concurrent" over "cohort" for the journal; LMS screens already say "Together, with a guide" and never show "cohort" to people. Pick: "Concurrent space", with the plain line "Everyone in the group, together" under it, so the vocabulary stays one set. "Shared space" is the plainer alternative. Keep "cohort" and "circle" out of what people see; they stay as internal run-mode names.

**Where steps are answered, without two sources of truth.**
- Pick: one stored response per (person, step). The sheet and the module are two views of the same step component; both call the one save, then read from it. The "done" flag is derived from step state, as in the LMS. Journal entries are those same responses, never copies. In the prototype, `entries` and `done` should be keyed by step id and recomputed, not stored twice.

**The sheet staying open in theater and document view.** Keep. It is layout; the only data rule is the one above.

**Talk room versus pasted link.** Offer both in one panel, as workshops already do: "Create a room", "Use my own link (Zoom, Meet)", "Remove". Pick: the pasted link is the quick default, the Talk room is the one-click extra (embedded rooms suit small groups; Zoom is familiar for large ones; recordings are easier in built-in rooms). The sheet shows the chat of whichever Talk room exists; with only a pasted link it shows a "Join the call" button and the step's forum thread for text.

**Notifications default.** Pick: instant for a reply to you and your guide answering (the one the LMS already sends); daily digest for new entries in a group space, off until the person turns it on; nothing for presence or reactions. A per-space "tell me when someone posts" switch, default off.

### 4.2 Smallest version worth building first

A real course, no new tables, no new step types, in the inner_group org:
1. `/workspace` lists the org's courses and "New workshop" (calls `createCourse`; the four questions become title, summary, a run's start date, and "where").
2. A workshop is a course; a session is a module; steps are the existing types (reading, practice, reflection, gathering, resource). Authoring calls `editOutline` and `upsertStepDraft`; "Publish" calls `publishCourse` and opens a run.
3. The sheet shows the module's steps and saves reflections with `saveResponse`, with the visibility default from the run. The journal lists `listJournal` for the person and `listCircleResponses` for the group (read widened to the whole run).
4. Pinned material for a module is its first resource step. The Talk-or-link panel is the existing workshop one.
5. Nothing is sent except the existing "guide answered" email.

Second increment: the `space` step type and the run-wide group list. Third: a module materials field, suggested-by dates, then notifications and anything with timers or presence.

---
## 5. What the owner needs to decide
1. Name of the group space: "Concurrent space" (my pick, one vocabulary) or "Shared space" (plainer).
2. Sharing on switch: shared applies only to new entries and each person can opt earlier ones in (my pick), or everyone is shared from the switch (not recommended).
3. Journal shape: sectioned by week with a "show all" switch (my pick) or one continuous feed.
4. Deadlines: "suggested by" dates with no penalty (my pick), or none in version one.
5. Group chat: use the workshop's Talk room and the step's forum thread (my pick) or build a new message board (not recommended: a third place for chat).
6. First build: the plain version in 4.2, on the real course tables, before anything with a space, presence, timers or notifications.
7. The guide can read Private entries: confirm that, and set a policy for a worrying entry, before a real group writes anything.
