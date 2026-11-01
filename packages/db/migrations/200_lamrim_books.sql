-- 200 — whole books for Jerusalem's Path › Read (2026-10-07): the Great Treatise by heading, each
-- commentary by its own headings, the Lamp verse by verse. Private study copies (owners only).
CREATE TABLE IF NOT EXISTS lamrim_books (
  source  text PRIMARY KEY,
  title   text NOT NULL,
  author  text,
  parts   integer NOT NULL,
  words   integer NOT NULL,
  ord     integer NOT NULL
);

CREATE TABLE IF NOT EXISTS lamrim_book_parts (
  id       text PRIMARY KEY,          -- '<source>#p0012', 'great-treatise#0012', 'lamp#v05'
  source   text NOT NULL,
  seq      integer NOT NULL,
  heading  text,
  chapter  text,
  page     integer,
  node_id  text,                      -- the outline heading it belongs to, where known
  body     text NOT NULL
);
CREATE INDEX IF NOT EXISTS lamrim_book_parts_seq ON lamrim_book_parts (source, seq);
