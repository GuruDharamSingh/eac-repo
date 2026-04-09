# EAC Network Architecture - Final Design

## Overview

A **multi-organization network** where each app is autonomous but connected through shared authentication and optional content sharing.

## Core Components

### 1. **Database** (PostgreSQL)
- Single database, shared tables
- Content filtered by `orgId`
- Events track all activity
- No complex schemas or multi-tenancy tricks

### 2. **Authentication** (Supabase)
- Single sign-on across all apps
- Users can belong to multiple organizations
- Admin users have special privileges

### 3. **Storage** (Nextcloud)
- Media files for all apps
- Each org has its own folder
- Accessible via API

### 4. **Apps Structure**

```
apps/
├── admin/           # Dashboard & control center
│   ├── Monitor all activity
│   ├── Approve cross-posting
│   ├── Post to any org
│   └── User management
│
├── blog-elkdonis/   # Main collective blog
│   ├── Public blog
│   └── /admin → Create/edit posts
│
├── events/          # Event calendar
│   ├── Public events list
│   └── /admin → Create/edit events
│
├── links/           # Link tree / directory
│   ├── Public links page
│   └── /admin → Manage links
│
└── [future-apps]/   # Easy to add more
```

## How It Works

### Content Creation Flow

1. **Regular Member** (in blog app):
```
Member logs into blog-elkdonis.com
    ↓
Goes to /admin/posts/new
    ↓
Creates and publishes post
    ↓
Post saved with orgId='elkdonis'
    ↓
Event logged: "User X created post Y in elkdonis"
    ↓
If auto-share enabled → Request sent to forum
```

2. **Admin** (in admin dashboard):
```
Admin logs into admin.eac-network.com
    ↓
Sees all activity across all orgs
    ↓
Can create content for ANY org:
  - Select target org: "blog-elkdonis"
  - Create announcement
  - Auto-published to that org
    ↓
Can approve cross-post requests
```

### Database Design (Simple)

```typescript
// Everything uses these simple tables:

organizations {
  id: 'elkdonis',
  name: 'Elkdonis Arts Collective',
  type: 'blog',
  settings: { autoShare: true }
}

content {
  id: 'post-123',
  orgId: 'elkdonis',        // Which app owns this
  authorId: 'user-456',
  type: 'post',
  title: 'Art Exhibition',
  body: '...',
  status: 'published'
}

events {
  id: 'evt-789',
  orgId: 'elkdonis',
  action: 'created',
  contentId: 'post-123',
  userId: 'user-456',
  timestamp: '2024-01-20...'
}
```

### Permission Model

```typescript
// Regular users
if (user.orgs.includes('elkdonis')) {
  // Can create/edit in elkdonis app only
  Content.create('elkdonis', user.id, data);
}

// Admin users
if (user.isAdmin) {
  // Can create/edit in ANY org
  Content.create('any-org-id', user.id, data, true);

  // Can approve cross-posts
  Events.processShareRequest(requestId, true, user.id);
}
```

## Development Setup

### Quick Start (for your VirtualBox)

```bash
# 1. Clone and setup
git clone [repo]
cd eac-repo
pnpm install

# 2. Configure environment
cp .env.docker .env
# Edit .env with your SMTP settings

# 3. Start Docker
docker-compose up -d

# 4. Initialize database
docker-compose exec admin pnpm --filter @elkdonis/db db:migrate

# 5. Access
- Admin: http://localhost:3000
- Blog: http://localhost:3001  (when added)
- Events: http://localhost:3002 (when added)
- Nextcloud: http://localhost:8080
```

### Adding a New App

1. **Create app from template**:
```bash
cp -r apps/template apps/my-new-site
```

2. **Configure**:
```typescript
// apps/my-new-site/src/config.ts
export const ORG_ID = 'my-site';
export const ORG_NAME = 'My New Site';
```

3. **Register in database**:
```sql
INSERT INTO organizations VALUES ('my-site', 'My New Site', ...);
```

4. **Add to Docker** (for dev):
```yaml
my-site:
  extends: { service: admin }
  ports: ["3003:3000"]
  command: sh -c "cd apps/my-new-site && pnpm dev"
```

## Key Benefits

### Simple
- One database, no complex schemas
- Standard Next.js apps
- Shared packages for common code

### Scalable
- Add apps without touching others
- Each app can evolve independently
- Easy to understand and maintain

### Connected
- Single sign-on everywhere
- Optional content sharing
- Admin oversight when needed

### Practical
- Works on modest hardware
- No over-engineering
- Clear separation of concerns

## What We Avoided

❌ **NOT DOING**:
- Multiple databases or complex schemas
- Event sourcing with replay
- Microservices communication
- Complex state management
- Enterprise patterns

✅ **INSTEAD**:
- Simple PostgreSQL queries
- Basic event logging
- Shared database with filters
- Direct database access
- Pragmatic solutions

## Next Steps

1. **Build the admin app UI**
   - Dashboard showing all activity
   - Organization selector for posting
   - Share request approvals

2. **Create first blog app**
   - Copy template
   - Add blog-specific features
   - Test SSO

3. **Deploy to VirtualBox**
   - Run docker-compose
   - Test with local network
   - Refine based on real usage