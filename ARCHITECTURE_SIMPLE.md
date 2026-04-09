# EAC Network Architecture - Simplified

## What We Built

A self-hosted network where multiple apps share infrastructure but maintain independence.

## Core Design

```
Single PostgreSQL Database
├── public schema (shared data)
│   ├── organizations
│   ├── users (Supabase auth)
│   ├── events (activity log)
│   ├── forum_queue (pending approval)
│   └── forum_posts (approved content)
│
├── org_elkdonis schema (blog content)
│   ├── posts
│   ├── pages
│   └── media
│
├── org_events schema (events app content)
│   ├── posts
│   ├── pages
│   └── media
│
└── org_[new] schema (future apps...)
```

## How Content Flows to Forum

```
1. User publishes in Blog App
      ↓
2. Event logged to public.events
      ↓
3. If auto-share enabled → Added to forum_queue
      ↓
4. Admin approves in dashboard
      ↓
5. Content COPIED to forum_posts
      ↓
6. Forum app displays it
```

## Apps in the Monorepo

- **apps/admin** - Dashboard for monitoring and approvals
- **apps/forum** - Public activity feed (displays approved content)
- **apps/blog-sunjay** - Sunjay's personal blog
- **apps/blog-guru-dharam** - Guru Dharam's personal blog
- **apps/[future]** - Events, links, collab apps to be added

## Docker Services

- **postgres** - Single database, multiple schemas
- **supabase-auth** - Authentication only
- **nextcloud** - Media storage
- **redis** - Caching
- **admin** - Admin dashboard (port 3000)
- **blog-sunjay** - Sunjay's blog (port 3001)
- **blog-guru-dharam** - Guru Dharam's blog (port 3002)
- **forum** - Forum app (port 3003)

## Key Files

- `packages/db/` - Database client with schema routing
- `packages/auth/` - Shared authentication
- `docker-compose.yml` - Local development setup

## To Run

```bash
# Start everything
docker-compose up -d

# Initialize database
docker-compose exec admin pnpm --filter @elkdonis/db db:migrate

# Access
- Admin: http://localhost:3000
- Sunjay's Blog: http://localhost:3001
- Guru Dharam's Blog: http://localhost:3002
- Forum: http://localhost:3003
```

## Next Steps

1. Build admin UI for approving forum posts
2. Create first blog app
3. Test the full flow