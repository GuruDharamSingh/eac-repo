# Elkdonis Course: integrate an LMS or build natively? (research brief, 2026-09-18)

This brief covers the "Elkdonis Course" section at `arts-collective.com/hub/elkdonis`, which is where the **Elkdonis Path** will live. No code, schema or database was touched while writing it.

**Legend:** **[V]** = checked in the repo or at a cited source today. **[A]** = an assumption or general knowledge that I did not re-check.

---

## TL;DR

- **Build it natively as a thin package, `@elkdonis/courses`, on top of `threads`, questionnaires and workshops.** Do not run a second learning platform.
- Every candidate LMS brings **a second user store, a second content store and a second UI language**. At our scale (dozens to hundreds of learners, contemplative content, a few admins) the LMS features we would actually use are ordering, unlocking and "done" ticks. We already own the hard parts: auth, media, live rooms, reflections, enrolment and email.
- What is missing is **four small tables**: modules, steps, enrolments and step progress. Cohorts come from **workshop threads we already have**.
- Standards: **ignore SCORM, LTI, OneRoster and Common Cartridge** for now. Keep cmi5/xAPI and **Open Badges 3.0** as the only planned add-ons, at the export edge.
- **Migration number:** `ls` at write time shows **138 and 139 already taken**. `138_feed_stewardship.sql` and `139_org_grants_nextcloud_sync.sql` are untracked files from another session today. **The next free number is 140. Re-check before writing it.** [V]

---

## 1. What already exists (verified in the repo)

| Fact | Where | Relevance |
|---|---|---|
| All content lives in one `threads` table. `kind` has **no CHECK** and is opt-*out* of feeds. `OFF_FEED_KINDS = ['wiki_page','writing','document']` | `packages/services/src/thread-kinds.ts:40` | A `lesson` kind **must** be added to `OFF_FEED_KINDS`, or gated lessons appear in the forum, feeds and search. Forum predicates have an admin branch and an `author_id = viewer` branch that ignore `visibility`. |
| RSVP is kind-agnostic: `thread_rsvps(thread_id,user_id,status)` plus `threads.is_rsvp_enabled/attendee_limit/rsvp_deadline` | `thread-rsvp.ts`, `migrations/030_unified_threads_schema.sql:222` | Can serve as the enrolment trigger. It has no `started_at`/`completed_at`/cohort, so it is not enough for progress on its own. |
| Workshops: `kind='workshop'` + `workshop_pages` + `workshop_sessions` + a Nextcloud materials folder + a shared Talk room + paid `workshop_join_requests` | `workshop-offerings.ts` (928 lines); `isEnrolledInWorkshop()` at ~l.784 unions RSVP 'yes' and join-request 'paid' | **A cohort run already exists as a thing: it is a workshop.** |
| Media authz has a `workshop` target, `EAC_Network/<org>/workshops/<threadId>/…`, gated by enrolment | `media-authz.ts:44-89, 224-240` | Needs a sibling `course` target. Otherwise lesson media is readable network-wide, which is what happened to workshop materials before the `workshop` target existed (memory note). |
| Questionnaires: `questionnaires.fields` JSONB (text/longtext/choice/multichoice/image/number/boolean). Kinds `questionnaire`/`poll`/`wizard`. Optional `thread_id` (103). Responses go draft → submitted → reviewed/returned | `questionnaires.ts:282-340`, `migrations/088`, `103_questionnaire_as_thread.sql` | Good enough for reflections and simple quizzes. `idx_qr_one_open` allows **one open response per (key,user,org)** while submitted rows build up as history, so repeated or spaced reflections already work. |
| **Trap:** `listPendingReviews()` returns **every** `status='submitted'` response | `questionnaires.ts:210` | Course reflections would flood the Elkdonis admin review queue. We need a per-questionnaire "no review" flag (see migration). |
| `thread_gathers` (131): a hand-ordered, polymorphic "what this thread holds" edge with `position` | `migrations/131_thread_gathers.sql` | Tempting as course structure. **Rejected**: it has no modules, no required/unlock semantics, and its meaning is "occasion page". A course can still *gather* its discussion or drawings. |
| An OIDC provider already exists on the admin IdP (`/api/oidc/authorize|token|userinfo`, `.well-known/openid-configuration`, migrations 007/010/011) | `apps/admin/src/app/api/oidc/*` | This is what an external LMS would use for SSO. It is not needed for the native route. |
| `SCHEDULED_KINDS = ['event','meeting','workshop','reading_group']` | `org-calendar.ts:71` | Cohort sessions reach the calendar for free if they are workshop threads. |
| The Elkdonis hub tab exists (`apps/arts-collective/src/app/hub/(tabs)/elkdonis/page.tsx`) with `HUB_CARDS`, and most cards are `available:false` | `apps/arts-collective/src/lib/hub-cards.ts` | The course section is a card/band here. |
| **Another session is working on the Elkdonis tab today.** Migration 138 adds a steward org: `inner_group` owners and guides count as guides on `elkdonis` in the forum | `138_feed_stewardship.sql` (untracked) | This settles who can author Elkdonis courses: `elkdonis` org + steward guides. Coordinate before touching the tab. |
| No `course`/`lesson` kind or table exists anywhere | grep of apps/, packages/ | Clean slate. |
| Stripe code is written but has no keys. SendGrid key is a placeholder (memory) | - | Paid courses and email nudges are **phase 3 at earliest**. In-app nudges only until then. |

[A] The network sign-in handoff and Supabase GoTrue session behave as documented in `CLAUDE.md` and memory. Not re-traced for this brief.

---

## 2. Open-source LMS candidates

| LMS | Licence | Stack | Footprint (Docker) | SSO / OIDC with our IdP | API / embed | Maintenance burden | Fit for us |
|---|---|---|---|---|---|---|---|
| **Moodle 5.x** | GPL-3.0 | PHP ≥ 8.2, Postgres/MySQL, cron, moodledata volume | 512 MB min, **2 GB+ prod** [V] | `auth_oidc` plugin, supports 3.9-5.2 [V]. Docker SSRF protection blocks private-IP IdPs until allow-listed [V] | Web services REST, LTI provider/consumer | **High.** The Bitnami image lost free updates on 29 Sep 2025; there is no official prod image yet (Helm chart only proposed) [V]. A third UI language (PHP themes) | Feature-complete but heavy and institutional. Styling it to match our design is a project of its own |
| **Open edX (Tutor)** | AGPL-3.0 | Django, MySQL, Mongo, Redis, Meilisearch, Caddy, MFEs | **4 GB min / 8 GB rec**, 2-4 CPU [V] | Generic OAuth2 via python-social-auth. `auth-backends` dropped OIDC in 3.0 [V]. Doable with a Tutor plugin | Rich REST, LTI, xblocks | **Very high.** Twice-yearly named releases, multi-container | Built for MOOCs. Over-sized for us |
| **Frappe LMS** | AGPL-3.0 [V] | Python/Frappe + Vue, MariaDB, Redis | ~2-4 GB [A] | Frappe "Social Login Key" supports a **custom OIDC provider** [V] | Frappe REST on every doctype | Medium. Bench/Frappe upgrades, a second DB engine | **Closest shape**: course → chapter → lesson, quizzes, assignments, **batches** (cohorts), certificates [V]. Payments via the payments app incl. Stripe [V]. Best candidate *if* we integrated |
| **ClassroomIO** | AGPL-3.0 [V] | SvelteKit + Hono + Postgres + Better Auth (moved off Supabase) [V] | Small [A] | Better Auth has OIDC [A]; not confirmed for self-host | REST API + embeddable widget [V] | Medium. Young project, 34 open issues [V] | Modern and light, but a fifth JS framework in the stack |
| **Canvas LMS** | AGPL-3.0 | Rails, Postgres, Redis, many aux services | 8 GB+ [V] | SAML/OIDC | Excellent API, LTI 1.3 | **Very high.** Instructure's self-hosted Docker is "alpha, not for production" [V] | No |
| **Chamilo 2.0** | GPL-3.0 | PHP/Symfony + Vue, MySQL | ~1-2 GB [A] | OAuth2/OIDC plugins [A] | Limited REST | Medium-high. 2.0 has had repeated packaging and security patch releases [V] | Simpler than Moodle, still PHP and institutional |
| **ILIAS 10** | GPL-3.0 [V] | PHP, MySQL | ~2 GB [A] | Native OIDC provider class [V] | SOAP/REST, LTI, SCORM | High. German-university oriented | No |
| **LearnHouse** | AGPL-3.0 + Enterprise licence [V] | Next.js + FastAPI, Postgres, Redis | 2 GB min / 4 GB rec [V] | **OIDC/SSO is enterprise-only** [V] | REST, CLI | Medium | Stack-adjacent, but SSO sits behind the paywall |
| **CourseLit** | AGPL-3.0 [V] | Next.js, **MongoDB**, needs a MediaLit instance [V] | Small-medium | Email magic link [A] | GraphQL | Medium | A course storefront (Teachable clone). Mongo plus a media service duplicates Nextcloud |

**What every candidate costs, beyond its own row:**

- **Two identity stores.** The LMS user must be JIT-provisioned from our IdP, and org roles do not flow across.
- **Two content stores.** Lessons are not threads, so they cannot be gathered, mapped, defined into the dictionary, discussed in the forum, or authored with `@elkdonis/cms-ui/editor`.
- **Media duplicated or proxied** away from Nextcloud.
- **Its own look.** We have spent weeks unifying `primitives`, `cms-ui` and the surface pattern, and an iframe or subdomain LMS undoes that for the flagship section.
- **Another backup and upgrade target on one TrueNAS box**, whose backup already lives on the same pool.

**If we ever integrate anyway:** choose **Frappe LMS**. It has the right hierarchy, batches, certificates, Stripe and custom OIDC. Connect it through the admin IdP's OIDC provider, give it a subdomain, and link out from the hub. Budget ~2-4 GB RAM plus MariaDB.

Sources: [Moodle 5.0 requirements](https://moodledev.io/docs/5.0/gettingstarted/requirements) · [Moodle PHP](https://docs.moodle.org/502/en/PHP) · [auth_oidc](https://moodle.org/plugins/auth_oidc) · [Moodle/Keycloak Docker SSRF notes](https://github.com/DDRMin/moodle-keycloak-oidc-fix) · [Bitnami Moodle deprecation](https://github.com/moodlehq/moodle-docker/issues/335) · [Tutor docs](https://docs.tutor.edly.io/) · [Tutor install reqs](https://github.com/overhangio/tutor/blob/master/docs/install.rst) · [Open edX OAuth2 TPA](https://edx.readthedocs.io/projects/edx-installing-configuring-and-running/en/open-release-quince.master/configuration/tpa/tpa_integrate_open/tpa_oauth.html) · [openedx/auth-backends](https://github.com/openedx/auth-backends) · [frappe/lms](https://github.com/frappe/lms) · [Frappe OIDC social login](https://docs.frappe.io/framework/user/en/guides/integration/openid_connect_and_frappe_social_login) · [Frappe LMS payment gateway](https://docs.frappe.io/learning/setting-up-payment-gateway) · [Frappe monetization](https://frappe.io/learning/monetization) · [ClassroomIO](https://github.com/classroomio/classroomio) · [Canvas self-hosted (alpha)](https://github.com/instructure/canvas-self-hosted) · [canvas-lms](https://github.com/instructure/canvas-lms) · [Chamilo releases](https://github.com/chamilo/chamilo-lms/releases) · [ILIAS](https://en.wikipedia.org/wiki/ILIAS) · [ILIAS OIDC provider class](https://fossies.org/linux/ILIAS/components/ILIAS/OpenIdConnect/classes/class.ilAuthProviderOpenIdConnect.php) · [LearnHouse requirements](https://docs.learnhouse.app/self-hosting/installation/requirements) · [LearnHouse repo](https://github.com/learnhouse/learnhouse) · [CourseLit](https://github.com/codelitdev/courselit)

---

## 3. Standards: which matter at our scale

| Standard | What it is | Verdict |
|---|---|---|
| **SCORM 1.2 / 2004** | Packaged HTML content that reports to the LMS through a JS API | **Skip.** It matters only if we buy off-the-shelf corporate e-learning packages. Our content is authored text, media, reflections and live sessions. |
| **xAPI** | "Actor verb object" statements sent to an LRS | **Shape, don't implement.** Make `course_step_progress` rows easy to map to xAPI statements (`actor=user`, `verb=completed/experienced/answered`, `object=step`). An LRS is not needed. |
| **cmi5** | An xAPI profile that adds launch/complete/pass semantics | **Later, if ever.** It is the modern replacement for SCORM when importing third-party content. Not phase 1-3. |
| **LTI 1.3** | Plug a tool into someone else's LMS, or theirs into ours | **Skip** unless a school or university partner asks. It would be the way to embed Elkdonis courses *in* their Moodle or Canvas. |
| **Common Cartridge** | Course export/import zip | **Skip.** Offer a Markdown/JSON export of a course instead. It is cheaper and actually readable. |
| **OneRoster** | SIS ↔ LMS roster sync for K-12 and higher ed | **Irrelevant.** |
| **Open Badges 3.0** | Signed W3C Verifiable Credentials (VC Data Model 2.0) for achievements; a final 1EdTech standard since June 2024 | **Yes, phase 3.** It is the one standard with real value for us: a portable, verifiable "completed the Elkdonis Path". Design the completions table so a credential can be issued from it later. |

Sources: [xapi.com cmi5 comparison](https://xapi.com/cmi5/comparison-of-scorm-xapi-and-cmi5/) · [iSpring standards overview](https://www.ispringsolutions.com/blog/elearning-standards) · [1EdTech Open Badges](https://www.1edtech.org/standards/open-badges) · [OB 3.0 implementation guide](https://www.imsglobal.org/spec/ob/v3p0/impl) · [OB 3.0 announcement](https://www.1edtech.org/1edtech-article/new-open-badges-30-standard-provides-enhanced-security-and-mobility/411060)

---

## 4. Curriculum structure patterns (distilled)

- **Hierarchy:** course → module → lesson → activity. Frappe calls modules "chapters". Moodle uses "sections" and "activities". Two structural levels (module, step) are enough. A "step" is the activity and points at a lesson, a reflection, a live session or a resource.
- **Unlock rules** (all common across Moodle, Frappe and Thinkific-type tools):
  - *sequential*: the previous required step must be done
  - *drip*: N days after enrolment/cohort start
  - *date*: fixed calendar unlock
  - *prerequisite*: another course completed

  Encode these as a few nullable columns. Do not build a rules engine.
- **Cohort vs self-paced** is a property of the *run*, not the course. The same course can have an open self-paced enrolment and dated cohorts. A cohort adds a start date that anchors drip, a group, live sessions and a room. **We already have all of that as a workshop thread.**
- **Progress/completion:** per-step status (`started`/`completed`) plus a derived course completion when every `required` step is done. Store the completion timestamp on the enrolment, and don't store percentages; compute them.
- **Contemplative-specific:**
  - Reflections are usually **not graded**. Completion means "answered", optionally "acknowledged by a guide" (reusing `reviewed`).
  - **Spaced reflection prompts** re-ask a question at +1d/+7d/+30d after a step. Implement this as a schedule on the step, fired by the existing reminder pattern (`069_workshop_reminders`). The questionnaire history index already keeps each answer.
  - **One question at a time** is the existing `wizard` presentation, one field per page.
- **Certificates:** start with a completion page ("You walked the Path, <date>") and move to Open Badges 3.0 later.

---

## 5. Proposed native data model

**Principles:**

- Content stays in `threads`.
- Structure, enrolment and progress get small new tables.
- No kind-specific logic in `thread-rsvp.ts`, which stays kind-agnostic per the memory note.

**New thread kinds** (no schema change needed, since `kind` has no CHECK):

- `course`: the public face of the course (description, cover, price). It **may** appear on feeds as an announcement, the same way a workshop does.
- `lesson`: a lesson body (rich text from the shared editor, media in Nextcloud, replies as discussion). **Add it to `OFF_FEED_KINDS`.**

**New tables (first migration: 140, or the next free number):**

```sql
-- 1. Modules: ordered groups inside a course.
course_modules (
  id               VARCHAR(21) PK,
  course_thread_id VARCHAR(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  summary          TEXT,
  position         INT NOT NULL DEFAULT 0,
  unlock_offset_days INT,          -- drip: days after enrolment/cohort start
  unlock_at        TIMESTAMPTZ,    -- fixed date
  created_at, updated_at
)

-- 2. Steps: the activities. Polymorphic target, shaped like thread_gathers.
course_steps (
  id              VARCHAR(21) PK,
  module_id       VARCHAR(21) NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  position        INT NOT NULL DEFAULT 0,
  step_type       VARCHAR(20) NOT NULL CHECK (step_type IN ('lesson','reflection','live','resource')),
  target_thread_id VARCHAR(21) REFERENCES threads(id) ON DELETE CASCADE,        -- lesson / live(workshop|meeting)
  questionnaire_key TEXT REFERENCES questionnaires(key) ON DELETE CASCADE,       -- reflection / quiz
  target_ref      TEXT,                                                           -- resource: NC path or URL
  title_override  TEXT,
  is_required     BOOLEAN NOT NULL DEFAULT TRUE,
  sequential      BOOLEAN NOT NULL DEFAULT TRUE,   -- locked until previous required step is done
  estimated_minutes INT,
  reprompt_days   INT[],                           -- spaced reflection, e.g. {7,30}; phase 3
  CHECK (exactly one of target_thread_id / questionnaire_key / target_ref per step_type)
)

-- 3. Enrolments: one per person per course. Cohort optional.
course_enrolments (
  course_thread_id  VARCHAR(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cohort_thread_id  VARCHAR(21) REFERENCES threads(id) ON DELETE SET NULL,  -- a kind='workshop' run
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','completed','withdrawn')),
  source            VARCHAR(20) NOT NULL DEFAULT 'free'
                      CHECK (source IN ('free','rsvp','order','granted')),
  anchor_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- drip clock: cohort start or enrol time
  enrolled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  PRIMARY KEY (course_thread_id, user_id)
)

-- 4. Progress: one row per person per step touched.
course_step_progress (
  step_id      VARCHAR(21) NOT NULL REFERENCES course_steps(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed')),
  response_id  VARCHAR(21) REFERENCES questionnaire_responses(id) ON DELETE SET NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (step_id, user_id)
)

-- 5. Keep course reflections out of the Elkdonis admin review queue.
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT TRUE;
-- listPendingReviews() then filters on q.requires_review. Course reflections are created FALSE.
```

**Course-level settings** (pacing default, prerequisite course, completion message) go in a sidecar `course_pages(thread_id PK, …)`, mirroring `workshop_pages`. They can also wait until phase 2 as `threads.metadata` JSONB, which exists (030:101) [V].

**How this maps onto existing machinery:**

| Need | Reuses |
|---|---|
| Course page, publishing, org scoping, slug, feed announcement | `threads` kind='course' + `thread-publish.ts`, `thread-slug.ts` |
| Lesson text and discussion | `threads` kind='lesson', shared editor, replies. `OFF_FEED_KINDS` keeps it out of feeds |
| Reflections, quizzes, one-question-at-a-time | `questionnaires` (kind `wizard`), `questionnaire_responses` history |
| Cohort run, live sessions, Talk room, calendar, capacity, paid join | a `workshop` thread linked by `course_enrolments.cohort_thread_id` and by `live` steps |
| Media gating | a new `course` target in `media-authz.ts` (`EAC_Network/<org>/courses/<threadId>/…`), gated by `course_enrolments` |
| Paid access (later) | `source='order'` from `@elkdonis/commerce`, like `kind='service'` |
| Authoring rights | org owners and guides, plus the steward org from migration 138 (confirm how that lands) |
| xAPI/Open Badges export (later) | derived from `course_step_progress` / `course_enrolments.completed_at` |

**Why not `thread_rsvps` for enrolment:** its CHECK is `yes/no/maybe` (030) and it has nowhere to put the anchor date, cohort or completion. An RSVP on a *cohort workshop* can still **create** a course enrolment (`source='rsvp'`).

**Why not `thread_gathers` for structure:** see §1. Its meaning is "occasion page", it has no modules, and there are no unlock or required semantics.

**First migration (140) contains exactly:**

- the four tables above, with indexes on `(course_thread_id, position)`, `(module_id, position)`, `(user_id)` and `(cohort_thread_id)`;
- the `questionnaires.requires_review` column.

It does **not** contain a kind CHECK, seed data, certificates or reprompt jobs. The runner strips `BEGIN/COMMIT` and refuses duplicate numbers (CLAUDE.md), so re-`ls` before naming the file.

---

## 6. Recommendation

**Build natively (`@elkdonis/courses` in services + a `cms-ui/course` surface), and do not adopt an LMS.**

| | Native | Integrate Frappe LMS (best external) |
|---|---|---|
| Time to first learner | ~1-2 focused sessions for phase 1 [A] | ~1 session to deploy + SSO, then theming and link-out |
| Identity | Existing users/orgs/roles | JIT users in a second DB, roles out of sync |
| Content reuse (forum, map, dictionary, editor, Nextcloud) | Full | None (links only) |
| Look and feel | Primitives/surface system | Frappe UI, a separate design |
| Ops on one TrueNAS box | 0 new containers | + Frappe, MariaDB, Redis worker, backups |
| Features we would not build soon | - | Graded quizzes, assignments, certificates, reports |
| Risk | Scope creep into "building Moodle" | Stranded content and a second platform to upgrade |

The native risk is scope creep, so **hold the line on the non-goals**: no gradebook, no assignment marking, no SCORM, no LRS. If the collective later needs institutional features (graded assessment, accredited transcripts, LTI into a university), put **Frappe LMS** beside it as a separate offering at that point.

---

## 7. Phased plan

**Phase 1: the Elkdonis Path, walkable.** This is the smallest useful thing.
- Migration 140 (above), plus `lesson` added to `OFF_FEED_KINDS`, plus the `course` media-authz target.
- Services: `getCourse`, `getCourseOutline(viewer)` (steps with locked/unlocked/done), `enrol`, `markStepComplete`, `completeReflection` (on questionnaire submit), and derived completion.
- UI: a hub Elkdonis card/band "The Elkdonis Path" → outline page → step page. The step page renders a lesson thread body or a wizard questionnaire one question at a time.
- **Self-paced, free, `sequential` only.** No drip, no cohorts, no payment, no email.
- Authoring can start as a seed script plus the existing thread and questionnaire editors. Hand-authored structure is fine for one course.

**Phase 2: cohorts and authoring.**
- `cohort_thread_id` wiring: enrolling via a workshop RSVP or paid join creates a course enrolment. `live` steps point at workshop sessions. Drip is anchored on the cohort start.
- A course builder surface in `cms-ui`: modules and steps with drag order. Reuse `content-form/tiers/*` field sections (memory feedback).
- A guide view of who is where. "Acknowledge reflection" reuses the `reviewed` status.
- "Elkdonis Inner Work" study material becomes a second course, or a self-paced collection with no required steps.

**Phase 3: continuity and credentials.**
- `reprompt_days` spaced reflections, in-app first and by email once SendGrid is real.
- Completion page, then **Open Badges 3.0** issuance, signed by the collective.
- Paid courses through commerce/Stripe once keys exist (`source='order'`).
- Optional Markdown/JSON course export, and xAPI statement export if a partner asks.

**Open questions for the user:**
1. Is the Path open to any signed-in network member, or gated to the `elkdonis` org or a role?
2. Should a guide see reflections, or are they private to the learner by default? This is a privacy call for contemplative work.
3. One Path, or several courses from the start (Path + Inner Work)?
4. Coordinate with today's Elkdonis-tab session (migration 138 steward model) before touching `hub/(tabs)/elkdonis`.
