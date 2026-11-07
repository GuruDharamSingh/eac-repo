# The LMS as an action layer: registry, in-lesson actions, dock, runbooks (brief, 2026-11-06)

Covers the developer's direction of 2026-11-06: extend Sophia's course structure across the
platform so a lesson can present and perform platform actions, and grow it into an assisting
layer, a runbook per campaign or action, for people, orgs and series. Builds on the
onboarding course (`docs/open/ONBOARDING_COURSE_BRIEF_2026-10-29.md`, deployed 2026-10-30).
Current state below was verified by code read on 2026-11-06; ~~nothing has been built for this
brief yet~~ (correction, later 2026-11-06: phases 1-2 built and deployed, §5a-5c). §7 records two
longer-range possibilities the developer named; they are not decisions.

## 1. Decisions (developer, 2026-11-06)

1. Both shapes: actions open inside the lesson (A), and the current step travels with the
   person across the platform as a dock (B).
2. Runbooks are the end goal: a course replayed per subject (a person, an org, a series, an
   auction), working as a helper that walks the person through a campaign or an action.
3. Authoring is network-first (the onboarding course). Org owners writing Sophia tutorials
   for their own interests comes later.
4. The dock may appear on any site in the network, including org sites on their own domains.
5. The action registry comes first and has to be solid before the rest is built on it.

## 1a. Developer, later on 2026-11-06

- "Start phase 1."
- The registry includes CMS actions (create or edit content by kind, pin, page design), not
  only the onboarding outcomes.

## 2. Current state (2026-11-06, code read, before phase 1)

- Task steps: step type `task`, completion mode `derived` (`packages/lms/src/step-types.ts`);
  `settleTaskStep` records completion when the host reports done (`packages/lms/src/tasks.ts`).
  `settings.task = { id, scope }`; no parameters.
- Completion checks: one `switch` over 16 task ids in
  `packages/services/src/onboarding-tasks.ts:62-185`. Unknown ids are never done.
- Presentation: a second `switch` in `apps/arts-collective/src/components/learn/TaskBox.tsx`
  (`control()`), host-specific. Ten tasks open a surface in place (profile, listing,
  show-on, service, store, artwork, payouts, org, org-details, org-people); `gain-space` is an
  inline button; four leave the lesson (`studio` → `/studio`, `cloud` → Nextcloud,
  `org-offering` → `/hub/organization`, `org-email` → `/email`); `org-site` has nothing to
  press. Sophia has no `tasks` connector and shows "this site cannot do it from here".
- Re-check: on step render and on window focus (`TaskBox.tsx`, `router.refresh()`). No push.
- Progress is `lms_step_state` keyed `(enrolment, step)`: one completion per learner per
  step, so a step cannot repeat per org or series.
- Handlers: the work is in `packages/services` (`updateProfile`, `saveOffering`,
  `createArtwork`, `createOrganizationForUser`, `setOrgPersonRole`, …), wrapped by per-app
  server actions in `apps/*/src/lib/cms/*-actions.ts`. The wrappers are copied between apps:
  ifac's and arts-collective's `journey-actions.ts` differ by 89 diff lines.
- Permissions are enforced in code (`getServerSession()`, `if (!user)`,
  `canEditOrgIdentity`, org-role gates in `org-people-actions.ts`). Row-level security
  (migration 227) binds only the `eac_tenant` role, used through `withOrg`; apps connect as
  `postgres`, so it does not guard these writes.
- Input schemas: zod 3.25 is a dependency of nine apps; form schemas exist per app
  (`apps/arts-collective/src/lib/cms/schema.ts`). Services take plain TypeScript arguments.
- Surfaces (`packages/cms-ui/src/surface/types.ts`) include `profile`, `journey`, `artwork`,
  `compose`, `write`, `documents`, `postTo`, `me`, `custom`. `SurfaceProvider` is mounted
  in ten apps.
- Shared chrome mounted on every site: `@elkdonis/analytics/beacon` in each root layout;
  `ArrivalNotice` (`@elkdonis/cms-ui/network`) in ifac, innergathering, amrit-canada,
  art-auction. These are the precedent for mounting a dock.
- Anchors: direct-edit declares named sections (`page-edits:home`) on sunjay and
  innergathering only.

## 3. Design

### 3.1 Action registry (phase 1)

One named, typed definition per platform action, independent of any page. An entry:

| Field | Meaning |
|---|---|
| `id` | Stable. The 16 onboarding ids stay as they are (`profile`, `store`, `org`…): published course versions store them. (2026-11-06 correction: the dotted ids first proposed here would have needed aliases.) |
| `scope` | `person`, `org`, or a subject kind (`series`, `auction`, `event`) |
| `input` | zod schema for what the handler accepts |
| `defaults` | zod schema for what a lesson step may prefill (subset of `input`) |
| `allowed(ctx, input)` | Permission check; `ctx` = acting user from `getServerSession()`, roles, org, subject |
| `run(ctx, input)` | Handler; calls the existing service function |
| `status(ctx)` | Completion check, returns `TaskStatus` (`done`, `partial`, `detail`, `href`) |
| `present(ctx)` | Where it is shown: a surface descriptor, or a route plus anchor, or "nothing to press" with a reason |

Placement: a new package (working name `@elkdonis/actions`) with a `server` subpath
(input, allowed, run, status; imports services and db) and a `client` subpath (ids, labels,
`present`; no database). Kept out of `packages/services`' barrel because a broken file there
fails every app's type check.

Execution: one generic server action per host, `runAction(id, input)`, which resolves the
acting user itself, parses `input` with the schema, calls `allowed`, then `run`. Existing
panels move from their per-app wrappers to `runAction` one at a time; the copied
`lib/cms/*-actions.ts` files shrink as they move.

First entries: the 16 onboarding tasks, moved from `onboarding-tasks.ts` and `TaskBox.tsx`
without behaviour change. `getOnboardingTaskStatus` becomes a lookup into the registry.
Afterwards: the compose kinds, series (`packages/series-site`), store and auction,
email identity, Puck/landing page.

Studio: a task picker on the step editor lists registry entries (label, scope, what the
step may prefill) and shows the task box as the learner would see it.

### 3.2 In-lesson actions (shape A)

- Every entry with a surface opens in place, as ten do today.
- Close the four exits: `org-offering` → `compose` surface; `cloud` → `documents` surface or
  a sign-in popup; `org-email` → a small new surface over `saveOrgEmailIdentity`; `studio` →
  needs a surface for `writing` pieces. The existing `write` surface writes
  `threads.kind = 'post'`, while the `studio` task counts `kind = 'writing'`
  (`onboarding-tasks.ts:81-89`), so it does not fit as is.
- `settings.task.params` (validated against the entry's `defaults`) prefill the surface.
- Sophia gets a `tasks` connector so a task step renders there too, or a task step on
  Sophia links to the course's canonical host.

### 3.3 Dock (shape B)

- A client strip from a shared package (`@elkdonis/lms-ui/dock`), mounted in each app's
  root layout beside the analytics beacon. It shows the current step's title and state,
  the step's action (`present`), and a link back to the lesson.
- The "current step" is stored server-side per user, not in a cookie: org sites on their own
  domains (ifacgroup.com, amritcanada.ca) share no cookie with arts-collective. Each app
  reads it with the session it already verifies.
- When the step's action routes to the page the person is on, the dock outlines the anchor:
  `data-eac-anchor="<action id>"` on the real control. Whether this reuses direct-edit's
  section markers is open (section 6).
- Dismiss and resume; hidden when there is no active course.

### 3.4 Pushed completion (between B and C)

The `runAction` wrapper writes an `action_events` row (actor, action id, scope, subject,
occurred_at) in the handler's transaction. The LMS re-checks the steps that name that action
for that actor, so the course, the dock and the hub card update without a revisit. `status`
stays authoritative: an event is a hint to re-check, because the same state can change
outside the registry (admin console, imports).

### 3.5 Runbooks (shape C)

- A course run bound to a subject: progress keyed `(enrolment, step, subject)`, or a separate
  runbook-run table referencing the enrolment. Schema change; decide in phase 4.
- `ctx.subject` passes through `allowed`, `run`, `status` and `present`, so "Run a series
  term" ticks per series and "Launch an org site" per org.
- Role-gated steps: a step names the role it needs (owner, guide, operator); others see it
  as context, not as a task.
- The operator steps that now have "nothing to press" (`org-site`: confirm subdomain, add
  proxy host) become admin-scoped registry entries in an operator runbook.
- Org-authored courses use the same registry; the registry's `allowed` decides what an
  org's course can perform, not the course author.

## 4. Rules

- A step performs only registered actions through `runAction`: the LMS never gains write
  access of its own, so permissions stay in one place.
- `runAction` resolves the acting user from `getServerSession()` and never from input: it is
  a generic endpoint, and a client-supplied actor would let any action run as anyone.
- `@elkdonis/lms` core does not import the registry (`lms/SYNTHESIS.md` rule 5); the host
  passes it in through `LmsConnectors.tasks`.
- Moving an action into the registry changes no behaviour in the same pass: compare the
  task box and the panel before and after.
- Actions that touch Stripe stay unexercised in tests (live keys, `docs/reference/commerce.md`).

## 5. Build order

| Phase | Work | Done when |
|---|---|---|
| 1 | Registry package; 16 onboarding entries moved; `runAction` in arts-collective; TaskBox reads `present`; studio task picker (deployed 2026-11-06, §5c) | Course behaves as on 2026-10-30, from the registry; picker lists entries |
| 2 | Shape A: close the four exits, `params` prefill, Sophia connector or canonical link (deployed 2026-11-06, §5b-5c) | No task step leaves the lesson except `cloud` sign-in, if it must |
| 3 | Shape B: current-step store, dock package, mount on arts-collective then the live apps, anchors | Dock follows a signed-in learner from `/learn` to `/studio` and to an org site |
| 4 | `action_events` and pushed settlement; subject-keyed progress; first runbook (one of: launch an org site, run a series term) | One runbook runs twice for two subjects with separate progress |
| 5 | Wider registry (compose kinds, series, store, auction, email, landing page); org-authored courses | An org owner publishes a course whose steps call registry actions |

Each phase in a dev-mode preview first (`docs/reference/testing.md`); each rebuild of a
production-mode app ships the whole uncommitted tree and is announced separately.

## 5a. Status (2026-11-06)

~~Phase 1 is in source, not deployed, not committed.~~ Correction, 2026-11-06: deployed with phase 2
(§5c); not committed.

- `packages/actions` (`@elkdonis/actions`): catalogue (16 entries, ids unchanged), `presentAction`,
  `actionStatus`/`actionStatuses` (the queries of `onboarding-tasks.ts`, moved), `performAction` with
  runners for `gain-space`, `store`, `org` (zod input for `org`). README in the package.
  `tsconfig` has `strict: false` like services, which it imports as source.
- `packages/services/src/onboarding-tasks.ts` removed with its two exports; no other caller.
- arts-collective: `src/lib/actions/run.ts` (`runAction`, actor from the session);
  `journey-actions.ts` store/org/gain-space delegate to it; `lib/lms/connectors.tsx` reads
  `actionStatus`; `TaskBox.tsx` reads `presentAction` (control kind `run` replaces `gain-space`).
- lms-ui: `LmsConnectors.taskCatalogue` + `LmsTaskChoice`; studio "What it asks for" picker on
  `derived` steps; `studio-save-step` `withTask`. Sophia passes `ACTION_CATALOGUE`.
- Dependencies: `@elkdonis/actions` in arts-collective and Sophia (`package.json`,
  `transpilePackages`); installed with the install container, lockfile gained only these entries.

Verified 2026-11-06:
- Type checks: `@elkdonis/actions`, `@elkdonis/lms-ui`, `sophia`, `arts-collective` exit 0.
  `@elkdonis/services` fails with 17 errors in other files (nextcloud components, utils
  sanitizers, `social-feeds.ts`), none in files this phase touched.
- Status equivalence: old `getOnboardingTaskStatus` plus the old connector's href filling against
  `actionStatus`, 39 live accounts × 16 tasks = 624 comparisons (103 done), 0 differences
  (read-only script, removed).
- `performAction` refusals without writes: no actor, unknown id, entry without a runner, bad input
  type, missing input, invalid subdomain (service's own message).
- Task box markup: signed-in throwaway account, the 16 task steps on live arts-collective (old build)
  against a dev preview (new code): identical `section.so-task` markup on all 16.
- Studio picker: Sophia dev preview on port 3120 (the running Sophia is production mode), throwaway
  account as author of `sophia-test-course`: picker lists 16 entries in 9 groups; saves stored
  `{id:'org-details', scope:'org'}`, `{id:'profile', scope:'person'}`, kept the task when the field
  was absent, removed it on an empty choice; the test step was removed from the outline and its
  never-published `lms_steps` row deleted; staff row and account removed. 17 `lms_events` rows of the
  throwaway account remain (append-only table).

Not verified: pressing "Take my space", "Open a store" or creating an organisation through
`runAction` (each writes live rows; gain-space also creates a Nextcloud folder); org-scoped task
boxes with an org (the throwaway owned none); a browser click on any control.

Deploying needs a rebuild of arts-collective (ships the whole uncommitted tree) and of Sophia
(done 2026-11-06, §5c).

## 5b. Status, phase 2 (2026-11-06)

~~In source, not deployed, not committed.~~ Correction, 2026-11-06: deployed (§5c); not committed.

- Exits closed: `studio` opens the Studio framed in a dialog over the lesson (custom surface
  `learn:frame` in `LearnHost.tsx`, same-origin paths only, refreshes the step on close);
  `cloud` opens Nextcloud's login in a popup window (refresh when it closes; a blocked popup
  falls back to a new tab); `org-offering` opens the compose surface for the learner's org;
  `org-email` is a form in the step saved through `runAction('org-email')`. `org-site` stays
  "nothing to press" (operator step, phase 4 runbook).
- Compose on `/learn`: the console's compose wiring moved unchanged to
  `apps/arts-collective/src/components/hub/console/org-compose.tsx` and is used by both
  `OrgConsoleHost` and `LearnHost`; `app/learn/layout.tsx` resolves the learner's owned org
  (the same org `pages.tsx` passes to task boxes) and wires compose only for an owner or
  guide. A compose task for any other org falls back to the console link.
- Params: `StepTask.params` (lms), catalogue `params`, `actionParams`; the studio picker
  shows a saved task's choices as selects (`task_param_<name>`), `withTask` keeps them to the
  declared options. First user: `org-publish` (`kind`), status counts drafts/published
  threads of that kind in the org.
- `runAction(id, input, { org })`: for org-scoped entries the org is the requested one when
  the person is owner or guide there, else their owned org.
- `TaskStatus.values` (lms) and `ActionStatus.values` carry a form's current values.
  `StepBody` now always reads status, also for a recorded step (the read is cached): a form
  drawn without its values would save blanks over them.
- Sophia: `LmsConnectors.taskElsewhere`; a task step there links to the same step under
  `/learn` on the network host.

Verified 2026-11-06:
- Type checks exit 0: `@elkdonis/actions`, `@elkdonis/lms`, `@elkdonis/lms-ui`, `sophia`,
  `arts-collective`.
- Task boxes, signed-in throwaway account owning a throwaway org (`claude-test-actions`,
  minimal rows): live (old build) vs dev preview, 16 steps: 11 identical; the four exits
  differ as intended (frame button, popup hint, "Publish something", the email form);
  "start-an-organisation" shows its detail line now that recorded steps read status.
- `org-email` through `performAction` on the throwaway org: stranger refused, no org refused,
  bad address refused with its own message, owner save → status done with values, clearing
  the reply-to → partial. The rendered form prefilled the saved sending name.
- `org-publish` status and presentation for `article`, `event`, an unknown kind (falls back
  to the default).
- `/studio` sends no `X-Frame-Options` or CSP through the edge or the app (same-origin
  framing allowed).
- Sophia dev preview: a task step shows "Open it there" →
  `https://arts-collective.com/learn/getting-started/<step>`.
- Org console page for the throwaway org: main text identical live vs preview (142 lines).
- Cleanup: throwaway org (cascade: feed, site_config row), account and enrolment removed;
  17 `lms_events` rows remain (append-only).

~~Not verified: anything that needs a browser click.~~ Correction, later 2026-11-06: the
developer allowed the headless Chrome container; the clicks below were then run.

Browser pass (2026-11-06, headless Chrome over CDP against the dev preview, throwaway account
owning a throwaway org, no console errors in any run):
- "Your first offering" → "Publish something" opened the compose picker over the lesson
  (Post, Event, Meeting, Workshop, Questionnaire, Poll); "Post" opened the writing form with
  the org's feed; Publish created the thread, the step read "Done · Leading with …" and the
  outline marked it done. Defect found and fixed: after Publish the dialog showed "This is
  no longer here" because `/learn` loaded threads from the default `/api/hub/threads`, which
  this host does not serve; `LearnHost` now uses the org's `/api/org/<slug>/threads` (and
  calendar, image upload) when it wires compose. Re-run: the new post opens with "Edit".
- "Write your first piece" → "Open the Studio": the Studio loaded inside the frame (library,
  drafts, "Writing as … Claude test org"); closing the dialog sent a refresh request.
- "Mail from your collective": the form saved, showed "Saved.", turned the step Done and came
  back prefilled after a reload. A bad reply-to is stopped by the browser's own email check;
  with that bypassed, the server's "That is not an email address." showed in the step.
- "Your files" → "Open the cloud" opened `https://cloud.elkdonis-arts.org/login` in a separate
  window while the lesson stayed; closing that window sent a refresh request.
- Wording: the compose picker calls the article kind "Post"; the step hint, `org-publish`
  labels and status words now say post (the param value stays `article`, the compose id).
- Cleanup: throwaway org (three test posts with it, by cascade), account, enrolment removed;
  7 `lms_events` rows remain (append-only). Containers `claude-chrome` and `ac-preview` removed.

## 5c. Deploy, phases 1-2 (2026-11-06)

Deployed 2026-11-06 on the developer's word ("Rebuild and deploy"); nothing committed.

- arts-collective: `.next` backed up to `~/eac-backups/next/arts-collective-20261106-1141.tgz`
  (previous build `KtYiwkFGPywjkBtCiT2B-`), built in its own container, restarted 16:43 UTC;
  serves `BUILD_ID` `vni7A5WfAZhv09ZSSlHR1`. The build ships the whole uncommitted tree.
- Sophia: backup `~/eac-backups/next/sophia-20261106-1141.tgz` (previous `W7ExjIl7586hYyk8Po-X6`),
  restarted 16:44 UTC; serves `wA42qGejM_G-1PSJp01Fm`.

Verified 2026-11-06:
- Edge checks on arts-collective and `scripts/tenant-smoke.sh` 9/9.
- Sophia: a task step links to the same step under `https://arts-collective.com/learn`.
- Live click-through (headless Chrome over CDP against `eac-arts-network:3007`, throwaway account
  owning throwaway org `claude-test-actions`, no console errors, 20:20-20:30 UTC): "Publish something"
  opens the compose picker for the org; "Open the Studio" loads the Studio in the frame and the step
  stays after closing it; the mail form saves, shows "Saved.", turns the step Done and prefills;
  "Open the cloud" opens `https://cloud.elkdonis-arts.org/login` in a second window while the lesson
  stays. Nothing was published (no thread rows); the Studio's three actions on open wrote no piece.
- Cleanup: throwaway org (feed, email identity, membership), account (`users`, enrolment,
  entitlement, `org_profiles`, GoTrue) removed; 6 `lms_events` rows remain (append-only).
  Containers `claude-chrome` removed.

Unknown: a first live run at 16:47 UTC ended on the app's "Something went wrong" page after the
mail save, with no server log line and no identity row written; the tab then stopped answering CDP.
Three later runs (mail alone, bad address alone, the full sequence) did not reproduce it. Cause not
found: the headless tab, or a client error on the first requests after the restart.

Not verified live: publishing a post through the compose dialog (verified in the preview only),
a bad reply-to past the browser's email check (preview only), the cloud sign-in itself.

## 5d. Registry pass (2026-11-06, between phases 2 and 3)

Developer, 2026-11-06: focus on the registry before the dock. ~~In source, not deployed, not
committed; migration 245 written, not applied.~~ Correction, 2026-11-06 22:40 UTC: migration 245
applied and arts-collective deployed (§5e); not committed.

- `check:registry` (`packages/actions/scripts/check-registry.mts`): catalogue flags against
  `RUNNERS`/`CHECKS`, param defaults, duplicate ids and options; exits 1 on a mismatch.
- Audit: migration 245 `action_events` (append-only, no foreign keys, `eac_tenant` revoked);
  `performAction` writes one row per call with an actor, refusals included, best effort.
  `ActorContext.via` names the door ('app' default, 'http' for the routes, 'script').
- Runners for plain field edits: `profile` (name, line, bio), `listing` (directory switch),
  `org-details` (line, description on the org's identity row). Each calls the service that
  already writes those fields (`updateProfile`, `setPresence`). Their statuses carry `values`.
  Presentations unchanged: the lesson still opens the profile popup and console for these.
- Runner schemas on `zod/v4`; `actionInputSchema(id)` and `RUNNABLE_IDS` exported for the
  routes' JSON Schema. Input refusals: a refine's message only when every issue is a refine,
  a too-long string named, other zod defaults generic.
- HTTP door (built by a helper agent in this session, reviewed): `actionRoutes({ who, links,
  publicOrigin })` in `packages/actions/src/server/routes.ts`, mounted on arts-collective at
  `GET /api/actions` (catalogue, public; runnable entries carry `input` as JSON Schema from
  `actionJsonSchema`, `src/server/schema.ts`), `GET /api/actions/<id>?org=` (`{ id, org, status }`,
  reads only, other query keys are params), `POST /api/actions/<id>` (body `{ input?, org? }`,
  200 ok / 422 refused; 404 unknown, 405 no runner, 415 not JSON, 403 foreign `Origin`,
  401 signed out, 413 over 64 KiB, 400 not an object). No CORS headers: same-origin only.
  Host files: `apps/arts-collective/src/lib/actions/routes.ts`, `app/api/actions/route.ts`,
  `app/api/actions/[id]/route.ts`.
- One org rule for every door: `resolveActionOrg` / `actionOrgId` (`src/server/org.ts`), used by
  `runAction`, the routes and the lesson's `orgFor` (`lib/lms/connectors.tsx`). One links object:
  `apps/arts-collective/src/lib/actions/links.ts`.

Verified 2026-11-06:
- `@elkdonis/actions` check-types exit 0; `check:registry`: 17 entries, 7 runners, 17 checks.
- Migration 245 trial in a rolled-back transaction: table, indexes, trigger, revokes created;
  an insert accepted, an update refused ("action_events is append-only"); nothing left after.
- Runners against live rows (tsx in the admin container, three throwaway accounts, a hand-made
  throwaway org whose identity row was one of them; the `org` runner was not used because it
  also provisions Nextcloud folders): profile save trims and stores, `values` read back, an
  empty bio clears; refusals: nothing to save, blank name, 201-character headline ("The headline
  field is longer than 200 characters."), wrong type, unknown entry, no actor. `listing`
  `listed: false` through `setPresence`, status partial with `values.listed = 'false'`; wrong
  type refused. `org-details`: stranger refused, no org refused, empty refused, save and clear
  on the identity row, `organizations.name` unchanged. `org-email` bad address still answers
  "That is not an email address." With 245 unapplied, the first call logged the missing-table
  warning once and every result stood.
- Cleanup: throwaway org, membership, `org_profiles` row, three accounts (`users`, GoTrue) removed.
- Type checks exit 0 after all changes: `@elkdonis/actions`, `@elkdonis/lms-ui`, `sophia`,
  `arts-collective`.
- Routes, helper's dev preview (reported, code reviewed): signed out catalogue 200 with schemas,
  POST 401, `text/plain` and form bodies 415, foreign and `null` Origin 403, unknown id 404,
  `studio` POST 405; edge headers (`Host`, `X-Forwarded-Proto`) let the hub's own origin through
  and refuse `http://`; signed in, a claim on `ifac` resolved to no org, `org-email` bad address
  422 with the schema's message and ifac's identity row untouched; malformed and array bodies
  400, 70 KB body 413.
- Routes and lesson, own dev preview after the links/org-rule change (each request twice,
  throwaway owner of a throwaway org): catalogue lists 7 runnable entries with schemas; status
  `org-email` resolves the person's own org, also when the request claims `ifac`; signed-out POST
  401; signed-in same-origin over-long headline 422 "The headline field is longer than 200
  characters."; the mail step draws its form; the profile, directory and org-details steps draw
  the same controls as before. Cleanup: preview, org, account removed; 5 `lms_events` rows remain.

Not verified: `listing` with `listed: true` on live rows (it would put a test account on the
public directory for the length of the test); audit rows themselves (245 unapplied); anything
in a browser (no presentation changed); the routes' 500 path; a request through the edge
itself (headers were sent to the preview); a browser `fetch` to the routes; `runAction` run after
its switch to `actionOrgId` (type-checked; the lesson's `orgFor` on the same function rendered).

Continued 2026-11-06 (developer: "OK continue"), in source, not deployed:
- `ActionResult` failures carry `code` (`ActionFailure`: auth, unknown, input, forbidden, failed;
  absent when the entry itself refused); migration 245 (still unapplied) gained a `code` column.
- `org-publish` runner: a draft post (title 2-200, optional plain text up to 20000 characters,
  `textToHtml` then `createThread`, the shared thread write path that sanitises the body);
  owners and guides; never publishes; events and meetings stay with the composer. Catalogue
  `performs` says so. The lesson still opens the composer for this step.
- Verified 2026-11-06 on a hand-made throwaway org (tsx in the admin container): stranger and no
  org refused (`forbidden`), one-character, 201-character and missing titles refused (`input`,
  the first two with their own message); the saved row is `kind post`, `status draft`,
  `published_at` NULL, author the owner, `<b>` and `<script>` in the text escaped; status moved
  from "No post on the site yet." to partial "1 draft post, none published yet."; the event
  param still reads its own kind. Draft, org, feed and accounts removed. `check:registry`: 17
  entries, 8 runners. Type checks 0: actions, lms-ui, sophia.

- Route hardening (helper agent, reviewed): POST status from `code` (auth 401, unknown 404,
  input 400, forbidden 403, failed 500, limit 429; no code 422); the body is read from the stream
  and cancelled past 64 KiB; a per-person sliding window in memory (default 30 POSTs per 60 s,
  `rateLimit` option, 429 with `Retry-After`, per process), counted once the actor is known.
  Verified in the helper's dev preview (each request twice): bad address 400 with the schema
  message, `org-details` without an org 403, unknown 404, a 70 KB chunked body with no
  Content-Length 413 (the server answered while the upload was still running), 32 rapid refused
  POSTs gave 30 × 400 then 429 `retry-after: 60`, with GET still 200 and a signed-out POST 401.
  The `limit` code on the 429 body was added afterwards (type-checked, not re-probed).
  Type checks 0 after all changes: actions, lms-ui, sophia, arts-collective.

Open from this pass: cross-origin callers (a dock on an org's own domain) need CORS with an
allow-list and a token or SSO handoff; JSON Schema leaves out refine rules (the server still
applies them); the rate window is per process. ~~No rate limit; a chunked body read in full;
every refusal 422.~~ (2026-11-06: hardened, above.) Once 245 is applied, every signed-in POST that
reaches `performAction` leaves an append-only row, so repeated probes leave rows.

## 5e. Deploy, registry pass (2026-11-06)

Developer: "Deploy it." Nothing committed.

- Migration 245 applied 2026-11-06 22:39 UTC by the runner (the only pending file). `\d action_events`
  matches the file; `eac_tenant` has no select; trigger present.
- arts-collective: `.next` backed up to `~/eac-backups/next/arts-collective-20261106-1740.tgz`
  (previous build `vni7A5WfAZhv09ZSSlHR1`); built inside `eac-arts-network` (no one-off containers;
  only this pass's files edited in the 10 minutes before); restarted, not recreated; serves
  `BUILD_ID` `15yPXWvkJS3XcZH8R_jIy`. The build also shipped other sessions' changes made since
  the 11:41 build (`direct-edit` site style and Puck parts, `page-builder` parts and drag,
  `blocks` types, `cms-ui` auth `TurnstileField`, `series-site` sign-in); arts-collective's type
  check covered them.
- Turnstile: the running container has no `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (compose change not
  applied to it), so the build baked none: 0 client files contain the key and the sign-up page has
  no widget, so sign-up behaves as before. Restart rather than recreate kept it so; the rollout
  order in `docs/reference/identity-and-tenancy.md` stays with its own session.
- Sophia was not rebuilt: the pass changed only catalogue flags and types it does not show.

Verified 2026-11-06, through the edge (`--resolve arts-collective.com:30022`), throwaway owner of a
throwaway org:
- `/`, `/learn/getting-started`, `/login`, `/hub/network`, `/api/actions` 200; `tenant-smoke` 9/9;
  no error lines in the log since the restart.
- Catalogue: 17 entries, 8 runnable, `org-publish` `performs` text present.
- POST with `Origin: https://arts-collective.com` (what a browser sends; the edge forwards `Host`
  without the port, so `Origin: https://arts-collective.com:30022` is refused as foreign, 403):
  `org-email` bad address 400 `code: input`; `http://` origin 403; `org-publish` draft 200 with
  its thread id, row `post`/`draft`/no `published_at`; status moved to partial; signed-out 401.
- Audit rows: `via=http` for the refusal (code `input`) and the draft (result with the thread id);
  the lesson's mail form saved in headless Chrome (no console errors) left a `via=app` row.
- Cleanup: draft, org, feed, email identity, membership, account removed; 3 `action_events` and
  3 `lms_events` rows remain (append-only).

Not verified live: the rate limit (a burst would leave 30 append-only rows; verified in a
preview), `listing` with `listed: true`, a request from outside the LAN.

## 5f. Post actions (2026-11-06, in source)

Developer: "Post actions" (chosen over starting the dock). ~~Not deployed, not committed;
migration 246 written, not applied.~~ Correction, 2026-11-06 23:30 UTC: deployed (below); not committed.

- Scope `thread` (`ActionScope`), with `CourseActionScope` and `COURSE_ACTIONS` for the scopes a
  course step can name; Sophia's studio lists `COURSE_ACTIONS`, so post entries are not offered
  as task steps until runbooks supply a subject. `ActorContext.subjectId`, `StatusContext.subjectId`.
- `performAction` loads a `thread` entry's post itself (`kind = 'post'`, not archived), takes the
  org from the post's row (a claimed org is dropped, also from the audit row), refuses a missing
  subject (`input`) and an unknown post (`unknown`).
- Entries: `thread-edit` (title, plain `text` or sanitised `html`; the post's author or an owner or
  guide; no completion check), `thread-publish` (owners and guides; `updatePost` status
  'published'), `thread-pin` (owners and guides; one pinned post per org and only a published
  PUBLIC post, the console's `togglePinAction` rule). Catalogue `performs` describes each.
- Doors: publishing, pinning and editing a published post only from a host's own pages
  (`via` 'app'); the HTTP routes and later agents work on drafts. Policy for those doors, not a
  boundary against the person, who can do the same in the console.
- Audit: migration 246 adds `action_events.subject_id`; until it is applied `record()` writes the
  row without it and warns once.
- `check:registry`: 20 entries, 11 runners, 19 checks. Type checks 0: actions, lms-ui, sophia.

Verified 2026-11-06 on a hand-made throwaway org (owner, plain member, stranger; tsx in the admin
container): no subject `input`, unknown post `unknown`; owner edits a draft over `http`; member edits
their own draft, not the owner's; stranger refused; `text` with `html` refused; `<script>` and
`onerror` stripped from `html`; publish refused over `http` and for the member, done from `app`
(`published_at` stamped; a repeat answers `already`); editing the published post refused over
`http`, done from `app`; pinning a draft refused, pinning over `http` refused, pinning a second
post unpinned the first; status reads only for the author or the org's editors. Posts were public
only on the throwaway org's own site (`share_to_network` defaults to false) and deleted in the same
run; org and accounts removed. 22 `action_events` rows from these accounts remain (append-only).
- Doors (helper agent, reviewed): `GET /api/actions/<id>?subject=` (answers `{ id, org, subject,
  status }`; `subject` is not a param) and `POST` body `{ input?, org?, subject? }` pass `subjectId`;
  `runAction(id, input, { org?, subject? })` the same. `performAction` drops `subjectId` for entries
  that are not subject-scoped, so a stray subject is never audited. Verified in the helper's dev
  preview (throwaway owner and stranger, a draft made through `org-publish`): owner status "… is a
  draft.", stranger "No post of yours is named."; owner edit 200, stranger 403, missing subject 400,
  unknown 404, text with html 400, publish 403, pin 403 over HTTP; the row stayed a draft, unpinned.
  That run left 8 `action_events` rows. Type checks 0 after all changes: actions, lms-ui, sophia,
  arts-collective; `check:registry` consistent.
- Not verified: `runAction` with a subject from a page (no page offers post entries yet); publish
  and pin through a host page (no page calls them yet; verified only by direct calls with `via: 'app'`).

Deploy 2026-11-06 (developer: "Deploy it"): migration 246 applied by the runner (only pending
file); arts-collective backed up to `~/eac-backups/next/arts-collective-20261106-1814.tgz`
(previous `15yPXWvkJS3XcZH8R_jIy`), type-checked against the tree, built in `eac-arts-network`
after a quiet period (another session's `direct-edit`, `blocks` and `services/featured-people.ts`
edits up to 18:05 EST shipped with it), restarted (not recreated; no Turnstile key baked); serves
`TgxcFUbac5zEOfwudowAF`. Verified through the edge: `/`, `/learn/getting-started`, `/login`,
`/hub/network`, `/api/actions` 200; catalogue 20 entries with the three post entries; signed-out
post-entry POST 401; `tenant-smoke` 9/9; no error lines in the log. Signed in (throwaway owner and
org): a draft through `org-publish`, `thread-edit` 200 (title changed, still draft),
`thread-publish` over HTTP 403, status "… is a draft."; audit rows carry `subject_id`. Org, post and
account removed; 3 `action_events` rows remain.

## 5g. Dock, slice 1 (2026-11-06, in source)

Developer: "do the dock", plan approved, built by a subagent ("test half as much"). ~~Not deployed,
not committed.~~ Correction, 2026-11-07 02:30 UTC: deployed with the draft-page fix (below); not committed.

- `GET /api/actions/dock?path=` (arts-collective; `packages/actions/src/server/dock.ts`, LMS
  functions passed in by the host): the current step (getting-started first, then other active
  enrolments; `continueStep`, else the first open step not done; reads only, no settling) and, on
  `/sites/<org>/<post>`, the post entries for owners and guides (Publish for a draft; Lead/Stop
  leading for a published PUBLIC post). 401 signed out, 204 when empty.
- `@elkdonis/dock` (new package, plain CSS on `--eac-dock-*`, contrast in a comment): corner tab
  and box; surface/frame controls link to the lesson, link/popup/run/form act in the dock; hidden on
  `/learn` and signed out; dismissible per session. Actions run through `runDockAction`
  (`apps/arts-collective/src/lib/actions/dock-actions.ts`, allow-list, `runAction`, via `app`).
  Mounted in arts-collective's root layout. Lockfile: the install container added only the new
  package's entries.
- Hub host only: the session cookie is host-only (`EAC_COOKIE_DOMAIN` unset), so org subdomains get
  no dock.

Verified 2026-11-06 (subagent, dev preview + headless Chrome; type checks re-run by the main
session): check-types 0 for actions, dock, arts-collective; the dock shows the current step on
`/hub/network`; absent on `/learn` and signed out (route 401); Publish on a throwaway draft from the
dock published it and left `thread-publish` via `app` with `subject_id`. Cleanup done; 2
`action_events` and 2 `lms_events` rows remain.

Not verified: a task step's control inside the dock, `/studio`, Lead the site from the dock, the
dismiss button, narrow screens.

~~Open: a draft's own page is a 404~~ Fixed 2026-11-06 (developer: "Fix it first"): `getPublicThread`
(`apps/arts-collective/src/lib/org.ts`) takes `includeDrafts`, which the post page passes only for
owners and guides (`canEditOrgSite`); a draft shows a "Draft" notice (#4a3500 on #fff4d6, 10.64:1)
and no pin bar. Verified in a dev preview by server HTML, each request twice: draft signed out 404;
draft as owner 200 with the notice and no pin bar; published signed out 200 with no notice;
published as owner 200 with the pin bar. arts-collective check-types 0. Test rows removed.
Open: each signed-out page
makes one 401 request; `DockWire` in the dock duplicates `DockData` (move wire types to the
client-safe `types.ts`); the tab says "Your next step" on post pages.

Deploy 2026-11-07 (developer: "Deploy it"): no migrations pending; arts-collective type-checked
against the tree (quiet 10 minutes; other sessions' `services` recordings/studio-items/reels,
`page-builder` config and `direct-edit` changes shipped with it), backed up to
`~/eac-backups/next/arts-collective-20261106-2120.tgz` (previous `TgxcFUbac5zEOfwudowAF`), built in
`eac-arts-network`, restarted (not recreated; no Turnstile key baked); serves `NP5IGAuZPQ_xI0crNBzL-`.
Verified through the edge: `/`, `/learn/getting-started`, `/login`, `/hub/network`, `/api/actions` 200,
`/studio` 307 signed out; dock route 401 signed out and no dock markup in signed-out HTML;
`tenant-smoke` 9/9; no error lines. Signed in (throwaway account): dock 204 before enrolling, after
opening the course 200 with step "What this is" (0 of 9). Account removed; 1 `lms_events` row remains.
Not verified live: the dock drawn in a browser, Publish from the dock (preview only).

## 6. Open questions

- ~~Package name and placement~~: new `@elkdonis/actions` (2026-11-06).
- ~~Nothing checks `runnable`/`derived` in the catalogue against `RUNNERS`/`CHECKS` on the server side;
  a small script or a test-time assertion would.~~ 2026-11-06: `check:registry` (§5d).
- Dock anchors: reuse direct-edit's section markers, or a separate `data-eac-anchor`
  vocabulary on controls (markers are sections, anchors are buttons).
- Current-step storage: a new column or table, or derived from the latest `lms_events` row
  (check `\d lms_events` and `\d lms_step_state` first).
- Runbook progress: extend `lms_step_state` with a subject, or a separate table.
- Which runbook first: "Launch an org site" (operator steps included) or "Run a series term"
  (`packages/series-site`).
- Whether the `studio` task should also count `post` threads, or a writing-kind surface is
  built.

## 7. Further horizons (developer, 2026-11-06; not decided)

The developer observed that the LMS work seems to lead toward two things: the Center factory
and the single-app direction, and a central MCP for the platform that an assistant or other AI
could use to run it. Asked that this be recorded as something to keep in mind and draw on, not
as the direction. Nothing here is scheduled or in §5; the phases there stand as written.

### 7.1 Center factory and the single app

- `centerRoutes()` (`packages/services/src/center-routes.ts:13`) is the start of one set of
  Center routes for every org app; on 2026-11-06 it carries the connections routes only.
- The registry is served from arts-collective only (`apps/arts-collective/src/lib/actions/run.ts`).
- The single-app decisions are in the claude.ai Doc "Arts Collective: One App Reform Review"
  (https://claude.ai/artifact/X4UzFg2UffJTnbpDCko1DU). Not read for this note; how the registry
  fits its phase plan is unknown.
- What the registry offers either way: one list of actions that does not depend on the host
  that draws it. An `actionRoutes()` beside `centerRoutes()` (run an entry, read its status,
  actor from the verified session) would let a dock on any org site (decision 4) call the same
  entries before any merge; in a single app it would simply be that app's action API.
  (Later 2026-11-06: built and mounted on arts-collective, same-origin only, §5d.)

### 7.2 A platform MCP

How registry parts correspond to MCP parts:

| Registry | MCP |
|---|---|
| Entry with a runner (`RUNNERS`, `packages/actions/src/server/run.ts:51`) | Tool; its zod input converts to JSON Schema |
| Completion check (`actionStatus`) | Read tool or resource: where a person or org stands |
| Course or runbook | Prompt: ordered steps with checks; an agent could follow the runbook a person follows |
| Presentation (`presentAction`) | What an agent hands back when the person must act (Stripe onboarding, cloud sign-in): a link |

Existing pieces it could build on:
- Delegated tokens: `apps/admin` issues RFC 8693 tokens with `sub` = the person and
  `act.sub` = the agent; `verifyDelegatedToken` (`apps/admin/src/lib/oidc.ts:259`) gates
  `apps/admin/src/app/api/agent/post/route.ts`, which applies ordinary org roles with no admin
  bypass (`docs/reference/identity-and-tenancy.md`, "OpenClaw bridge").
- `packages/openclaw-bridge` creates draft posts only (`src/post.ts:126,160,265`): a precedent
  for agent writes starting as drafts.
- `performAction` takes the actor from its caller, never from input (§4); for an agent the
  actor would come from the token in the same way.
- MCP authorisation is OAuth 2.1 with the server as resource server. The network's OIDC
  providers would need a registration path for MCP clients, a consent screen, and tokens bound
  to the MCP endpoint (assumed from the MCP specification; not checked against a client).

Two possible consumers of the same entries:
- Claude clients outside the platform, connecting as the signed-in person.
- An assistant inside the dock (§1 decision 1, shape B), calling `performAction` on the server
  through the Claude API's tool use; it runs in the person's session, so it needs no OAuth.
  The Astro Studio helper is blocked on `ANTHROPIC_WORKSPACE_ID` (`CLAUDE.md`); assumed to
  apply here too.

What would have to be true before an agent writes anything:
- Runners for the entries performed only by a surface: 4 of 17 entries have one
  (`gain-space`, `store`, `org`, `org-email`); an agent cannot press compose, the Studio or
  the profile popup. (Later 2026-11-06: 7 of 17, §5d.)
- An audit row per call (who, which agent, which org, input, result): `action_events`, phase 4.
  (Later 2026-11-06: written as migration 245 and wired in `performAction`, §5d; not applied.)
- Entries that touch money (`store`, `payouts`) return a link for the person instead of running:
  the Stripe keys are live and every call writes to `elkdonis_dev`.
- A check that catalogue flags (`runnable`, `derived`) match `RUNNERS` and `CHECKS` (§6), since
  tools would be generated from the flags. (Later 2026-11-06: `check:registry`, §5d.)

Most of these also serve the phases already planned (the dock, runbooks, a wider registry), so
they can be done without deciding anything here.

Questions if this is taken up:
- First consumer: outside Claude clients, an assistant in the dock, or both.
- First scope: read-only (catalogue, status, course progress), or draft writes.
