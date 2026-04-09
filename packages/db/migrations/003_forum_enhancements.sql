-- ============================================================================
-- EAC Network - Forum Enhancements Migration
-- ============================================================================
-- Adds forum-specific columns to existing content tables:
-- - Activity tracking (last_activity_at)
-- - Thread management (is_pinned, is_locked)
-- - Denormalized counters (reaction_count)
-- - User trust levels and presence
-- - Reply edit tracking
-- ============================================================================

-- ============================================================================
-- POSTS TABLE ENHANCEMENTS
-- ============================================================================
-- Add forum thread features to posts

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0;

-- Initialize last_activity_at for existing posts
-- Use published_at if available, otherwise created_at
UPDATE posts
SET last_activity_at = COALESCE(published_at, created_at)
WHERE last_activity_at IS NULL OR last_activity_at = created_at;

-- Create index for sorting by recent activity
CREATE INDEX IF NOT EXISTS idx_posts_last_activity
  ON posts(last_activity_at DESC)
  WHERE status = 'published';

-- Create index for pinned posts (they sort first)
CREATE INDEX IF NOT EXISTS idx_posts_pinned
  ON posts(org_id, is_pinned, last_activity_at DESC)
  WHERE status = 'published';


-- ============================================================================
-- MEETINGS TABLE ENHANCEMENTS
-- ============================================================================
-- Add same forum features to meetings

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0;

-- Initialize last_activity_at for existing meetings
UPDATE meetings
SET last_activity_at = COALESCE(published_at, created_at)
WHERE last_activity_at IS NULL OR last_activity_at = created_at;

-- Create index for sorting by recent activity
CREATE INDEX IF NOT EXISTS idx_meetings_last_activity
  ON meetings(last_activity_at DESC)
  WHERE status = 'published';

-- Create index for pinned meetings
CREATE INDEX IF NOT EXISTS idx_meetings_pinned
  ON meetings(org_id, is_pinned, last_activity_at DESC)
  WHERE status = 'published';


-- ============================================================================
-- USERS TABLE ENHANCEMENTS
-- ============================================================================
-- Add trust level system and presence tracking

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trust_level INTEGER DEFAULT 0 CHECK (trust_level >= 0 AND trust_level <= 4),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN users.trust_level IS 'Trust level: 0=new, 1=basic, 2=member, 3=regular, 4=leader/guide';

-- Initialize last_seen_at to created_at for existing users
UPDATE users
SET last_seen_at = created_at
WHERE last_seen_at IS NULL OR last_seen_at = created_at;

-- Create index for finding active users
CREATE INDEX IF NOT EXISTS idx_users_last_seen
  ON users(last_seen_at DESC);

-- Create index for trust level queries
CREATE INDEX IF NOT EXISTS idx_users_trust_level
  ON users(trust_level);


-- ============================================================================
-- REPLIES TABLE ENHANCEMENTS
-- ============================================================================
-- Add edit tracking and reaction counter

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0;

-- Create index for finding recently edited replies
CREATE INDEX IF NOT EXISTS idx_replies_edited
  ON replies(edited_at DESC)
  WHERE edited_at IS NOT NULL;


-- ============================================================================
-- TRIGGER FUNCTIONS FOR MAINTAINING last_activity_at
-- ============================================================================

-- Function to update post/meeting last_activity_at when reply is added
CREATE OR REPLACE FUNCTION update_thread_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the parent post or meeting
  IF NEW.parent_type = 'post' THEN
    UPDATE posts
    SET last_activity_at = NEW.created_at
    WHERE id = NEW.parent_id;
  ELSIF NEW.parent_type = 'meeting' THEN
    UPDATE meetings
    SET last_activity_at = NEW.created_at
    WHERE id = NEW.parent_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on replies table
DROP TRIGGER IF EXISTS trigger_update_thread_activity ON replies;
CREATE TRIGGER trigger_update_thread_activity
  AFTER INSERT ON replies
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_activity();


-- ============================================================================
-- TRIGGER FUNCTIONS FOR MAINTAINING reaction_count
-- ============================================================================

-- Function to increment/decrement reaction counts
CREATE OR REPLACE FUNCTION update_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment reaction count
    IF NEW.reactable_type = 'post' THEN
      UPDATE posts SET reaction_count = reaction_count + 1 WHERE id = NEW.reactable_id;
    ELSIF NEW.reactable_type = 'meeting' THEN
      UPDATE meetings SET reaction_count = reaction_count + 1 WHERE id = NEW.reactable_id;
    ELSIF NEW.reactable_type = 'reply' THEN
      UPDATE replies SET reaction_count = reaction_count + 1 WHERE id = NEW.reactable_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement reaction count
    IF OLD.reactable_type = 'post' THEN
      UPDATE posts SET reaction_count = reaction_count - 1 WHERE id = OLD.reactable_id;
    ELSIF OLD.reactable_type = 'meeting' THEN
      UPDATE meetings SET reaction_count = reaction_count - 1 WHERE id = OLD.reactable_id;
    ELSIF OLD.reactable_type = 'reply' THEN
      UPDATE replies SET reaction_count = reaction_count - 1 WHERE id = OLD.reactable_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger on reactions table
DROP TRIGGER IF EXISTS trigger_update_reaction_count ON reactions;
CREATE TRIGGER trigger_update_reaction_count
  AFTER INSERT OR DELETE ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_reaction_count();


-- ============================================================================
-- TRIGGER FUNCTION FOR MAINTAINING reply_count
-- ============================================================================
-- (Already exists in your schema, but ensuring it updates last_activity_at too)

CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment reply count and update activity
    IF NEW.parent_type = 'post' THEN
      UPDATE posts
      SET reply_count = reply_count + 1,
          last_activity_at = NEW.created_at
      WHERE id = NEW.parent_id;
    ELSIF NEW.parent_type = 'meeting' THEN
      UPDATE meetings
      SET reply_count = reply_count + 1,
          last_activity_at = NEW.created_at
      WHERE id = NEW.parent_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement reply count
    IF OLD.parent_type = 'post' THEN
      UPDATE posts SET reply_count = reply_count - 1 WHERE id = OLD.parent_id;
    ELSIF OLD.parent_type = 'meeting' THEN
      UPDATE meetings SET reply_count = reply_count - 1 WHERE id = OLD.parent_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_reply_count ON replies;
CREATE TRIGGER trigger_update_reply_count
  AFTER INSERT OR DELETE ON replies
  FOR EACH ROW
  EXECUTE FUNCTION update_reply_count();


-- ============================================================================
-- HELPER FUNCTION: Recalculate reaction counts (for data integrity)
-- ============================================================================
-- Run this if reaction_count gets out of sync

CREATE OR REPLACE FUNCTION recalculate_reaction_counts()
RETURNS void AS $$
BEGIN
  -- Update posts
  UPDATE posts p
  SET reaction_count = (
    SELECT COUNT(*)
    FROM reactions r
    WHERE r.reactable_type = 'post' AND r.reactable_id = p.id
  );

  -- Update meetings
  UPDATE meetings m
  SET reaction_count = (
    SELECT COUNT(*)
    FROM reactions r
    WHERE r.reactable_type = 'meeting' AND r.reactable_id = m.id
  );

  -- Update replies
  UPDATE replies r
  SET reaction_count = (
    SELECT COUNT(*)
    FROM reactions rx
    WHERE rx.reactable_type = 'reply' AND rx.reactable_id = r.id
  );

  RAISE NOTICE 'Reaction counts recalculated successfully';
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- MIGRATION NOTES & DOCUMENTATION
-- ============================================================================

/*
WHAT UPDATES last_activity_at?
================================
Automatically updated by triggers when:
✅ New reply added (trigger_update_thread_activity)
✅ New reply added (also via trigger_update_reply_count)

Manually update via application logic when:
- Reply edited (significant edits, not typo fixes)
- Post/meeting edited (major updates)
- Moderator pins/unpins thread

NOT updated when:
- User bookmarks/watches (passive action)
- User reacts (doesn't bump thread)


DEFAULT VALUES FOR EXISTING ROWS
=================================
✅ Posts/meetings: last_activity_at = published_at or created_at
✅ Users: last_seen_at = created_at
✅ Users: trust_level = 0 (new user)
✅ Counters: reaction_count = 0 (will be accurate after new reactions)


TRUST LEVEL SYSTEM
===================
0 = New user (just signed up, limited permissions)
1 = Basic (verified email, can post/reply)
2 = Member (regular participant, can flag content)
3 = Regular (trusted member, can edit wiki, help moderate)
4 = Leader/Guide (org leaders, full mod permissions)

Application logic should check trust_level before allowing:
- Editing others' content (level 3+)
- Moderator actions (level 4+)
- Bulk operations (level 3+)


MAINTAINING DATA INTEGRITY
===========================
If denormalized counters drift out of sync, run:
  SELECT recalculate_reaction_counts();

For reply_count, use existing schemas.ts logic or create similar helper function.


SORTING THREADS BY ACTIVITY
============================
-- Hot threads (recent activity, many replies/reactions)
SELECT * FROM posts
WHERE status = 'published'
ORDER BY
  is_pinned DESC,  -- Pinned first
  last_activity_at DESC
LIMIT 50;

-- Trending (recent + popular)
SELECT * FROM posts
WHERE status = 'published'
  AND last_activity_at > NOW() - INTERVAL '7 days'
ORDER BY
  (reply_count + reaction_count * 2) DESC,
  last_activity_at DESC
LIMIT 50;
*/


-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
