# Everything Is a Thread

## Philosophy

The old schema had separate `posts` and `meetings` tables with duplicated columns and diverging features. The new model consolidates into a single `threads` table with a `kind` discriminator (`post`, `meeting`, `workshop`). This is the Substack/Twitter pattern — every piece of content is fundamentally the same object, differentiated by metadata.

A post is a thread. A meeting is a thread with a date. A workshop is a meeting with sessions and pricing. Kind transitions are first-class — a post can be promoted to a meeting, a meeting to a workshop — and each transition is snapshot-archived in `thread_revisions`.

### Key design decisions

- **Explicit kind selection** — the content form uses a SegmentedControl (Post / Meeting / Workshop), not inference from filled fields. Users pick what they're making.
- **`is_meeting` is an intent flag** — decoupled from `scheduled_at`. A meeting with no date yet is still a meeting ("TBD").
- **Two date concepts** — "Publish at" delays visibility (scheduled publishing). "Meeting time" is when the gathering happens. These are independent.
- **Cross-posting via `thread_orgs`** — a thread belongs to one primary org (`threads.org_id`) but can appear in others via the join table. Only CMS-flagged sites can cross-post.
- **`thread_references`** — formal backlinks between threads (e.g., tagging a related meeting from a post).
- **`thread_revisions`** — JSONB snapshot of the prior state on every kind transition, for audit trail.

## Migrations applied

- **030_unified_threads_schema.sql** — creates `threads` from `posts` + `meetings`, migrates data, drops old tables. One-way door.
- **031_content_form_foundation.sql** — adds `is_meeting`, `thread_revisions`, `thread_orgs`, `thread_references`, CMS flags on `organizations`.

These are applied on the dev database. Anyone pulling fresh needs to run `pnpm --filter @elkdonis/db db:migrate`.

## What changed

### New files
- `packages/ui/src/components/content-form/` — unified content creation form (SegmentedControl, conditional fields, media upload, integrations drawer, sticky publish bar)
- `packages/types/src/workshop.ts` — Workshop, WorkshopSession, WorkshopResource types
- `packages/ui/src/components/workshop-ui.tsx` — DigitalFlyer, GuideBadge, ActionCard, StickyBottomBar
- `apps/inner-gathering/src/app/api/content/route.ts` — unified publish endpoint (threads + workshop_details + workshop_sessions + thread_orgs + thread_references + Talk room + document URL)
- `apps/inner-gathering/src/components/gathering-details.tsx` — detail view for meetings/workshops
- `apps/inner-gathering/src/app/network-mock/amrit-vela/` — mock workshop detail page
- `apps/admin/src/components/WorkshopForm.tsx` — admin workshop promotion form
- `packages/db/scripts/migrate.mjs` — ESM rewrite of migration runner (replaces migrate.js)
- `docs/` — schema documentation

### Modified files (threads refactor)
Files that changed `FROM meetings` / `FROM posts` → `FROM threads`:
- `apps/inner-gathering/src/lib/data.ts` — all queries rewritten for threads table
- `apps/inner-gathering/src/lib/actions.ts` — createMeetingAction/createPostAction still work (threads table)
- `apps/admin/src/lib/data.ts` — queries rewritten for threads
- `apps/admin/src/app/api/meetings/route.ts` — INSERT INTO threads
- `apps/amrit-canada/src/lib/data.ts` — queries rewritten for threads
- `apps/amrit-canada/src/lib/actions.ts` — queries rewritten
- `packages/db/src/queries/forum.ts` — forum aggregation queries
- `packages/services/src/meetings.ts`, `posts.ts`, `calendar-sync.ts`, `nextcloud-sync.ts` — service layer
- `packages/blog-server/src/posts.ts` — blog queries
- `packages/types/src/index.ts`, `reply.ts` — type exports updated

### Deleted files
- ~30 root-level markdown docs (APP_TEMPLATE.md, ARCHITECTURE_*.md, SESSION_SUMMARY, etc.) — stale documentation cleanup
- `packages/db/scripts/migrate.js` — replaced by migrate.mjs
- `packages/db/src/forum-sync.ts` — obsolete

## Pre-existing type errors

These errors exist in files **not touched** by this refactor. They predate the threads migration and are tracked here so they aren't confused with regressions.

### inner-gathering
| File | Errors | Cause |
|------|--------|-------|
| `calendar-client.tsx` | `startTime`, `status` on Meeting | Old Meeting type used `startTime`; current type uses `scheduledAt` |
| `calendar/meeting-calendar.tsx` | `startTime`, DatePicker prop types | Same `startTime` rename + Mantine 8 API change for DatePicker |
| `home-client.tsx` | `start_time`, `author_name` | Snake-case field names from old schema |
| `live-video-player.tsx` | `@elkdonis/nextcloud/components` module | Subpath export + moduleResolution mismatch (works at runtime) |
| `post-card.tsx` | Group component prop | Mantine 8 polymorphic component type change |
| `recurring-meetings-carousel.tsx` | Paper component prop | Same Mantine 8 polymorphic type issue |
| `poll-creator.tsx` | `string[]` vs `Date[]` | State type mismatch in date handling |
| `tailwind.config.ts` | Missing `tailwindcss` types | Tailwind not installed (app uses Mantine) |

### admin
| File | Errors | Cause |
|------|--------|-------|
| `meeting-card.tsx` | `startTime`, `endTime`, `name` | Old Meeting/User field names |
| `dashboard/page.tsx` | `getMeetingsByUser`, `getRSVPsByUser` | Functions removed/renamed |
| `lib/data.ts` | `MeetingType`, `MeetingStatus` | Types removed from @elkdonis/types |
| `lib/actions.ts` | `MeetingType` | Same |
| `new-meeting-form.tsx` | `meetingType` | Old form field |
| `api/moderation/route.ts`, `events/page.tsx` | `@elkdonis/db/events` module | Subpath export |

### amrit-canada
| File | Errors | Cause |
|------|--------|-------|
| `admin-meeting-form.tsx` | `db_user_id` on AuthUser | Old auth field name |
| `create-meeting-form.tsx` | DatePicker type | Mantine 8 API |
| `sadhana-card.tsx` | `@/lib/types` module | Missing local types file |

### packages
| File | Errors | Cause |
|------|--------|-------|
| `packages/ui` (button.tsx, dialog.tsx, utils.ts) | radix-ui, class-variance-authority, tailwind-merge | Shadcn remnants — app uses Mantine |
| `packages/nextcloud` (CalendarEmbed, FileUploader) | `window`, input `files` | DOM types not in tsconfig |

## What's next

- Workshop-specific feed card (currently using MeetingCard)
- Drafts page + `/api/drafts`
- Clean up orphaned tier files from old content form layout
- Retire old `CreateContentForm` once new form is confirmed
- Fix pre-existing type errors above (separate effort)
- ExtraFields, thread references UI, report-issue button in content form
- `/admin/organizations` page with CMS toggles
