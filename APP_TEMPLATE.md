# App Template - How Each App Works

## Core Concept

Each app in our network is **autonomous** but **connected**:

1. **Autonomous**:
   - Has its own admin interface at `/admin`
   - Members log in directly to the app
   - Create and manage content independently
   - No dependency on the admin dashboard

2. **Connected**:
   - Uses shared auth (single sign-on)
   - Events flow to admin dashboard
   - Can request cross-posting to forum
   - Shares database but filtered by `orgId`

## App Structure

```
apps/[app-name]/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # App layout with auth
│   │   ├── page.tsx            # Public homepage
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   ├── admin/              # Protected admin area
│   │   │   ├── layout.tsx      # Admin layout with auth check
│   │   │   ├── page.tsx        # Dashboard
│   │   │   ├── posts/          # Content management
│   │   │   │   ├── page.tsx    # List posts
│   │   │   │   ├── new/page.tsx # Create post
│   │   │   │   └── [id]/page.tsx # Edit post
│   │   │   └── settings/       # App settings
│   │   │       └── page.tsx
│   │   └── [...slug]/          # Dynamic public pages
│   │       └── page.tsx
│   ├── components/
│   │   ├── AdminNav.tsx        # Admin navigation
│   │   ├── ContentEditor.tsx   # Rich text editor
│   │   ├── PublicNav.tsx       # Public navigation
│   │   └── AuthGuard.tsx       # Auth protection
│   └── lib/
│       ├── content.ts           # Content operations
│       └── config.ts            # App configuration
├── package.json
└── next.config.ts
```

## Example Blog App Implementation

```typescript
// apps/blog-elkdonis/src/app/admin/posts/new/page.tsx
import { Content, Events } from '@elkdonis/db';
import { useUser } from '@elkdonis/auth';

export default function NewPost() {
  const user = useUser();
  const orgId = 'elkdonis'; // This app's org ID

  async function createPost(formData: FormData) {
    const post = await Content.create(orgId, user.id, {
      type: 'post',
      title: formData.get('title'),
      body: formData.get('body'),
      status: 'draft'
    });

    // Event is automatically created by Content.create()
    // Admin dashboard will see this activity
  }

  async function publishPost(postId: string) {
    await Content.publish(postId, user.id);
    // This triggers auto-share check if configured
  }

  return (
    <div>
      <h1>Create New Post</h1>
      <form action={createPost}>
        <input name="title" placeholder="Title" />
        <textarea name="body" placeholder="Content" />
        <button type="submit">Save Draft</button>
      </form>
    </div>
  );
}
```

## How Apps Connect

### 1. **Authentication Flow**
```typescript
// Shared auth across all apps
import { getClientAuth } from '@elkdonis/auth';

const auth = getClientAuth();
const { data: { user } } = await auth.auth.getUser();

// User logs in once, authenticated everywhere
```

### 2. **Content Creation Flow**
```
User creates post in Blog App
    ↓
Content saved to database (with orgId='elkdonis')
    ↓
Event logged automatically
    ↓
Admin dashboard sees activity in real-time
    ↓
If auto-share enabled → Share request created
    ↓
Admin approves → Content appears in forum
```

### 3. **Database Filtering**
Each app only sees its own content:
```typescript
// Blog app only gets blog content
const posts = await Content.getByOrg('elkdonis', {
  type: 'post',
  status: 'published'
});

// Events app only gets events
const events = await Content.getByOrg('events', {
  type: 'event',
  status: 'published'
});
```

## Creating a New App

1. **Copy template structure**
```bash
cp -r apps/template apps/my-new-blog
```

2. **Configure the app**
```typescript
// apps/my-new-blog/src/lib/config.ts
export const APP_CONFIG = {
  orgId: 'my-blog',
  name: 'My Blog',
  type: 'blog',
  autoShare: true,  // Auto-request forum sharing
  isPublic: true     // Public or members-only
};
```

3. **Register in database**
```sql
INSERT INTO organizations (id, name, slug, type, settings)
VALUES ('my-blog', 'My Blog', 'my-blog', 'blog',
  '{"autoShare": true, "isPublic": true}');
```

4. **Add to Docker Compose** (for development)
```yaml
my-blog:
  extends:
    service: admin  # Same config as admin
  container_name: eac-my-blog
  ports:
    - "3001:3000"
  command: sh -c "cd apps/my-blog && pnpm dev"
```

## Admin Dashboard Role

The admin dashboard (`apps/admin`) is now just for:

1. **Monitoring**: See all activity across all apps
2. **Cross-posting**: Approve/reject share requests
3. **User Management**: Manage who has access to which apps
4. **System Health**: Database stats, performance metrics

It does NOT:
- Create content for other apps
- Manage other apps' content
- Control other apps' settings

## Benefits of This Architecture

1. **Independence**: Each app team can work independently
2. **Scalability**: Add new apps without touching existing ones
3. **Flexibility**: Each app can have unique features
4. **Simplicity**: Members use apps directly, no confusion
5. **Unity**: Shared auth and optional cross-posting keeps network connected