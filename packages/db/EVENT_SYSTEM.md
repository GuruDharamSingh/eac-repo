# Event System - Network Activity Logging & Admin Control

## Overview

The event system is designed to cast a **wide net** across all network activity, logging everything for admin oversight. This is NOT a queue system - it's an audit trail with admin veto power.

## Architecture Vision

### Content Flow
```
User creates content → Stored in DB with org_id
                     ↓
              Event logged in events table
                     ↓
         Forum queries DB directly (no queue, no copying)
                     ↓
         Forum filters by visibility & metadata.hidden
```

### Key Principles

1. **Direct DB Queries** - Forum surfaces content directly from `posts`, `meetings`, and `replies` tables
2. **No Copying** - Content lives in ONE place, forum reads it with queries
3. **Admin Veto Power** - Admins can hide, pin, lock, or override visibility at any time
4. **Wide Net Logging** - ALL activity is logged for transparency and audit trails

## Event Types

### Content Lifecycle
- `post_created`, `post_published`, `post_updated`, `post_deleted`
- `meeting_created`, `meeting_published`, `meeting_updated`, `meeting_deleted`
- `reply_created`, `reply_updated`, `reply_deleted`

### User Actions
- `user_joined_org`, `user_left_org`
- `meeting_rsvp`, `meeting_attended`

### Interactions
- `reaction_added`, `reaction_removed`
- `content_bookmarked`, `content_unbookmarked`
- `thread_watched`, `thread_unwatched`

### Media
- `media_uploaded`, `media_attached`, `media_deleted`

### Moderation (Admin Actions)
- `content_hidden`, `content_unhidden` - Hide/unhide from forum
- `content_pinned`, `content_unpinned` - Pin to top of forum
- `content_locked`, `content_unlocked` - Prevent new replies
- `content_flagged`, `flag_resolved` - User reports & resolution
- `user_banned`, `user_unbanned` - Ban users from forum
- `visibility_override` - Admin forces visibility change

## Admin Powers

Admins have **full veto power** over all content in the network.

### Available Actions

```typescript
// Hide content from forum (doesn't delete)
await Events.hideContent('post', postId, adminId, 'Inappropriate content');

// Override visibility (force to org-only even if author set PUBLIC)
await Events.overrideVisibility('post', postId, 'ORGANIZATION', adminId, 'Sensitive info');

// Pin content to top of forum
await Events.pinContent('meeting', meetingId, adminId);

// Lock thread (prevent new replies)
await Events.lockContent('post', postId, adminId, 'Discussion concluded');
```

### How Admin Controls Work

Content metadata stores admin actions:
```json
{
  "hidden": true,
  "hidden_by": {
    "adminId": "xyz",
    "reason": "Inappropriate",
    "timestamp": "2024-10-24T..."
  },
  "admin_override": {
    "admin_id": "xyz",
    "previous_visibility": "PUBLIC",
    "reason": "Contains sensitive info",
    "timestamp": "2024-10-24T..."
  }
}
```

Forum queries check `metadata.hidden` to filter content.

## Superadmin Authentication

### Simple Approach

1. **Supabase GoTrue** handles authentication (JWT tokens)
2. **users.is_admin** boolean field in DB marks superadmins
3. **Server-side checks** before admin actions:

```typescript
import { isAdmin, requireAdmin } from '@elkdonis/auth';

// Check if user is admin
if (await isAdmin(userId)) {
  // Allow admin action
}

// Or throw error if not admin
await requireAdmin(userId);
```

### How to Make Someone Admin

**Manual DB update** (keeping it simple for now):

```sql
UPDATE users
SET is_admin = true
WHERE email = 'your-email@example.com';
```

No complex backdoor needed - just set the flag in the DB.

## Forum Queries

Forum queries content directly, respecting admin controls:

```sql
-- Get all posts for forum (with admin filters)
SELECT p.*
FROM posts p
WHERE p.status = 'published'
  AND p.visibility = 'PUBLIC'
  AND (p.metadata->>'hidden' IS NULL OR p.metadata->>'hidden' = 'false')
ORDER BY
  p.is_pinned DESC,  -- Pinned first
  p.last_activity_at DESC
LIMIT 50;
```

## Admin Dashboard

Located at `/apps/admin/src/app/events/page.tsx`

Features:
- Real-time network activity feed
- Filter by action type, resource type, org
- Quick moderation actions (hide, pin, lock)
- Event statistics dashboard
- Audit trail of all admin actions

### API Routes

`POST /api/moderation` - Execute admin actions:
```json
{
  "action": "hide|unhide|pin|unpin|lock|unlock|override_visibility",
  "resourceType": "post|meeting",
  "resourceId": "abc123",
  "userId": "admin-user-id",
  "reason": "Optional reason",
  "newVisibility": "PUBLIC|ORGANIZATION|INVITE_ONLY"
}
```

## Usage Examples

### Log a Content Creation Event
```typescript
import { Events } from '@elkdonis/db/events';

// User publishes a post
await Events.log(
  'sunjay', // orgId
  userId,
  'post_published',
  'post',
  postId,
  { title: post.title }
);
```

### Admin Hides Inappropriate Content
```typescript
await Events.hideContent('post', postId, adminId, 'Violates community guidelines');
```

### Query Events for Dashboard
```typescript
const events = await Events.getAllEvents({
  limit: 100,
  action: 'post_published',
  orgId: 'sunjay'
});
```

### Get Event Statistics
```typescript
const stats = await Events.getEventStats();
// Returns: post_events, meeting_events, reply_events, moderation_events, etc.
```

## Integration Points

### When to Log Events

**App/blog posts:**
```typescript
// After creating post
await Events.log(orgId, userId, 'post_created', 'post', postId);

// After publishing
await Events.log(orgId, userId, 'post_published', 'post', postId);
```

**App/forum replies:**
```typescript
await Events.log(orgId, userId, 'reply_created', 'reply', replyId, {
  parentType: 'post',
  parentId: postId
});
```

**Meetings:**
```typescript
await Events.log(orgId, userId, 'meeting_published', 'meeting', meetingId);
```

### Forum Content Queries

Forum should query content respecting admin controls:

```typescript
// In forum app
const posts = await db`
  SELECT p.*, u.display_name as author_name, o.name as org_name
  FROM posts p
  JOIN users u ON u.id = p.author_id
  JOIN organizations o ON o.id = p.org_id
  WHERE p.status = 'published'
    AND p.visibility = 'PUBLIC'
    AND (p.metadata->>'hidden' IS NULL OR p.metadata->>'hidden' != 'true')
    AND (p.is_locked IS NULL OR p.is_locked = false)
  ORDER BY
    p.is_pinned DESC,
    p.last_activity_at DESC
  LIMIT 50
`;
```

## Migration Notes

### What Changed

**Before:**
- `forum_queue` table for approval workflow
- `forum_posts` table (copied content)
- Approval/rejection flow
- Manual admin approval required

**After:**
- Direct DB queries from forum
- Content lives in one place
- Admin has veto power (can hide after publication)
- No queue, no copying
- Events logged for audit trail

### Cleanup Needed

If you have old forum_queue/forum_posts tables, they can be dropped:

```sql
DROP TABLE IF EXISTS forum_queue;
DROP TABLE IF EXISTS forum_posts;
DROP TABLE IF EXISTS forum_replies;
```

## Security Considerations

1. **Admin checks are server-side** - Never trust client-side admin flags
2. **All admin actions are logged** - Full audit trail in events table
3. **is_admin is boolean** - Simple, no complex role system
4. **Dynamic imports** - Auth package uses dynamic imports to avoid circular deps
5. **Supabase handles auth** - JWT tokens, session management

## Future Enhancements

- [ ] User trust levels (for auto-moderation)
- [ ] Flag/report system (users can flag content)
- [ ] Moderation queue (view flagged content)
- [ ] Ban users from forum entirely
- [ ] Bulk moderation actions
- [ ] Email notifications for admin actions
- [ ] Moderation analytics dashboard

## Questions?

This is a living document. Update it as the system evolves.
