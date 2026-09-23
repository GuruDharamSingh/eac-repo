# Elkdonis LMS — synthesis and guidance (2026-09-18)

Distilled from `research/01–04` and three owner decisions. This is the working guidance until it is
replaced; the research files hold the evidence and sources.

## Decisions taken (2026-09-18)

| Area | Decision |
|---|---|
| Business | **Flagship first.** One Elkdonis course, public and free (dana welcome), run live as a cohort of 12–20; then 3–5 invited founding teachers. No self-serve teacher signup, no Stripe Connect, no subscriptions in year one. |
| Design | **Quiet practice companion** is the default experience. **Community classroom** is a second *mode* of the same course, sketched now, built second. Pages must be **SEO-first** because the first course is public. |
| Structure | **LMS-owned, versioned content** in a new package family. Steps *reference* threads/questionnaires/Talk rooms. A cohort run **is** a workshop thread. Multi-session workshops become one-module courses; single-session workshops stay as they are. |

### Added 2026-09-18 (later the same day)
- **Name and home:** the platform is **Sophia**, at `sophia.arts-collective.com` (`apps/sophia`, port 3020).
- **First guide/admin:** Jason (Rev Dr suNjye Fnord, `fnordj@gmail.com`). The guide is *present*, but close watching of each learner is **not** required — acknowledgement is available, never a gate on progress.
- **Steps may point at what already exists on the network:** standing meetings/events (`session` step → a thread with a schedule and Talk room) and forum threads (`thread` step). The flagship will grow over time and may get its own campaign/progression later.
- **Both modes are built now:** quiet practice companion (run mode `open`) and community classroom (`cohort`/`circle`).
- **SendGrid delivers** (confirmed by the user) — operational course email is in scope.
- Built as two packages for now: `@elkdonis/lms` (services, unlock engine, step-type definitions) and `@elkdonis/lms-ui` (pages + step renderers under `src/steps/`, to split into `lms-steps` when a third party needs to add a type).

## Built so far (2026-09-18) — Phases 0–2, first pass

| Piece | Where |
|---|---|
| Schema: content / delivery / record (+ run conversations) | migrations `140`–`143` (applied) |
| Services, unlock engine, step-type registry, JSON-LD, refs to threads | `packages/lms` (`pnpm test:unlock`, 17 assertions) |
| Pages (catalogue, course, step, journal, guide desk, care) + form-action handler; **no client JS** | `packages/lms-ui` |
| Host | `apps/sophia`, compose service `sophia`, port **3020** |
| Flagship scaffold | `packages/lms/scripts/seed-elkdonis-path.mts` → `/elkdonis-path`, **unlisted** (noindex, off sitemap) until the guide flips it to `public` |

Verified end to end through the real form posts and services: sign-in redirect, begin, sequential gate, complete, reflection completes its step, private/guide/circle visibility (a `me` entry never reaches the guide, org staff, the circle or the public HTML), guide acknowledgement + unseen dot, derived course completion + award, wording-fix publish fast-forwards a run while a structural publish leaves it pinned until adopted, append-only event log refuses deletes, unlisted ⇒ `noindex` + no JSON-LD + not in sitemap, public ⇒ `Course`/`CourseInstance`/`LearningResource`/breadcrumb JSON-LD + canonical + sitemap.

**Added later the same day:** the **studio** (`/studio` — start a course, outline with modules/steps/reorder, step editor with the shared rich-text editor and a no-JS textarea fallback, "when it opens" rules, a publish panel that says what would change, groups: open/edit a run, add a guide by email); **RSVPs → enrolments** for a run tied to a gathering (`syncWorkshopEnrolments`, one button, idempotent, never removes anyone); a **test course** `/sophia-test-course` (private to the `elkdonis` org + stewards: every step type, every unlock rule, audio with transcript, an unregistered type, open/drip/cohort runs) — `pnpm --filter @elkdonis/lms seed:test`. Seeds share `scripts/seed-lib.mts`.

**Third pass, same day:**
- **Upload** in the step editor, on the network's shared paths: `validateUploadBuffer` (content-sniffed, size-capped; text only when *named* .txt/.md) → `uploadOrgFile` → served by Sophia's own `/api/media/[...path]` = services' `serveMedia` (authorised per file, ranged, `?w=` thumbnails). Media no longer borrows ArtDirect's proxy.
- **The pool** (`/studio/<course>/pool`, migration **145**, `packages/lms/src/pool.ts` + `unfurl.ts`): one box takes a network thread link, any web link (captured with its OpenGraph title/description/image behind an SSRF guard — private/loopback/link-local hosts are refused, redirects re-checked, 4 s / 512 KB), or a note; plus *search the network's threads* (services' `searchForum`, already visibility-aware) and *browse the org's files* (`listOrgMediaLibrary`). Items are references, tagged, show **used in / not used yet** derived from the working drafts, and "Use in…" either attaches to a step or makes a new step of the fitting kind. Web links render on a step as cards (`refs.links`). Never published; learners never see it.
- **Hub button**: `NEXT_PUBLIC_SOPHIA_URL` is set on the arts-collective container; the hub shows "Open the Elkdonis Path" only while Sophia actually answers (checked ≤ once / 2 min), so it appears by itself when the proxy host goes live.
- What "the factory" gave us: `serveMedia`, `uploadOrgFile`/`folderForMime`, `validateUploadBuffer`, `searchForum`, `listOrgMediaLibrary`, `createThread`, the shared `RichTextEditor`, the auth handoff, and the forum-ui connector/action-handler pattern. What it lacked: any URL unfurl (now in `@elkdonis/lms`, a candidate to move to services), and a shared *upload route* factory (each app still hand-writes ~60 lines around `uploadOrgFile`).

**Not built yet:** enrolment-gated forum categories (run conversations are ordinary public threads in the `elkdonis-path` category), audio acknowledgements upload, Open Badges signing, payments.

**To go live:** A record + NPM proxy host for `sophia.arts-collective.com` → `:3020` (no wildcard DNS/cert exists); then sign-in works through the network handoff like the forum. `SOPHIA_URL` is already in `.env`.

## The platform in one paragraph

Three layers with one-way dependencies — **content** (what is taught; authored, versioned, immutable once
published), **delivery** (runs, guides, enrolments, entitlements) and **record** (what each person did:
state, responses, events, awards). Everything a learner touches is a **step** of some **type**; types are
plugins at the leaves, structure is core. A course always has a default open run; cohorts are extra runs.
Progress points at stable step ids and remembers the version it was completed against. Nothing in the rest
of the network depends on the LMS; the LMS depends on the network only at named seams (auth viewer, org
roles, threads, questionnaires, media-authz, commerce, email).

## Ten rules for building it

1. **Schema, services and a seed script before any authoring UI.** Order: schema → services → learner player → guide view → authoring. The flagship is hand-seeded.
2. **Publish is one transaction that freezes a version.** Draft and published pointers; runs pin a version; typo-class fixes fast-forward, structural changes are adopted explicitly. Never delete a published version.
3. **Stable ids, unique constraints from migration one.** State is keyed `(enrolment_id, step_id)` and stamped with the `step_version_id`. One enrolment per person per run; one award per person per achievement.
4. **State table is the truth the UI reads; an append-only event log is written in the same transaction** (actor, verb, object+version, enrolment, occurred_at — xAPI-shaped so it can be exported, never required to be). Reflection text lives *outside* the log so it can be deleted.
5. **Step types are open text + a registry** (`reading`, `practice`, `reflection`, `session`, `resource` to start). Core never imports a type; an unknown type renders a placeholder and still exports.
6. **A short list of typed unlock rules** — sequential, after-module, date, offset-from-run-start, requires-course — evaluated by one pure function returning `{allowed, reason, unlocksAt}`. No rule language, no adaptive branching, **no gradebook**.
7. **Entitlement ≠ enrolment.** The right to take a course (free, role, RSVP, order, grant) is separate from a seat in a run. Roles are scope rows: author→course, guide→run, mentor→learners. Org admin comes from `user_organizations.role`; no new role vocabulary.
8. **Courses are org-owned; `org_id` on every delivery/record row; all access through the package's services with a viewer.** The network catalogue is a filtered view of org catalogues.
9. **Private by default, stated to the learner.** Reflections have four visible levels (me / my guide / my circle / public), chosen per entry, never emailed, never cross-org, never AI-readable unless opted in. Do **not** reuse `listPendingReviews()` as-is — it is network-wide.
10. **Leave seams, build nothing, for:** Open Badges 3.0 (achievement + award tables now, signing later), AI (plain-text export per step, actor-type on records, drafts-only generation), payments (entitlement source `order`), drip and spaced re-prompts.

## Package layout (its own resources)

```
packages/lms/            @elkdonis/lms          content + delivery + record services, unlock engine, types registry
packages/lms-ui/         @elkdonis/lms-ui       player, outline, guide view, (later) builder — plain CSS, connectors like forum-ui
packages/lms-steps/      @elkdonis/lms-steps    the built-in step types (reading, practice, reflection, session, resource)
lms/                     research, this synthesis, ADRs (one short file per irreversible decision)
migrations 14x_lms_*     one migration per layer: content, delivery, record
```
Hosts mount it the way they mount the forum. Services export source (no build step), like `@elkdonis/services`.

## First schema (names, not SQL)

- **Content:** `lms_courses` (org, slug, draft/published version pointers) · `lms_course_versions` (immutable snapshot: outline JSON of module/step order + rules) · `lms_steps` (stable id, type) · `lms_step_versions` (immutable: title, body, settings, refs to thread/questionnaire/media) · `lms_achievements`
- **Delivery:** `lms_runs` (course, pinned version, mode `open|drip|cohort|circle`, anchor date, **`workshop_thread_id`**, visibility) · `lms_run_staff` · `lms_entitlements` · `lms_enrolments`
- **Record:** `lms_step_state` · `lms_responses` (reflection/practice-log bodies + visibility level) · `lms_acknowledgements` (guide → response, text or audio) · `lms_events` (append-only) · `lms_awards`

## Experience — quiet practice companion (default)

- **Step page:** one column, phone-first: media (audio first-class, downloadable) → the practice → private reflection → (optional) discussion. One primary action.
- **One "Continue".** Resume exactly where they were; welcome back without saying how far behind. A neutral private practice calendar; **no streaks, points, levels, leaderboards.**
- **Win week one:** step 1 is short, is a practice, and is reachable within minutes of arriving — for a public course, *without signing in*. Sign-in is asked for only when there is something to save.
- **A person notices you:** the guide's "awaiting you" queue and acknowledgement (text or short audio) is the feature that matters most. Build it before any authoring UI.
- **Safety shipped with v1:** honest descriptions, an alternative for hard practices, a one-tap private route to the guide, not-therapy notice, resources page.
- **Notifications:** learner-chosen cadence, weekly digest default, no guilt copy. (Email is not live yet — in-app first.)
- WCAG 2.2 AA floor; transcripts for all audio/video (also the SEO text).

## Experience — community classroom (mode two, sketch only)

Same course version, different **run mode**: `cohort` or `circle`. Adds a per-step discussion (a forum thread in the
run's own `org_feeds` category gated by enrolment, so the forum, dictionary and map come free), visible cohort
presence, reflections defaulting to "my circle", and `session` steps bound to the run's workshop thread (Talk room,
calendar, reminders, rota). No new content model — only run settings and two UI panels. Study circles (7–12,
peer-led) are this mode with no guide.

## SEO for a public, free course

- **Public content, private record.** Outline and step *content* are server-rendered and indexable without a session; reflections, discussion, progress and anything run-specific are never in the public HTML.
- **Stable URLs from version-independent slugs:** `/learn/<course>` and `/learn/<course>/<step-slug>`. Versions never appear in URLs; renamed slugs 301.
- **One canonical home per course** (the owning org's mount); any other mount or the network catalogue sets `rel=canonical` to it.
- **Structured data:** `Course` + `CourseInstance` (one per run, with `courseMode` and dates) and `hasPart`/`LearningResource` per step; `isAccessibleForFree: true`; `provider` = the org. `AudioObject`/`VideoObject` with transcript.
- **Each step page stands alone:** real `<h1>`, a 150-char summary authored per step (required field in the step version), transcript in the page, prev/next links, breadcrumb markup, OG image per course.
- `sitemap.xml` from published versions only; `noindex` on drafts, run pages and anything behind enrolment. Fast: no client JS needed to read a step.
- The **first module free and open** rule applies to future paid courses too — it is the landing page.

## Another approach to workshops

- A **run is a workshop thread** (`lms_runs.workshop_thread_id`): RSVP, capacity, deadline, paid join, reminders, Talk room, calendar and gated materials are reused, not rebuilt. Enrolling via the workshop creates the LMS enrolment.
- `workshop_pages` is kept for what it really is — the **marketing page** of a course or run.
- **Multi-session workshop = one-module course.** Each session becomes a `session` step (with its own materials, notes, discussion), replacing the `workshop_sessions.notes` blob over time. Single-session workshops stay plain workshops.
- A past workshop can be **republished as a self-paced course** from its recordings and materials — the cheapest second product the collective has.
- Make `upsertWorkshopOffering` the only workshop writer before wiring runs to it (three raw-SQL paths bypass it today; two are in the app being retired).

## Business posture, year one (brief)

Cost-recovery, not margin. Flagship free/dana with a stated true cost; ≥2 scholarship seats on anything paid later. Founding teachers: 90/10 on students they bring, 75/25 on students the network brings, 100% of dana less processing, terms locked 24 months, written export right, teacher keeps copyright. Collective is the seller on a single account with ledger + manual payouts until ~10 paid teachers. **Email before Stripe.** Ask the accountant about the GST/HST small-supplier threshold and NPO status before the first paid course. Lesson video on Bunny/Cloudflare Stream behind existing authz; masters on Nextcloud. Off-box encrypted backup before the first enrolment that matters.

Watch: first-step activation, midpoint retention, 30-day practice continuity, second-course rate, teacher net per hour.

## Phases

| Phase | Ships | Explicitly not |
|---|---|---|
| **0 — Foundations** | ADRs, three migrations, services, unlock engine, seed script, tests through the service boundary | any UI |
| **1 — The Path, public** | Public outline + step pages (SEO), default open run, sign-in-to-save, private reflections, Continue, guide queue + acknowledgement; hub's Course section links in | authoring UI, payments, email, drip |
| **2 — First cohort** | `cohort` run bound to a workshop thread, session steps, per-step discussion, circle visibility | marketplace, Connect |
| **3 — Founding teachers** | Builder (blueprints + backward-design wizard), versions/adopt UI, org catalogue, workshop→course republish | self-serve signup |
| **4 — Continuity** | Spaced re-prompts, completion page → Open Badges 3.0, paid entitlements, exports | gradebook, adaptive paths, SCORM/LTI |

## Open before Phase 0

1. ~~Where the Path lives publicly~~ — **decided 2026-09-18: `sophia.arts-collective.com`**, a thin host app (`apps/sophia`) mounting the packages, like `apps/forum` on forum.arts-collective.com. Canonical URLs: `https://sophia.arts-collective.com/<course>/<step-slug>`. Needs an A record + NPM proxy host (no wildcard DNS/cert exists) and the network sign-in handoff (`/api/auth/handoff/accept`), same as the forum. Org sites that mount a catalogue set `rel=canonical` here for network courses.
2. **Who is the flagship's guide(s)**, and the weekly capacity they have for acknowledgements — this sizes the cohort.
3. **Who writes the curriculum outline** (modules → steps) — the platform can be seeded the day that exists.
4. Whether guides may read reflections at level "my guide" by default in the flagship, or only when the learner raises it.
