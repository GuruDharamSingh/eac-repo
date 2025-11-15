# Elkdonis Arts Collective - Multi-Organization Platform

Self-hosted network of interconnected apps with shared authentication and content aggregation.

## Architecture

**Single-schema PostgreSQL design:**
- One database (`elkdonis_dev`) with public schema
- All content tables include `org_id` for filtering
- Each app queries same database, filtered to its organization
- Forum aggregates across all orgs

**Stack:**
- Next.js 15 (App Router) + React 19
- PostgreSQL 16 + Supabase GoTrue (auth)
- Nextcloud 29 (file storage)
- Redis (cache)
- Turborepo monorepo (pnpm workspaces)

## Apps

```
apps/
├── inner-gathering/     Port 3004 - Mobile-first community app
├── forum/               Port 3003 - Cross-org content aggregator
├── admin/               Port 3000 - Admin dashboard
├── blog-sunjay/         Port 3001 - Personal blog
└── blog-guru-dharam/    Port 3002 - Personal blog
```

## Database Schema

**Core tables:**
```
organizations           Communities within the network
users                   Shared user accounts (UUID from Supabase)
user_organizations      Membership + roles (guide/member/viewer)
topics                  Hierarchical tags
```

**Content tables:**
```
posts                   Blog posts (title, body, slug, visibility)
meetings                Events (scheduling, RSVP, location)
replies                 Polymorphic comments (post/meeting/reply)
media                   Nextcloud-backed attachments
```

**System tables:**
```
events                  Activity audit log
post_topics             Post-tag junction
meeting_topics          Meeting-tag junction
meeting_attendees       RSVP tracking
```

**Forum tables (migration pending):**
```
reactions               Likes/upvotes (polymorphic)
watches                 Thread subscriptions
notifications           User alerts (reply/mention/reaction)
bookmarks               Saved content
flags                   Content reports
moderation_log          Audit trail of mod actions
```

## Shared Packages

```
packages/
├── db/                 PostgreSQL client + schema setup
├── auth/               Supabase auth wrapper
├── types/              TypeScript definitions
├── ui/                 Shared React components
├── hooks/              React hooks
├── services/           Business logic layer
├── utils/              Helper functions
├── nextcloud/          Nextcloud API client
├── config/             Shared configuration
└── events/             Event system utilities
```

## Quick Start

```bash
# Start infrastructure
docker-compose up -d

# Install dependencies
pnpm install

# Run migrations
docker exec -i eac-postgres psql -U postgres -d elkdonis_dev < packages/db/migrations/001_core_schema.sql

# Start all apps
pnpm dev

# Or start individual app
cd apps/inner-gathering && pnpm dev
```

**Access:**
- Inner Gathering: http://localhost:3004
- Forum: http://localhost:3003
- Admin: http://localhost:3000
- Nextcloud: http://localhost:8080
- Supabase Auth: http://localhost:9999

## Content Flow

1. User signs in (Supabase GoTrue)
2. User creates post/meeting in their org app
3. Content stored with `org_id` filter
4. Forum queries across all orgs (filtered by visibility)
5. Users react, comment, bookmark
6. Events logged for audit trail

## Configuration

See `.env` for:
- `DATABASE_URL` - PostgreSQL connection
- `SUPABASE_URL` + `JWT_SECRET` - Auth config
- `NEXTCLOUD_URL` + credentials - File storage

---

**Built for spiritual communities to share teachings, coordinate gatherings, and collaborate.**
