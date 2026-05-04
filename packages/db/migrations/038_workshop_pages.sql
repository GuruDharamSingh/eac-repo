-- ============================================================================
-- Migration 038: Workshop pages sidecar + threads.format enum
-- ============================================================================
-- Two changes:
--
-- 1. threads: replaces is_online (boolean) with format (enum)
--    in_person | online | hybrid
--    Backfills from existing is_online values.
--
-- 2. workshop_pages sidecar table
--    One row per thread where kind='workshop'.
--    Owns all template-filling data that does not belong on the generic
--    threads row: discipline, logistics, pricing tiers, media, SEO,
--    optional-section overrides, and registration state.
--
-- Author convention: threads.author_id → artist_profiles is the facilitator.
-- No separate facilitator_id column needed. workshop_pages.author_note
-- provides a workshop-specific override for the bio text only.
--
-- Registration URL: stored here for now. Checkout feature is a future
-- session — note the need for a shared /register/[slug] route component.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. threads: is_online → format
-- ---------------------------------------------------------------------------

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS format VARCHAR(20)
    CHECK (format IN ('in_person', 'online', 'hybrid'));

-- Backfill from is_online (true → 'online', false → 'in_person').
-- NULL rows (posts/meetings with no scheduling context) stay NULL.
UPDATE threads
   SET format = CASE
                  WHEN is_online = true  THEN 'online'
                  WHEN is_online = false THEN 'in_person'
                END
 WHERE kind IN ('workshop', 'event')
   AND format IS NULL
   AND is_online IS NOT NULL;

-- Default new rows to 'online' (most common for this platform).
ALTER TABLE threads
  ALTER COLUMN format SET DEFAULT 'online';

-- is_online is kept for one migration cycle so existing code can be updated
-- before the column is dropped. Remove in the next cleanup migration.
COMMENT ON COLUMN threads.is_online IS 'DEPRECATED: use threads.format instead. Will be dropped after migration 038 code rollout.';

-- ---------------------------------------------------------------------------
-- 2. workshop_pages sidecar
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workshop_pages (
  thread_id             VARCHAR(21)   PRIMARY KEY
                          REFERENCES threads(id) ON DELETE CASCADE,

  -- Workshop identity
  subtitle              TEXT,
    -- One-line hook shown below the title (e.g. "A six-week writing circle").

  description_short     TEXT,
    -- Hand-written 2–3 sentence summary. Used in cards, meta, and social
    -- preview. Distinct from threads.excerpt (which is auto-generated).

  discipline            VARCHAR(80),
    -- Display label for the art form of this workshop.
    -- Free text for now; no enum constraint until taxonomy is stable.
    -- e.g. "Creative writing", "Movement", "Sound".

  series_label          VARCHAR(80),
    -- Short format descriptor used in the hero eyebrow alongside discipline.
    -- e.g. "6-week series", "Single session", "Ongoing cohort".
    -- Eyebrow renders as: "{discipline} · {series_label}".

  -- Logistics
  level                 VARCHAR(20)
                          CHECK (level IN ('all_levels', 'beginner', 'intermediate', 'advanced')),

  language              VARCHAR(60)   NOT NULL DEFAULT 'English',

  session_count         INTEGER,
    -- Total number of sessions. Distinct from threads.sessions[] (which
    -- holds the structured per-session rows). session_count may be set
    -- before session details are filled in.

  session_duration_hrs  DECIMAL(4,2),
    -- Length of each session in hours (e.g. 3.0).

  recurrence_label      TEXT,
    -- Human-readable schedule string shown in hero pill and detail strip.
    -- e.g. "Saturdays 10am–1pm". Separate from threads.recurrence_pattern
    -- (machine enum). Both may coexist.

  location_address      TEXT,
    -- Full street address. Null for online workshops.
    -- threads.location holds a short display label (e.g. "EAC Studio, Toronto").

  accessibility_notes   TEXT,
    -- Wheelchair access, captioning, etc. Shown in collapsed About section.

  -- Capacity & pricing
  price_sliding_min     DECIMAL(10,2),
    -- Sliding scale floor. NULL = sliding scale not offered.

  price_member          DECIMAL(10,2),
    -- EAC member discount price. NULL = no member pricing.

  sliding_scale_note    TEXT,
    -- e.g. "Reach out if cost is a barrier." Shown in register block.

  registration_url      TEXT,
    -- External checkout/registration link or internal /register/[slug] path.
    -- NOTE: a shared checkout feature component is needed (future session).

  registration_deadline DATE,
    -- Cutoff date for registration. Maps to threads.rsvp_deadline for
    -- RSVP-enabled workshops; this field is for display and external forms.

  registration_status   VARCHAR(20)   NOT NULL DEFAULT 'open'
                          CHECK (registration_status IN ('open', 'waitlist', 'full', 'closed')),
    -- Template-level registration state, separate from threads.status
    -- (which handles draft / published / archived).
    -- open     → "Register now"
    -- waitlist → "Join waitlist"
    -- full     → "Sold out"
    -- closed   → "This workshop has ended"

  -- Author context (author_id → artist_profiles is the facilitator)
  author_note           TEXT,
    -- Workshop-specific bio override. Replaces artist_profiles.bio in the
    -- facilitator section for this workshop only.

  -- Media (Nextcloud paths or URLs)
  cover_image_url       TEXT,
    -- Hero background / OG image. Falls back to og_image_url if null.

  gallery_image_urls    JSONB         NOT NULL DEFAULT '[]',
    -- Array of Nextcloud paths for the past sessions / media gallery.
    -- Shape: [{"url": "...", "alt": "...", "caption": "..."}]

  promo_video_url       TEXT,
    -- Optional video embed URL for the gallery section.

  -- SEO / social
  seo_title             TEXT,
    -- Overrides threads.title in the <title> tag. Null = use threads.title.

  seo_description       VARCHAR(160),
    -- Meta description. Max 160 chars. Falls back to description_short.

  og_image_url          TEXT,
    -- Social share image. Falls back to cover_image_url.

  -- Template editor state
  optional_sections     JSONB         NOT NULL DEFAULT '{}',
    -- Map of manifest section ids to inclusion boolean.
    -- e.g. {"eac-ws-schedule": true, "eac-ws-gallery": false}
    -- Missing keys fall back to manifest defaultVisible.

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workshop_pages IS
  'Template-filling data for workshop threads. One row per thread '
  'where kind=''workshop''. Owned by the template editor and the workshop '
  'CMS form. Separate from threads to keep the generic thread row lean.';

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION workshop_pages_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workshop_pages_updated_at ON workshop_pages;
CREATE TRIGGER trg_workshop_pages_updated_at
  BEFORE UPDATE ON workshop_pages
  FOR EACH ROW EXECUTE FUNCTION workshop_pages_touch_updated_at();

COMMIT;
