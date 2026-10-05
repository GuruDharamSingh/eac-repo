-- 190 — auction series: the art-auction campaign wing (series, desk team,
-- weekly slots, slot artworks). 2026-10-03.
-- Brief: docs/open/AUCTION_SERIES_BRIEF_2026-10-03.md
--
-- A series is one seasonal auction (e.g. the IFAC Art Auction). Its weeks are
-- laid out as slots; a slot is a block of content (artworks, an artist, an
-- article, an announcement) that is assigned to a person and published only
-- once approved and its publish time has passed. Each slot mirrors one card on
-- the org's Nextcloud Deck board (organizations.deck_board_id), one Deck stack
-- per week. All lots in a series close at live_at.

CREATE TABLE IF NOT EXISTS auction_series (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug             varchar(100) NOT NULL,
  title            text NOT NULL,
  subtitle         text,
  presenter_org_id varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,
  host_org_id      varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'published', 'closed')),
  -- Phases: week 1 opens at announce_at with no artwork shown; bidding opens
  -- at silent_opens_at; every lot closes at live_at, the live auction day.
  announce_at      timestamptz,
  silent_opens_at  timestamptz,
  live_at          timestamptz,
  week_count       smallint NOT NULL DEFAULT 3 CHECK (week_count BETWEEN 1 AND 12),
  -- Palette tokens, type pair, hero image, motif statement.
  theme            jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- org_feeds slug holding the artwork discussions.
  forum_feed_slug  varchar(100),
  -- Deck stack id per stage: {"1": 101, "2": 102, "3": 103, "live": 104}.
  deck_stacks      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

-- The desk team. Owners of the series' org choose it; editors run the desk.
-- People assigned a slot need no row here.
CREATE TABLE IF NOT EXISTS auction_series_member (
  series_id  uuid NOT NULL REFERENCES auction_series(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id     varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'contributor')),
  added_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (series_id, user_id)
);

CREATE TABLE IF NOT EXISTS auction_series_slot (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id        uuid NOT NULL REFERENCES auction_series(id) ON DELETE CASCADE,
  org_id           varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- 'week' slots carry week_no; the 'live' stage has none.
  stage            text NOT NULL DEFAULT 'week' CHECK (stage IN ('week', 'live')),
  week_no          smallint CHECK (week_no IS NULL OR week_no >= 1),
  position         integer NOT NULL DEFAULT 0,
  kind             text NOT NULL CHECK (kind IN ('artwork', 'artist', 'article', 'announcement')),
  title            text NOT NULL,
  -- What the assignee is asked to supply.
  brief            text,
  artist_user_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  -- An article: a Studio piece, or a thread written in the desk editor.
  thread_id        varchar(21) REFERENCES threads(id) ON DELETE SET NULL,
  -- Slot-level copy: story, quote, curator note, editor document.
  content          jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           text NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'assigned', 'submitted', 'approved', 'published')),
  assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at      timestamptz,
  due_at           timestamptz,
  publish_at       timestamptz,
  deck_card_id     integer,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((stage = 'week') = (week_no IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_auction_series_slot_series
  ON auction_series_slot (series_id, stage, week_no, position);
CREATE INDEX IF NOT EXISTS idx_auction_series_slot_assignee
  ON auction_series_slot (assignee_user_id) WHERE assignee_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_series_slot_card
  ON auction_series_slot (deck_card_id) WHERE deck_card_id IS NOT NULL;

-- A slot may feature several artworks, each with its chosen photos.
CREATE TABLE IF NOT EXISTS auction_series_slot_artwork (
  slot_id              uuid NOT NULL REFERENCES auction_series_slot(id) ON DELETE CASCADE,
  artwork_id           uuid NOT NULL REFERENCES artwork(id) ON DELETE CASCADE,
  org_id               varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  position             integer NOT NULL DEFAULT 0,
  -- artwork_media ids to publish, in order; empty means all of the artwork's media.
  media_ids            uuid[] NOT NULL DEFAULT '{}',
  -- The artwork's discussion in the series forum category, created on first view.
  discussion_thread_id varchar(21) REFERENCES threads(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (slot_id, artwork_id)
);

CREATE INDEX IF NOT EXISTS idx_auction_series_slot_artwork_artwork
  ON auction_series_slot_artwork (artwork_id);

DROP TRIGGER IF EXISTS trg_auction_series_touch ON auction_series;
CREATE TRIGGER trg_auction_series_touch BEFORE UPDATE ON auction_series
  FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
DROP TRIGGER IF EXISTS trg_auction_series_slot_touch ON auction_series_slot;
CREATE TRIGGER trg_auction_series_slot_touch BEFORE UPDATE ON auction_series_slot
  FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();
