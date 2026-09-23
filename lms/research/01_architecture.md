# LMS research 01 — Architecture (2026-09-18)

Research only. No code, schema or database was touched. This document follows `COURSE_RESEARCH_2026-09-18.md` (the "integrate vs build" brief) and does **not** repeat its product comparison or its standards table. The decision since then: **build our own LMS as a first-class, expandable project with its own package(s)**. This brief is about how to shape it.

**Legend**
- **[V]** verified today at a cited primary source (spec, official docs, or source code read directly).
- **[S]** from a secondary source / search summary; plausible, not read at the primary.
- **[O]** my opinion or synthesis. Treat as a recommendation to argue with.

---

## 0. The one-paragraph answer

Every mature LMS converges on the same three-layer split: **content** (what was authored, versioned, publishable), **delivery** (a *run* of that content for particular people at a particular time, with its own schedule, staff and rules) and **record** (what each learner did, immutable-ish, outliving both). The expensive mistakes in the codebases studied are all failures to keep those layers apart: progress rows pointing at mutable content (LearnHouse, Frappe, Thinkific), publish being non-atomic (old Open edX), content opaque to SQL (Open edX modulestore), a course being its own run so reuse means copy (Moodle, Canvas). Build the three layers from day one, with a **published-version snapshot** between content and delivery and an **append-only event log** under the record. Almost everything else can be deferred. [O]

---

## 1. How course platforms are architected

### 1.1 Domain model: content vs delivery vs record

| Layer | Holds | Changes when | Who owns it | Examples in the wild |
|---|---|---|---|---|
| **Content** | Course, its outline (modules/units), activities, assets, assessment definitions. Versioned. | An author edits | Author / org | Open edX "learning package" of `PublishableEntity` + versions [V]; Moodle course + `course_modules`; Frappe `LMS Course`/`Course Chapter`/`Course Lesson` [V] |
| **Delivery** | A *run/offering/cohort*: which published version, start/end, pacing, staff, capacity, price, room, enrolments | An organiser schedules | Guide / org admin | Open edX **course run** (seats attach to runs, **entitlements attach to the course** and are redeemed into a run) [V]; Frappe `LMS Batch` + `Batch Course` (a batch bundles several courses, each with an evaluator) [V]; Canvas course *section* |
| **Record** | Enrolment, per-activity attempt/completion, responses, grades (if any), credentials issued | A learner acts | Learner (and the org as custodian) | Moodle `course_modules_completion`, Open edX `BlockCompletion` + persistent grades, LearnHouse `TrailRun`/`TrailStep` [V], xAPI statements in an LRS |

Key observations:

- **Course ≠ run.** Open edX separates them and sells differently against each (a *seat* is for one run; an *entitlement* is for the course and lets the learner pick a run later) [V — course-discovery ADR 0009]. Frappe retrofitted batches on top of self-paced courses and ended up with two parallel enrolment doctypes (`LMS Enrollment` with an `enrollment_from_batch` link, and `LMS Batch Enrollment`) [V — doctype JSON]. Moodle and Canvas have no separation at all: a "course" *is* the run, so re-running means copy/restore (Moodle) or Blueprint sync (Canvas), both well-known sources of pain [S].
- **Self-paced is just a run with no end date and no staff.** Model "always-open" as a default run, not as the absence of one. Then every enrolment has a run and the code has one path. [O]
- **The record must survive the content.** A learner's answer to a reflection in 2026 must still be readable in 2030 after the course was rewritten twice. Open edX's grades team recorded exactly this need ("learners who already completed problems that are now removed may want to see their previous answers") [S — Robust Grades Design].

### 1.2 Content versioning and publishing

What the studied systems do:

| System | Versioning model | What enrolled learners see when content changes | Verdict |
|---|---|---|---|
| **Open edX (legacy modulestore)** | Draft + published branches in Mongo; publish fires a `course_published` signal and Celery tasks rebuild downstream stores | New content after an eventually-consistent window. Their own ADR: "the publishing process is not atomic… a course enters a nebulous state where both the old and new versions are live in different systems", with "no provision for error handling" [V — openedx_content ADR 0002] | Cautionary tale |
| **Open edX Learning Core (`openedx-core`)** | Every `PublishableEntity` has immutable versions plus a *Draft* pointer and a *Published* pointer; a `PublishLog` records each publish. Containers (unit/subsection/section) are themselves versioned; a container version holds an ordered *entity list* whose rows pin a child version **or** float on "latest" (`NULL`). Deletion = pointer set to NULL, history kept [V — ADR 0007] | Whatever Published points to, switched atomically in one DB transaction | **Best model to copy in spirit** |
| **Moodle** | No course versioning. Question bank got per-question versions in 4.0; a quiz slot can pin a version or use "always latest"; attempts keep the version they were taken against [S — MoodleDocs] | Live edits hit everyone immediately. Completion settings lock once someone has completed; unlocking offers to wipe completion data [V — completion API docs] | Versioning only where it hurt most (assessment) |
| **Canvas** | No versioning; Blueprint courses push changes to child courses, locked objects overwrite [S] | Live edits | Known sync bugs with Mastery Paths [S] |
| **Frappe LMS** | None. Lessons are Editor.js JSON edited in place [V/S] | Live edits; `LMS Enrollment.progress` is a stored float that must be recomputed [V] | Simple, fragile |
| **LearnHouse** | `ActivityVersion` = last N saves of an activity's content JSON, for undo/conflict detection, **not** for publishing [V — source] | Live edits; `Activity.published` boolean only | Editor history ≠ publishing |
| **Thinkific (SaaS, for behaviour)** | None | Deleting a lesson removes it for enrolled students; owner must press "Recalculate progress" [V — Thinkific support] | The default failure mode |

The three policies available when content changes under an enrolled learner:

| Policy | Meaning | Good for | Cost |
|---|---|---|---|
| **Float** | Everyone sees the latest published version | Typos, evergreen self-paced courses | Completion maths shifts under people; "100%" can become "92%" |
| **Pin** | A run (or an enrolment) is bound to the published version it started on | Cohorts, anything with a certificate | Old versions must stay renderable forever |
| **Pin + migrate** | Pinned, but an organiser can move a run to a newer version with an explicit step-mapping | Long-running cohorts | Needs stable activity identity across versions |

**Recommended default [O]:** *pin per run, float within a version for non-structural edits.* Concretely: stable `activity_id` that persists across versions; a published **course version** is an immutable snapshot of the outline (ordered list of `activity_id` + pinned `activity_version_id`); a run points at one course version; "fix a typo" publishes a new activity version and can be fast-forwarded into open runs because the outline did not change; **structural** change (add/remove/reorder required activities) is a new course version that existing runs adopt only by explicit action. Progress rows key on `activity_id` (stable), and store the `activity_version_id` they were completed against. This is Learning Core's entity/version/pointer model, minus its generality.

Rules that make this cheap rather than expensive [O]:
1. Publish is **one database transaction** that writes the snapshot and flips one pointer. No signals, no background rebuild. (We are on one Postgres; take the win Open edX could not.)
2. Never delete a published version row. "Delete" is a pointer to NULL (Learning Core) [V].
3. Draft autosave history (LearnHouse-style last-N) is a different feature from publishing; don't conflate them.

### 1.3 Enrolment vs entitlement

| Concept | What it is | Why separate |
|---|---|---|
| **Entitlement** | The *right* to take a course: bought, granted, comes with org membership, comes with a bundle/programme, scholarship | Rights come from many sources (order, role, grant, coupon) and can exist before a run is chosen. Open edX models this explicitly [V] |
| **Enrolment** | A person's seat in a specific **run**, with a state machine (`invited → active → completed / withdrawn / expired`) and the pacing anchor date | The thing progress hangs off |
| **Access check** | A pure function `canAccess(user, activity, now)` reading both | One place, kind-agnostic, testable |

Frappe folds payment, certificate and progress straight onto the enrolment row (`payment`, `certificate`, `progress`, `purchased_certificate`) [V]. It works until a second way of getting in appears. For us the second and third ways already exist (RSVP, paid join request, org role — see prior brief), so keep `entitlements(source_type, source_id)` polymorphic and let enrolment reference the entitlement that justified it. [O]

Enrolment **role belongs on the enrolment/run, not the user**: the same person is a guide in one run and a learner in another. Frappe's `member_type` (Student/Mentor/Staff) on `LMS Enrollment` gets this right [V]; its global `Course Creator`/`Moderator` roles that "bypass per-record authorization checks" [S — DeepWiki] get it wrong for a multi-org platform.

### 1.4 Progress and completion engines

Three generations, all still in use:

| Approach | How | Seen in | Trade-off |
|---|---|---|---|
| **Stored aggregate** | `enrolment.progress = 0.62` updated on each completion | Frappe [V], Thinkific [V] | Trivial reads; wrong the moment content changes; needs a "recalculate" button |
| **Per-activity state + derived roll-up** | One row per (learner, activity) with a state; module/course completion computed (optionally cached) | Moodle completion [V], Canvas module `state` [V], Open edX `BlockCompletion` + the separate *completion aggregator* app that walks the course graph [V], cmi5 "satisfied" roll-up [V] | The mainstream answer |
| **Event log + projection** | Append-only statements; state tables are projections | xAPI/LRS; Open edX emits xAPI via event routing as a side-channel [S] | Auditable, replayable, AI/analytics-ready; more moving parts if it is the *only* store |

Useful details worth stealing:

- **Completion is declared per activity, evaluated by the activity type.** Moodle: an activity declares `FEATURE_COMPLETION_TRACKS_VIEWS`, `FEATURE_GRADE_HAS_GRADE`, `FEATURE_COMPLETION_HAS_RULES`, and implements a custom-rules class; the core only asks "is it complete?" [V]. Canvas: a fixed enum on the module item — `must_view | must_submit | must_contribute | min_score | min_percentage | must_mark_done` [V]. cmi5: `moveOn ∈ {Passed, Completed, CompletedAndPassed, CompletedOrPassed, NotApplicable}` and blocks/courses are *satisfied* when all children are [V].
- **States are more than done/not-done.** Moodle distinguishes complete / complete-pass / complete-fail [S]; Canvas modules have `locked | unlocked | started | completed` [V]. For contemplative work add `acknowledged` (a guide has seen it) as a *separate fact*, not a state. [O]
- **Uniqueness constraints are part of the engine.** LearnHouse's source carries a comment that check-then-insert without `UNIQUE(run, activity, user)` "inflates completion counts and can trigger duplicate certificate issuance / COURSE_COMPLETED webhooks" [V]. Put the constraint in migration one.
- **Optional vs required** is a property of the outline entry, not of the activity (the same reading can be required in one course and optional in another). [O]

**Recommended default [O]:** generation 2 *and* a thin generation 3: a `learner_activity_state` table (the truth the UI reads) **plus** an append-only `learning_events` table written in the same transaction. Do not make the event log the sole source of truth (that is full event sourcing, and it is overkill at this scale), but do make it complete enough that state could be rebuilt from it. It costs one insert and buys audit, xAPI export, AI context and "recalculate" for free.

### 1.5 Unlock / prerequisite rules

What platforms actually ship, from simplest up:

| Rule | Canvas | Moodle | cmi5 | Frappe |
|---|---|---|---|---|
| Sequential within a module | `require_sequential_progress` [V] | via restrict-access on previous activity completion [S] | implied by moveOn | default lesson order |
| Module prerequisites | `prerequisite_module_ids` [V] | restrict access: completion of X | block satisfied | — |
| Date unlock | `unlock_at` [V] | restrict access: date | — | batch timetable |
| Drip from enrolment | — (third-party) | relative-date plugins | — | — |
| Any/all | `requirement_type: all|one` [V] | nested AND/OR/NOT condition tree stored as JSON [S] | — | — |
| Score gate | `min_score` / `min_percentage` [V] | grade condition | `masteryScore` | quiz passing % |
| Group/role | sections / assign-to | group, profile-field conditions | — | — |
| Cross-course | — | course completion condition | — | `LMS Program` enforces course order [S] |
| Adaptive branching | Mastery Paths (fragile under Blueprint sync [S]) | — | — | — |

Lessons:
- Moodle's JSON condition tree is the most powerful and is also the thing authors most often get wrong. Canvas's handful of booleans covers ~all real use. [O]
- **Always return a reason.** Canvas's API returns `locked_for_user` + `lock_explanation` + `lock_info` on every item [V]. Design the access function to return `{allowed, reason, unlocksAt?}` from the start; bolting reasons on later means rewriting every caller.
- Dynamic content selection (randomised pools, A/B) is a *different* feature from unlocking; Learning Core keeps it separate as "selectors/variants" and has left it at **Proposed** for years [V — ADR 0009]. Defer.

**Recommended default [O]:** a small fixed set of typed rules stored as rows/columns (`sequential`, `after_module`, `unlock_at`, `offset_days` from the run anchor, `requires_course`), evaluated by one pure function. Leave a `rule_type`/`params JSONB` escape hatch in the table, but ship no expression language.

### 1.6 Assessment

| Decision | Options | Notes |
|---|---|---|
| Where questions live | Inline in the lesson (Frappe: quiz/assignment are **Editor.js blocks inside lesson content** [S]) vs. separate definitions referenced by the outline | Inline is nice to author, but makes "which quiz did this learner take?" depend on parsing rich text. Reference, don't embed. [O] |
| Definition versioning | Moodle 4.0: question versions; quiz slot pins a version or "always latest"; regrade only across compatible versions [S] | **An attempt must reference the exact definition version it was taken against.** This is the most expensive thing to retrofit. |
| Attempt model | `attempt(id, learner, activity_version, n, started, submitted, state)` + `responses` | Multiple attempts are the norm; "one row per learner per quiz" is a trap. |
| Marking | auto / self-marked / guide-acknowledged / rubric / peer | For this network: *ungraded reflection* and *guide acknowledgement* are first-class, auto-marked quiz is second, rubric/peer is far future. [O] |
| Anti-cheat, proctoring, timed exams | Frappe has `LMS Quiz Violation Log` [V] | Never build. |

The repo already has a versionable-enough substrate (`questionnaires.fields` JSONB + response history — prior brief §1). The architectural question is only whether the LMS **references** it or **owns** its own; either way the attempt must snapshot or pin the field definition it answered. [O]

### 1.7 Gradebook or not

A gradebook is three things that arrive together: weighted categories, a learner × item matrix with overrides, and export to a student-information system. Moodle built the whole gradebook as report/import/export plugins around a `grade_update()` API that every activity calls [V]; Open edX needed a multi-year "robust/persistent grades" project with a `VisibleBlocks` table just to make grades stable against content change [S].

**Recommendation [O]: no gradebook.** Keep an optional `score`/`max_score`/`passed` on the attempt and on activity state so a score gate (`min_score`) and a future transcript are possible. A "who is where" matrix for guides is a **progress report**, not a gradebook — build that instead.

### 1.8 Certificates and credentials

- **Open Badges 3.0** is a profile of W3C Verifiable Credentials 2.0: a signed JSON document (`OpenBadgeCredential`). For conformance an issuer must produce at least one of: a `DataIntegrityProof` with the EdDSA cryptosuite (`eddsa-rdfc-2022`), or a VC-JWT signed RS256 with the key published as a JWK [V — 1EdTech implementation guide; the guide's text spells the suite "eddsa-rdf-2022" in places].
- A **minimal issuer needs no API and no wallet**: an issuer profile (HTTPS URL or `did:web`/`did:key`) exposing the public key, achievement definitions at resolvable URLs, signed credential JSON the learner can download, optionally "baked" into a PNG/SVG [V]. Recipient can be a salted SHA-256 email hash, a DID, or omitted in favour of a human-readable identifier [V]. Revocation: W3C Bitstring Status List, optional [V].
- **Adoption reality (2026):** OB 2.0 is still the most widely accepted; wallets/DID infrastructure are "still maturing" [S — vendor blog, treat as directional]. So: issue OB 3.0 (it is the final standard and self-verifying), but also give people a plain verification URL and a PDF, because that is what they will actually share. [O]

Design now, build later [O]:
- `achievements` (the *definition*: name, criteria narrative, image, issuer org) separate from `awards` (the *assertion*: who, when, evidence pointer, which course version/run, revoked_at). That is exactly the OB Achievement / AchievementCredential split.
- An award is created by a **rule on the record layer** ("run completed", "all courses in a path completed", "guide granted"), never by UI code.
- The issuer is an **org**, so org signing keys are a platform concern; keep keys out of the LMS tables (one keypair per issuing org, private key in secrets, public key served at the issuer URL).
- Awards are immutable except `revoked_at`; re-issue = new award.

### 1.9 Learning-record store, xAPI / cmi5 "in spirit"

What is worth borrowing from xAPI/cmi5 without running an LRS [O, grounded in the specs cited]:

| Idea | Borrow as |
|---|---|
| Statement = actor, verb, object, result, context, timestamp, plus a client-generated UUID for idempotency | Columns of `learning_events`: `id uuid`, `actor_id`, `verb`, `object_type`, `object_id`, `object_version_id`, `result jsonb`, `context jsonb`, `occurred_at`, `recorded_at` |
| cmi5 **registration** = one learner's one passage through one course | That is the **enrolment id**; put it on every event |
| cmi5 verb set is tiny: launched, initialized, completed, passed, failed, abandoned, waived, terminated, **satisfied** | Start with ~8 verbs in a lookup; resist per-feature verbs |
| cmi5 *waived* | A guide marking something as not required for this learner. Contemplative courses need this more than corporate ones |
| Voiding instead of deleting | Corrections are new events that void old ones; never UPDATE the log |
| `occurred_at` vs `recorded_at` | Offline/mobile and imported history both need it |

Event-sourced vs state tables — the honest comparison:

| | State tables only | State + append-only log (recommended) | Pure event sourcing |
|---|---|---|---|
| Read path | trivial | trivial | projections required |
| "Why does it say 80%?" | unanswerable | answerable | answerable |
| Content-change recalculation | bespoke script | replay | replay |
| Privacy erasure (GDPR/PIPEDA-style) | delete rows | delete rows + redact events by actor | hard |
| Effort | 1× | ~1.2× | 3×+ |

Privacy note [O]: reflections are sensitive. Store response **bodies** in the record tables (deletable, access-controlled) and only *references* in the event log, so the log can be retained and exported without carrying intimate text.

---

## 2. Lessons from open-source codebases

| Codebase | Got right | Got wrong / paid for | Take for us |
|---|---|---|---|
| **Open edX — XBlock + modulestore** | Activity-type plugin model (XBlock = model + view + handlers, field *scopes* separate authored settings from per-learner state) [S]; course/run split; entitlements | Containers were XBlocks too, so structure lived inside plugin code; content stored as opaque key/value docs — "joins and rich database-level querying difficult"; "uninstalling an XBlock would prevent the export of any course that used that XBlock"; non-atomic publish [all V — ADR 0002]. Navigation required a depth-first walk instantiating every block per user, hence the Course Blocks/transformers cache layer [S] | Plugins are **leaves only**. Structure is core, relational, queryable without plugin code. |
| **Open edX — Learning Core (`openedx-core`)** | Core model "always introspectable and exportable, without invoking plugin/extension code"; plugins *progressively enhance* via their own tables with a OneToOne to the core row; subclassing concrete models explicitly rejected; LTI-only integration rejected because grading/completion need cheap data introspection; identifier convention `id` / `uuid` / `key`; strict import-linter boundary so core never imports the platform [all V — ADRs 0002, 0003, README] | Generality costs years: flexible Sequence/Navigation still "Proposed… not realized" after 3+ years; selectors still Proposed [V]. APIs still marked unstable [S] | Copy the principles, not the generality. Fix the hierarchy at 2–3 levels. |
| **Moodle — activity modules** | The cleanest plugin *contract* in the field: each `mod_*` declares capabilities via `_supports(FEATURE_*)`, brings its own tables, forms, backup/restore, completion rules, gradebook hook, privacy (GDPR) provider [V/S]. Core asks; plugin answers. 20+ years of third-party activities prove it. AI added in 4.5 as *providers × placements × actions* with a manager that logs and enforces policy; placements don't know providers [V/S] | Course = run (re-run by backup/restore); no content versioning; restore silently degrades when a plugin is missing [S]; every activity type re-implements its own settings/attempt tables, so cross-activity reporting needs the gradebook as lowest common denominator [O]; PHP globals and per-module `lib.php` function-name conventions | The **capability-declaration contract** is the thing to copy. Add "must degrade gracefully if the plugin is absent". |
| **Canvas — modules** | Modules are a thin **ordering + requirement layer over content that exists independently** (pages, assignments, quizzes, external tools): `ModuleItem{type, content_id, position, indent, completion_requirement}` [V]. Small fixed rule vocabulary. Every lock carries an explanation [V]. Excellent API-first discipline | Course = run; Blueprint sync for reuse with documented edge-case bugs [S]; `type` enum is closed — new item kinds are core changes or LTI | Outline entries as **references to activities**, not containers of them. |
| **Frappe LMS** | Closest product shape to ours: course/chapter/lesson, batches bundling courses with per-course evaluators, live classes, certificates, programmes (ordered course paths) [V]. Very fast to build because DocType = schema + form + REST + permissions | 70+ doctypes and growing by feature accretion (`lms_zoom_settings`, `lms_google_meet_settings`, `lms_quiz_violation_log`, job-board-ish `work_experience`…) [V — doctype listing]; two enrolment models; denormalised `member_name`/`member_image` on enrolment rows; stored `progress` float; assessments embedded as editor blocks; progress row carries `scorm_content` long-text [V] | A warning about **feature accretion without a core**. Decide the core nouns and refuse table-per-feature. |
| **LearnHouse** | Same stack family as us (Next.js + Postgres). Org-scoped everything (`org_id` on every table) [V]. `Trail → TrailRun → TrailStep` is a reasonable learner-record shape. Usergroup ↔ resource access mapping. pgvector course embeddings already in schema [V] | Activity types are **closed enums** (`TYPE_VIDEO…TYPE_SCORM` + subtype enum) [V] — every new type is a core migration. No course/run split (`TrailRun` is per user per course). Dates stored as **strings** (`creation_date: str`) [V]. Uniqueness constraints added late, with source comments describing duplicate-certificate bugs [V]. Version history is editor undo, not publishing. SSO/payments behind the enterprise licence (prior brief) | Read its `apps/api/src/db` for a quick tour of *what tables an LMS ends up needing*; don't copy the types-as-enum or string timestamps. |
| **CourseLit** | Everything is a **product** (course, download, membership/community) with pluggable payment providers behind one interface; multi-tenant `Domain` scoping from day one [S] | Commerce-first: learning record is thin (lesson completed flags), Mongo documents, no runs/cohorts [S] | Useful only as the model for "course as something the commerce layer can sell" — which our `@elkdonis/commerce` already covers. |

### 2.1 The extensibility pattern to adopt: activity types as plugins [O, distilled from Moodle + Learning Core + XBlock]

An **activity type** is a registered module that supplies:

| Part | Purpose | Inspiration |
|---|---|---|
| `type` key + `capabilities` | `{ completable: 'view'|'submit'|'manual'|'custom', scorable, hasAttempts, needsGuide, exportable }` | Moodle `_supports()` |
| `settingsSchema` | Authored config, validated (zod), stored as the activity version's `settings jsonb` | XBlock content-scope fields |
| Own tables (optional) | Rich types get their own tables keyed 1:1 to `activity_version_id` / `attempt_id` | Learning Core ADR 0002 |
| `Editor` / `Player` React components | Author and learner surfaces | XBlock `studio_view` / `student_view` |
| `evaluateCompletion(events, settings)` | Pure function; core never knows type internals | Moodle custom completion class |
| `toPlainExport(version)` | Markdown/JSON rendering that works **without the plugin installed** | Learning Core: "introspectable and exportable without invoking plugin code" |
| `aiContext(version)` | Plain-text the AI layer may read (see §5) | new |

Core invariants: the outline, versions, runs, enrolments, state, events and access function **never import a plugin**; `activity.type` is a free `text` validated against the registry at write time (not a DB enum/CHECK); an unknown type renders a placeholder and still exports. In a TypeScript monorepo this is a registry object in the core package and one package (or folder) per type — no dynamic loading needed.

---

## 3. Multi-tenancy: many orgs authoring on one platform

Context [V — CLAUDE.md, prior brief]: one Postgres, `org_id` on content tables, `user_organizations.role` + `organizations.tier` are the only two role/tier vocabularies, users are network-wide identities.

| Question | Options | Recommendation [O] |
|---|---|---|
| Who owns a course? | org / user / polymorphic | **Org-owned, always.** Authorship is a separate many-to-many (`course_authors`). Commerce here already went polymorphic (user-or-org stores) and the memory notes record the nullable-owner join traps; don't repeat for courses. A solo teacher gets a personal org. |
| Catalogue | per-org only / one shared / both | **Per-org catalogue is the truth; a network catalogue is a *view*** filtered by a per-course `listing` flag (`private | org | network`). LearnHouse and CourseLit are per-tenant only [V/S]; commercial multi-tenant LMSs all end up with "global + tenant-specific" [S]. |
| Cross-org reuse of content | copy / share by reference / licence | **Defer.** When needed, do it Learning-Core style: another org's run points at *your published version* (reference, read-only), never a copy. The version-pinning design makes this possible later at no cost now. |
| Learner identity | per-org accounts / network identity | Network identity (already true). Enrolment, state, events carry `org_id` **denormalised from the run** so every query can filter by tenant without joins, as LearnHouse does [V]. |
| Learner data custody | org sees all / learner-private | Reflection bodies private to learner + explicitly assigned guides of *that run*. Org admins see progress, not bodies, by default. Make visibility a column on the activity (`responses_visible_to: learner | guides | cohort`), chosen by the author and shown to the learner before they write. |
| Isolation mechanism | app-layer `org_id` filter / Postgres RLS | Stay with app-layer (network convention) **but** put every LMS query behind the package's service layer that takes a `viewer` and an `orgId`; no raw SQL in apps. RLS can be added later only if queries are already centralised. |

### Roles

| Role | Scope | Can |
|---|---|---|
| **Org admin / owner** | org (existing `user_organizations.role`) | Everything in the org's LMS; appoint authors; see reports; issue/revoke awards |
| **Author** | course | Edit drafts, publish versions. Not implied by being a guide |
| **Guide** (instructor) | **run** | See roster and progress, acknowledge/waive, post to the cohort, read responses where the activity allows |
| **Mentor** | **learner-within-run** (a guide limited to assigned learners) | Same as guide, for their assignees only. Frappe has a course-level mentor mapping [V]; per-run is the safer grain |
| **Learner** | enrolment | Own record only |
| **Steward / network admin** | network | Catalogue moderation, not content editing. Per project convention, global admin stays in the admin app, never in the shared package |

Rules [O]: roles are **rows in scope tables** (`course_authors`, `run_staff(role, assignee_scope)`), never a global flag; a permission check is always `(viewer, action, resource)`; do **not** mint a third role vocabulary on `users` or on orgs — derive "can author" from org role + `course_authors`.

---

## 4. Build-from-scratch guidance

### 4.1 Build first / defer / never

| Build first (the spine) | Defer (design the seam now) | Never build |
|---|---|---|
| Core nouns: course, course_version (snapshot), activity, activity_version, outline entries, run, enrolment, entitlement, activity_state, learning_events | Drip/date rules beyond `sequential` | SCORM runtime / player |
| Atomic publish + version pinning | Attempts with scoring, auto-marked quiz | Video hosting/transcoding (Nextcloud/embeds exist) |
| Access function returning `{allowed, reason}` | Course builder drag-and-drop UI (seed by script/JSON first) | Proctoring, anti-cheat, plagiarism |
| Activity-type registry with **3 types**: `reading` (rich text), `reflection` (questionnaire), `session` (live meeting link) | Programmes/paths (ordered sets of courses) | A gradebook with weighted categories |
| Default always-open run per course | Open Badges 3.0 signing | A general rules/expression engine for unlocks |
| Guide's "who is where" view | Cross-org content sharing; network catalogue | Live-video, chat, forum, calendar, email, payments — **all exist in the network; integrate by reference** |
| Plain JSON/Markdown export of a course version | xAPI export endpoint; LTI 1.3 tool provider | SIS/OneRoster sync; native mobile app; a custom page/site builder for course landing pages (Puck/blocks exist) |
| | AI hooks (§5) | Your own LLM fine-tuning/hosting as part of the LMS |

Order of work [O]: schema + services + seed script → learner player for one real course → guide view → authoring UI → second activity types → runs/cohorts wiring → credentials. Authoring UI is deliberately *after* a real course has been walked by real people; every LMS that starts with the builder ends up with a builder-shaped data model.

### 4.2 Schema decisions that are expensive to reverse

| # | Decision | Cheap now, brutal later because… |
|---|---|---|
| 1 | Course / version / run as three tables | Every enrolment and progress row references them; splitting later means rewriting the whole record layer (Frappe's two enrolment doctypes are the scar) |
| 2 | Progress keyed on **stable activity id** + records the version completed | If keyed on a version-specific or positional id, every edit orphans progress (Thinkific "recalculate") |
| 3 | Attempts/responses pin the **definition version** answered | Otherwise historical answers become uninterpretable after an edit (Moodle had to retrofit question versioning in 4.0) |
| 4 | `UNIQUE` constraints on enrolment (run,user), state (enrolment,activity), award (achievement,user,run) | LearnHouse's duplicate-certificate bug [V]; deduping live data is miserable |
| 5 | Enrolment separate from entitlement, entitlement source polymorphic | Payment columns on the enrolment row block every other way in |
| 6 | Roles scoped to course/run rows, not global flags | Global "instructor" leaks across orgs the day a second org arrives |
| 7 | Activity `type` open (text + registry), type-specific data in `jsonb` or side tables | Closed enums/CHECKs make every new type a core migration (LearnHouse) |
| 8 | Structure is core and relational; plugins are leaves | Open edX spent a decade and a rewrite undoing containers-as-plugins |
| 9 | Append-only event log from the first write | You cannot backfill history you never recorded |
| 10 | `timestamptz` everywhere, `occurred_at` ≠ `recorded_at`; ids follow one convention (internal PK, public stable id, human slug — cf. Learning Core ADR 0003 [V]) | LearnHouse string dates [V]; slugs used as foreign keys break on rename. (Repo note: mind the µs-vs-ms timestamptz trap already recorded in memory.) |
| 11 | `org_id` denormalised onto every record-layer row | Tenant filters via 4-table joins are where leaks happen |
| 12 | Sensitive response bodies separate from the event log | Otherwise erasure requests force rewriting an "immutable" log |

Decisions that are **cheap** to change later (don't agonise) [O]: outline depth UI, unlock rule set, completion percentage maths, catalogue/listing, certificate visuals, which editor, pricing model.

### 4.3 The relationship to `threads` — a tension to resolve deliberately [O]

The prior brief proposed `kind='course'` / `kind='lesson'` **threads** plus four thin tables. That was right for a thin feature. For a first-class LMS with versioned publishing it conflicts with §1.2: a thread is a single mutable row in a shared namespace whose feed/forum/search queries don't filter by kind (memory: *threads is a shared namespace*), and it has no immutable-version concept that progress can pin to.

Recommended position: **LMS-owned content tables** (activities + versions) in the LMS package's own migration range and table prefix; **threads by reference** where the network's social machinery is wanted — a course's public announcement/landing (`kind='course'` thread, optional), a run's cohort space (existing workshop thread), per-activity discussion (a thread *linked from* the activity, created lazily). The LMS then depends on `@elkdonis/services` at a few named seams (auth/viewer, org membership, media authz, questionnaires, workshop/run, commerce entitlement source, email), and nothing in services depends on the LMS — the same one-way rule Learning Core enforces with import-linter [V]. This needs the user's explicit call because it reverses part of the earlier brief.

---

## 5. AI-era considerations (2025–26): design for, don't build

What the field is doing:
- **Moodle 4.5+** shipped an AI *subsystem*: **providers** (OpenAI, Azure, Ollama…) × **placements** (where in the UI) × **actions** (generate text, summarise, explain…), with a manager between them that logs every action and enforces policy; placements and providers don't know about each other [V/S — moodledev.io].
- **LearnHouse** carries pgvector course embeddings in its schema for RAG over course content [V].
- **Khanmigo**-style tutors are Socratic by policy (hint, don't answer), grounded in the course's own content, moderated, with transcripts visible to teachers/parents [S].
- 2025–26 research on course-aware tutors separates **retrieval, learner-state, pedagogical policy, prompt assembly, logging** into explicit components, and finds real-world use diverges from benchmarks (students seek answers, not scaffolding) [S — Frontiers 2026, arXiv 2606.15766].

Seams to leave open now (each is a column, an interface or a rule — no AI code) [O]:

| Seam | Why | Cost now |
|---|---|---|
| Every activity version can emit **plain text** (`aiContext()` / `toPlainExport()`) | Retrieval, summarisation, generation, accessibility, search all need it; rich-text JSON and iframes are useless to a model | One function per activity type |
| **Stable ids + versions on content chunks** | Embeddings must be invalidated by version, and citations must point at what the learner actually saw | Already required by §1.2 |
| The **event log** is the learner-state input | "What has this person done, struggled with, skipped" is a query over events | Already required by §1.4 |
| **Actor type on events and on authored content** (`human | ai | system`) plus `on_behalf_of` | AI-drafted feedback, AI-generated lessons and agent-performed actions must be distinguishable forever; provenance cannot be backfilled | Two columns |
| **Provider-agnostic AI service interface** in the package, Moodle-style (action in, logged result out), org-level on/off and per-course on/off | No vendor lock; a contemplative org may want AI entirely off | An interface + a settings flag |
| **Consent + visibility flags on responses** (`ai_may_read boolean`, default **false** for reflections) | Reflections are intimate; sending them to a third-party model is a disclosure. Must be the learner's informed choice, per activity | One column, one line of UI copy |
| **Feedback as a first-class record** (`feedback(attempt_id, author_actor, body, status: draft|released)`) | Lets AI *draft* and a guide *release*; never auto-release AI feedback on inner-work | One table when assessment lands |
| **Generation lands in drafts only** | AI content generation should write a draft activity version that a human publishes — the draft/publish split already gives the review gate (same stance as the repo's OpenClaw bridge: draft-only) | None |
| **Machine-readable course export / read API** (later an MCP server) | Agents (the org's own or a learner's) will want to read the syllabus and the learner's own record | The export from §4.1 |

Do **not** design for: adaptive-path engines, knowledge tracing, automated grading of reflective writing, AI proctoring. For this community the defensible uses are *find/explain within the course's own texts*, *draft a guide's reply*, *summarise a cohort's progress for the guide*, and *help an author structure a draft*. [O]

---

## 6. Top 10 structural decisions and the recommended default for each

| # | Decision | Recommended default | Basis |
|---|---|---|---|
| 1 | **Layers** | Three explicit layers in one package family: *content* (authored, versioned), *delivery* (runs, staff, enrolments, entitlements), *record* (state, attempts, events, awards). One-way dependencies: record → delivery → content. The LMS depends on network services at named seams; nothing depends back on it. | Open edX course/run/entitlement [V]; Learning Core boundary rule [V] |
| 2 | **Course vs run** | Always both. Every course gets a default always-open run; cohorts are additional runs (linked to the existing workshop thread for room/calendar/RSVP). All enrolments belong to a run. | Open edX [V]; Frappe's dual-enrolment scar [V] |
| 3 | **Versioning & publish** | Immutable activity versions + immutable course-version snapshots; draft and published pointers; publish = one DB transaction. Runs **pin** a course version; non-structural fixes may fast-forward; structural changes require explicit adoption. Never delete published versions. | Learning Core ADR 0007 [V]; failure modes in ADR 0002, Thinkific [V] |
| 4 | **Identity of things progress points at** | Stable `activity_id` across versions; state rows keyed `(enrolment_id, activity_id)` and stamped with the `activity_version_id` completed; attempts pin the definition version. Unique constraints from migration one. | Moodle question versioning [S]; LearnHouse constraints [V] |
| 5 | **Progress engine** | Per-activity state table (UI truth) + append-only `learning_events` written in the same transaction (xAPI/cmi5-shaped: actor, verb, object+version, result, context, registration=enrolment, occurred/recorded). Aggregates derived, optionally cached, never authoritative. Response bodies live outside the log. | Moodle/Canvas/cmi5 roll-up [V]; opinion on hybrid |
| 6 | **Activity extensibility** | Plugins are **leaves only**. Registry of activity types declaring capabilities, settings schema, editor/player, `evaluateCompletion`, plain export, AI text. `type` is open text; core never imports a plugin; unknown types degrade to a placeholder and still export. Start with reading / reflection / session. | Moodle `_supports` [V]; Learning Core ADR 0002 [V]; LearnHouse closed enums as anti-pattern [V] |
| 7 | **Unlock rules & access** | A short list of typed rules (sequential, after-module, date, offset-from-run-anchor, requires-course) evaluated by one pure function returning `{allowed, reason, unlocksAt}`. JSONB escape hatch, no expression language, no adaptive branching. | Canvas module model [V]; Moodle condition-tree complexity [S/O] |
| 8 | **Enrolment vs entitlement; roles** | Entitlement (polymorphic source: free, role, RSVP, order, grant) is separate from enrolment (seat in a run, state machine, anchor date). Roles are scope rows: author→course, guide→run, mentor→learners-in-run; org admin from existing `user_organizations.role`. No new global role vocabulary. | Open edX entitlements [V]; Frappe per-enrolment member_type [V]; repo role convention |
| 9 | **Tenancy & ownership** | Courses are org-owned, always; `org_id` denormalised onto every delivery/record row; all access through the package's service layer with `(viewer, orgId)`. Per-org catalogue is truth; network catalogue is a filtered view; cross-org reuse later by *reference to a published version*, never copy. Response visibility is an authored, learner-visible setting. | LearnHouse org scoping [V]; commercial multi-tenant pattern [S]; opinion |
| 10 | **Assessment, grades, credentials, AI** | Attempts model with optional score/pass; **no gradebook**; guide *acknowledge* and *waive* as first-class facts. `achievements` (definition) vs `awards` (assertion, immutable, revocable) issued by record-layer rules; OB 3.0 signing later with per-org keys held outside LMS tables. AI: leave the seams in §5 (plain-text export, actor-type provenance, consent flag default-off on reflections, draft-only generation, provider-agnostic interface) and build none of it yet. | OB 3.0 impl. guide [V]; Moodle AI subsystem shape [V/S]; opinion |

**One decision needs the user before any schema is written:** §4.3 — whether lesson content lives in LMS-owned versioned tables (recommended here) or stays as `threads` rows (the earlier brief). Everything in decisions 3–5 depends on it.

---

## Sources

Primary (read directly today):
- Open edX Learning Core / `openedx-core`: [repo](https://github.com/openedx/openedx-core) · ADRs [0001 content flexibility](https://github.com/openedx/openedx-core/blob/main/docs/openedx_content/decisions/0001-content-flexibility.rst) · [0002 content extensibility](https://github.com/openedx/openedx-core/blob/main/docs/openedx_content/decisions/0002-content-extensibility.rst) · [0003 identifier conventions](https://github.com/openedx/openedx-core/blob/main/docs/openedx_content/decisions/0003-identifier-conventions.rst) · [0007 generalized containers](https://github.com/openedx/openedx-core/blob/main/docs/openedx_content/decisions/0007-generalized-containers.rst) · [0009 selectors](https://github.com/openedx/openedx-core/blob/main/docs/openedx_content/decisions/0009-selectors.rst)
- Open edX course-discovery [ADR 0009: LMS types in course metadata (seats vs entitlements)](https://github.com/openedx/course-discovery/blob/master/docs/decisions/0009-LMS-types-in-course-metadata.rst)
- Moodle: [Activity completion API](https://moodledev.io/docs/4.5/apis/core/activitycompletion) · [Activity modules](https://moodledev.io/docs/4.5/apis/plugintypes/mod) · [Gradebook API](https://docs.moodle.org/dev/Gradebook_API) · [AI subsystem](https://moodledev.io/docs/4.5/apis/subsystems/ai) · [AI placements](https://moodledev.io/docs/5.0/apis/plugintypes/ai/placement) · [AI providers](https://moodledev.io/docs/4.5/apis/plugintypes/ai/provider)
- Canvas: [Modules API (Module, ModuleItem, CompletionRequirement)](https://canvas.instructure.com/doc/api/modules.html)
- LearnHouse source, `apps/api/src/db`: [trail_runs.py](https://github.com/learnhouse/learnhouse/blob/dev/apps/api/src/db/trail_runs.py) · [trail_steps.py](https://github.com/learnhouse/learnhouse/blob/dev/apps/api/src/db/trail_steps.py) · [courses/activities.py](https://github.com/learnhouse/learnhouse/blob/dev/apps/api/src/db/courses/activities.py) · [courses/activity_versions.py](https://github.com/learnhouse/learnhouse/blob/dev/apps/api/src/db/courses/activity_versions.py)
- Frappe LMS doctypes: [lms/lms/doctype](https://github.com/frappe/lms/tree/develop/lms/lms/doctype) (`lms_enrollment`, `lms_course_progress`, `lms_batch_enrollment`, `batch_course` JSON read directly)
- 1EdTech [Open Badges 3.0 Implementation Guide](https://www.imsglobal.org/spec/ob/v3p0/impl) · [Open Badges standard page](https://www.1edtech.org/standards/open-badges)
- cmi5: [specification](https://github.com/AICC/cmi-5_Spec_Current/blob/quartz/cmi5_spec.md) · [LMS implementation flow](https://aicc.github.io/CMI-5_Spec_Current/flows/lms-flow.html) · [moveOn explained (RISC)](https://risc-inc.com/cmi5-moveon/) · [cmi5 Technical 101](https://xapi.com/cmi5/cmi5-technical-101/)
- Thinkific support: [Editing published courses](https://support.thinkific.com/hc/en-us/articles/360030371214-Editing-Published-Courses) · [Delete a chapter or lesson](https://support.thinkific.com/hc/en-us/articles/360030374114-Delete-a-Chapter-or-Lesson-from-Your-Course)

Secondary (search summaries / not read at the primary):
- Open edX wiki: [Migrating Courses to Learning Core](https://openedx.atlassian.net/wiki/spaces/AC/pages/4612685830/Migrating+Courses+to+Learning+Core) (page did not render for fetch) · [Determine LMS content data model design, issue #1](https://github.com/openedx/openedx-core/issues/1) · [Course Blocks API](https://openedx.atlassian.net/wiki/spaces/AC/pages/29688043/Course+Blocks+API) · [Completion API](https://openedx.atlassian.net/wiki/spaces/AC/pages/162247762/Completion+API) · [completion aggregator](https://github.com/open-craft/openedx-completion-aggregator) · [Robust Grades Design](https://openedx.atlassian.net/wiki/spaces/AC/pages/95912121/Robust+Grades+Design) · [Grades data model](https://docs.openedx.org/projects/edx-platform/en/open-release-sumac.master/references/docs/lms/djangoapps/grades/docs/data-model.html) · [xAPI real-time events (OEP-26)](https://docs.openedx.org/projects/openedx-proposals/en/latest/architectural-decisions/oep-0026/xapi-realtime-events.html) · [XBlock intro](https://docs.openedx.org/projects/xblock/en/latest/xblock-tutorial/overview/introduction.html)
- Moodle: [Question bank improvements for 4.0](https://docs.moodle.org/dev/Question_bank_improvements_for_Moodle_4.0) · [Conditional activities](https://docs.moodle.org/dev/Conditional_activities) · [Backup 2.0 architecture](https://docs.moodle.org/dev/Backup_2.0_general_architecture)
- Canvas Blueprint: [sync guide](https://community.canvaslms.com/t5/Instructor-Guide/How-do-I-sync-course-content-in-a-blueprint-course-as-an/ta-p/1271) · [Mastery Paths sync issue](https://community.canvaslms.com/t5/Canvas-Question-Forum/Mastery-Paths-in-blueprint-course-does-not-sync-correctly/m-p/638421)
- DeepWiki summaries: [frappe/lms core features](https://deepwiki.com/frappe/lms/3-core-features) · [learnhouse/learnhouse](https://deepwiki.com/learnhouse/learnhouse) · [LearnHouse docs](https://docs.learnhouse.app/platform) · [CourseLit repo](https://github.com/codelitdev/courselit) / [overview](https://openapps.pro/apps/courselit)
- Multi-tenant LMS patterns (vendor material, directional only): [Docebo](https://www.docebo.com/learning-network/blog/multi-tenant-lms/) · [Teachfloor](https://www.teachfloor.com/blog/what-is-multi-tenant-lms) · [Paradiso](https://www.paradisosolutions.com/blog/technical-architecture-multi-tenant-enterprise-lms)
- Open Badges adoption: [VirtualBadge — OB 3.0 status in 2026](https://www.virtualbadge.io/blog-articles/open-badges-3-0-what-is-the-status-in-2026)
- AI tutoring: [Frontiers 2026 — learner-state-aware RAG tutor](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2026.1896839/full) · [Rethinking scaffolding in LLM tutors (arXiv 2606.15766)](https://arxiv.org/html/2606.15766v1) · [Course-aware AI tutor deployment (arXiv 2604.11836)](https://arxiv.org/pdf/2604.11836) · [Khan Academy prompt-engineering approach](https://blog.khanacademy.org/khan-academys-7-step-approach-to-prompt-engineering-for-khanmigo/) · [Khanmigo safety features](https://support.khanacademy.org/hc/en-us/articles/14394814244365-What-safety-features-does-Khanmigo-have)
- Build-from-scratch guides (generic, low signal): [Selleo](https://selleo.com/blog/how-to-build-a-learning-management-system-from-scratch) · [Hubken](https://www.hubkengroup.com/resources/building-an-lms-from-scratch)
