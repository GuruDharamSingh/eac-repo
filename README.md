# EAC Network - Multi-Organization Platform

A self-hosted network of interconnected apps with centralized forum and shared authentication.

## Architecture

**Single-Schema Database** approach:
- Single PostgreSQL database with one public schema
- Each org's content filtered by `org_id` column
- Simpler queries and easier aggregation
- Event-driven system aggregates content to central forum

## Apps

```
eac-repo/
├── apps/
│   ├── admin/              Port 3000 - Monitor & approve forum posts
│   ├── blog-sunjay/        Port 3001 - Sunjay's personal blog
│   ├── blog-guru-dharam/   Port 3002 - Guru Dharam's personal blog
│   └── forum/              Port 3003 - Aggregated activity feed
├── packages/
│   ├── db/                 PostgreSQL with schema routing + events
│   ├── auth/               Shared Supabase authentication
│   └── types/              Shared TypeScript types
```

## How It Works

1. **User creates post** in their blog app (`/admin` page)
2. **Event logged** to `public.events`
3. **If auto-share enabled** → Added to `forum_queue`
4. **Admin approves** → Content copied to `forum_posts`
5. **Forum displays** all approved content from all orgs

## Database Structure

```sql
-- All in public schema
organizations, users, user_organizations

-- Content tables (all filtered by org_id)
posts, pages, media

-- Event & forum system
events, forum_queue, forum_posts, forum_replies
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Start all services
docker-compose up -d

# Initialize database (creates all schemas)
docker-compose exec admin pnpm --filter @elkdonis/db db:migrate

# Access apps
- Admin Dashboard: http://localhost:3000
- Sunjay's Blog: http://localhost:3001
  - Create Entry: http://localhost:3001/entry
- Guru Dharam's Blog: http://localhost:3002
  - Create Entry: http://localhost:3002/entry
- Community Forum: http://localhost:3003
- Nextcloud: http://localhost:8080
```

## Creating Blog Posts

Each blog has an `/entry` page with a rich form including:
- Title and excerpt
- Rich text editor (bold, italic, headings, lists, links)
- Media upload (drag & drop, up to 5 files, 10MB each)
- Tags
- External link field
- Forum thread creation toggle
  - Auto-submits to forum queue if enabled
  - Custom thread title or uses post title

## Key Features

✅ **Independent Apps** - Each blog runs autonomously
✅ **Single Sign-On** - Supabase auth shared across all apps
✅ **Event Tracking** - All activity logged centrally
✅ **Forum Aggregation** - Approved content from all apps in one feed
✅ **Schema Isolation** - Each org's data is separated
✅ **Self-Hosted** - PostgreSQL, Nextcloud, all local

## Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Database**: PostgreSQL 16 (schema-per-org)
- **Auth**: Supabase (self-hosted)
- **Storage**: Nextcloud (self-hosted)
- **Cache**: Redis
- **Deployment**: Docker Compose

## Documentation

- [Architecture Overview](./ARCHITECTURE_SIMPLE.md)
- [App Template Guide](./APP_TEMPLATE.md)
- [Docker Setup](./DOCKER_SETUP.md)

## Adding a New Blog

1. Copy blog template:
   ```bash
   cp -r apps/blog-sunjay apps/blog-newname
   ```

2. Update `ORG_ID` in the app's pages

3. Add to `docker-compose.yml`

4. Register in database (runs automatically on migration)

---

Built for the Elkdonis Arts Collective network.