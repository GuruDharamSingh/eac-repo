# Elkdonis Arts Collective (EAC) Network - AI Agent Guide

This document provides essential guidance for AI agents working on the EAC Network codebase. Understanding these concepts is critical for being productive.

## 1. The Big Picture: Architecture

This is a **multi-organization monorepo** built with pnpm, Turborepo, and Next.js. The entire stack is designed to be self-hosted using Docker.

The core architectural concepts are:
- **Single-Schema Database with org_id Filtering**: A single PostgreSQL database with one schema serves all applications. Content is logically separated using an `org_id` column on each table (simpler than schema-per-org). This makes queries straightforward and aggregation across orgs trivial.
- **Event-Driven Content Aggregation**: Individual apps (like blogs) operate independently. When a user creates a post with `share_to_forum = true`, it's automatically added to a `forum_queue` table. An admin must approve it via the `admin` app for it to be copied into the `forum_posts` table for display in the central `forum` app.
- **Dockerized Environment**: All services (PostgreSQL, Supabase for auth, Nextcloud for storage, Redis, and all Next.js apps) are managed via `docker-compose.yml`.

## 2. Key Files & Directories

- **`docker-compose.yml`**: Defines the entire development stack. This is the source of truth for what services are running and on which ports.
- **`SETUP-NEXT-STEPS.md`**: **CRITICAL READ**. This file contains the step-by-step commands to get the project running from scratch.
- **`apps/`**: Contains the individual Next.js applications.
  - `admin`: Central dashboard for monitoring and approving content for the forum.
  - `forum`: The public, aggregated content feed.
  - `blog-*`: Individual blog applications for each organization.
- **`packages/`**: Shared libraries used across the monorepo.
  - **`db`**: The most critical package.
    - `src/schemas.ts`: Defines the database table creation logic (single schema, all tables in public).
    - `src/events.ts`: Contains the logic for logging events and handling the forum queue/approval workflow.
    - `src/client.ts`: The PostgreSQL client setup (using the `postgres` npm package).
    - `src/forum-sync.ts`: Helper functions for the forum app (pagination, replies, search).
  - **`auth`**: Shared authentication logic (using the self-hosted Supabase instance).
  - **`ui`**: Shared Mantine UI components.

## 3. Critical Developer Workflows

The development workflow is not a simple `pnpm dev`. Follow the steps in `SETUP-NEXT-STEPS.md`. The key commands are:

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

### Forum Workflow

1. User publishes a post with `share_to_forum = true`
2. Call `Events.submitToForumQueue(postId, orgId)` to add it to the queue
3. Admin views queue with `Events.getForumQueue()`
4. Admin approves with `Events.approveForForum(queueId, adminId)` - this copies the post to `forum_posts`
5. Forum app displays posts from `forum_posts` table

## 5. Code Conventions

- **Authentication**: Authentication is handled by the `@elkdonis/auth` package. User identity is currently placeholder (`user-placeholder`) and needs full implementation.
- **Always filter by org_id**: When querying content tables, always filter by the appropriate `org_id` to ensure data isolation.
- **Use transactions for multi-step operations**: The `postgres` package supports `db.begin(async (tx) => {...})` for transactions.
