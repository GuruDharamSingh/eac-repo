# Database Architecture Refactor - From Schema-per-Org to Single Schema

## What Changed

We simplified the database architecture from a complex **schema-per-org** design to a straightforward **single-schema with org_id filtering** approach.

### Before (Schema-per-Org)
```
PostgreSQL Database
├── public schema
│   ├── organizations
│   ├── users
│   ├── events
│   └── forum_*
├── org_sunjay schema
│   ├── posts
│   ├── pages
│   └── media
├── org_guru_dharam schema
│   ├── posts
│   ├── pages
│   └── media
└── org_[each-new-blog] schema...
```

**Problems:**
- Complex queries across multiple schemas
- Harder to aggregate content for forum
- Need to create new schema for each organization
- More complex connection management

### After (Single Schema with org_id)
```
PostgreSQL Database
└── public schema (all tables)
    ├── organizations
    ├── users
    ├── user_organizations (memberships & roles)
    ├── posts (org_id column)
    ├── pages (org_id column)
    ├── media (org_id column)
    ├── events (org_id column)
    ├── forum_queue
    ├── forum_posts
    └── forum_replies
```

**Benefits:**
- ✅ Simple queries: `SELECT * FROM posts WHERE org_id = 'sunjay'`
- ✅ Easy aggregation: `SELECT * FROM posts ORDER BY created_at DESC`
- ✅ Standard database patterns
- ✅ No schema creation needed when adding orgs
- ✅ Better for backups and migrations
- ✅ Works seamlessly with ORMs and query builders

## Files Changed

### `packages/db/src/schemas.ts`
- Removed `createOrgSchema()` function
- All tables now in single public schema
- Each content table has `org_id` column with foreign key
- Added proper indexes for `org_id` filtering
- Added `user_organizations` table for role-based membership

### `packages/db/src/client.ts`
- Removed `getOrgDb()` function (no longer needed)
- Simplified to single connection pool
- Changed default database name to `elkdonis_dev`

### `packages/db/src/events.ts`
- Updated to query from single schema
- Simplified `approveForForum()` - no more cross-schema queries
- Added `submitToForumQueue()` helper
- Added `rejectForumSubmission()` for admin workflow
- Added `getOrgEvents()` for per-org activity logs

### `packages/db/src/forum-sync.ts`
- Removed Flarum integration (not using external forum)
- Enhanced with reply management functions
- Added search functionality
- Added forum stats dashboard helper

### `packages/db/src/index.ts`
- Removed exports for `getOrgDb` and `createOrgSchema`
- Cleaner API surface

### `.github/copilot-instructions.md`
- Updated to reflect new single-schema architecture
- Added code examples for common patterns
- Clarified database querying approach

## How to Use the New Design

### Creating Content
```typescript
import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

// Create a post for Sunjay's blog
const post = {
  id: nanoid(),
  orgId: 'sunjay',  // <-- Key field
  authorId: userId,
  title: 'My Post',
  slug: 'my-post',
  body: 'Content...',
  status: 'draft',
  shareToForum: false
};

await db`INSERT INTO posts ${db(post)}`;
```

### Querying Content
```typescript
// Get all posts for a specific org
const posts = await db`
  SELECT * FROM posts
  WHERE org_id = 'sunjay'
    AND status = 'published'
  ORDER BY published_at DESC
`;

// Get all posts across all orgs (for admin dashboard)
const allPosts = await db`
  SELECT p.*, o.name as org_name
  FROM posts p
  JOIN organizations o ON o.id = p.org_id
  ORDER BY p.created_at DESC
`;
```

### Forum Workflow
```typescript
import { Events } from '@elkdonis/db';

// 1. User publishes post with share_to_forum = true
await Events.submitToForumQueue(postId, 'sunjay');

// 2. Admin views pending queue
const queue = await Events.getForumQueue();

// 3. Admin approves
await Events.approveForForum(queueId, adminUserId);

// 4. Forum displays it
const forumPosts = await Events.getForumPosts(50, 0);
```

## Migration Path

Since this is early stage and no production data exists:

1. **Drop the old database** (if it exists):
   ```bash
   docker-compose down -v
   ```

2. **Start fresh**:
   ```bash
   docker-compose up -d
   docker-compose exec admin pnpm --filter @elkdonis/db db:migrate
   ```

3. **All tables will be created in the new structure**

## What Still Needs Implementation

The refactor focused on the database layer. These features still need building:

- 🚧 **Authentication**: Connect Supabase auth to the users table
- 🚧 **Blog UIs**: Build the blog entry creation forms
- 🚧 **Admin UI**: Build the approval queue interface
- 🚧 **Forum UI**: Build the forum display and reply system
- 🚧 **Media Upload**: Integrate Nextcloud for file uploads

But now you have a **solid, simple foundation** to build these on!

## Questions?

The new design is much simpler to understand and work with. If you're unsure how to query or create data, check:

1. `packages/db/src/schemas.ts` - See all table structures
2. `packages/db/src/events.ts` - See the forum workflow
3. `.github/copilot-instructions.md` - See code examples

Happy coding! 🚀
