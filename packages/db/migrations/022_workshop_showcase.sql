-- Migration 022: Workshop showcase flags for elkdonis-arts-collective public page
--
-- show_on_workshops_page : toggle to feature a meeting on the public /workshops page
-- workshop_order         : when set (1, 2, 3…) → featured card; NULL → upcoming table
-- subtitle               : short descriptor beneath the title ("Creative Writing Laboratory")
-- card_colour            : hex background for the workshop card (e.g. "#1a3a2a")
-- card_accent_colour     : hex accent / CTA colour for the card   (e.g. "#4a9a6a")
--
-- enquireUrl comes from the existing meetings.meeting_url column (no new column needed)
-- capacity   comes from the existing meetings.attendee_limit column ("Up to N participants")
--            or can be overridden via metadata->'workshop'->>'capacity' for custom strings
--
-- Remaining display metadata (lead, format, workshopStatus, workshopType, capacity override)
-- is stored in the existing metadata JSONB column under the "workshop" key:
--   { "workshop": { "lead": "Dana McCool", "format": "Online · 3 sessions", ... } }

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS show_on_workshops_page BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workshop_order         INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subtitle               VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS card_colour            VARCHAR(7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS card_accent_colour     VARCHAR(7) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_workshop_showcase
  ON meetings (show_on_workshops_page, workshop_order)
  WHERE show_on_workshops_page = true;
