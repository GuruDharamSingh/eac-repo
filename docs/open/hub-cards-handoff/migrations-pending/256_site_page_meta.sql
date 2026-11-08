-- 256 · Site page meta: what the hub Site Builder card shows about each page.
-- 2026-11-08. docs/open/hub-cards-handoff/PLAN.md §6 A (architect notes folded in).
--
-- Keyed on the SITE PATH ('' = home, 'exhibitions/after-image' = nested), not on
-- the Puck storage key, so template pages (copy slots in org_site_sections) get
-- notes too and a later rename/move carries the meta with it. `kind` says which
-- store the page body lives in: editor = site_config 'puck:<path>', template =
-- an app-declared layout. Notes are hub-only: never rendered on the site.
-- thumbnail_* is reserved for the capture-on-save job (later pass; v1 draws the
-- placeholder). Path depth ≤ 3, as page-builder's isValidPagePath.

CREATE TABLE IF NOT EXISTS site_page_meta (
  org_id         varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  path           text        NOT NULL
                 CHECK (path = '' OR path ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*){0,2}$'),
  kind           text        NOT NULL CHECK (kind IN ('editor', 'template')),
  title          text,
  notes          text        CHECK (notes IS NULL OR length(notes) <= 4000),
  link_preview   text        CHECK (link_preview IS NULL OR length(link_preview) <= 300),
  thumbnail_url  text,
  thumbnail_at   timestamptz,
  sort_order     integer,
  updated_by     uuid        REFERENCES users(id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, path)
);
