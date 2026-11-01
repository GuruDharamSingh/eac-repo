-- ============================================================================
-- 197: BuddhasEngines — the org behind Pureland — and per-user game saves.
--
-- Pureland, the web game from Justin's BuddhasEngines8 repo, is played at
-- arts-collective.com/pureland (apps/arts-collective: src/app/pureland,
-- src/app/api/pureland, src/lib/pureland*.ts). Private while it is tested:
--   owner          manages the members (and plays)
--   guide, member  play ("tester" in the page's words is `member`)
--   viewer         nothing here: /api/org/join hands `viewer` out ungated, so
--                  it is treated as a non-member (identity-and-tenancy.md)
--
-- Owners by EMAIL, the 080/117 way: a no-op for an account that doesn't exist
-- yet, so this stays safe on any database. An owner who signs up later is
-- added from the page's Manage section by the other owner.
--
-- game_saves: one row per player per game. `files` mirrors the game's
-- user:// files (Godot keeps them in the browser's IndexedDB) as
-- { "<path under the game's user dir>": { "t": <ms>, "b64": "<base64>" } };
-- the page's API caps it at 1 MB. `enabled` is the player's "save to my
-- account" switch.
-- ============================================================================

BEGIN;

INSERT INTO organizations (id, name, slug, description, tier) VALUES
  ('BuddhasEngines', 'Buddha''s Engines', 'buddhasengines',
   'Pureland and the other games of Buddha''s Engines. Private while in testing.',
   'free')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_organizations (user_id, org_id, role)
SELECT u.id, 'BuddhasEngines', 'owner'
FROM users u
WHERE lower(u.email) IN ('justin.gillisb@gmail.com', 'gurudharamsingh@gmail.com')
ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'owner';

CREATE TABLE IF NOT EXISTS game_saves (
  user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game             text        NOT NULL,
  org_id           varchar     NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enabled          boolean     NOT NULL DEFAULT false,
  files            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  bytes            integer     NOT NULL DEFAULT 0,
  client_saved_at  timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game)
);

COMMENT ON TABLE game_saves IS
  'Per-player cloud saves of web games (Pureland: arts-collective.com/pureland). files = { path: { t, b64 } }, capped at 1 MB by the API.';

COMMIT;
