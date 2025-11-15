-- ============================================================================
-- EAC Network - Forum Tables Migration
-- ============================================================================
-- Adds 6 core forum functionality tables:
-- 1. reactions - likes/upvotes on content
-- 2. watches - thread subscriptions
-- 3. notifications - user alerts
-- 4. bookmarks - saved content
-- 5. flags - content reports
-- 6. moderation_log - mod action audit trail
-- ============================================================================

-- ============================================================================
-- 1. REACTIONS TABLE
-- ============================================================================
-- Allows users to react to posts, meetings, or replies with different
-- reaction types (like, upvote, etc). One reaction per user per item.
--
-- Design decisions:
-- - Polymorphic: reactable_type + reactable_id can point to posts/meetings/replies
-- - Composite PK ensures one reaction per user per item
-- - reaction_type enum allows multiple reaction types (future emoji support)
-- - Includes created_at for analytics (e.g., trending content)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reactions (
  id VARCHAR(21) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reactable_type VARCHAR(20) NOT NULL CHECK (reactable_type IN ('post', 'meeting', 'reply')),
  reactable_id VARCHAR(21) NOT NULL,
  reaction_type VARCHAR(20) NOT NULL DEFAULT 'like' CHECK (reaction_type IN ('like', 'upvote', 'love', 'insightful')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, reactable_type, reactable_id)
);

-- Index for counting reactions on content
CREATE INDEX IF NOT EXISTS idx_reactions_reactable
  ON reactions(reactable_type, reactable_id, reaction_type);

-- Index for user's reaction history
CREATE INDEX IF NOT EXISTS idx_reactions_user
  ON reactions(user_id, created_at DESC);

-- Index for recent reactions (for activity feeds)
CREATE INDEX IF NOT EXISTS idx_reactions_created
  ON reactions(created_at DESC);


-- ============================================================================
-- 2. WATCHES TABLE
-- ============================================================================
-- Users subscribe to threads (posts or meetings) to receive notifications
-- about new replies and activity.
--
-- Design decisions:
-- - Polymorphic: watchable_type + watchable_id (posts or meetings only, not replies)
-- - Composite PK prevents duplicate watches
-- - started_at allows sorting by recently watched
-- - No status field - users either watch or don't (simple unwatch = DELETE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS watches (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  watchable_type VARCHAR(20) NOT NULL CHECK (watchable_type IN ('post', 'meeting')),
  watchable_id VARCHAR(21) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, watchable_type, watchable_id)
);

-- Index for finding all watchers of a thread (for sending notifications)
CREATE INDEX IF NOT EXISTS idx_watches_watchable
  ON watches(watchable_type, watchable_id);

-- Index for user's watched threads
CREATE INDEX IF NOT EXISTS idx_watches_user
  ON watches(user_id, started_at DESC);


-- ============================================================================
-- 3. NOTIFICATIONS TABLE
-- ============================================================================
-- Alerts users of activity: new replies, reactions, mentions, etc.
--
-- Design decisions:
-- - notification_type enum covers all event types
-- - actor_id tracks who triggered the notification (NULL for system notifications)
-- - Polymorphic: notifiable_type + notifiable_id links to the content
-- - read_at timestamp (NULL = unread) instead of boolean for analytics
-- - Includes metadata JSONB for extensibility (e.g., preview text, counts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(21) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN (
    'reply', 'mention', 'reaction', 'watch_reply',
    'moderation', 'system', 'announcement'
  )),
  notifiable_type VARCHAR(20) NOT NULL CHECK (notifiable_type IN ('post', 'meeting', 'reply')),
  notifiable_id VARCHAR(21) NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user's notification inbox (unread first)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read_at, created_at DESC);

-- Index for marking notifications as read by content
CREATE INDEX IF NOT EXISTS idx_notifications_notifiable
  ON notifications(notifiable_type, notifiable_id);

-- Index for finding notifications by actor
CREATE INDEX IF NOT EXISTS idx_notifications_actor
  ON notifications(actor_id, created_at DESC);

-- Index for unread count queries
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;


-- ============================================================================
-- 4. BOOKMARKS TABLE
-- ============================================================================
-- Users save threads for later reference.
--
-- Design decisions:
-- - Polymorphic: bookmarkable_type + bookmarkable_id (posts or meetings)
-- - Composite PK prevents duplicate bookmarks
-- - Simple design: no folders/tags (can add later via metadata JSONB if needed)
-- - bookmarked_at for sorting (recently bookmarked first)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bookmarkable_type VARCHAR(20) NOT NULL CHECK (bookmarkable_type IN ('post', 'meeting')),
  bookmarkable_id VARCHAR(21) NOT NULL,
  bookmarked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, bookmarkable_type, bookmarkable_id)
);

-- Index for user's bookmarked items (chronological)
CREATE INDEX IF NOT EXISTS idx_bookmarks_user
  ON bookmarks(user_id, bookmarked_at DESC);

-- Index for checking if content is bookmarked
CREATE INDEX IF NOT EXISTS idx_bookmarks_bookmarkable
  ON bookmarks(bookmarkable_type, bookmarkable_id);


-- ============================================================================
-- 5. FLAGS TABLE
-- ============================================================================
-- Users report inappropriate content for moderator review.
--
-- Design decisions:
-- - Polymorphic: flaggable_type + flaggable_id (posts, meetings, or replies)
-- - reason enum covers common report types
-- - status tracks moderation workflow (pending -> resolved/dismissed)
-- - resolved_by and resolved_at for audit trail
-- - notes for additional context from reporter or resolver
-- - Multiple users can flag same content (no UNIQUE constraint)
-- ============================================================================

CREATE TABLE IF NOT EXISTS flags (
  id VARCHAR(21) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flaggable_type VARCHAR(20) NOT NULL CHECK (flaggable_type IN ('post', 'meeting', 'reply')),
  flaggable_id VARCHAR(21) NOT NULL,
  reason VARCHAR(30) NOT NULL CHECK (reason IN (
    'spam', 'harassment', 'inappropriate', 'misinformation',
    'off_topic', 'duplicate', 'other'
  )),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for moderator queue (pending flags)
CREATE INDEX IF NOT EXISTS idx_flags_status
  ON flags(status, created_at)
  WHERE status = 'pending';

-- Index for flagged content (to show flag count)
CREATE INDEX IF NOT EXISTS idx_flags_flaggable
  ON flags(flaggable_type, flaggable_id, status);

-- Index for user's flag history
CREATE INDEX IF NOT EXISTS idx_flags_user
  ON flags(user_id, created_at DESC);

-- Index for moderator activity
CREATE INDEX IF NOT EXISTS idx_flags_resolved_by
  ON flags(resolved_by, resolved_at DESC);


-- ============================================================================
-- 6. MODERATION_LOG TABLE
-- ============================================================================
-- Audit trail of all moderator actions (pin, lock, hide, delete, etc).
--
-- Design decisions:
-- - action enum covers all mod actions
-- - Polymorphic: target_type + target_id for any content type
-- - moderator_id tracks who performed the action
-- - reason required for transparency
-- - metadata JSONB for storing previous state (e.g., original visibility before hide)
-- - Immutable: no updates/deletes, only INSERTs
-- ============================================================================

CREATE TABLE IF NOT EXISTS moderation_log (
  id VARCHAR(21) PRIMARY KEY,
  moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL CHECK (action IN (
    'pin', 'unpin', 'lock', 'unlock', 'hide', 'unhide',
    'delete', 'restore', 'move', 'edit', 'warn_user', 'ban_user'
  )),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('post', 'meeting', 'reply', 'user')),
  target_id VARCHAR(21) NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for content moderation history
CREATE INDEX IF NOT EXISTS idx_moderation_log_target
  ON moderation_log(target_type, target_id, created_at DESC);

-- Index for moderator activity
CREATE INDEX IF NOT EXISTS idx_moderation_log_moderator
  ON moderation_log(moderator_id, created_at DESC);

-- Index for recent mod actions (for audit/review)
CREATE INDEX IF NOT EXISTS idx_moderation_log_created
  ON moderation_log(created_at DESC);

-- Index for specific action queries (e.g., all bans)
CREATE INDEX IF NOT EXISTS idx_moderation_log_action
  ON moderation_log(action, created_at DESC);


-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
