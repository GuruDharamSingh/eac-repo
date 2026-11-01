-- 219: social_posts — the Studio's Post kind (2026-10-31).
--
-- A social post is written in the Studio for Facebook, Instagram and
-- Threads, not for the network: text, up to ten images (public /api/media
-- paths, since Meta fetches them by URL), an optional link, and per-platform
-- text overrides in `variants`. Each successful post to a connected account
-- is appended to `shares` ({targetId, kind, label, url, at}). `oad` is
-- "Just me"; an org id means the post was made as that org (the acting org
-- in the Studio). Owner-scoped: every query takes the acting user.

CREATE TABLE IF NOT EXISTS social_posts (
  id          varchar(21) PRIMARY KEY,
  org_id      varchar(50) NOT NULL REFERENCES organizations(id),
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT '',
  body        text NOT NULL DEFAULT '',
  link        text,
  images      jsonb NOT NULL DEFAULT '[]'::jsonb,
  variants    jsonb NOT NULL DEFAULT '{}'::jsonb,
  shares      jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_posts_owner_idx
  ON social_posts (owner_id, updated_at DESC) WHERE archived_at IS NULL;
