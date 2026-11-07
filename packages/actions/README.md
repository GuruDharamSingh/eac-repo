# @elkdonis/actions

The platform's action registry (2026-11-06): named entries for things a person or an
org's owner can do or have on the network, independent of the page that offers them.
A course step (`task` type in `@elkdonis/lms`), a future dock or a hub checklist names
an entry by id. Design and phases: `docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md`.

## Current state (2026-11-06)

| Subpath | Holds | Client-safe |
|---|---|---|
| `.` | types, `ACTION_CATALOGUE`, `actionMeta`, `actionParams` | yes |
| `./catalogue` | the catalogue alone (no dependencies) | yes |
| `./present` | `presentAction`: surface (with a fallback link), link, run button, form, frame, popup, or nothing | yes (type import of `@elkdonis/cms-ui/surface`) |
| `./server` | `actionStatus`, `actionStatuses`, `performAction`, `actionInputSchema`, `RUNNABLE_IDS`, `resolveActionOrg`/`actionOrgId`, `actionJsonSchema`, `actionRoutes` | no: database and services |

- Sixteen entries, the getting-started course's tasks, moved from
  `packages/services/src/onboarding-tasks.ts` (removed) and
  `apps/arts-collective/src/components/learn/TaskBox.tsx` with ids, queries and wording
  unchanged.
- Seventeen entries since phase 2 (2026-11-06): the sixteen plus `org-publish`, the first
  content entry, with one param (`kind`: article, event, meeting) that the step stores in
  `settings.task.params` and `actionParams` restricts to the declared options.
- Eight are performable through `performAction` (`RUNNERS`, `src/server/run.ts`; `org-publish` below):
  - `gain-space`, `store`, `org` (phase 1, the hosts' former journey actions);
  - `org-email` (zod input `fromName`/`replyTo`, owners and guides of the host-resolved org,
    `@elkdonis/email` `saveOrgEmailIdentity`; leaves the reply-to alone while inbound replies
    are on);
  - since the registry pass (2026-11-06): `profile` (`displayName`, `headline`, `bio`;
    `updateProfile`, caps 120/200/4000 as in `/api/center/profile`), `listing` (`listed`
    boolean; `setPresence` "you"/"directory"; refuses `true` without a page address), and
    `org-details` (`headline`, `bio` on the org's identity row, `organizations.profile_user_id`;
    owners and guides only, no network-admin bypass). Text fields: absent is untouched, an empty
    string clears. Photos, the org's name and image stay with their surfaces.
  The rest are performed by the surfaces their presentation opens. Adding a runner does not
  change what a lesson shows: `presentAction` decides that.
- `org-publish` (registry pass, 2026-11-06): a draft post only (`title`, optional plain `text`;
  `createThread` with `status: 'draft'`, owners and guides). Catalogue `performs` describes what
  a runner does when that is less than the label.
- Post entries (scope `thread`, 2026-11-06): `thread-edit`, `thread-publish`, `thread-pin` act
  on one post named by `subjectId`; `performAction` loads it and takes its org. Publishing,
  pinning and editing a published post only through a host's own door (`via` 'app').
  Routes take the post as `?subject=` (status) and `subject` in the POST body; `runAction` as
  `opts.subject`. Migration 246 (`action_events.subject_id`, applied 2026-11-06) records it.
  `COURSE_ACTIONS` is the catalogue without them (what a course step can name).
- Refusal codes: `ActionResult` failures from `performAction` itself carry `code` ('auth',
  'unknown', 'input', 'forbidden', 'failed'); a refusal without a code is the entry's own.
- Input refusals: a refine's message is returned when every issue is a refine; a too-long string
  is named (`The headline field is longer than 200 characters.`); other zod defaults become
  "That request was not complete." Runner schemas use `zod/v4` (inside zod 3.25), so
  `actionInputSchema(id)` converts with `z.toJSONSchema`.
- Audit (2026-11-06; migration 245 applied and live on arts-collective the same day): every
  `performAction` call with an actor writes one `action_events` row (migration 245: entry, actor, org, `via`, input up to 4000 characters of JSON, outcome,
  duration), refusals included. Best effort: a failed insert is logged and the result stands;
  while the table is missing, inserts pause for ten minutes at a time. Append-only by trigger;
  no foreign keys (the record outlives the user or org); `eac_tenant` has no access.
- `check:registry` (`scripts/check-registry.mts`): catalogue `runnable`/`derived` against
  `RUNNERS`/`CHECKS`, param defaults and duplicates; exits 1 on a mismatch. Run in a container:
  `pnpm --filter @elkdonis/actions check:registry` (tsx comes from `@elkdonis/lms`).
- `profile`, `listing` and `org-details` statuses carry `values` (the current fields).
- HTTP (`src/server/routes.ts`, 2026-11-06): `actionRoutes({ who, links, publicOrigin? })`
  returns `catalogue.GET` (public: entries, `runnable` from `RUNNABLE_IDS`, `input` JSON Schema)
  and `entry.GET` (status, `?org=` claim, other keys as params) / `entry.POST` (body
  `{ input?, org? }`; route guards 404, 405, 415, 403 foreign `Origin`, 401, 429 over the
  per-person window (`rateLimit`, default 30 per 60 s, in memory per process), 413 past 64 KiB
  read from the stream, 400; then 200 ok, or by `code`: auth 401, unknown 404, input 400,
  forbidden 403, failed 500, and 422 when the entry itself refused).
  Mounted on arts-collective at `/api/actions` and `/api/actions/<id>`
  (`apps/arts-collective/src/lib/actions/routes.ts`). Same-origin only: no CORS headers.
- Org rule: `resolveActionOrg(userId, requested)` (`src/server/org.ts`), used by arts-collective's
  `runAction`, the routes and the lesson's `orgFor`.
- Presentations since phase 2: `studio` is a `frame` (the Studio over the lesson),
  `cloud` a `popup` (Nextcloud cannot be framed), `org-offering` and `org-publish` the
  `compose` surface for the learner's org, `org-email` a `form` in the step.
- Consumers: arts-collective `/learn` (`src/lib/lms/connectors.tsx`, `TaskBox.tsx`,
  `src/lib/actions/run.ts`, `src/lib/cms/journey-actions.ts`); Sophia's studio step
  editor lists the catalogue through `LmsConnectors.taskCatalogue`.

## Rules

- Never rename an id: published course versions store it and are immutable. Retire an
  entry and add another.
- Resolve the actor in the host from `getServerSession()` and pass it to
  `performAction` (or `actionRoutes`' `who`); never read it from input, because `runAction`
  and the routes are one endpoint for every entry.
- Resolve an org-scoped entry's org with `resolveActionOrg`, not a host's own rule, so the
  lesson, the server action and the routes agree.
- Keep the POST route's guards (JSON content type, `Origin` equal to the public origin, no
  CORS headers): the session is a cookie.
- Keep `./catalogue`, `./present` and `.` free of database and services imports: Sophia's
  studio and client components import them.
- When an entry gains a runner in `src/server/run.ts`, set `runnable` in
  `src/catalogue.ts`; when it gains or loses a check in `src/server/status.ts`, set
  `derived`; then run `check:registry`, which fails on a mismatch.
- A runner calls the service that already writes those fields, not its own `UPDATE`: the
  service holds the rules (slug redirects, presence states, merge semantics).
- An org-scoped runner checks the role itself (`orgEditor`: owners and guides), with no
  network-admin bypass: the actor may be an agent acting for a person.

## Adding an entry

1. `src/catalogue.ts`: id, label, describe, scope, area.
2. `src/server/status.ts`: a check in `CHECKS`, if completion can be read from tables.
3. `src/present.ts`: a case in `presentAction`.
4. `src/server/run.ts`: a runner with a `zod/v4` `input`, if a host should perform it directly.
   An org-scoped runner checks the role itself (`orgEditor`); the host only resolves the org.
   Set `runnable` and run `check:registry`.
5. A choice the author makes: `params` on the catalogue entry (closed option lists); read
   them with `actionParams(id, raw)` in the check and the presentation.

## Open items

- Cross-origin callers (a dock on an org's own domain): CORS with an allow-list and a token or
  SSO handoff instead of the cookie.

- More content entries: edit an existing thread, pin (needs an entry with a subject), page
  design (Puck editor is a route: a `frame`), workshops (a route), services on an org.
- Subject scopes (`series`, `auction`) for runbooks (phase 4).
