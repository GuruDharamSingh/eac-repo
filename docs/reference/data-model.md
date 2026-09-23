# Data model

Covers the shared Postgres database: multi-tenancy by `org_id`, the migration
runner, the `threads` table as the unified content model and the tables around
it (feeds, edges, moderation, questionnaires, rota, wiki), the shared write
path in `@elkdonis/services`, HTML sanitisation, and the query conventions that
have caused runtime-only failures. Commerce tables (`artwork`, `store`, orders)
are in `docs/reference/commerce.md`.
Last verified: 2026-09-23 (schema read with `\d`, row counts queried, code read;
nothing written to the database).

## Current state

### One database, many tenants

- One Postgres 16 database, `elkdonis_dev`, one `public` schema. It is the only
  application database on the instance (`\l`) and holds production data despite
  the name.
- Tenancy is a column, not a schema: content tables carry `org_id`
  (`threads.org_id` → `organizations(id) ON DELETE CASCADE`). Every read and
  write filters by it. Deliberate exceptions: the wiki stores every page under
  `org_id = 'elkdonis'` and its service takes no org argument
  (`packages/services/src/wiki.ts:37`, `WIKI_ORG`); every commerce `store` row
  sits in `org_id = 'market'`.
- Client: postgres.js, exported as `db` from `packages/db/src/client.ts:38`.
  `@elkdonis/db` and `@elkdonis/types` are consumed from `dist/` (rebuild after
  changing them); `@elkdonis/services` and `@elkdonis/utils` are consumed from
  `src/` (a type error in any services file fails every app's type check).
- Baseline tables are created by `packages/db/src/schemas.ts`; migrations layer
  on top. `docs/schema.mmd` was last changed 2026-04-17 and predates migration
  073; do not use it as a column reference.

Organizations (2026-09-23, `SELECT id, name FROM organizations`):

| id | name | id | name |
|---|---|---|---|
| `amrit_canada` | Amrit Canada | `justing` | justing |
| `danamccool` | Dana McCool | `market` | The Collective Market |
| `elastrocal` | Elastrocal | `oad` | ArtDirect — Online Artist Directory |
| `elkdonis` | Elkdonis Arts Collective | `pigeonshoot` | Pigeonshoot |
| `fourth_way_book_readers` | 4th Way Book Readers | `saw` | SAW |
| `guru-dharam` | Guru Dharam's Practice Group | `stonebalancing` | Stone Balancing |
| `hidden-enneagram` | The Hidden Enneagram | `sunjay` | Para Theater |
| `ifac` | International Fine Art Collectors | `surrealistwriting` | Surrealist Writing |
| `inner_group` | InnerGathering (the core member group; private by default) | `tara` | tara |

### Migration runner

`packages/db/scripts/migrate.mjs`, run as `pnpm --filter @elkdonis/db db:migrate`
inside an app container (needs `DATABASE_URL`; no default, `migrate.mjs:35`).
Run it after `supabase-auth` is healthy: migration 052 fails loudly if
`auth.users` does not exist yet.

- Tracker table `app_schema_migrations(filename PK, checksum, applied_at)`
  (`migrate.mjs:58`). The separate `schema_migrations` table (timestamp
  versions) belongs to a Supabase service, not this runner.
- Files apply in lexicographic order, each in one transaction with its tracker
  row. A file's own `BEGIN;`/`COMMIT;` lines are replaced with a comment
  (`migrate.mjs:86`), because they would otherwise end the runner's transaction.
- One run at a time: advisory lock 7246001 (`migrate.mjs:93`).
- A pending file whose number is already used is refused (`migrate.mjs:179-187`).
  Applied duplicates stay: 052, 054, 102, 103, 112 each have two files.
- An applied file whose checksum changed on disk stops the run unless
  `MIGRATE_ALLOW_DRIFT=1` (`migrate.mjs:189-198`).
- `--verify` compares file checksums with stored ones. It does not compare the
  live schema with the files; see `thread_revisions` below.
- Also `--status`, and `--backfill` (records files as applied without running them).
- 2026-09-23: 163 files, 163 applied, 0 pending. Highest number **163**
  (`163_forum_subcategories.sql`, applied 2026-09-23). Numbering starts at 002
  and skips 026–029.
- Migration 030's `CREATE TABLE IF NOT EXISTS threads` was a no-op (the baseline
  table already existed), so columns listed only in 030 never landed. Trust
  `\d threads`, not 030.

### `threads`: the unified content model

Every post, meeting, event, workshop, service, wiki page, document, idea and
personal blog piece is a `threads` row. `posts`, `meetings` and `event_pages`
were dropped by migration 030.

Key columns (live `\d threads`):

- `id varchar(21)` with no default: generate it (`nanoid()`), as `createThread` does.
- `org_id`, `author_id uuid NOT NULL` → `users(id)`, `kind varchar(20)`,
  `title`, `slug`, `section` (an `org_feeds.slug`, no FK), `status`, `visibility`,
  `pinned`, `locked`, `share_to_network` (ignored by the forum).
- Body: `body text`, `excerpt`, `body_format` (`html|md|mdx`, CHECK; all 67 rows
  are `html`), `body_source`, `static_path`/`static_published_at`
  (`thread-publish.ts`), `search_tsv` (generated, migration 114) with a trigram
  index on `title`.
- Scheduling and attendance: `scheduled_at`, `duration_minutes`, `location`,
  `format` (`in_person|online|hybrid`), `meeting_url`, `recurrence_pattern`
  (`NULL|DAILY|WEEKLY|MONTHLY|CUSTOM`; the form value `NONE` must be stored as
  NULL), `recurrence_until`, `is_rsvp_enabled`, `attendee_limit`, `rsvp_deadline`,
  `is_meeting` (intent flag), `price`, `currency`, `sessions jsonb`.
- Also: Nextcloud links (`nextcloud_talk_token`, `document_url`,
  `nextcloud_doc_url`), counters, `last_activity_at` (110), `reviewed_by`/`reviewed_at` (156).
- `metadata jsonb NOT NULL DEFAULT '{}'`. Keys in use: `coverImageUrl` (9 rows),
  `timeZone`, `wikiParentId`, `aliases`, `definitions`, `wikiTalkFor`,
  `legacyDocumentId`, `documentPath`, `feedPinned`, `bookingType`, `nextcloud`,
  `drawing`.
- A `drawing jsonb` column also exists (legacy from `event_pages`); 0 rows use it.
  Forum drawings live in `metadata.drawing` (`packages/services/src/drawing.ts`).

Constraints (live, 2026-09-23):

| constraint | rule |
|---|---|
| `threads_status_check` | `draft`, `pending`, `published`, `archived` |
| `threads_visibility_check` | `PUBLIC`, `ORGANIZATION`, `INVITE_ONLY` |
| `threads_wiki_never_public` | `kind <> 'wiki_page' OR visibility <> 'PUBLIC'` (123) |
| `threads_body_format_check` | `html`, `md`, `mdx` |
| `threads_format_check` | `in_person`, `online`, `hybrid` |
| `threads_recurrence_pattern_check` | NULL or `DAILY`/`WEEKLY`/`MONTHLY`/`CUSTOM` |
| `threads_org_id_slug_key` | UNIQUE `(org_id, slug)` |
| `idx_threads_wiki_slug_unique` | UNIQUE `slug` where `kind = 'wiki_page'` (122) |

There is no CHECK on `kind` (removed by 097) and none on `section` (removed by
073). A new kind needs no migration. `visibility` has no value meaning "any
signed-in network user".

Kinds in the table (2026-09-23): `post` 23, `meeting` 23, `workshop` 6,
`wiki_page` 4, `document` 3, `idea` 3, `service` 2, `writing` 2, `pigeon` 1.
`event` is authored by the compose surface but has no rows. `ContentKind` in
`packages/cms-ui/src/compose/content-fields.ts:40` also lists `product`, but
products and art pieces are `artwork` rows, not threads (decided 2026-09-17;
see commerce reference).

Columns that do not exist (verified absent with `information_schema`, 2026-09-23).
Code naming them compiles and fails at runtime:

| written as | actual location |
|---|---|
| `threads.cover_image_url` | `threads.metadata->>'coverImageUrl'` (`workshop_pages.cover_image_url` does exist) |
| `threads.time_zone` | `metadata->>'timeZone'` |
| `threads.tags` | `thread_topics` + `topics` |
| `threads.attachments`, `co_host_ids`, `card_colour`, `show_on_workshops_page`, `nextcloud_calendar_*` | never landed (030 no-op) |
| `org_profiles.headline` | `org_profiles.role_title` |
| `org_profiles.kind` | no such column |
| `questionnaires.gates_tier`, `users.network_tier` | dropped by 106 |

The audit table `events` has only `id, org_id, user_id, action, resource_type,
resource_id, data, created_at`; the forum's moderation log once wrote other
columns inside a swallowing `try/catch` and recorded nothing.

Two archived `inner_group` rows hold double-encoded `metadata` (one jsonb string,
one array), the result of `JSON.stringify(x)::jsonb` writes. Code that reads
`metadata->>'key'` gets NULL for them.

### Kinds kept off shared surfaces

Feed, forum, search and centre queries filter on `org_id + status + visibility`
and select `kind` without testing it, so a new kind appears on every one of them
as soon as a published PUBLIC row exists. The forum predicates also have a
global-admin branch and an `OR author_id = viewer` clause that ignore
visibility. `visibility` therefore cannot hide a kind.

`OFF_FEED_KINDS` (`packages/services/src/thread-kinds.ts:40`) is
`['wiki_page', 'writing', 'document']`, applied as `AND t.kind <> ALL(${OFF_FEED_KINDS})`
in the services forum, search, people, center and showcase queries
(`forum.ts:249`) and in 11 app files (`grep -rln OFF_FEED_KINDS apps`).
`getOfferingThread` in `apps/arts-collective/src/lib/org.ts` promotes the most
recent published PUBLIC thread, so any new PUBLIC kind can become an org's
`/offering` headline.

### Sections: `org_feeds` (073)

`org_feeds` PK `(org_id, slug)`: `name`, `tagline`, `description`, `presenter`,
`accent`, `sort_order`, `is_public`, `min_role` (who may see; `member|guide|owner`
or NULL), `post_role` (who may post; 138), `parent_slug` (sub-category, same org,
163), `nc_category_id` (Nextcloud Forum mirror, 163). 42 rows.
`threads.section` holds the slug as a soft reference with no FK. `is_public`
controls whether the host site's navigation lists the feed; it is not access
control. Access is `min_role` via `canViewFeed`/`canPostToFeed`
(`packages/services/src/org-feeds.ts:61`, `:71`). Migration 110 gave each
existing org a `general` feed (15 of 18 orgs have one on 2026-09-23); 113 made
it non-public. Helpers: `listOrgFeeds`, `getOrgFeed`,
`upsertOrgFeed`, `deleteOrgFeed`.

### Edges between threads

| table | migration | meaning | written by |
|---|---|---|---|
| `thread_references` | 031 | derived links: wikilinks and defined terms | `syncWikiLinks` (`wiki.ts:478`) deletes and rewrites a thread's whole set on each save; `defineTerm` (`wiki.ts:855`) adds one row |
| `thread_gathers` | 131 | deliberate grouping; relation `gathers`, `produced`, `talk` or `cites`; target is a thread (FK) or a `document`, `deck_card`, `deck_label`, `file`, `quote` or `link` via `target_ref` | `gatherOnto` (`gather.ts:677`); read with `getGathered`/`getGatheredBy`/`getGathering` |
| `thread_lines` | 137 | a line one person draws between two threads; `a_thread_id < b_thread_id`, unique per user | `drawLine`/`eraseLine` (`constellation.ts:256`) |
| `thread_orgs` | 031 | cross-posting into another org | app code |
| `thread_topics` | 030 | tags, shared by forum and wiki | `setWikiTopics`, forum write |

`getConstellation` (`constellation.ts:107`) merges these for the forum map.
`getGathered({ documentLinks })` defaults to false: documents carry a public
writable Nextcloud link, so only a caller that checked membership passes true.

### `thread_revisions` drift

Migration 031's file declares `id`/`thread_id` as `VARCHAR(21)` with a default on
`id` and a `created_at` column. The live table has `text` columns, no default on
`id`, and `changed_at` instead of `created_at`. `--verify` reports no drift
because it checks file checksums only. 4 rows; the only writer is
`apps/inner-gathering/src/app/api/content/route.ts:196`. Wiki history uses its own
table, `wiki_revisions` (118).

### Removal: archive, do not delete

`removeThread` (`packages/services/src/thread-admin.ts:34`) sets
`status = 'archived'` for the author (any of their identities) or a moderator,
logs `content_hidden` to `events`, and is idempotent. `deletePost`
(`posts.ts:284`), `deleteOrgDocument` and a rejected submission also archive.
39 tables reference `threads(id)`, most with `ON DELETE CASCADE`
(replies, reactions, RSVPs, gathers, rota rows), so a hard delete removes them.
Hard deletes that remain (2026-09-23): `deleteContentAction` in
`apps/{innergathering,amrit-canada,sunjay}/src/lib/cms/actions.ts:330` and
`deleteWritingPost` (`packages/services/src/writing.ts:368`).

### Moderation (156)

`threads.status` gained `pending`; `organizations.member_posts_review` defaults
to false. `packages/services/src/moderation.ts` holds the rule:
`statusForNewThread(userId, orgId, intent)` (`:83`) returns `draft` for drafts,
`published` for owners/guides/global admin, and `pending` for others only when
the org turned review on. `reviewThread` (`:144`) publishes (stamping
`published_at` if empty) or archives. Pending rows are invisible because reads
filter `status = 'published'`. 2026-09-23: only IFAC's `saveContentAction` calls
`statusForNewThread`.

### Questionnaires (088, 089, 103, 106)

`questionnaires` (key PK, `fields jsonb`, `kind` questionnaire/poll/wizard,
`scope` user/org, `status` draft/open/closed, `results_visibility`
admins/members/respondents/public, nullable `org_id` = platform wizard,
`thread_id`) + `questionnaire_responses.answers jsonb`; service
`packages/services/src/questionnaires.ts`; two rows, both `wizard`. 106 dropped
`gates_tier` and `users.network_tier`. Empty legacy poll tables remain because
inner-gathering still reads them.

### Meeting rota (136, 159)

A recurring gathering is one `threads` row; its occurrences are computed by
`expandOccurrences` (`packages/utils/src/recurrence.ts:120`) and have no id.
`meeting_hosts` PK `(thread_id, occurrence_at, role)` and
`meeting_occurrence_notes` PK `(thread_id, occurrence_at)` (`plan` added by 159;
`note` is the after-the-fact record) key on the occurrence timestamp. Service:
`packages/services/src/meeting-rota.ts`. `thread_reminder_sends` is keyed
`(thread, occurrence, kind)`. Weekly occurrences step 7 days in UTC, so local
times shift an hour across DST; changing that changes the keys and needs a data
migration.

### Member writing

A person's blog is `kind = 'writing'`, `author_id` = the person, `section` NULL,
`visibility = 'PUBLIC'`. Service `packages/services/src/writing.ts` scopes every
read by author and does no authorization (apps gate with `canEditProfile`).
Opt-in flag: `users.profile_sections.blog` (105).

### Wiki and dictionary (118, 122, 123, 126)

Wiki pages are `kind = 'wiki_page'`, `org_id = 'elkdonis'`, `INVITE_ONLY`, looked
up by slug alone (hence the partial unique index). Hierarchy is
`metadata.wikiParentId`; the slug never changes after creation. History:
`wiki_revisions`, one full snapshot per save. `updateWikiPage` takes
`expectedUpdatedAt` and throws `WikiConflictError` on mismatch (`wiki.ts:200`).
Each page may get a Talk topic: an ordinary `post` in the `wiki-talk` feed (126)
paired by `metadata.wikiTalkFor`, created on demand.

Dictionary: a term is a wiki page whose title is the term. `defineTerm` appends
to `metadata.definitions` with a jsonb `||` (no read-modify-write) and records a
`thread_references` edge from the source. `metadata.aliases` is matched with the
title. The editor mark stores only `<dfn data-term>`; `resolveTerms(html)` fills
definitions server-side when a thread is read.

Reading and editing are `@elkdonis/forum-ui` routes (`/wiki`, `/wiki/new`,
`/wiki/[slug]/edit|history`, `/dictionary`; `routes.tsx:60-65`). The
arts-collective `/hub/wiki` console was deleted 2026-09-17 (absent 2026-09-23).

### Write path

`@elkdonis/services` `createThread` (`packages/services/src/posts.ts:71`) writes
any kind: generates the id, allocates a unique slug with
`ensureUniqueThreadSlug(orgId, base, excludeId)` (`thread-slug.ts:28`), derives an
excerpt with `deriveExcerpt` (`packages/utils/src/strings.ts:77`), passes
`metadata` through `db.json`, and stamps `published_at` only when publishing.
`createPost` is a `kind = 'post'` wrapper. `updatePost` (`:231`) is org-scoped,
keeps the first `published_at` on re-publish, and matches `kind = 'post'` only;
it replaces `metadata` wholesale.

Callers of `createThread` include the services forum, writing, wiki, drawing,
ideas, Nextcloud-forum and calendar-sync modules, IFAC's `saveContentAction`,
fourthwayBookreaders, sophia and `openclaw-bridge`. About 20 hand-written
`INSERT INTO threads` remain (`grep -rn "INSERT INTO threads" apps packages`),
including the `lib/cms/actions.ts` of amrit-canada, innergathering, sunjay,
hidden-enneagram and arts-collective.

Editing through the shared compose surface
(`packages/cms-ui/src/surface/surfaces/ComposeSurface.tsx`) depends on four
links: the host's `connectors.saveThread` passing `threadId` to its action;
`defaultThreadToAnswers` (`ComposeSurface.tsx:403`) mapping every field back from
the thread; room creation (Talk, document) being idempotent; the host's thread
GET route returning every field the form maps. Form fields for all kinds are
declared once in `packages/cms-ui/src/compose/content-fields.ts`
(`buildContentFields`). The older Mantine tiers in
`packages/ui/src/components/content-form/tiers/` are used only by
`apps/inner-gathering`.

### Sanitisation

`packages/utils/src/sanitize.ts` (DOMPurify): `sanitizeRichText` (`:112`) keeps
`ALLOWED_TAGS` (`:19`) and `ALLOWED_ATTR` (`:40`), which include `dfn`, `abbr`,
`data-wiki-slug`, `data-wiki-new`, `data-term`, `data-definition`, `data-senses`,
`data-href`; iframes only from YouTube/Vimeo; links get
`rel="noopener noreferrer nofollow"`. `sanitizePostBody` (`:144`) adds
`<eac-embed>` markers. Silex pages and email templates have their own profiles
(`sanitize-silex.ts`, `sanitize-email.ts`).

Renderers (`ArticleView` in `@elkdonis/cms-ui/article`, `ThreadView` in
`@elkdonis/cms-ui/surface`, forum-ui) insert `bodyHtml` with
`dangerouslySetInnerHTML` and do not sanitise; the caller is expected to.
Sanitised on write: `forum-write.ts`, `writing.ts`, `nc-forum.ts`, forum-ui wiki
connectors, `openclaw-bridge`, `inner-gathering` `/api/content`. Sanitised on
read: arts-collective `ArticleBody.tsx:50`, `article-render.ts:112`. Neither on
write nor read (grep, 2026-09-23): `saveContentAction` in ifac,
innergathering, amrit-canada, sunjay, and the hub thread routes that return
`row.body` (for example `apps/ifac/src/app/api/hub/threads/[id]/route.ts:134`).
See Open items.

### Query conventions

- jsonb: pass objects with `db.json(value)`. `${JSON.stringify(x)}::jsonb`
  makes postgres.js encode the string again, storing a jsonb string (the two
  archived rows above). Remaining instances: `apps/pigeonshoot/src/lib/manage/actions.ts:423`
  and several in `apps/inner-gathering`.
- Merge metadata with `COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(...)`
  so other keys survive (`wiki.ts:903`).
- Timestamps: `timestamptz` keeps microseconds, JS `Date` milliseconds. Compare
  round-tripped values with `date_trunc('milliseconds', …)` on both sides
  (`wiki.ts:200`), or compute both sides in JS and pass
  `= ANY(${isos}::timestamptz[])` (`meeting-rota.ts:154`).
- A backtick anywhere inside a `` db`…` `` template, including in a `--` SQL
  comment, ends the template literal and breaks the build.
- `user_organizations.role` defaults to `member` (live and `schemas.ts:58`);
  always name the role in an insert.
- `users.auth_user_id` is NOT NULL with `CHECK (auth_user_id = id)` and no
  trigger on `public.users` fills it. Anonymous contributions use one seeded
  sentinel user as `author_id`, with attribution in a side table (pigeonshoot:
  `sentinelUserId` in `apps/pigeonshoot/src/config/site.ts:27`, migration 077).
  inner-gathering's `getOrCreateGuestUserId` (`apps/inner-gathering/src/lib/forum.ts:30`)
  omits `auth_user_id` and has never succeeded.

## Rules and constraints

- Filter by `org_id` on every tenant read and write, including by-id updates: an id alone lets one org write another's rows.
- Create threads with `createThread`: it is the one path with correct id, slug, excerpt and `published_at` handling.
- Archive rather than delete a thread: 39 tables reference it, most with `ON DELETE CASCADE`.
- Keep single-surface kinds off shared surfaces with `OFF_FEED_KINDS`: `visibility` cannot hide a kind.
- Check `\d <table>` before a hand-written query: several documented columns do not exist.
- Use `db.json()` for jsonb (not `JSON.stringify(x)::jsonb`, which stores a string); merge `metadata` with `||`.
- Sanitise rich text before storing or rendering it: the shared renderers do not.
- Never reuse a migration number or edit an applied migration: the runner refuses both.
- Use a sentinel user for anonymous authorship: `users.auth_user_id` must equal `id`.

## Open items

- Unsanitised thread bodies (verified by reading code 2026-09-23, not exploited):
  IFAC lets members post (`apps/ifac/src/lib/cms/actions.ts:293`); the body goes
  through `createThread` unsanitised and is returned raw by
  `/api/hub/threads/[id]` to `ThreadView`. The innergathering/amrit-canada/sunjay
  actions are editor-only but also unsanitised. Next step: sanitise in
  `createThread`/`updatePost` or at each action, and on read in the hub routes.
- Hard deletes in `deleteContentAction` (three org sites) and `deleteWritingPost`.
- `thread_revisions` live schema differs from 031; reconcile the file or retire
  the table once `apps/inner-gathering` is removed.
- About 20 hand-written `INSERT INTO threads` sites remain; `updatePost`
  handles `kind = 'post'` only and assigns `metadata` wholesale.
- Two archived `inner_group` threads have non-object `metadata`.
- `hidden-enneagram/src/lib/data.ts` and `elastrocal/src/lib/journal.ts` do not
  use `OFF_FEED_KINDS`; they filter by section or `kind = 'post'`. Not audited
  further.
- `identity_control` (132) is applied (2026-09-17), 0 rows; owned by the auth/profiles area.
- `docs/schema.mmd` is stale; regenerate or delete.

## Sources

Supersedes, for data-model content:
`docs/archive/THREADS_REFACTOR.md`, `docs/archive/HEADLESS_CMS_DIRECTION.md`
(axes section), `docs/archive/AUDIT_2026-09-06_network_state.md` and
`docs/archive/AUDIT_2026-09-06_findings_index.md` (migration and threads
sections), `docs/archive/GRAND_FORUM_PLAN.md` (section 3, schema),
`docs/schema.mmd`.

Memory files: `org_feeds_pattern`, `thread_revisions_schema_drift`,
`bug_inner_gathering_guest_users`, `project_threads_shared_namespace`,
`project_thread_write_path`, `project_thread_gathers`,
`project_thread_remove_feature`, `project_thread_kind_expansion`,
`project_member_writing`, `project_questionnaire_unification`,
`project_meeting_rota`, `project_org_moderation`, `project_wiki_pages`,
`project_network_dictionary`, `feedback_test_through_the_boundary`,
`feedback_edit_path`, `feedback_reuse_thread_forms`, `project_grand_forum`.

Corrections (2026-09-23): `OFF_FEED_KINDS` also holds `document`; migration 132
is applied (2026-09-17), not pending; `gates_tier` was dropped by 106, so the
"don't fix gates_tier" note is obsolete; listings and products are not thread
kinds (`artwork` table); the reusable form is the compose surface's
`content-fields.ts`, not the Mantine `content-form/tiers`.
