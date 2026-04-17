# Elkdonis Arts Collective (EAC) Network - AI Agent Guide

This document provides essential guidance for AI agents working on the EAC Network codebase. Understanding these concepts is critical for being productive.

## 1. The Big Picture: Architecture

This is a **multi-organization monorepo** built with pnpm, Turborepo, and Next.js. The entire stack is designed to be self-hosted using Docker.

The core architectural concepts are:
- **Single-Schema Database with org_id Filtering**: A single PostgreSQL database with one schema serves all applications. Content is logically separated using an `org_id` column on each table (simpler than schema-per-org). This makes queries straightforward and aggregation across orgs trivial.
- **Direct Forum Aggregation**: Individual apps (like blogs) operate independently. The forum app reads directly from `posts`/`meetings`/`replies` across all orgs — there is NO queue table, NO approval step, and NO content copying. Admins control forum surfacing through moderation actions (hide, pin, lock, visibility override) logged in the `events` table.
- **Dockerized Environment**: All services (PostgreSQL, Supabase for auth, Nextcloud for storage, Redis, and all Next.js apps) are managed via `docker-compose.yml`.

## 2. Key Files & Directories

- **`docker-compose.yml`**: Defines the entire development stack. This is the source of truth for what services are running and on which ports.
- **`CLAUDE.md`**: Primary AI agent guide — architecture, conventions, commands.
- **`apps/`**: Contains the individual Next.js applications.
  - `admin`: Central dashboard for moderation, user management, RSVP review.
  - `forum`: The public, aggregated content feed (reads cross-org directly).
  - `blog-*`: Individual blog applications for each organization.
  - `inner-gathering`, `amrit-canada`, `elkdonis-arts-collective`: Community and landing apps.
- **`packages/`**: Shared libraries used across the monorepo.
  - **`db`**: The most critical package.
    - `src/schemas.ts`: Baseline table definitions (`setupDatabase()`) used for fresh bootstrap. Has drift vs. live DB; see `schema-snapshot-*.sql` for canonical state.
    - `src/events.ts`: Activity audit log (wide-net logging + admin moderation actions).
    - `src/client.ts`: The PostgreSQL client setup (using the `postgres` npm package).
    - `scripts/migrate.mjs`: Transactional migration runner; tracks applied files in `app_schema_migrations`.
    - `migrations/*.sql`: Migration source of truth, applied in lex order.
  - **`auth-server` / `auth-client`**: Shared authentication logic (self-hosted Supabase GoTrue).
  - **`ui`**: Shared Mantine UI components.

## 3. Critical Developer Workflows

The development workflow is Docker-first. See `CLAUDE.md` → "Essential Commands" for the full reference. The key commands are:

1.  **Install Dependencies**:
    ```bash
    pnpm install
    ```
2.  **Build Shared Packages** (Required before starting):
    ```bash
    pnpm --filter @elkdonis/db build
    pnpm --filter @elkdonis/ui build
    ```
3.  **Start All Services**:
    ```bash
    docker-compose up -d
    ```
4.  **Run Database Migrations**: This is a custom script that creates all tables and seeds initial organizations.
    ```bash
    docker-compose exec admin pnpm --filter @elkdonis/db db:migrate
    ```

### Common Tasks

- **Restarting a single app**: `docker-compose restart blog-sunjay`
- **Viewing logs**: `docker-compose logs -f <service-name>` (e.g., `postgres`, `admin`)
- **Resetting the database**: `docker-compose down -v` (Warning: This deletes all data).

## 4. Database Patterns

### Querying Content for a Specific Org

All content tables have an `org_id` column. To query posts for a specific blog:

```typescript
import { db } from '@elkdonis/db';

// Get all published posts for Sunjay's blog
const posts = await db`
  SELECT * FROM posts
  WHERE org_id = 'sunjay' 
    AND status = 'published'
  ORDER BY published_at DESC
`;
```

### Creating Content

When creating content, always include the `org_id`:

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

### Forum Aggregation

The forum app reads content directly from `posts`, `meetings`, and `replies` — filtered by visibility and `org_id`. There is no queue, no copy, no approval. To control what surfaces, use the admin moderation actions in `Events` (`hideContent`, `overrideVisibility`, `pinContent`, `lockContent`) which log to the `events` audit table.

## 5. Code Conventions

- **Authentication**: Authentication is handled by the `@elkdonis/auth` package. User identity is currently placeholder (`user-placeholder`) and needs full implementation.
- **Always filter by org_id**: When querying content tables, always filter by the appropriate `org_id` to ensure data isolation.
- **Use transactions for multi-step operations**: The `postgres` package supports `db.begin(async (tx) => {...})` for transactions.
