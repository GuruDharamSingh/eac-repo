# Next Agent Brief: Feed Performance + PWA + Headless CMS Prep

## Codebase Orientation

Read `CLAUDE.md` at the repo root first — it covers the full architecture, commands, and conventions. This is a multi-org monorepo where `inner-gathering` (port 3004, Docker-only) is the primary community app. It runs Next.js 15 (App Router) + React 19 + Mantine 8.3.2 + PostgreSQL.

Key context from recent work:
- Migration 016 added `comment_color` to users table
- `mapMeeting()` in `apps/inner-gathering/src/lib/data.ts` hydrates guide avatars
- The feed page server-renders ALL meetings + posts in a single waterfall call

## Task 1: Lazy Loading on the Feed Page

### Current Problem
`apps/inner-gathering/src/lib/data.ts` → `getFeed()` calls `getMeetings()` + `getPosts()` in parallel, each returning up to 50 items with full media subqueries (cover image + all media via LATERAL JOINs). The feed page (`apps/inner-gathering/src/app/page.tsx`) renders everything at once — no pagination, no virtualization.

### Files to Study First
- `apps/inner-gathering/src/app/page.tsx` — the feed page (server component, calls `getFeed()`)
- `apps/inner-gathering/src/lib/data.ts` — `getFeed()`, `getMeetings()`, `getPosts()` queries
- `apps/inner-gathering/src/components/meeting-card.tsx` — heavy card component (cover images, realtime attendee hooks, RSVP state checks)
- `apps/inner-gathering/src/components/feed.tsx` (if it exists, or the feed rendering may be inline in `page.tsx`)

### Recommended Approach
1. **Cursor-based pagination on the API**: Add a `/api/feed` route that accepts `cursor` (last item's `createdAt`) and `limit` (default 10). The existing `getFeed()` already sorts by `createdAt DESC` — add `WHERE created_at < ${cursor}` and `LIMIT ${limit}` to both `getMeetings` and `getPosts`, then merge/sort/slice.

2. **Client-side infinite scroll**: Create a `<FeedList>` client component that:
   - Receives the first page of items from the server component (SSR the initial batch)
   - Uses `IntersectionObserver` on a sentinel element to trigger loading the next page
   - Calls `/api/feed?cursor=...&limit=10`
   - Appends results to state

3. **Lazy load images**: The `MeetingCard` already uses `next/image` with `unoptimized` for cover images. Consider adding `loading="lazy"` (it's the default for `next/image` but verify). For avatars from Nextcloud proxy URLs, they're small enough to not matter much.

4. **Defer non-critical hydration**: Each `MeetingCard` runs `useRealtimeAttendees` and `checkRsvpStatus` on mount. Consider only activating these for cards that are visible (intersection observer) or deferring them behind `requestIdleCallback`.

### What NOT to Do
- Don't add a virtual scroll library — the feed items have variable height (cover images, media) and it's mobile-first, so virtual scroll adds complexity for marginal gain at 50 items
- Don't split the single `getFeed()` into separate meeting/post endpoints — keep the unified chronological feed

---

## Task 2: PWA Preparation

### Goal
Make `inner-gathering` installable as a Progressive Web App on mobile devices. This is the primary interface for the community — it needs to feel native.

### Recommended Approach
1. **Use `@serwist/next`** (successor to `next-pwa`, actively maintained, works with App Router + Next.js 15). Add to `apps/inner-gathering/package.json`.

2. **Create `manifest.json`** in `apps/inner-gathering/public/`:
   - `name`: "InnerGathering"
   - `short_name`: "Gather"
   - `start_url`: "/"
   - `display`: "standalone"
   - `theme_color`: match the indigo theme used throughout (`#4c6ef5`)
   - `background_color`: white or dark depending on theme
   - Generate icons at 192x192 and 512x512

3. **Service worker strategy**:
   - **NetworkFirst** for API routes and pages (always fresh when online)
   - **CacheFirst** for static assets, Nextcloud proxy images (`/api/nextcloud/file/*`)
   - **StaleWhileRevalidate** for the feed page itself
   - Pre-cache the app shell: `/`, `/account`, `/meetings/[id]` layout

4. **Offline support** (phase 2, not required now): Cache the last-viewed feed and meeting pages for offline reading. The comment composer could queue submissions in IndexedDB.

5. **Meta tags**: Add to `apps/inner-gathering/src/app/layout.tsx`:
   - `<meta name="theme-color">`
   - `<link rel="manifest">`
   - Apple-specific meta tags for iOS

### Key Constraint
inner-gathering runs **only in Docker** (`docker compose up -d --build inner-gathering`). It does NOT run via `pnpm dev`. The Dockerfile is at `apps/inner-gathering/Dockerfile`. Any build config changes (like the Serwist webpack plugin) need to work in this Docker build context.

---

## Task 3: Headless CMS Prep for Blog Apps

### Current Architecture
Right now, each blog app (`blog-sunjay` port 3001, `blog-guru-dharam` port 3002) has its own Next.js frontend that queries the shared PostgreSQL database directly via `@elkdonis/db`, filtered by `org_id`. Content is created in each blog's own admin interface.

The forum app (`port 3003`) aggregates content via the `forum_queue` → admin approval → `forum_posts` workflow.

### Target Architecture
inner-gathering becomes the **content management hub** where guides create and manage content for ALL organizations. The blog apps become **thin rendering frontends** that consume content via API.

### Suggested Implementation Path

**Phase 1: Content API in inner-gathering**
- Create `apps/inner-gathering/src/app/api/cms/[orgId]/posts/route.ts` — returns published posts for a given org
- Create `apps/inner-gathering/src/app/api/cms/[orgId]/meetings/route.ts` — returns published meetings for a given org
- These are public read endpoints (no auth required, respect `visibility` field)
- Support query params: `?limit=`, `?cursor=`, `?status=published`
- Return clean JSON matching the existing `Post` / `Meeting` types from `@elkdonis/types`

**Phase 2: Blog apps consume the API**
- Blog apps replace direct DB queries with `fetch('http://inner-gathering:3004/api/cms/sunjay/posts')` (internal Docker network)
- This decouples the blogs from the database schema — they only depend on the API contract
- Blog apps can be statically generated with ISR, fetching from the CMS API at build/revalidation time

**Phase 3: Content creation UI in inner-gathering**
- The meeting/post creation forms in inner-gathering already work for `inner_group` org
- Add an org switcher for guides who belong to multiple organizations (check `user_organizations` table)
- The `org_id` parameter in `createMeeting()` and `createPost()` in `data.ts` is currently hardcoded to `'inner_group'` — make it dynamic based on the selected org

### Key Files for CMS Work
- `packages/types/src/post.ts`, `packages/types/src/meeting.ts` — the API contract types
- `apps/inner-gathering/src/lib/data.ts` — all the query functions (currently hardcoded `ORG_ID = 'inner_group'`)
- `packages/db/src/schemas.ts` — the shared database schema
- `apps/blog-sunjay/src/lib/data.ts` (or similar) — see how blogs currently fetch data
- `docker-compose.yml` — network configuration (all services share `eac-net`)

### Important: Don't Break the Monorepo Pattern
The `@elkdonis/db`, `@elkdonis/types`, and `@elkdonis/services` packages are shared. The CMS API should reuse the existing query functions from `data.ts` (or factor them into `@elkdonis/services`) rather than duplicating SQL. The blog apps should still be able to fall back to direct DB access during the transition.

---

## Quick Reference

| Service | Port | Docker Service Name | Runs Via |
|---------|------|-------------------|----------|
| inner-gathering | 3004 | inner-gathering | Docker only |
| blog-sunjay | 3001 | blog-sunjay | pnpm dev or Docker |
| blog-guru-dharam | 3002 | blog-guru-dharam | pnpm dev or Docker |
| forum | 3003 | forum | pnpm dev or Docker |
| admin | 3000 | admin | pnpm dev or Docker |
| PostgreSQL | 5432 | postgres | Docker |
| Supabase Auth | 9999 | supabase-auth | Docker |
| Redis | 6379 | redis | Docker |

### Commands
```bash
# Rebuild inner-gathering after changes
docker compose up -d --build inner-gathering

# View logs
docker compose logs -f inner-gathering

# Run migration
docker compose exec postgres psql -U postgres -d elkdonis_dev -f /path/to/migration.sql
# Or: docker compose exec admin pnpm --filter @elkdonis/db db:migrate

# Check types
pnpm check-types
```
