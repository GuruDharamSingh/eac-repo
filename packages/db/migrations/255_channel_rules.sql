-- 255 · Channel rules: "never suggest this" for an owner (the routines planner).
-- 2026-11-07. docs/open/channel.md "Owner direction, third check-in".
--
-- A suggestion can be skipped for one piece (a 'dismissed' channel_deliveries
-- row, migration 252) or turned off for good. This table holds the second:
-- "never suggest <outlet> for <kind of piece>" for a person or an org. Either
-- side may be NULL to mean "any" (outlet NULL: no suggestions at all for that
-- kind; piece_kind NULL: never that outlet). The loader skips matching gaps.

CREATE TABLE IF NOT EXISTS channel_rules (
  id          varchar(21) PRIMARY KEY,
  org_id      varchar(50) NOT NULL REFERENCES organizations(id),
  owner_kind  text NOT NULL CHECK (owner_kind IN ('user', 'org')),
  owner_id    text NOT NULL,
  rule        text NOT NULL DEFAULT 'never_suggest' CHECK (rule IN ('never_suggest')),
  outlet      text,
  piece_kind  text,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS channel_rules_unique
  ON channel_rules (owner_kind, owner_id, rule, COALESCE(outlet, ''), COALESCE(piece_kind, ''));
