-- 204: user_slug_redirects — old profile slugs that permanently redirect to
-- the person's current slug. 2026-10-11.
--
-- A row is written when a user's slug changes (profile edit, admin edit, or a
-- placeholder merge whose slug loses). Profile resolvers that find no user for
-- a slug look it up here and issue a 308 to the current slug.
-- ensureUniqueUserSlug treats a slug held here by another user as taken; a
-- user who takes back one of their own old slugs deletes the row.
-- old_slug matches users.slug (varchar(80)).

CREATE TABLE IF NOT EXISTS user_slug_redirects (
  old_slug   varchar(80) PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_slug_redirects_user_id
  ON user_slug_redirects (user_id);
