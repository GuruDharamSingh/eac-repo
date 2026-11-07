# Onboarding as a course: Sophia inside arts-collective (brief, 2026-10-29)

Covers the developer's direction of 2026-10-29: the platform is a learning curve, and the
first course on it walks a new person from sign-in to a profile, a page, an offering, a
store and (optionally) their own organisation with a subdomain site, with the platform's
own actions embedded in the lessons rather than linked from a checklist. This brief records
what exists (verified by code read on 2026-10-29), the proposed design, the gaps in the
sign-up → org page flow that the course exposes, and the decisions still open. No code
has been written.

Related: `docs/reference/workshops-and-lms.md` (Sophia), `lms/SYNTHESIS.md` (LMS rules),
`lms/ORG_SITES.md` (parked note on mounting courses on org sites, 2026-10-16),
`docs/open/CENTER_JOURNEYS_2026-10-18.md` (journeys), `docs/open/BRIEF_E_HUB_TOUR_2026-09-18.md`
(the unbuilt first-steps checklist), `docs/open/ARTIST_FUNNEL_BRIEF_2026-09-27.md`.

## 1. What exists

### Sophia (the LMS)

- Packages `@elkdonis/lms` (services) and `@elkdonis/lms-ui` (server components, plain
  CSS on `so-` classes, no client JS), host `apps/sophia` on port 3020. **The container is
  running** (`eac-sophia`, up since 2026-10-28); the reference doc's "stopped" note is
  stale. `localhost:3020` answers; `sophia.arts-collective.com` has no proxy host (edge 404).
- `apps/sophia` and `packages/lms*` carry uncommitted edits by another developer
  (files owned by uid `stephan`, last touched 2026-10-24: `apps/sophia/src/app/inner`,
  `packages/lms/src/delivery.ts`, `record.ts`, `lms-ui/src/pages.tsx`, `parts.tsx`,
  `studio.tsx`). Work here must be additive and must not rewrite those files.
- Content model: course → published version → modules → steps. A step is sanitised HTML
  (`bodyHtml`; forms, buttons, inputs and `<eac-embed>` are stripped), `settings` (open
  JSONB), `refs` (thread, media, links). Step types are a registry
  (`packages/lms/src/step-types.ts`): `reading`, `practice`, `reflection`, `session`,
  `thread`, `resource`. Two completion modes only: `manual` (a button) and `response`
  (a saved reflection). `registerStepType` exists and has no caller. `StepBody`
  (`lms-ui/src/steps/StepBody.tsx`) renders every type the same way; there is no
  per-type renderer and nothing checks external state.
- Host seam: `LmsConnectors` (`lms-ui/src/connectors.ts`): viewer, hrefs, `actionBase`,
  `mediaUrl`, and optional host-injected pieces. The `editor` connector is the precedent
  for a host-supplied client component rendered inside a server page.
- Actions are plain form posts to `/api/lms/[action]` answered with 303 redirects
  (`lms-ui/src/actions.ts`); the action set is closed. The studio's step save rebuilds
  `settings` from four known keys and drops any other (`actions.ts:367-372`).
- Delivery: every published course has a default `open` run; a signed-in person enrols by
  pressing "Begin" (`enrol`, free entitlement for public/unlisted courses). Progress is
  `lms_step_state` keyed `(enrolment, step)`; `markComplete` derives course completion
  and awards.
- Tenancy: `lms_courses.org_id` is required and slugs are global. Courses exist under
  `elkdonis` (the network's own org, slug `arts-collective`), `hidden-enneagram`, `saw`,
  `inner_group`. Only `apps/sophia` mounts the packages; arts-collective's only
  touchpoint is `sophiaLive()` and an external link on the hub tab.
- `lms/ORG_SITES.md` (parked, 2026-10-16) proposes exactly the mounting mechanism needed
  here: a `renderLmsRoute({ connectors, segments, searchParams })` like
  `renderForumRoute`, host-following tokens on `--so-*`, and a canonical home per course.
  None of it is built.

### arts-collective: sign-up to org page today

- Sign-up is `/login?mode=signup`; the routes pass no `defaultOrgs`, so every new account
  joins `inner_group` as `viewer`. Sign-up lands on `/hub/arts-collective`; sign-in on
  `/hub`, which sends org editors to `/hub/organization` and everyone else to `/hub/network`.
- `/hub/arts-collective` (uncommitted rename of the `elkdonis` tab, 2026-10-28): masthead,
  feedback box, "Welcome back" card (profile and business status, memberships including the
  `inner_group · viewer` row), a "Wizards" rail of links (`/wizard`, `/wizard/business`,
  org console, email suite, agreements, quotes, wiki, Inner Temple, account) and an
  "Elkdonis Course" section linking to Sophia when it answers. No checklist exists
  (Brief E's `FirstStepsFace` was never built).
- Because a new account already holds a membership, `/hub/organization` shows the
  Inner Group member console instead of the tier cards; "start an org" is reachable only
  through `?new=1` or `/pricing`.
- Org creation: `SetupForm` asks for a subdomain only and posts `/api/org/create` with
  `title = subdomain` → `createOrganizationForUser` (`packages/services/src/org-create.ts`):
  `organizations` row (`subdomain_confirmed = false`), owner row, `artist_profiles`,
  an organisation identity `users` row, best-effort Nextcloud folder. No `org_feeds`,
  no `org_profiles` for the owner, no proxy host or certificate (operator step,
  `docs/reference/ops.md` "Launch an org site on a subdomain"). An admin confirms the
  org at `/hub/admin`; until then visitors see "being set up" on `/` and `/offering`.
- The org site (`sites/[slug]`): `/` is `OfferingPage`, i.e. the pinned thread or the
  newest published public thread, else an empty state ("Nothing published yet"); `/profile`
  is the identity page (name, headline, avatar, bio, links, members, feed); `/community` is
  the network newsroom; `/center` the follower home. `layout_mode = 'silex'` replaces `/`
  with a Silex page (one org uses it). **There is no Puck page for an org's landing on
  arts-collective** and no route reads the `site_config` `puck:` store there, although the
  store is org-keyed and sunjay, innergathering, danamccool and art-auction use it.
- Pinning has no UI on arts-collective (`PinToggle` is never mounted); the only pin path is
  forum moderation.
- Owner editing today: hub Settings → Identity (name, headline, bio, logo, place), People,
  Appearance (CSS variables), Silex controls; email identity via `/email?org=`.
  `organizations.description` and the slug have no writer.
- The Center's `/api/center/profile?org=` returns 404 on arts-collective (ifac serves it),
  so the shared org Details form cannot load there.
- Journey connectors (`journey`, `artwork`, `services`, `orgPeople`, `profilePage`/payouts)
  are wired on ifac and innergathering only. arts-collective wires `profile`, `presence`,
  `listings`, `postTo`, `connections`.

### Platform actions a lesson can drive (service, UI, "done" state)

| Action | Server function | Existing UI | Done when |
|---|---|---|---|
| Profile (name, photo, headline, bio, links) | `updateProfile`, `getProfileDetails`/`saveProfileDetails` (`services/center.ts`) | `ProfileSurface`, journey `ProfilePanel` → `IdentityForm` | `users.display_name`, `avatar_url`, `headline` set |
| Gain a space (artist of the collective) | `gainSpace` (`services/artist-space.ts`) | `/wizard` calls it on open; `GainSpaceBand` | `user_organizations(oad)` role ≠ viewer; `users.directory_listed` |
| ArtDirect page listed | `markArtist`, `setPresence` | "Where you show" | `users.directory_listed = true` |
| Write and publish a piece | `startStudioPiece`/`saveStudioPiece` (arts-collective `lib/studio-actions.ts`) → `createWritingPost` | `/studio` | `threads(kind='writing', author_id)` with `status='published'` |
| Show a piece on an org | `setThreadListings` | Studio "Show on", profile popup listings | `thread_orgs` row |
| Cloud storage linked | innergathering `/api/oidc/*` on "Sign in with Elkdonis" | link to Nextcloud | `users.nextcloud_user_id` set |
| Offer a service | `saveOffering` (`services/artist-offerings.ts`) → `upsertServiceOffering` | journey `OfferTab`, ArtDirect `ManageSpace` | `threads(kind='service', org_id='oad', author_id)` published |
| Open a store on the market | `publishStoreForAuction` / `applyForStore` (`commerce/server/journeys.ts`) | journey `SellingPanel` step 2 | `store.status='active'` (`owner_user_id`, `org_id='market'`) |
| Publish an artwork | `createArtwork`, `publishArtwork` | `ArtworkSurface` | `artwork.status IN ('available','sold')` |
| Connect Stripe (people only) | `startPayoutsFor` (`checkout/server/stripe.ts`), `refreshStripeAccountStatus` on return | `PayoutBlock`, `SellingPanel` step 3 | `users.stripe_account_id` (pending) → `stripe_onboarded_at` (ready) |
| Create an organisation | `checkSubdomain`, `createOrganizationForUser` | journey `SitePanel`; `SetupForm` | `user_organizations.role='owner'`; admin confirm → `subdomain_confirmed` |
| Org details | `updateProfile` on `organizations.profile_user_id`; `canEditOrgIdentity` | `OrgPanel` Details, hub Settings → Identity | identity row has headline, bio, avatar |
| Org people | `listOrgPeople`, `setOrgPersonRole` (`services/org-people.ts`) | `OrgPanel` People | a second non-viewer row |
| Org email identity | `saveOrgEmailIdentity` (`packages/email/identity.ts`) | email suite Look tab | `site_config['email:identity']` has `fromName`/`replyTo` |
| First offering on the org site | compose/`createThreadAction`; pin via `togglePinAction` (unmounted) | console compose | `getOfferingThread(org)` not null |
| Connect YouTube | `beginConnectionAuth` (`services/connections.ts`) | `ConnectionsPanel` (arts-collective only) | `user_connections.status='connected'` |

Not available: a mailbox or forwarder for `name@<org>.arts-collective.com`. Nothing in the
code creates mailboxes or forwarders; the org's own domain reaches the inbox only through a
manual cPanel forwarder, and the cPanel API account holds read access only (memory
`cpanel_dns_api`). An org's **sending** identity (from-name, reply-to) is the part that exists.
Organisations never get a Stripe account (`commerce/server/index.ts:776-780`); payouts are
per person, and the Stripe keys are live, so the Connect step can be built but not
exercised end to end without creating real Stripe objects.

## 2. Proposed design

### 2.1 One new step type: `task`

Add a `task` step type to the registry with a third completion mode, `derived`:

- `settings.task = { id: <task id>, scope?: 'person' | 'org' }`. Task ids are the rows of
  the table above (`profile`, `gain-space`, `listing`, `studio`, `cloud`, `service`,
  `store`, `artwork`, `payouts`, `org`, `org-details`, `org-people`, `org-email`,
  `org-offering`, `org-site`).
- Completion is read from platform state, never pressed: the host supplies
  `connectors.tasks.status(taskId, viewer, { orgId }) → { done, partial?, detail }`.
  When the step page renders and the task reports done, the step is marked complete
  (`lms_step_state` through the existing `markComplete`, event verb `derived`), so the
  outline, "Continue" and course completion work unchanged. A `derived` step keeps no
  "Done" button; a learner who did the thing elsewhere (Center, hub) finds the step ticked
  when they come back.
- Rendering: `StepBody` gains one branch. For a `task` step it renders the lesson text as
  usual, then a task box from `connectors.tasks.render(taskId, state)`: a host-injected
  client component (the `editor` precedent) that shows the current state and offers the
  action in place. On arts-collective the box opens the matching **surface** (journey
  panel, profile surface, artwork surface) as a centred dialog through the existing
  `SurfaceProvider`, which follows the css-ui rule (no new dialog primitive) and reuses the
  panels built for `/center`. The panel's `onMutated` refreshes the step page, which
  re-derives the status.
- The studio's step save is changed to preserve unknown `settings` keys so an author
  editing the lesson text in Sophia does not drop `settings.task`.
- Org-scoped tasks resolve their org from the learner's owned org (`getOwnedOrgId`), with
  `?org=` as an override for people who own more than one.

Everything else in the LMS stays as it is: modules, unlock rules, reflections, the guide,
the event log, versions.

### 2.2 Mount the LMS inside arts-collective

Build the `renderLmsRoute` from `lms/ORG_SITES.md` (course list, course, step, journal)
and mount it in arts-collective at `/learn/[[...segments]]` with `/api/lms/[action]`,
a connectors file (`viewer` from `getServerSession` + `getViewerRoles`, hrefs under
`/learn`, `mediaUrl` = the app's media proxy, `actionBase = /api/lms`). Import
`@elkdonis/lms-ui/lms.css`; the hub's newsroom look and `lms.css`'s newsroom palette are
the same family, so the token work in ORG_SITES step 1 can wait. Sophia stays the authoring
studio and the home of the Elkdonis Path; the onboarding course's canonical home is
arts-collective (Sophia's copy sets `rel=canonical` there, ORG_SITES step 4).

The alternative, keeping the course on `sophia.arts-collective.com` and linking out, cannot
embed the actions: the panels need the network host's session and server actions, and the
Sophia host has none of the commerce, profile or org connectors.

### 2.3 The course

Org `elkdonis`, slug `getting-started`, visibility `public` (readable signed out; sign-in is
asked when the first task needs it), default open run, auto-enrol on first open when signed
in. Seeded from `packages/lms/scripts/seed-getting-started.mts` (uses `seed-lib.mts`), so the
outline lives in code and can be re-run. Voice per Brief E: one line on why (artist
sovereignty, open source, not-for-profit, your work and files stay yours), then the steps;
no platform jargon.

| Module | Steps (type) |
|---|---|
| 1 Arrive | What this is (reading) · Your name and face (task `profile`) · Take your space (task `gain-space`: folder, directory listing) · What do you make? (reflection, optional) |
| 2 Your page | Your page in the directory (task `listing`) · Write your first piece (task `studio`) · Show it where you belong (task `show-on`, optional) · Your files (task `cloud`, optional) |
| 3 Offer and earn | Offer a service (task `service`) · Open a store on the market (task `store`) · Put up a work (task `artwork`) · Get paid (task `payouts`) |
| 4 Your own collective (open unlock, optional) | Name it and give it an address (task `org`) · Say what it is for (task `org-details`) · Your first offering on your site (task `org-offering`) · Who is in it (task `org-people`) · Mail from your collective (task `org-email`) · Going live (task `org-site`: states "being set up" vs live; the operator step is explained, nothing to press) |
| 5 Go deeper | Introduce yourself (thread: a forum topic in the `elkdonis` feed) · The weekly gathering (session: the standing meeting thread) · The Elkdonis Path (resource: link to Sophia) |

Completion of modules 1–3 completes the course and awards an achievement
(`lms_achievements`, criteria `course_completed`); module 4 is optional.

### 2.4 The sign-up → org page gaps the course exposes

These are platform changes, not course content; the course only makes them visible.

1. **arts-collective lacks the journey connectors.** Port ifac's host actions
   (`journey-actions.ts`, `artwork-actions.ts`, `own-service-actions.ts`,
   `org-people-actions.ts`, `payout-actions.ts`; about 150 lines each, already
   multi-tenant through `org_id`) into `apps/arts-collective/src/lib/cms/`, and fix
   `/api/center/profile?org=` (resolve the org identity through
   `organizations.profile_user_id` as ifac does). This also completes the `/center`
   journeys on every arts-collective subdomain (open item 8 of the journeys doc).
2. **A default org page.** When an org has nothing pinned, `/` should still be a page:
   identity (name, headline, logo, statement), the offering card if one exists, people,
   recent posts, links. Today it is "Nothing published yet". Plus a pin control in the
   console compose/list so an owner chooses what leads.
3. **An editing surface for the org page.** Two candidates, see decision A.
4. **Org creation collects only a subdomain** and names the org after it. The `site`
   journey already asks name + address; use it (via 1) and retire `SetupForm`'s single
   field, or extend it.
5. **New accounts join `inner_group` as viewers**, which hides the "start an org" cards and
   labels every new person a viewer of the core group. See decision B.
6. **Email.** Only the sending identity can be set. The lesson says so and stops there.
7. **Stripe** is per person and live-keyed. The lesson's return path is the step URL with
   `?payouts=done`, and the step route calls `refreshStripeAccountStatus`, as the Center does.

### 2.5 Hub integration

On `/hub/arts-collective`, replace the "Wizards" rail and the "Elkdonis Course" section with
one course card: title, progress (`doneRequired/totalRequired` from `getLearnerOutline`),
"Continue" to `continueStep`. The task-status service (`packages/services/src/onboarding-tasks.ts`,
the derivations of the table above) is shared, so the same card can later stand in for Brief
E's checklist on ifac and innergathering without a second set of rules.

## 3. Build order

| Phase | Work | Touches |
|---|---|---|
| 1 | `task` type, `derived` completion, `tasks` connector, `StepBody` branch, studio save keeps unknown settings keys, `renderLmsRoute`, `verifyTaskSteps` | `packages/lms` (step-types, types, new `tasks.ts`), `packages/lms-ui` (connectors, StepBody, actions, new `route.tsx`); additive only, around the other developer's edits |
| 2 | `/learn` mount in arts-collective: route, action route, connectors, CSS, surface provider on step pages; task-status service; host actions ported from ifac; `/api/center/profile?org=` fix | `apps/arts-collective`, `packages/services/src/onboarding-tasks.ts` |
| 3 | Seed script and course text; achievement row | `packages/lms/scripts` |
| 4 | Default org page + pin control; org page editor (per decision A); org creation with name | `apps/arts-collective` sites/console |
| 5 | Hub course card; post-sign-up landing (per decision B); `lms/ORG_SITES.md` updated | `apps/arts-collective` hub |

Verification: arts-collective runs in production mode, so a change is tested in a one-off
dev container on a spare port (`docker compose run` preview, the `ig-preview` precedent in
ops.md) with a throwaway account that is removed afterwards; store, artwork and org creation
write live rows and are cleaned up in the same session; Stripe Connect is not exercised.
The production rebuild ships the whole uncommitted tree (527 files on 2026-10-29) and is
a separate, announced step.

## 4. Decisions (developer, 2026-10-29)

Taken the same day, in the order asked: A (i) Puck + default page; B no default org and
land on the course; C `arts-collective.com/learn`; D phases 1–3 in this pass, phase 4–5 as
their own pass. The questions as put:

A. **Org page editor.** (i) Puck for an org's landing on its subdomain: `site_config`
   `puck:home` rendered by `sites/[slug]/page.tsx` when published (sunjay's hybrid pattern),
   editor at `/hub/sites/<slug>/design`, starting from a template built from the identity.
   This reverses the 2026-09-26 decision "Puck only on ArtDirect, not on org sites".
   (ii) No page editor: the default page of 2.4(2) plus pin, theme and Silex as today.
   The developer's message of 2026-10-29 names Puck; confirm the reversal.
   2026-10-30: built as (i); the reversal is recorded in
   `docs/reference/authoring.md` ("Person pages on ArtDirect") and `apps.md`.
B. **Sign-up default.** Keep `inner_group · viewer` for arts-collective sign-ups, or pass
   no default org (the course's first task gives them `oad`), and land new sign-ups on the
   course (`/learn/getting-started`) instead of the hub tab.
C. **Course home.** Mount at `arts-collective.com/learn` (recommended; needed for embedding)
   or elsewhere (`/hub/learn`, `/path`).
D. **Scope of this pass.** Phases 1–3 (the course works end to end for a person: profile,
   page, services, store, payouts) before phase 4 (org page), or all five.

## 5. Status (2026-10-30)

Phases 1–3 built and verified in a one-off dev-mode preview of arts-collective
(`docker compose run … -p 127.0.0.1:3107:3007 -v <scratch>/.next:/app/apps/arts-collective/.next`,
see `docs/reference/testing.md`). **Deployed 2026-10-30** (developer's go-ahead): `.next` backed up to
`~/eac-backups/next/arts-collective-20261030-*.tgz`, built inside `eac-arts-network`, restarted;
through the edge `/`, `/learn`, `/learn/getting-started` and a task step answer 200 with the task box
markup, `/hub` 307. The build shipped the whole uncommitted tree of that moment.

- Phase 1 (`packages/lms`, `packages/lms-ui`): `task` type with completion mode `derived`
  (`step-types.ts`), `StepTask`/`TaskStatus` (`types.ts`), `tasks.ts` (`stepTask`, `settleTaskStep`),
  `LmsConnectors.tasks` (`status`, `orgFor`, `render`), the task box in `steps/StepBody.tsx`
  (`StepBody` is now async and takes `enrolled`/`here`/`orgId`; one-line change in `pages.tsx`),
  `route.tsx` (`renderLmsRoute`, `lmsRouteMetadata`), the studio save keeps settings keys it does not
  edit (`actions.ts` `keepSettings`), `.so-task*` in `lms.css`. Type-checked in `eac-sophia`.
- Phase 2 (`packages/services/src/onboarding-tasks.ts`; arts-collective): `/learn/[[...segments]]`,
  `/api/lms/[action]`, `lib/lms/connectors.tsx` (viewer, hrefs, cached task status, org resolution),
  `components/learn/{TaskBox,LearnHost}.tsx`, host actions ported from ifac into `lib/cms/`
  (`journey-actions` with `gainSpaceAction`, `artwork-actions`, `own-service-actions`,
  `org-people-actions` per-org gate, `payout-actions` with the return path from the Referer),
  `/api/center/profile?org=` serves any org's identity row, sign-up passes `defaultOrgs: []` and lands on
  `/learn/getting-started`, `learn` in the middleware passthrough and the reserved slugs, `@elkdonis/lms`
  and `lms-ui` added to the app's dependencies and `transpilePackages` (lockfile changed by the install
  container). Type-checked in `eac-arts-network`.
- Phase 3: `packages/lms/scripts/seed-getting-started.mts` (org `elkdonis`, slug `getting-started`,
  public, 5 modules / 21 steps, achievement "Settled in"; guide = the developer's account). Seeded on
  the live database, published v2.
- Verified (throwaway password account, removed afterwards): signed-out course and step pages render
  inside the network shell; opening the course signed in enrols (`lms_enrolments` active, run `open`);
  a task step shows the box with its state ("Begun · Still missing a photo, a line about what you do");
  `PATCH /api/center/profile` with a headline and photo, then reloading the step, recorded
  `lms_step_state = completed` and `lms_events` `completed/step`, and the page offered
  "Continue — Take your space"; pressing "Offer a service" opened the directory journey dialog in
  place with the profile step ticked (CDP screenshot); `/learn`, `/learn/journal`, `/learn/care` answer;
  `GET /api/center/profile?org=elkdonis` returns the organisation row.
- Not exercised: gain-space, org creation, store, artwork, services and Stripe through the dialogs
  (each writes live rows or Stripe objects); the Sophia-side rendering of a task step (it reads
  "this site cannot do it from here", since Sophia has no `tasks` connector); phone width.
- Phase 5 (2026-10-30, **deployed** the same day in a second rebuild, with phase 4; `.next` backup `arts-collective-20261030-0109.tgz`; edge checks: `/`, `/learn/getting-started`, `/sites/bonpo` 200, `/hub/*` 307 signed out): `components/hub/CourseCard.tsx` replaces the
  hub tab's "Elkdonis Course" section with the getting-started course's state (modules with done counts,
  a progress bar, "Begin" / "Continue — <step>" / "Back to the course", the Elkdonis Path link while
  Sophia answers); the "Artist Profile" wizard card is gone from the rail (the course's first module) and
  the welcome card's profile button is now "Getting started". `.ekh-progress` and the done-module disc
  (#0a1324 on #dcb65c, 10.4:1) in `elkdonis-hub.css`. Type-checked in a dev preview (the live container's
  `tsc` fails on stale generated route types in `.next/dev/types`, not on code); rendered signed in with a
  throwaway account (removed): "Your way in", 0/3 · 0/2 · 0/4 · optional · optional, Begin. The phase-4
  session's org-page work is in the tree too, so the next rebuild ships both.
- Known gaps: arts-collective's container has no `NEXT_PUBLIC_FORUM_URL` (the connectors use the hub's
  `forumBase()`); `NEXT_PUBLIC_SOPHIA_URL` points at `sophia.elkdonis-arts.org`, which has no proxy host,
  so studio links from `/learn` do not resolve yet; the course index column sits left of the lesson
  under the network shell (Sophia draws it right); Sophia's catalogue lists the course too, with no
  `rel=canonical` to arts-collective (ORG_SITES step 4 still unbuilt); the hub's "Wizards" rail and
  "Elkdonis Course" section are unchanged (phase 5).

### Phase 4 (2026-10-30; deployed the same day in the second arts-collective build, verified through the edge)

Built in `apps/arts-collective` and verified in a one-off dev-mode preview (port 3107, throwaway
org `phase4-test` and password account, both removed afterwards; `pnpm check-types` clean in the
container with `NODE_OPTIONS=--max-old-space-size=3584`):

- Default landing: `sites/[slug]/page.tsx` → `components/sites/OrgDefaultPage.tsx` when nothing is
  pinned or published (identity header, statement, offering card when passed, what's on, people,
  links; editors get a band with "Go to your hub" and "Design this page"). The `subdomain_confirmed`
  gate stays on every branch. Verified: Bonpo as a visitor (screenshot), the throwaway org as owner.
- Pin: `PinToggle`/`togglePinAction` mounted on the console's "N published" list (`PublishedSurface`,
  surface key `console-published`, rows from `ConsoleState.published.recent`), as a `threadActions`
  entry on the thread popup (`extra.pinned` from `/api/org/[slug]/threads/[id]`), and as
  `ThreadEditorBar` above a thread on the site. Verified: pinning from the console surface set
  `threads.pinned` and the root led with the pinned post.
- Puck page: `src/lib/puck/` (store, data loader, server/editor configs, identity template, actions,
  render), blocks `ac-offering` and `ac-people`, route `/api/org/[slug]/blocks/[block]`, editor
  `/hub/sites/[slug]/design`, Settings → Site & address "Landing page" controls (design, remove).
  `/api/upload/image` also reads `orgSlug`/`context` from the query string for the editor's picker.
  Dependencies `@elkdonis/blocks`, `@elkdonis/page-builder`, `@puckeditor/core` added and installed;
  `blocks.css` imported in `globals.css` (served chunk verified). Verified: editor opens on the
  identity template with live rows, Publish stored `puck:home` (7 blocks, resolver props stripped),
  the root rendered it with the site chrome, "Use the default page instead" removed it.
- `SetupForm` asks for a name; the address follows it until edited (screenshot).
- `TaskBox` `org-offering` hint mentions the page editor.
- Not done: phase 5 (hub course card, `lms/ORG_SITES.md`).

## 6. Open questions

- Should the proxy host for `sophia.arts-collective.com` be added now so "Edit in Sophia"
  and the Elkdonis Path link work for the guide? Operator step (`scripts/add-proxy-host.sh`).
- Does the subdomain confirmation gate stay for free orgs created from the course (the
  artist funnel brief's decision 8 said free orgs go live without confirmation; the code still
  gates)?
- Whether `writing` pieces should be able to lead an org site (`OFF_FEED_KINDS` keeps them
  off `/offering`), or whether "first offering" means a post, event or service only.

## 7. Follow-on (2026-11-06)

The developer chose to grow task steps into an action layer (registry, in-lesson actions, a
dock across sites, runbooks per subject): `docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md`.
