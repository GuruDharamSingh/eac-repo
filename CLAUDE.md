
22# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **multi-organization monorepo** for the Elkdonis Arts Collective - a self-hosted network of interconnected Next.js apps with shared authentication and content aggregation. Built for spiritual communities to share teachings, coordinate gatherings, and collaborate.

**Tech Stack:**
- Next.js 15 (App Router) + React 19 + TypeScript
- PostgreSQL 16 (single database, multi-tenant via `org_id` filtering)
- Supabase GoTrue (authentication)
- Nextcloud 29 (file storage)
- Redis (cache)
- Turborepo + pnpm workspaces
- Mantine 8.3.2 (UI components)

## Essential Commands

### Initial Setup
```bash
# Install dependencies
pnpm install

# Build shared packages (REQUIRED before starting apps)
pnpm --filter @elkdonis/db build
pnpm --filter @elkdonis/ui build

# Start all Docker services (postgres, auth, apps, etc.)
docker-compose up -d

# Run database migrations
docker-compose exec admin pnpm --filter @elkdonis/db db:migrate
```

### Development
```bash
# Start all apps in development mode (EXCEPT inner-gathering)
# Note: inner-gathering ONLY runs in Docker to share the Docker network
pnpm dev

# Start single app (NOT for inner-gathering)
cd apps/admin && pnpm dev

# Start inner-gathering (Docker ONLY)
docker compose up -d inner-gathering

# Build all apps
pnpm build

# Type check all packages
pnpm check-types

# Lint all code
pnpm lint

# Format code
pnpm format
```

### Docker Operations
```bash
# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f blog-sunjay

# Restart single service
docker-compose restart admin

# Rebuild and restart after code changes
docker-compose up -d --build

# Stop all services
docker-compose down

# Reset database (WARNING: deletes all data)
docker-compose down -v
```

### Database Management
```bash
# Run migrations from db package
pnpm --filter @elkdonis/db db:migrate

# Seed database
pnpm --filter @elkdonis/db db:seed

# Access PostgreSQL directly
docker-compose exec postgres psql -U postgres -d elkdonis_dev
```

### Testing Individual Features
```bash
# Run single test file (example)
cd apps/forum && pnpm test src/app/api/posts/route.test.ts
```

## Architecture

### Single-Schema Multi-Tenant Database

All apps share **one PostgreSQL database** (`elkdonis_dev`) with a **single `public` schema**. Content isolation is achieved through an `org_id` column on all content tables.

**Key pattern:** Always filter queries by `org_id`:
```typescript
import { db } from '@elkdonis/db';

// Get posts for specific organization
const posts = await db`
  SELECT * FROM posts
  WHERE org_id = 'sunjay'
    AND status = 'published'
  ORDER BY published_at DESC
`;
```

### Applications Structure

```
apps/
├── admin/               Port 3000 - Central dashboard for monitoring/approving content
├── forum/               Port 3003 - Cross-org content aggregator (public feed)
├── blog-sunjay/         Port 3001 - Personal blog (org: sunjay)
├── blog-guru-dharam/    Port 3002 - Personal blog (org: guru-dharam)
└── inner-gathering/     Port 3004 - Mobile-first community app (org: elkdonis) 
```

Each app operates independently but queries the same database filtered by its `org_id`.



### Shared Packages

```
packages/
├── db/                  PostgreSQL client + schema management + migrations
├── auth/                Supabase authentication wrapper
├── auth-server/         Server-side auth utilities
├── auth-client/         Client-side auth utilities
├── types/               Centralized TypeScript definitions
├── ui/                  Shared Mantine React components
├── hooks/               Custom React hooks
├── services/            Business logic layer (database queries)
├── utils/               Helper functions
├── blog-client/         Blog-specific client functionality
├── blog-server/         Blog-specific server functionality
├── nextcloud/           Nextcloud API client
├── config/              Shared ESLint/Prettier config
└── events/              Event system utilities
```

**Critical package: `@elkdonis/db`**
- `src/client.ts` - PostgreSQL connection setup
- `src/schemas.ts` - Database table definitions
- `src/events.ts` - Event logging and forum queue workflow
- `src/forum-sync.ts` - Forum-specific helpers (pagination, search)
- `migrations/*.sql` - Schema migrations

### Event-Driven Forum Workflow

Individual blogs operate independently. When sharing content to the forum:

1. User creates post with `share_to_forum = true`
2. Call `Events.submitToForumQueue(postId, orgId)` to add to queue
3. Admin views queue with `Events.getForumQueue()` in admin app
4. Admin approves with `Events.approveForForum(queueId, adminId)`
5. Content is copied to `forum_posts` table
6. Forum app displays aggregated content from `forum_posts`

### Database Schema Patterns

**Core tables:**
- `organizations` - Communities within the network
- `users` - Shared user accounts (UUID from Supabase)
- `user_organizations` - Membership + roles (guide/member/viewer)
- `topics` - Hierarchical tags for content

**Content tables (all have `org_id`):**
- `posts` - Blog posts (title, body, slug, status, visibility, share_to_forum)
- `meetings` - Events (scheduling, location, RSVP tracking)
- `replies` - Polymorphic comments (can reply to posts/meetings/replies)
- `media` - Nextcloud-backed file attachments

**System tables:**
- `events` - Activity audit log for all actions
- `forum_queue` - Pending content for admin approval
- `forum_posts` - Approved content displayed in forum app

**Forum engagement tables:**
- `reactions` - Likes/upvotes (polymorphic)
- `watches` - Thread subscriptions
- `notifications` - User alerts
- `bookmarks` - Saved content
- `flags` - Content reports
- `moderation_log` - Audit trail

## Code Conventions

### Always Filter by org_id
When querying content tables, **always filter by `org_id`** to ensure data isolation:
```typescript
// Good
const posts = await db`SELECT * FROM posts WHERE org_id = ${orgId}`;

// Bad - will return data from all organizations
const posts = await db`SELECT * FROM posts`;
```

### Creating Content
Always include `org_id` when inserting:
```typescript
import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

const post = {
  id: nanoid(),
  orgId: 'sunjay',
  authorId: userId,
  title: 'My Post',
  slug: 'my-post',
  body: 'Content here',
  status: 'draft',
  shareToForum: false
};

await db`INSERT INTO posts ${db(post)}`;
```

### Using Transactions
The `postgres` package supports transactions for multi-step operations:
```typescript
await db.begin(async (tx) => {
  await tx`INSERT INTO posts ${db(post)}`;
  await tx`INSERT INTO post_topics ${db(topicRelations)}`;
});
```

### Authentication
Authentication is handled by `@elkdonis/auth` package using Supabase GoTrue. User identity is stored as UUID from Supabase auth system.

**Note:** Authentication is partially implemented - some areas still use placeholder user IDs.

## Monorepo Workflow

### Turborepo Task Execution
Tasks defined in `turbo.json`:
- `build` - Builds packages/apps with dependency graph awareness
- `dev` - Runs development servers (no caching, persistent)
- `lint` - Runs ESLint
- `check-types` - TypeScript type checking

**Key behavior:** Tasks with `dependsOn: ["^build"]` will automatically build dependencies first.

### Adding Dependencies
```bash
# Add to workspace root
pnpm add <package> -w

# Add to specific app/package
pnpm --filter @elkdonis/admin add <package>

# Add dev dependency
pnpm --filter @elkdonis/ui add -D <package>
```

### Creating New Packages
1. Create directory in `packages/`
2. Add `package.json` with `name: "@elkdonis/<name>"`
3. Configure `tsup.config.ts` for build
4. Export from `src/index.ts`
5. Build: `pnpm --filter @elkdonis/<name> build`

## Important Files

- **`docker-compose.yml`** - Complete stack definition (all services and ports)
- **`SETUP-NEXT-STEPS.md`** - Step-by-step setup instructions (critical read)
- **`.github/copilot-instructions.md`** - Detailed AI agent guidance (more context)
- **`turbo.json`** - Build task configuration
- **`pnpm-workspace.yaml`** - Workspace definition
- **`packages/db/src/schemas.ts`** - Database table structure

## Access Points

When services are running:
- Admin Dashboard: http://localhost:3000
- Sunjay's Blog: http://localhost:3001
- Guru Dharam's Blog: http://localhost:3002
- Forum: http://localhost:3003
- Inner Gathering: http://localhost:3004
- Nextcloud: http://localhost:8080
- Supabase Auth: http://localhost:9999

## Current Implementation Status

**Completed:**
- Core database schema with multi-tenant design
- Shared package architecture
- Docker-based development environment
- Basic CRUD operations for posts/meetings
- Event logging system
- Forum queue/approval workflow structure
- **Nextcloud user provisioning with app passwords** (2025-11-01)
  - Database migration 006 adds `nextcloud_app_password` column
  - Admin UI shows user table with individual sync buttons
  - `getServerSession()` returns credentials for API authentication
- **Server-side auth API routes** (2025-11-01)
  - Created `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`, `/api/auth/session`
  - Fixes CORS issues by handling auth server-side
  - Same code works in dev and production with separate domains
- **Profile pictures, comment colors, and guide avatars** (2026-02-13)
  - Migration 016 adds `comment_color VARCHAR(7)` to users table (`avatar_url` already existed)
  - Account page (`/account`) now has clickable avatar upload (via existing `/api/upload`) and a `ColorInput` for comment color preference
  - Account API (`/api/account`) GET returns `commentColor`, PATCH accepts `avatarUrl` and `commentColor`
  - Meeting queries in `data.ts` now fetch `u.avatar_url as guide_avatar`; `mapMeeting()` passes it to `guide`/`creator`
  - Meeting cards and event page view show guide avatar (`Avatar` component) instead of generic user icon
  - Replies API (`/api/meetings/[id]/replies` POST) queries user profile for `display_name`, `avatar_url`, `comment_color` to enrich optimistic replies
  - `getReplies()` in `packages/db/src/queries/forum.ts` selects `u.comment_color`; `Reply` interface includes `commentColor`
  - `CommentItem` applies `commentColor` as inline style on the commenter's name
  - `ReplyData` interfaces across `comment-item.tsx`, `comment-section.tsx`, and `event-page-view.tsx` include `commentColor`
- **Fullscreen image lightbox, Nextcloud file picker, Excalidraw drawing** (2026-02-14)
  - **ImageLightbox** (`packages/ui/src/components/image-lightbox.tsx`): Mantine fullscreen Modal for viewing images, exported from `@elkdonis/ui`
  - **MediaPlayer** now accepts `onImageClick` prop; images get `cursor: pointer` when handler is provided
  - **MediaGallery** has built-in lightbox support (`enableLightbox` defaults to `true`) — both blog apps get fullscreen images automatically on post detail pages
  - **MeetingCard** (`meeting-card.tsx`): cover images and image attachments are now clickable for fullscreen viewing
  - **MediaUpload** (`packages/ui/src/components/MediaUpload.tsx`): now supports Upload/Library tabs via `enableLibrary` + `orgId` props; Library tab integrates `FileBrowser` for selecting existing Nextcloud files
  - **SelectedNextcloudFile** type added to `@elkdonis/hooks` (`useMeetingForm.ts`) and `@elkdonis/ui`; `MeetingFormData` includes `selectedFiles` array
  - **MeetingForm** accepts `enableLibrary` and `orgId` props, passed through to MediaUpload
  - **CreateMeetingForm** in inner-gathering enables library with `orgId="inner_group"`; selected Nextcloud files are included in meeting media alongside uploads
  - **ExcalidrawEditor** (`packages/ui/src/components/excalidraw-editor.tsx`): shared wrapper around `@excalidraw/excalidraw` with lazy loading, edit/read-only modes, exported from `@elkdonis/ui`
  - Migration 017 adds `drawing JSONB DEFAULT NULL` column to `event_pages` table
  - **EventPage** type in `@elkdonis/types` includes optional `drawing` field
  - **Event page editor** has a toggle to enable drawing canvas (opt-in, not default)
  - **Event page view** displays saved drawings in read-only mode
  - Data layer (`data.ts`) and API route (`/api/meetings/[id]/event-page`) handle `drawing` field

**In Progress:**
- Full Supabase authentication integration
- Media upload to Nextcloud
- Admin UI for forum queue approval
- Enhanced forum post display
- Real-time features (subscriptions, notifications)

## Troubleshooting

**Build failures:**
- Ensure shared packages are built first: `pnpm --filter @elkdonis/db build && pnpm --filter @elkdonis/ui build`
- Clear turbo cache: `rm -rf .turbo`

**Database connection issues:**
- Verify postgres is running: `docker-compose ps postgres`
- Check logs: `docker-compose logs postgres`
- Test connection: `docker-compose exec postgres psql -U postgres -d elkdonis_dev -c '\l'`

**Apps not starting:**
- Check if ports are in use: `sudo netstat -tulpn | grep :3000`
- View app logs: `docker-compose logs -f <app-name>`
- Rebuild containers: `docker-compose up -d --build`

**Migration failures:**
- Ensure postgres is ready (wait ~10s after starting)
- Run manually: `docker-compose exec admin sh -c "cd packages/db && pnpm db:migrate"`
- Check migration status: `docker-compose exec postgres psql -U postgres -d elkdonis_dev -c '\dt'`