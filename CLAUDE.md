
22# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **multi-organization monorepo** for the Elkdonis Arts Collective - a self-hosted network of interconnected Next.js apps with shared authentication and content aggregation. Built for spiritual communities, art collectives, and educational groups to share teachings, coordinate gatherings, and collaborate.

**Tech Stack:**
- Next.js 16 (App Router) + React 19 + TypeScript
- PostgreSQL 16 (single database, multi-tenant via `org_id` filtering)
- Supabase GoTrue (authentication)
- Nextcloud 29 (file storage & CMS)
- Redis (cache)
- Silex (visual site builder integration)
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

# Start all Docker services (postgres, auth, redis, apps, etc.)
docker-compose up -d

# Run database migrations
docker-compose exec admin pnpm --filter @elkdonis/db db:migrate
```

### Development
```bash
# Start all apps in development mode (Note: many apps require Docker for network sharing)
pnpm dev

# Start single app
cd apps/admin && pnpm dev

# Start specific service in Docker
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
├── blog-sunjay/         Port 3001 - Personal blog (org: sunjay)
├── blog-guru-dharam/    Port 3002 - Personal blog (org: guru-dharam)
├── forum/               Port 3003 - Cross-org content aggregator (public feed)
├── inner-gathering/     Port 3004 - Mobile-first community app (org: elkdonis)
├── elkdonis-arts-collective/ Port 3005 - Main collective landing site
├── amrit-canada/        Port 3006 - Amrit Vela Toronto (org: amrit-vela)
├── arts-collective/     Port 3007 - Artist network & subdomain management
├── ifac/                Port 3008 - International Fine Art Collectors (org: ifac)
├── art-auction/         Port 3009 - Art marketplace and auctions
├── fourth-way-book-readers/ Port 3010 - Reading groups & book programs (org: fourth-way)
└── blog-tester/         Port 3011 - Sandbox for blog features
```

Each app operates independently but queries the same database filtered by its `org_id`.

### Shared Packages

```
packages/
├── db/                  PostgreSQL client + schema management + migrations
├── auth/                Supabase authentication wrapper (deprecated for client/server)
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
├── email/               SendGrid / SMTP email service
├── redis/               Redis client and caching logic
├── commerce/            Shared commerce/checkout logic
├── payments/            Payment gateway integrations (eTransfer, etc.)
├── checkout/            Unified checkout UI components
├── silex-nextcloud-connector/ Silex extension for Nextcloud storage
├── live-editor/         In-browser site editing components
├── reading-wizard/      Book reading session logic
└── three/               Three.js / 3D visualization utilities
```

**Critical package: `@elkdonis/db`**
- `src/client.ts` - PostgreSQL connection setup
- `src/schemas.ts` - Baseline table definitions
- `src/events.ts` - Activity audit log
- `scripts/migrate.mjs` - Transactional migration runner
- `migrations/*.sql` - Schema migrations

## Access Points

When services are running:
- **Admin Dashboard:** http://localhost:3000
- **Sunjay's Blog:** http://localhost:3001
- **Guru Dharam's Blog:** http://localhost:3002
- **Forum:** http://localhost:3003
- **Inner Gathering:** http://localhost:3004
- **Main Collective:** http://localhost:3005
- **Amrit Vela Toronto:** http://localhost:3006
- **Arts Network:** http://localhost:3007
- **IFAC:** http://localhost:3008
- **Art Auction:** http://localhost:3009
- **Book Readers:** http://localhost:3010
- **Blog Tester:** http://localhost:3011
- **Silex Editor:** http://localhost:6805
- **Nextcloud:** http://localhost:8080
- **Supabase Auth:** http://localhost:9999
- **Supabase Rest:** http://localhost:9998
- **Supabase Realtime:** http://localhost:4000

## Current Implementation Status

**Completed:**
- Core database schema with multi-tenant design
- Shared package architecture
- Docker-based development environment
- Basic CRUD operations for posts/meetings
- Event logging system (wide-net audit + admin veto)
- Transactional migration runner with checksum drift detection (2026-04-11)
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
- Unified `threads` schema refactor (migration 030 — consolidates posts/meetings/event_pages)
- Network app at `network.elkdonis-arts.org` (three-tier product: embed → workshop page → workshop app)
- Full Supabase authentication integration
- Media upload to Nextcloud
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