-- ============================================================================
-- 077 — Pigeonshoot
-- ============================================================================
-- A crowdsourced art project. Someone photographs a distinctive street pigeon,
-- the photo becomes a trading card, cards belong to a shared species library,
-- and the project owner rates each card against a rubric that will keep
-- changing.
--
-- Shape of the thing, and why:
--
-- (a) A card is a `threads` row with kind='pigeon', plus a `pigeon_cards`
--     sidecar. This is the workshop_pages precedent (migration 038) and it is
--     chosen for the same reason: threads already carries slug, status,
--     visibility, view_count, published_at, UNIQUE(org_id, slug), replies,
--     reactions and the media attachment polymorphism. A separate top-level
--     `cards` table would have re-implemented all of it and cut the app off
--     from every shared read path.
--
-- (b) The rubric is DATA, not DDL. pigeon_criteria holds the tick-boxes a
--     submitter sees; pigeon_tiers holds the rarity bands. Both are editable
--     rows because the owner has said outright that the rubric will evolve — a
--     CHECK constraint listing 'common','rare','legendary' would have made the
--     first rethink a migration. This is the org_feeds lesson from migration
--     073 applied before the mistake instead of after it.
--
--     pigeon_card_criteria snapshots `points_awarded` at rating time. Without
--     that snapshot, re-weighting a criterion would silently re-score every
--     card ever rated. Old verdicts stay put; new ones use the new weights.
--
-- (c) The score is split in three: auto_score (what the machine can check —
--     aspect ratio, resolution, whether both a front and a side shot exist),
--     owner_score, and tier_slug. The machine may propose. It does not decide.
--     A card with tier_slug NULL renders as "provisional" from auto_score;
--     once the owner sets a tier that is the card's rating, full stop.
--
-- (d) Geography is plain lat/lng doubles plus a soft city/area taxonomy — the
--     directory_profiles pattern from migration 063. PostGIS is NOT introduced:
--     nothing in this stack has it, the only spatial question ever asked is
--     "which neighbourhood is this point in", and that is answered in JS by
--     ray-casting against a simplified GeoJSON shipped in the app's public/
--     folder. pigeon_areas stores each neighbourhood's identity, centroid and
--     bounding box; the polygons themselves deliberately stay out of the
--     database, because 158 rings of coordinates would make this migration
--     megabytes of unreadable numbers that no query would ever read.
--
--     Cities and areas are NOT org-scoped. A rubric belongs to a project; a
--     neighbourhood is a fact about the world.
--
-- (e) Anonymous submission. Uploads publish instantly under a cookie identity
--     (pigeon_guests). They do NOT get rows in `users`.
--
--     This is deliberate and worth spelling out, because the obvious
--     alternative is already in the tree and already broken:
--     apps/inner-gathering/src/lib/forum.ts does
--         INSERT INTO users (id, email, display_name)
--     for its anonymous forum posters. `users.auth_user_id` is uuid NOT NULL
--     with CHECK (auth_user_id = id) and there is no trigger to fill it, so
--     that statement throws every time. There are zero such rows in the
--     database, which is how we know it has never once worked.
--
--     Even if it were fixed, minting a real `users` row per anonymous phone
--     would pollute a table that six other apps treat as "people with
--     accounts" — admin user lists, org member counts, messaging recipients.
--     So: ONE seeded sentinel user owns every anonymous thread and media row
--     (satisfying threads.author_id and media.uploaded_by, both NOT NULL FKs
--     to users), and the real attribution lives in pigeon_cards.guest_id. The
--     sentinel row below sets auth_user_id = id explicitly.
--     pigeon_guests.linked_user_id lets a guest claim their cards later, the
--     same affordance guest_submissions.linked_user_id already provides.
--
-- (f) media gains width/height. There are no dimension columns anywhere in this
--     schema today. A card grid needs them to reserve space and avoid layout
--     shift, and the resolution auto-criterion needs them to evaluate.
--     Nullable and additive, so invisible to every existing app.
--
-- Deliberately NOT done here:
--   - No PostGIS, no geometry columns, no spatial index.
--   - No `tags` or `attachments` column on threads (both still absent live;
--     the species relation and pigeon_card_images cover those needs).
--   - No thumbnail/variant table on `media`. The one derivative pigeonshoot
--     generates is recorded on pigeon_card_images.card_url, inside this app's
--     own tables, rather than growing the shared media schema for a single
--     consumer.
--   - No moderation queue for publishing. Cards go live on submit, by design.
--     pigeon_cards.moderation_state is a takedown lever, not a gate.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Org, sentinel author, shared-table widening
-- ---------------------------------------------------------------------------

INSERT INTO organizations (id, name, slug, description, tier) VALUES
  ('pigeonshoot', 'Pigeonshoot', 'pigeonshoot',
   'Toronto''s street pigeons, photographed by whoever finds them, turned into trading cards.',
   'free')
ON CONFLICT (id) DO NOTHING;

-- kind is a CHECK, so a new kind is DDL. Drop and re-add rather than adding a
-- second constraint, so there is exactly one list to read.
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_kind_check;
ALTER TABLE threads ADD CONSTRAINT threads_kind_check
  CHECK (kind IN ('meeting', 'workshop', 'event', 'post', 'pigeon'));

ALTER TABLE media
  ADD COLUMN IF NOT EXISTS width  INTEGER,
  ADD COLUMN IF NOT EXISTS height INTEGER;

COMMENT ON COLUMN media.width IS
  'Intrinsic pixel width, when known. Populated by pipelines that decode the image (pigeonshoot); NULL elsewhere.';

-- The anonymous author of record. auth_user_id = id is required by
-- users_auth_user_id_matches_id; nothing fills it automatically.
-- This uuid is mirrored in apps/pigeonshoot/src/config/site.ts.
INSERT INTO users (id, auth_user_id, email, display_name, bio) VALUES (
  '9e1e0b7a-1f4d-4c1a-9f2e-6b7c8d9e0f01',
  '9e1e0b7a-1f4d-4c1a-9f2e-6b7c8d9e0f01',
  'anonymous@pigeonshoot.invalid',
  'A Pigeon Shooter',
  'System account. Owns every anonymously submitted card so the NOT NULL author/uploader foreign keys hold. Real attribution is pigeon_cards.guest_id. Never signs in — there is no auth identity behind this uuid.'
) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. Geography: cities and neighbourhoods (not org-scoped — see header (d))
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pigeon_cities (
  slug            VARCHAR(50) PRIMARY KEY,
  name            VARCHAR(120)     NOT NULL,
  region          VARCHAR(80),
  country         VARCHAR(2)       NOT NULL DEFAULT 'CA',
  center_lat      DOUBLE PRECISION NOT NULL,
  center_lng      DOUBLE PRECISION NOT NULL,
  default_zoom    SMALLINT         NOT NULL DEFAULT 11,
  -- Filename under apps/pigeonshoot/public/geo/ holding this city's
  -- neighbourhood polygons. NULL means "no boundaries yet" — the city still
  -- works, cards just land with area_slug NULL.
  boundary_file   VARCHAR(120),
  boundary_credit TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pigeon_areas (
  city_slug    VARCHAR(50) NOT NULL REFERENCES pigeon_cities(slug) ON DELETE CASCADE,
  slug         VARCHAR(60) NOT NULL,
  name         VARCHAR(120) NOT NULL,
  -- Key back into the GeoJSON feature (Toronto: AREA_SHORT_CODE).
  source_id    VARCHAR(20),
  centroid_lat DOUBLE PRECISION,
  centroid_lng DOUBLE PRECISION,
  -- Bounding box, so point-in-polygon tests 1–2 candidate polygons, not 158.
  min_lat DOUBLE PRECISION, min_lng DOUBLE PRECISION,
  max_lat DOUBLE PRECISION, max_lng DOUBLE PRECISION,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (city_slug, slug)
);

CREATE INDEX IF NOT EXISTS idx_pigeon_areas_source
  ON pigeon_areas (city_slug, source_id);

-- ---------------------------------------------------------------------------
-- 2. Species library
-- ---------------------------------------------------------------------------
-- Contributors may propose a species at submit time; it lands as 'proposed'
-- and stays invisible on /species until the owner publishes it. 'merged' plus
-- merged_into exists because half the proposals will be a second name for a
-- species that is already there, and renaming-by-deletion would orphan cards.

CREATE TABLE IF NOT EXISTS pigeon_species (
  id            VARCHAR(21) PRIMARY KEY,
  org_id        VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug          VARCHAR(60) NOT NULL,
  name          VARCHAR(80) NOT NULL,
  tagline       TEXT,
  description   TEXT,
  -- Field marks: ["cream hood", "dark bib", "orange eye"]
  traits        JSONB NOT NULL DEFAULT '[]'::jsonb,
  accent_hex    VARCHAR(7),
  hero_media_id VARCHAR(21) REFERENCES media(id) ON DELETE SET NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'proposed'
                  CHECK (status IN ('proposed', 'published', 'merged', 'rejected')),
  merged_into   VARCHAR(21) REFERENCES pigeon_species(id) ON DELETE SET NULL,
  proposed_by_guest VARCHAR(21),
  proposed_by_user  UUID REFERENCES users(id) ON DELETE SET NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pigeon_species_status
  ON pigeon_species (org_id, status, sort_order);

-- ---------------------------------------------------------------------------
-- 3. The rubric, as rows
-- ---------------------------------------------------------------------------
-- source='submitter'  the tick-box the contributor sees
-- source='auto'       evaluated server-side; auto_check names the evaluator in
--                     src/lib/rubric.ts. An auto row whose auto_check the code
--                     doesn't recognise is simply skipped, so the owner can add
--                     an aspirational criterion before the code exists without
--                     breaking submission.
-- source='owner'      only the owner can tick it (e.g. "genuinely funny")

CREATE TABLE IF NOT EXISTS pigeon_criteria (
  org_id     VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key        VARCHAR(40) NOT NULL,
  label      TEXT NOT NULL,
  hint       TEXT,
  category   VARCHAR(30) NOT NULL DEFAULT 'craft',
  points     SMALLINT NOT NULL DEFAULT 1,
  source     VARCHAR(10) NOT NULL DEFAULT 'submitter'
               CHECK (source IN ('submitter', 'auto', 'owner')),
  auto_check VARCHAR(40),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, key)
);

CREATE TABLE IF NOT EXISTS pigeon_tiers (
  org_id      VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug        VARCHAR(30) NOT NULL,
  label       VARCHAR(60) NOT NULL,
  blurb       TEXT,
  -- Lower bound for the PROVISIONAL band shown before the owner rates.
  min_score   SMALLINT NOT NULL DEFAULT 0,
  accent_hex  VARCHAR(7) NOT NULL DEFAULT '#8A8A8A',
  frame_style VARCHAR(20) NOT NULL DEFAULT 'plain'
                CHECK (frame_style IN ('plain', 'metal', 'foil', 'holo')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, slug)
);

-- ---------------------------------------------------------------------------
-- 4. Guest identity and rate limiting
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pigeon_guests (
  id               VARCHAR(21) PRIMARY KEY,   -- nanoid, carried in a signed cookie
  display_name     VARCHAR(60) NOT NULL,      -- "Anonymous Kestrel 4821"
  handle           VARCHAR(40),               -- optional self-chosen credit
  first_ip         INET,
  last_ip          INET,
  user_agent       TEXT,
  submission_count INTEGER NOT NULL DEFAULT 0,
  is_blocked       BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_reason   TEXT,
  blocked_at       TIMESTAMPTZ,
  -- Set when this browser later signs in and claims its cards.
  linked_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pigeon_guests_blocked
  ON pigeon_guests (is_blocked) WHERE is_blocked;

-- Rate limiting lives in Postgres, not Redis. Redis IS available
-- (packages/redis, REDIS_URL wired into most apps), but getRedisClient()
-- throws when REDIS_URL is unset, and this codebase's stated convention is
-- fail-soft reads — a rate limiter that hard-fails the submit button when the
-- cache blinks is worse than one that does an indexed COUNT(*) on a table that
-- will see a few thousand rows a month. It also gives the owner's moderation
-- screen a visible abuse trail, which an expiring Redis counter cannot. If
-- volume ever justifies it, put a Redis INCR/EXPIRE in front of this as a
-- pre-check and keep the table as the record.
CREATE TABLE IF NOT EXISTS pigeon_rate_events (
  id           BIGSERIAL PRIMARY KEY,
  bucket       VARCHAR(20) NOT NULL,   -- upload | card | report | species
  subject_kind VARCHAR(10) NOT NULL CHECK (subject_kind IN ('guest', 'ip', 'user')),
  subject      TEXT NOT NULL,
  outcome      VARCHAR(10) NOT NULL DEFAULT 'ok'
                 CHECK (outcome IN ('ok', 'denied', 'rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pigeon_rate_events_lookup
  ON pigeon_rate_events (bucket, subject_kind, subject, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. The card sidecar
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pigeon_cards (
  thread_id     VARCHAR(21) PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,

  -- Species. NULL + proposed_species_name = "contributor suggested a new one".
  species_id            VARCHAR(21) REFERENCES pigeon_species(id) ON DELETE SET NULL,
  proposed_species_name VARCHAR(80),

  -- Where. city/area are a composite FK so a card can never claim a
  -- neighbourhood that isn't in the taxonomy; both nullable because a pin
  -- outside every known polygon is a legitimate card, just an unplaced one.
  city_slug     VARCHAR(50),
  area_slug     VARCHAR(60),
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  geo_source    VARCHAR(10) NOT NULL DEFAULT 'pin'
                  CHECK (geo_source IN ('pin', 'exif', 'area', 'none')),
  -- 'exact' pins render where they are; 'block' pins are jittered ~100m on
  -- public maps. Someone photographing from their own window gets an out.
  geo_precision VARCHAR(10) NOT NULL DEFAULT 'exact'
                  CHECK (geo_precision IN ('exact', 'block')),
  place_note    TEXT,
  spotted_at    TIMESTAMPTZ,

  -- Rating. See header (c).
  auto_score    SMALLINT NOT NULL DEFAULT 0,
  auto_max      SMALLINT NOT NULL DEFAULT 0,
  owner_score   SMALLINT,
  tier_slug     VARCHAR(30),
  rating_note   TEXT,
  rated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  rated_at      TIMESTAMPTZ,

  -- Who. At least one of these is set.
  guest_id          VARCHAR(21) REFERENCES pigeon_guests(id) ON DELETE SET NULL,
  submitter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Moderation. Publishing is instant; this is the takedown lever.
  -- 'hidden' keeps the row and the files for appeal; 'removed' means the
  -- Nextcloud objects have been destroyed (copyright, identifiable person).
  moderation_state  VARCHAR(20) NOT NULL DEFAULT 'live'
                      CHECK (moderation_state IN ('live', 'hidden', 'removed')),
  moderation_note   TEXT,
  moderated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  moderated_at      TIMESTAMPTZ,
  open_report_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (city_slug, area_slug)
    REFERENCES pigeon_areas (city_slug, slug) ON DELETE SET NULL,
  -- tier_slug is a SOFT reference to pigeon_tiers, not an FK: that table is
  -- org-scoped and this one is not, and more to the point the read layer here
  -- is fail-soft — an unknown tier should render unstyled, not fail the
  -- insert. Same reasoning as threads.section -> org_feeds.slug in 073.
  CONSTRAINT pigeon_cards_has_submitter
    CHECK (guest_id IS NOT NULL OR submitter_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_pigeon_cards_species ON pigeon_cards (species_id);
CREATE INDEX IF NOT EXISTS idx_pigeon_cards_place   ON pigeon_cards (city_slug, area_slug);
CREATE INDEX IF NOT EXISTS idx_pigeon_cards_tier    ON pigeon_cards (tier_slug);
CREATE INDEX IF NOT EXISTS idx_pigeon_cards_guest   ON pigeon_cards (guest_id);
CREATE INDEX IF NOT EXISTS idx_pigeon_cards_mod     ON pigeon_cards (moderation_state)
  WHERE moderation_state <> 'live';
CREATE INDEX IF NOT EXISTS idx_pigeon_cards_unrated ON pigeon_cards (created_at DESC)
  WHERE tier_slug IS NULL AND moderation_state = 'live';
CREATE INDEX IF NOT EXISTS idx_pigeon_cards_latlng  ON pigeon_cards (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Photos, with their job on the card. The partial unique index enforces
-- "at most one front and one side" without forbidding extra detail shots.
CREATE TABLE IF NOT EXISTS pigeon_card_images (
  thread_id   VARCHAR(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  media_id    VARCHAR(21) NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL
                CHECK (role IN ('front', 'side', 'detail', 'context')),
  -- 800px derivative generated at upload. Kept here rather than as a second
  -- media row or a variants column, because pigeonshoot is the only consumer.
  card_url    TEXT,
  card_width  INTEGER,
  card_height INTEGER,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, media_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pigeon_card_images_primary
  ON pigeon_card_images (thread_id, role) WHERE role IN ('front', 'side');

-- Which rubric boxes were ticked, and what they were worth at the time.
CREATE TABLE IF NOT EXISTS pigeon_card_criteria (
  thread_id      VARCHAR(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  criterion_key  VARCHAR(40) NOT NULL,
  claimed        BOOLEAN NOT NULL DEFAULT TRUE,   -- submitter (or auto) says yes
  confirmed      BOOLEAN,                         -- NULL = owner hasn't looked
  points_awarded SMALLINT,                        -- frozen at rating time
  PRIMARY KEY (thread_id, criterion_key)
);

-- Public "report" action. No account needed; that's the point.
CREATE TABLE IF NOT EXISTS pigeon_reports (
  id         VARCHAR(21) PRIMARY KEY,
  thread_id  VARCHAR(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  reason     VARCHAR(30) NOT NULL
               CHECK (reason IN ('not_a_pigeon', 'duplicate', 'identifiable_person',
                                 'wrong_place', 'offensive', 'copyright', 'other')),
  detail     TEXT,
  reporter_guest_id VARCHAR(21) REFERENCES pigeon_guests(id) ON DELETE SET NULL,
  reporter_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  status     VARCHAR(20) NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'dismissed', 'actioned')),
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pigeon_reports_open
  ON pigeon_reports (status, created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_pigeon_reports_thread
  ON pigeon_reports (thread_id);

-- ---------------------------------------------------------------------------
-- 6. Seeds
-- ---------------------------------------------------------------------------

-- One feed, so threads.section has a legitimate value. The site nav is NOT
-- feed-driven here (unlike amrit-canada): pigeonshoot's surfaces are /cards,
-- /map, /species and /places, and those are product, not editorial sections.
INSERT INTO org_feeds (org_id, slug, name, tagline, sort_order, is_public) VALUES
  ('pigeonshoot', 'cards', 'Cards', 'Every pigeon, catalogued', 0, TRUE)
ON CONFLICT (org_id, slug) DO NOTHING;

INSERT INTO org_site_sections (org_id, section_key, content) VALUES
  ('pigeonshoot', 'hero', '{"title":"Shoot a pigeon.","subtitle":"Toronto is full of them and no two are the same. Photograph one, drop a pin, get a card.","cta":"Start shooting"}'::jsonb),
  ('pigeonshoot', 'about', '{"title":"What is this","body":"<p>A field guide to the birds nobody looks at. Anyone can add to it, no account required, and cards go live the moment you upload them.</p>"}'::jsonb),
  ('pigeonshoot', 'rules', '{"title":"What makes a good card","body":"<p>The tick-boxes on the submit form are the rubric, and the rubric changes. Meeting every one of them does not guarantee a rating — the final call is a human one.</p>"}'::jsonb),
  ('pigeonshoot', 'footer', '{"body":"Toronto''s street pigeons, catalogued as trading cards.","credit":"Maps © OpenStreetMap contributors. Neighbourhood boundaries: City of Toronto Open Data, under the Open Government Licence – Toronto."}'::jsonb)
ON CONFLICT (org_id, section_key) DO NOTHING;

-- Starter rubric. Deliberately opinionated and deliberately provisional: these
-- rows exist to be argued with and edited at /manage/rubric.
INSERT INTO pigeon_criteria (org_id, key, label, hint, category, points, source, auto_check, sort_order) VALUES
  ('pigeonshoot','front_shot','Front-on shot','A straight-ahead portrait. The bird looking at you.','coverage',3,'auto','has_front',10),
  ('pigeonshoot','side_shot','Side profile','A clean profile so the markings read.','coverage',3,'auto','has_side',20),
  ('pigeonshoot','portrait_ratio','3:4 framing','Vertical, roughly card-shaped. Portrait, not landscape.','craft',2,'auto','aspect_3_4',30),
  ('pigeonshoot','resolution_ok','Big enough','At least 1200px on the long edge.','craft',1,'auto','min_long_edge_1200',40),
  ('pigeonshoot','ground_level','Shot at pigeon height','Crouch. Do not photograph down at it.','craft',3,'submitter',NULL,50),
  ('pigeonshoot','sharp_eye','The eye is sharp','If the eye is soft the card is soft.','craft',3,'submitter',NULL,60),
  ('pigeonshoot','whole_bird','Whole bird in frame','Nothing clipped — feet, tail, beak.','craft',1,'submitter',NULL,70),
  ('pigeonshoot','clean_background','Uncluttered background','The bird, not the bin behind it.','craft',1,'submitter',NULL,80),
  ('pigeonshoot','distinctive','Genuinely distinctive','Unusual plumage, a missing toe, a look.','subject',3,'submitter',NULL,90),
  ('pigeonshoot','in_action','Caught doing something','Eating, fighting, strutting, landing.','subject',2,'submitter',NULL,100),
  ('pigeonshoot','daylight','Natural light','No flash. Flash flattens them.','craft',1,'submitter',NULL,110),
  ('pigeonshoot','named','Named, with a story','The bird gets a name and one line about it.','story',1,'submitter',NULL,120),
  ('pigeonshoot','owner_charm','Has something','Reserved for the project owner. Unquantifiable.','story',3,'owner',NULL,200)
ON CONFLICT (org_id, key) DO NOTHING;

-- Tiers. min_score bands the PROVISIONAL badge only; the owner's tier_slug
-- overrides it outright.
INSERT INTO pigeon_tiers (org_id, slug, label, blurb, min_score, accent_hex, frame_style, sort_order) VALUES
  ('pigeonshoot','street','Street','Seen. Logged.',0,'#8A8A8A','plain',10),
  ('pigeonshoot','common','Common','A good honest pigeon.',7,'#7FA88C','plain',20),
  ('pigeonshoot','uncommon','Uncommon','Worth crossing the road for.',12,'#5B87C4','metal',30),
  ('pigeonshoot','rare','Rare','You will not see this bird again.',17,'#A768C9','foil',40),
  ('pigeonshoot','legendary','Legendary','A civic event.',21,'#E0A521','holo',50)
ON CONFLICT (org_id, slug) DO NOTHING;

-- A handful of starter species so /species isn't empty on day one. The rest
-- arrive as contributor proposals.
INSERT INTO pigeon_species (id, org_id, slug, name, tagline, traits, status, sort_order) VALUES
  ('spc_cappuccino','pigeonshoot','cappuccino-pigeon','Cappuccino','Cream hood, cocoa body, foam on top.','["cream head","warm brown mantle","pale wing bar"]'::jsonb,'published',10),
  ('spc_checker','pigeonshoot','checker','Checker','The default. Two black bars, grey everything.','["twin wing bars","iridescent neck","grey mantle"]'::jsonb,'published',20),
  ('spc_ash','pigeonshoot','ash','Ash','Uniform pale grey, no bars, faintly ghostly.','["barless","pale grey","dark eye"]'::jsonb,'published',30),
  ('spc_pied','pigeonshoot','pied','Pied','Irregular white patches. No two the same.','["white blotching","asymmetric","variable"]'::jsonb,'published',40),
  ('spc_ember','pigeonshoot','ember','Ember','Rust-red wash over the whole bird.','["red factor","rust wing","pale rump"]'::jsonb,'published',50)
ON CONFLICT (org_id, slug) DO NOTHING;

-- Toronto.
INSERT INTO pigeon_cities (slug, name, region, country, center_lat, center_lng, default_zoom, boundary_file, boundary_credit, sort_order) VALUES
  ('toronto','Toronto','ON','CA',43.6532,-79.3832,11,
   'toronto-neighbourhoods.json',
   'Neighbourhoods (158-area 2021 model), City of Toronto Open Data, Open Government Licence – Toronto.',
   0)
ON CONFLICT (slug) DO NOTHING;

-- The 158 neighbourhoods. Machine-generated — regenerate rather than hand-edit:
--   node apps/pigeonshoot/scripts/generate-toronto-areas.mjs
INSERT INTO pigeon_areas (city_slug, slug, name, source_id,
                          centroid_lat, centroid_lng,
                          min_lat, min_lng, max_lat, max_lng) VALUES
  ('toronto','agincourt-north','Agincourt North','129',43.805431,-79.266690,43.789070,-79.291270,43.819010,-79.242130),
  ('toronto','agincourt-south-malvern-west','Agincourt South-Malvern West','128',43.788649,-79.265619,43.775010,-79.291710,43.803750,-79.235290),
  ('toronto','alderwood','Alderwood','020',43.604938,-79.541603,43.590220,-79.559780,43.617150,-79.525020),
  ('toronto','annex','Annex','095',43.671590,-79.403996,43.663580,-79.421850,43.681080,-79.386790),
  ('toronto','avondale','Avondale','153',43.760961,-79.400821,43.753620,-79.410940,43.766590,-79.387150),
  ('toronto','banbury-don-mills','Banbury-Don Mills','042',43.737657,-79.349713,43.716230,-79.382670,43.756500,-79.318670),
  ('toronto','bathurst-manor','Bathurst Manor','034',43.764862,-79.456095,43.750380,-79.470180,43.787920,-79.430860),
  ('toronto','bay-cloverhill','Bay-Cloverhill','169',43.664883,-79.388949,43.659860,-79.394140,43.670230,-79.383110),
  ('toronto','bayview-village','Bayview Village','052',43.776351,-79.377124,43.763310,-79.392150,43.790010,-79.359660),
  ('toronto','bayview-woods-steeles','Bayview Woods-Steeles','049',43.796799,-79.382129,43.785010,-79.396230,43.808650,-79.368070),
  ('toronto','bedford-park-nortown','Bedford Park-Nortown','039',43.731485,-79.420225,43.708290,-79.433710,43.753620,-79.404930),
  ('toronto','beechborough-greenbrook','Beechborough-Greenbrook','112',43.693209,-79.479465,43.687460,-79.497980,43.699670,-79.464620),
  ('toronto','bendale-south','Bendale South','157',43.748673,-79.252362,43.741710,-79.268280,43.756000,-79.237580),
  ('toronto','bendale-glen-andrew','Bendale-Glen Andrew','156',43.766429,-79.259972,43.751520,-79.274780,43.781220,-79.245420),
  ('toronto','birchcliffe-cliffside','Birchcliffe-Cliffside','122',43.694662,-79.265114,43.671160,-79.287550,43.718760,-79.244040),
  ('toronto','black-creek','Black Creek','024',43.764904,-79.522000,43.754510,-79.534880,43.775470,-79.504970),
  ('toronto','blake-jones','Blake-Jones','069',43.676159,-79.337368,43.669210,-79.344840,43.681480,-79.329670),
  ('toronto','briar-hill-belgravia','Briar Hill-Belgravia','108',43.699023,-79.452869,43.692160,-79.467100,43.705610,-79.438830),
  ('toronto','bridle-path-sunnybrook-york-mills','Bridle Path-Sunnybrook-York Mills','041',43.731011,-79.378892,43.711350,-79.406500,43.748810,-79.349930),
  ('toronto','broadview-north','Broadview North','057',43.688831,-79.355612,43.679200,-79.366370,43.699410,-79.346270),
  ('toronto','brookhaven-amesbury','Brookhaven-Amesbury','030',43.701322,-79.485578,43.692980,-79.508250,43.710800,-79.467100),
  ('toronto','cabbagetown-south-stjames-town','Cabbagetown-South St.James Town','071',43.667644,-79.366105,43.661950,-79.378350,43.675320,-79.356300),
  ('toronto','caledonia-fairbank','Caledonia-Fairbank','109',43.688576,-79.455214,43.681560,-79.464620,43.695690,-79.445770),
  ('toronto','casa-loma','Casa Loma','096',43.681874,-79.408023,43.673910,-79.418540,43.690780,-79.397930),
  ('toronto','centennial-scarborough','Centennial Scarborough','133',43.782379,-79.150851,43.766370,-79.175270,43.798920,-79.134140),
  ('toronto','church-wellesley','Church-Wellesley','167',43.666354,-79.381765,43.661360,-79.386790,43.671610,-79.376720),
  ('toronto','clairlea-birchmount','Clairlea-Birchmount','120',43.713578,-79.281383,43.695840,-79.302650,43.729960,-79.254280),
  ('toronto','clanton-park','Clanton Park','033',43.741987,-79.446379,43.728070,-79.459670,43.755460,-79.433710),
  ('toronto','cliffcrest','Cliffcrest','123',43.721258,-79.235603,43.700340,-79.254280,43.741480,-79.213970),
  ('toronto','corso-italia-davenport','Corso Italia-Davenport','092',43.677659,-79.447495,43.671040,-79.460210,43.684890,-79.433780),
  ('toronto','danforth','Danforth','066',43.684021,-79.329828,43.678950,-79.346270,43.689180,-79.312780),
  ('toronto','danforth-east-york','Danforth East York','059',43.689468,-79.331393,43.682720,-79.348820,43.696440,-79.313090),
  ('toronto','don-valley-village','Don Valley Village','047',43.783292,-79.353662,43.771640,-79.368070,43.795170,-79.339630),
  ('toronto','dorset-park','Dorset Park','126',43.759272,-79.278909,43.739450,-79.294430,43.777280,-79.264000),
  ('toronto','dovercourt-village','Dovercourt Village','172',43.666226,-79.428810,43.659880,-79.439290,43.672420,-79.418420),
  ('toronto','downsview','Downsview','155',43.738699,-79.474231,43.722730,-79.498170,43.755470,-79.452730),
  ('toronto','downtown-yonge-east','Downtown Yonge East','168',43.655019,-79.377113,43.646880,-79.383110,43.662420,-79.371460),
  ('toronto','dufferin-grove','Dufferin Grove','083',43.655430,-79.437343,43.649890,-79.449870,43.661150,-79.426400),
  ('toronto','east-end-danforth','East End-Danforth','062',43.684171,-79.299366,43.673930,-79.313090,43.692470,-79.284060),
  ('toronto','east-lamoreaux','East L''Amoreaux','148',43.798962,-79.305664,43.785480,-79.320680,43.810090,-79.288570),
  ('toronto','east-willowdale','East Willowdale','152',43.773457,-79.400309,43.762100,-79.412480,43.785010,-79.388060),
  ('toronto','edenbridge-humber-valley','Edenbridge-Humber Valley','009',43.670881,-79.522453,43.651360,-79.539010,43.685510,-79.505520),
  ('toronto','eglinton-east','Eglinton East','138',43.740900,-79.245603,43.730600,-79.266660,43.753390,-79.228890),
  ('toronto','elms-old-rexdale','Elms-Old Rexdale','005',43.721485,-79.549007,43.709470,-79.562130,43.732870,-79.537840),
  ('toronto','englemount-lawrence','Englemount-Lawrence','032',43.720356,-79.437408,43.705860,-79.448550,43.736150,-79.427150),
  ('toronto','eringate-centennial-west-deane','Eringate-Centennial-West Deane','011',43.658024,-79.580436,43.637890,-79.608730,43.677350,-79.555250),
  ('toronto','etobicoke-city-centre','Etobicoke City Centre','159',43.625701,-79.540798,43.605050,-79.568340,43.648770,-79.513170),
  ('toronto','etobicoke-west-mall','Etobicoke West Mall','013',43.645072,-79.568933,43.635310,-79.579500,43.654250,-79.559590),
  ('toronto','fenside-parkwoods','Fenside-Parkwoods','150',43.761559,-79.330925,43.751980,-79.359660,43.768360,-79.314020),
  ('toronto','flemingdon-park','Flemingdon Park','044',43.715927,-79.332635,43.707700,-79.352630,43.725190,-79.319290),
  ('toronto','forest-hill-north','Forest Hill North','102',43.704198,-79.428188,43.698040,-79.440690,43.710510,-79.415960),
  ('toronto','forest-hill-south','Forest Hill South','101',43.694528,-79.414314,43.683490,-79.425560,43.704080,-79.400870),
  ('toronto','fort-york-liberty-village','Fort York-Liberty Village','163',43.634293,-79.412985,43.626750,-79.428940,43.640610,-79.396920),
  ('toronto','glenfield-jane-heights','Glenfield-Jane Heights','025',43.745640,-79.513470,43.732890,-79.530560,43.759870,-79.494230),
  ('toronto','golfdale-cedarbrae-woburn','Golfdale-Cedarbrae-Woburn','141',43.760039,-79.219974,43.741480,-79.243230,43.778560,-79.201440),
  ('toronto','greenwood-coxwell','Greenwood-Coxwell','065',43.672608,-79.324313,43.661550,-79.332380,43.683370,-79.314850),
  ('toronto','guildwood','Guildwood','140',43.748836,-79.195032,43.735000,-79.211280,43.759000,-79.170760),
  ('toronto','harbourfront-cityplace','Harbourfront-CityPlace','165',43.640108,-79.390339,43.633720,-79.401420,43.645290,-79.379580),
  ('toronto','henry-farm','Henry Farm','053',43.771134,-79.341197,43.766490,-79.364140,43.776070,-79.319600),
  ('toronto','high-park-north','High Park North','088',43.657565,-79.466292,43.651140,-79.480020,43.663130,-79.449870),
  ('toronto','high-park-swansea','High Park-Swansea','087',43.645060,-79.467855,43.633440,-79.492700,43.656320,-79.446220),
  ('toronto','highland-creek','Highland Creek','134',43.790766,-79.177470,43.778850,-79.197010,43.800030,-79.151450),
  ('toronto','hillcrest-village','Hillcrest Village','048',43.802999,-79.354807,43.790010,-79.371850,43.815650,-79.335540),
  ('toronto','humber-bay-shores','Humber Bay Shores','161',43.622593,-79.480678,43.610330,-79.493190,43.633440,-79.469230),
  ('toronto','humber-heights-westmount','Humber Heights-Westmount','008',43.692203,-79.522385,43.678910,-79.534390,43.704930,-79.505700),
  ('toronto','humber-summit','Humber Summit','021',43.758930,-79.556140,43.746250,-79.585210,43.772690,-79.530560),
  ('toronto','humbermede','Humbermede','022',43.743426,-79.542384,43.731440,-79.568620,43.754510,-79.526280),
  ('toronto','humewood-cedarvale','Humewood-Cedarvale','106',43.691374,-79.427680,43.681600,-79.437190,43.700990,-79.418490),
  ('toronto','ionview','Ionview','125',43.735358,-79.272469,43.722600,-79.281580,43.745840,-79.262970),
  ('toronto','islington','Islington','158',43.646331,-79.547539,43.630510,-79.567300,43.659860,-79.517030),
  ('toronto','junction-area','Junction Area','090',43.667889,-79.471451,43.660060,-79.483940,43.679380,-79.456020),
  ('toronto','junction-wallace-emerson','Junction-Wallace Emerson','171',43.665306,-79.445129,43.656880,-79.460050,43.674290,-79.433010),
  ('toronto','keelesdale-eglinton-west','Keelesdale-Eglinton West','110',43.685716,-79.471444,43.679220,-79.487080,43.692160,-79.460440),
  ('toronto','kennedy-park','Kennedy Park','124',43.725549,-79.260371,43.714160,-79.274850,43.736700,-79.245490),
  ('toronto','kensington-chinatown','Kensington-Chinatown','078',43.653556,-79.397253,43.647190,-79.407720,43.659860,-79.386630),
  ('toronto','kingsview-village-the-westway','Kingsview Village-The Westway','006',43.698995,-79.547850,43.685630,-79.569450,43.712990,-79.531680),
  ('toronto','kingsway-south','Kingsway South','015',43.653515,-79.510616,43.646110,-79.526790,43.662810,-79.491020),
  ('toronto','lamoreaux-west','L''Amoreaux West','147',43.792231,-79.323062,43.775240,-79.335540,43.805690,-79.310950),
  ('toronto','lambton-baby-point','Lambton Baby Point','114',43.657388,-79.495990,43.647440,-79.512210,43.665860,-79.484480),
  ('toronto','lansing-westgate','Lansing-Westgate','038',43.754270,-79.424756,43.736150,-79.440430,43.768090,-79.408390),
  ('toronto','lawrence-park-north','Lawrence Park North','105',43.730059,-79.403970,43.722570,-79.416980,43.736910,-79.390080),
  ('toronto','lawrence-park-south','Lawrence Park South','103',43.717209,-79.406037,43.703030,-79.422220,43.727680,-79.388290),
  ('toronto','leaside-bennington','Leaside-Bennington','056',43.703793,-79.366078,43.678510,-79.380080,43.721710,-79.350560),
  ('toronto','little-portugal','Little Portugal','084',43.647545,-79.430318,43.640610,-79.444050,43.653600,-79.421400),
  ('toronto','long-branch','Long Branch','019',43.592344,-79.533345,43.581000,-79.548660,43.601280,-79.519050),
  ('toronto','malvern-east','Malvern East','146',43.802026,-79.215641,43.785600,-79.238750,43.819840,-79.197010),
  ('toronto','malvern-west','Malvern West','145',43.805606,-79.230757,43.793870,-79.243940,43.820040,-79.217290),
  ('toronto','maple-leaf','Maple Leaf','029',43.715576,-79.480752,43.706370,-79.492490,43.724870,-79.469780),
  ('toronto','markland-wood','Markland Wood','012',43.633531,-79.573405,43.625530,-79.586050,43.644420,-79.556770),
  ('toronto','milliken','Milliken','130',43.820691,-79.275008,43.801270,-79.307070,43.836600,-79.243080),
  ('toronto','mimico-queensway','Mimico-Queensway','160',43.614047,-79.505755,43.601230,-79.530240,43.624850,-79.482030),
  ('toronto','morningside','Morningside','135',43.782388,-79.207037,43.764050,-79.225520,43.796520,-79.190610),
  ('toronto','morningside-heights','Morningside Heights','144',43.827902,-79.197720,43.796520,-79.251190,43.855460,-79.151190),
  ('toronto','moss-park','Moss Park','073',43.656531,-79.367449,43.649450,-79.376720,43.664290,-79.351740),
  ('toronto','mount-dennis','Mount Dennis','115',43.688156,-79.500000,43.681090,-79.513310,43.695740,-79.482890),
  ('toronto','mount-olive-silverstone-jamestown','Mount Olive-Silverstone-Jamestown','002',43.746885,-79.587246,43.728070,-79.603380,43.763020,-79.568620),
  ('toronto','mount-pleasant-east','Mount Pleasant East','099',43.704834,-79.384951,43.690940,-79.400480,43.719080,-79.372040),
  ('toronto','new-toronto','New Toronto','018',43.600691,-79.510318,43.587070,-79.526710,43.613450,-79.496880),
  ('toronto','newtonbrook-east','Newtonbrook East','050',43.791532,-79.405949,43.779770,-79.420080,43.803270,-79.392150),
  ('toronto','newtonbrook-west','Newtonbrook West','036',43.785829,-79.431428,43.773860,-79.446660,43.798000,-79.415580),
  ('toronto','north-riverdale','North Riverdale','068',43.672002,-79.351260,43.664530,-79.363390,43.678950,-79.340820),
  ('toronto','north-stjames-town','North St.James Town','074',43.669599,-79.375239,43.666290,-79.380570,43.672470,-79.369560),
  ('toronto','north-toronto','North Toronto','173',43.710259,-79.395070,43.706730,-79.399560,43.713790,-79.390200),
  ('toronto','oconnor-parkview','O''Connor-Parkview','054',43.706794,-79.312228,43.694920,-79.338180,43.717270,-79.293480),
  ('toronto','oakdale-beverley-heights','Oakdale-Beverley Heights','154',43.726562,-79.510745,43.714900,-79.532250,43.739390,-79.481310),
  ('toronto','oakridge','Oakridge','121',43.697375,-79.279724,43.689290,-79.290960,43.712050,-79.267670),
  ('toronto','oakwood-village','Oakwood Village','107',43.688564,-79.439783,43.678760,-79.450280,43.698510,-79.429090),
  ('toronto','old-east-york','Old East York','058',43.696776,-79.335472,43.689430,-79.351030,43.703200,-79.317430),
  ('toronto','palmerston-little-italy','Palmerston-Little Italy','080',43.659152,-79.418408,43.653600,-79.429440,43.665120,-79.407720),
  ('toronto','parkwoods-oconnor-hills','Parkwoods-O''Connor Hills','149',43.749808,-79.329568,43.739790,-79.349850,43.763650,-79.309790),
  ('toronto','pelmo-park-humberlea','Pelmo Park-Humberlea','023',43.717551,-79.528277,43.705870,-79.544860,43.735050,-79.505790),
  ('toronto','playter-estates-danforth','Playter Estates-Danforth','067',43.679698,-79.354889,43.675320,-79.364960,43.684080,-79.344840),
  ('toronto','pleasant-view','Pleasant View','046',43.786982,-79.334960,43.774700,-79.344400,43.802330,-79.323020),
  ('toronto','princess-rosethorn','Princess-Rosethorn','010',43.666043,-79.544556,43.650040,-79.563180,43.679840,-79.526400),
  ('toronto','regent-park','Regent Park','072',43.659996,-79.360513,43.655620,-79.367040,43.664530,-79.354320),
  ('toronto','rexdale-kipling','Rexdale-Kipling','004',43.723716,-79.566226,43.711700,-79.577510,43.736070,-79.554960),
  ('toronto','rockcliffe-smythe','Rockcliffe-Smythe','111',43.674790,-79.494432,43.662630,-79.513050,43.685350,-79.472420),
  ('toronto','roncesvalles','Roncesvalles','086',43.646118,-79.442982,43.638720,-79.452450,43.656880,-79.428210),
  ('toronto','rosedale-moore-park','Rosedale-Moore Park','098',43.682803,-79.379639,43.670230,-79.395340,43.695030,-79.363390),
  ('toronto','runnymede-bloor-west-village','Runnymede-Bloor West Village','089',43.659278,-79.485738,43.649330,-79.499230,43.666830,-79.476300),
  ('toronto','rustic','Rustic','028',43.711612,-79.498082,43.702880,-79.507830,43.720100,-79.487670),
  ('toronto','scarborough-village','Scarborough Village','139',43.738639,-79.216812,43.726760,-79.228890,43.751130,-79.204710),
  ('toronto','south-eglinton-davisville','South Eglinton-Davisville','174',43.701947,-79.392622,43.695670,-79.398370,43.708410,-79.386230),
  ('toronto','south-parkdale','South Parkdale','085',43.636707,-79.439298,43.629790,-79.474240,43.642310,-79.419570),
  ('toronto','south-riverdale','South Riverdale','070',43.649256,-79.335655,43.612820,-79.359850,43.674940,-79.303990),
  ('toronto','st-lawrence-east-bayfront-the-islands','St Lawrence-East Bayfront-The Islands','166',43.632239,-79.374329,43.611960,-79.404900,43.656350,-79.347300),
  ('toronto','standrew-windfields','St.Andrew-Windfields','040',43.756251,-79.379158,43.743300,-79.408390,43.766490,-79.343900),
  ('toronto','steeles','Steeles','116',43.812951,-79.321205,43.802330,-79.341320,43.823690,-79.301010),
  ('toronto','stonegate-queensway','Stonegate-Queensway','016',43.635525,-79.501128,43.620490,-79.523440,43.650070,-79.474240),
  ('toronto','tam-oshanter-sullivan','Tam O''Shanter-Sullivan','118',43.780140,-79.302905,43.768370,-79.323020,43.796070,-79.284610),
  ('toronto','taylor-massey','Taylor-Massey','061',43.694994,-79.295895,43.688710,-79.306310,43.703020,-79.287760),
  ('toronto','the-beaches','The Beaches','063',43.671063,-79.299580,43.659240,-79.329480,43.680810,-79.280050),
  ('toronto','thistletown-beaumond-heights','Thistletown-Beaumond Heights','003',43.737980,-79.563531,43.727890,-79.582560,43.746250,-79.546180),
  ('toronto','thorncliffe-park','Thorncliffe Park','055',43.707744,-79.349983,43.698260,-79.364800,43.716310,-79.335290),
  ('toronto','trinity-bellwoods','Trinity-Bellwoods','081',43.650167,-79.415335,43.643490,-79.426400,43.656480,-79.404010),
  ('toronto','university','University','079',43.662520,-79.401182,43.656480,-79.411210,43.668720,-79.390490),
  ('toronto','victoria-village','Victoria Village','043',43.728490,-79.314846,43.715100,-79.331560,43.742140,-79.299160),
  ('toronto','wellington-place','Wellington Place','164',43.645845,-79.394627,43.640750,-79.404010,43.650670,-79.385020),
  ('toronto','west-hill','West Hill','136',43.767484,-79.176676,43.753870,-79.203980,43.781140,-79.145110),
  ('toronto','west-humber-clairville','West Humber-Clairville','001',43.716196,-79.596363,43.668770,-79.639260,43.757860,-79.552360),
  ('toronto','west-queen-west','West Queen West','162',43.642925,-79.410914,43.640070,-79.422410,43.647190,-79.401270),
  ('toronto','west-rouge','West Rouge','143',43.798605,-79.148078,43.773970,-79.190150,43.813980,-79.116950),
  ('toronto','westminster-branson','Westminster-Branson','035',43.778811,-79.452386,43.761220,-79.468030,43.792410,-79.439980),
  ('toronto','weston','Weston','113',43.702737,-79.515766,43.693270,-79.535960,43.710680,-79.502190),
  ('toronto','weston-pelham-park','Weston-Pelham Park','091',43.673964,-79.460268,43.667120,-79.472420,43.681900,-79.449020),
  ('toronto','wexford-maryvale','Wexford/Maryvale','119',43.748590,-79.298643,43.724720,-79.319790,43.772730,-79.277860),
  ('toronto','willowdale-west','Willowdale West','037',43.771204,-79.427570,43.763340,-79.443010,43.779770,-79.412250),
  ('toronto','willowridge-martingrove-richview','Willowridge-Martingrove-Richview','007',43.683644,-79.554235,43.673310,-79.577610,43.696160,-79.526610),
  ('toronto','woburn-north','Woburn North','142',43.773176,-79.236822,43.755550,-79.254980,43.789250,-79.211170),
  ('toronto','woodbine-corridor','Woodbine Corridor','064',43.676768,-79.315409,43.666360,-79.323640,43.685680,-79.307930),
  ('toronto','woodbine-lumsden','Woodbine-Lumsden','060',43.694108,-79.311160,43.686400,-79.319370,43.701140,-79.302840),
  ('toronto','wychwood','Wychwood','094',43.676920,-79.425528,43.670270,-79.435920,43.683630,-79.414690),
  ('toronto','yonge-bay-corridor','Yonge-Bay Corridor','170',43.652945,-79.383732,43.644780,-79.390490,43.661370,-79.376970),
  ('toronto','yonge-doris','Yonge-Doris','151',43.771567,-79.411927,43.761510,-79.415580,43.780480,-79.408260),
  ('toronto','yonge-eglinton','Yonge-Eglinton','100',43.704702,-79.403607,43.695670,-79.411490,43.713650,-79.396110),
  ('toronto','yonge-stclair','Yonge-St.Clair','097',43.687865,-79.397869,43.677990,-79.405880,43.698180,-79.391190),
  ('toronto','york-university-heights','York University Heights','027',43.765733,-79.488881,43.742520,-79.521740,43.787280,-79.462770),
  ('toronto','yorkdale-glen-park','Yorkdale-Glen Park','031',43.714683,-79.457102,43.699670,-79.472570,43.730080,-79.438540)
ON CONFLICT (city_slug, slug) DO NOTHING;

COMMIT;
