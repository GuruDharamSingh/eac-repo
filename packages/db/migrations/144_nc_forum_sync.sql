-- ============================================================================
-- 144: nc_forum — the Nextcloud Forum app, mirrored per org.
--
-- Nextcloud runs ONE forum (the `forum` app) for the whole instance. Each org
-- gets one category there, named after itself and restricted to the org's
-- Team (organizations.nextcloud_circle_id). Topics in that category, and
-- topics an org admin creates on the site with "Sync to Nextcloud" ticked,
-- are the same conversation on both sides; everything else stays put.
--
-- The forum app dispatches no events, so inbound is a poll (services
-- nc-forum.ts, runNcForumSyncTick). Outbound happens right after the local
-- write. The link table is what stops a post being copied twice or bouncing
-- back: every mirrored thread and reply has exactly one row here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_nc_forum (
  org_id            VARCHAR(50)  PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  nc_category_id    INTEGER      NOT NULL UNIQUE,
  nc_category_slug  TEXT         NOT NULL,
  -- Public: anyone signed in may reply on the site (their reply reaches NC as
  -- the robot), and NC's User/Guest roles may read. Private: the org's Team.
  is_public         BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Which org_feeds row topics started on Nextcloud land in.
  site_feed_slug    TEXT         NOT NULL DEFAULT 'general',
  last_polled_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nc_forum_links (
  id               BIGSERIAL    PRIMARY KEY,
  org_id           VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  local_thread_id  VARCHAR(21)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  -- NULL: this row is the thread itself (its NC first post).
  local_reply_id   VARCHAR(21)  REFERENCES replies(id) ON DELETE CASCADE,
  nc_thread_id     INTEGER,
  -- NULL while an outbound push hasn't landed yet (status 'pending'/'failed').
  nc_post_id       INTEGER,
  -- Where it was written first.
  origin           TEXT         NOT NULL CHECK (origin IN ('site', 'nextcloud')),
  -- How a site-origin post reached NC: as the person's own NC account, or the robot.
  posted_via       TEXT         CHECK (posted_via IN ('self', 'robot')),
  nc_author_uid    TEXT,
  nc_author_name   TEXT,
  -- NC post updated_at (unix SECONDS) last seen, for edit detection.
  nc_updated_at    BIGINT,
  status           TEXT         NOT NULL DEFAULT 'synced' CHECK (status IN ('pending', 'synced', 'failed')),
  last_error       TEXT,
  attempts         INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  synced_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS nc_forum_links_nc_post ON nc_forum_links (nc_post_id) WHERE nc_post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nc_forum_links_reply ON nc_forum_links (local_reply_id) WHERE local_reply_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nc_forum_links_thread ON nc_forum_links (local_thread_id) WHERE local_reply_id IS NULL;
CREATE INDEX IF NOT EXISTS nc_forum_links_nc_thread ON nc_forum_links (nc_thread_id);
CREATE INDEX IF NOT EXISTS nc_forum_links_retry ON nc_forum_links (status) WHERE status <> 'synced';

-- One stand-in identity for Nextcloud authors with no site account.
-- `users` is an identity table (not accounts), and a row per NC author would
-- put people in the directory and in six apps' "accounts" lists who never
-- joined; so they all post under this row and the post carries their NC
-- name (nc_forum_links.nc_author_name, and a byline line in the body).
INSERT INTO users (id, auth_user_id, display_name, slug, entity_type, claim_status, directory_listed, profile_layout, bio)
VALUES (
  '00000000-0000-4000-8000-0000000c0f01'::uuid,
  '00000000-0000-4000-8000-0000000c0f01'::uuid,
  'Nextcloud', 'nextcloud-forum', 'person', 'claimed', FALSE, 'dossier',
  'Posts written in the Nextcloud forum by people without an account here.'
)
ON CONFLICT (id) DO NOTHING;
