-- 198 — Lam Rim study corpus and Justin's reviews of it (Jerusalem's Path tab). 2026-10-06.
--
-- The texts and the AI's readings are built on the PC (WSL ~/chunker, chunker/lamrim.py) and
-- imported from a bundle with packages/db/scripts/import-lamrim.mjs. They are private study
-- copies of copyrighted books: served to org owners only (apps/elastrocal /api/mobile/v1/lamrim/*).
--
--   lamrim_nodes     Tsongkhapa's outline of the Great Treatise (sa bcad), 690 headings
--   lamrim_passages  the Great Treatise text under each heading
--   lamrim_units     commentary sections aligned to a heading (Middle Length, Liberation, ...)
--   lamrim_items     the AI's readings, each reviewable: relations, needs, placements, arguments ...
--   lamrim_reviews   Justin's verdicts and notes; append-only, so a changed mind keeps its history
--
-- Items keep a stable id across re-imports (a hash of what they say); an item the new bundle no
-- longer has is retired, not deleted, and every review stores a snapshot of what it judged.

CREATE TABLE IF NOT EXISTS lamrim_nodes (
  id            text PRIMARY KEY,          -- 'LR.4.2.2.2.1' (ordinal path)
  parent        text,
  ord           integer NOT NULL,          -- reading order
  depth         integer NOT NULL,
  marker        text,
  title         text NOT NULL,
  vol           integer,
  page          integer,
  chapter       integer,
  chapter_title text,
  part          text,
  editorial     boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS lamrim_nodes_ord ON lamrim_nodes (ord);
CREATE INDEX IF NOT EXISTS lamrim_nodes_parent ON lamrim_nodes (parent);

CREATE TABLE IF NOT EXISTS lamrim_passages (
  id       text PRIMARY KEY,               -- node id, or '<node id>#pre' for a chapter's opening
  node_id  text NOT NULL,
  kind     text NOT NULL,
  title    text,
  words    integer,
  body     text NOT NULL
);
CREATE INDEX IF NOT EXISTS lamrim_passages_node ON lamrim_passages (node_id);

CREATE TABLE IF NOT EXISTS lamrim_units (
  id       text PRIMARY KEY,               -- '<source>#0123'
  source   text NOT NULL,
  node_id  text NOT NULL,
  seq      integer,
  heading  text,
  page     integer,
  sim      real,
  body     text NOT NULL
);
CREATE INDEX IF NOT EXISTS lamrim_units_node ON lamrim_units (node_id);

CREATE TABLE IF NOT EXISTS lamrim_items (
  id          text PRIMARY KEY,
  kind        text NOT NULL,               -- relation | need | placement | importance | argument | relation-to-others | synthesis | list | lamp-verse
  node_ids    text[] NOT NULL DEFAULT '{}',
  source      text,                        -- which text the reading is of
  payload     jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  retired_at  timestamptz
);
CREATE INDEX IF NOT EXISTS lamrim_items_nodes ON lamrim_items USING gin (node_ids);
CREATE INDEX IF NOT EXISTS lamrim_items_kind ON lamrim_items (kind);

CREATE TABLE IF NOT EXISTS lamrim_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_kind  text NOT NULL,              -- item | node | passage | unit
  target_id    text NOT NULL,
  node_id      text,
  verdict      text NOT NULL,              -- accurate | partly | wrong (items) · reading | note (anything)
  conviction   smallint CHECK (conviction BETWEEN 0 AND 5),
  note         text,
  voice        text,                       -- Nextcloud path from /api/mobile/v1/media
  quote        jsonb,                      -- {text, start, end} of a selected span
  snapshot     jsonb,                      -- what was judged, as it read then
  device       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lamrim_reviews_user_node ON lamrim_reviews (user_id, node_id);
CREATE INDEX IF NOT EXISTS lamrim_reviews_user_target ON lamrim_reviews (user_id, target_id);
