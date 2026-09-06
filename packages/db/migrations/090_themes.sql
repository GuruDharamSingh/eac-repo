-- ============================================================================
-- Migration 090: per-site, per-page and per-user theme overrides
-- ============================================================================
-- Every app currently hardcodes its palette in its own globals.css, which is
-- why "each business looks different" has meant "write another app". Meanwhile
-- the artist wizard has been asking every member for a palette_preference and
-- a template_preference since it was built — 0 rows populated, never read.
--
-- The insight that makes this cheap: the shared embeds are already entirely
-- CSS-variable driven. `bg-card` compiles to hsl(var(--card)), `bg-primary` to
-- hsl(var(--primary)). Anything that sets those variables restyles every embed
-- with no code change and no rebuild. So a theme is just a bag of CSS custom
-- properties injected at request time.
--
-- `vars` is deliberately an untyped JSONB map of {"--name": "value"} rather
-- than typed columns. Apps do not share a vocabulary — arts-collective uses
-- the shadcn set (--background/--card/--primary), IFAC uses its own
-- (--ink/--paper/--oxide/--line). Each app declares the variables it exposes
-- as CssVarDef[]; this table just stores whatever that app asked for. Typed
-- columns would force every app onto one palette, which is the opposite of
-- the point.
--
-- Three scopes, resolved by merging in this order (later wins):
--   site   the org's default look          site_themes(org_id, '')
--   page   one page of that site           site_themes(org_id, 'hub')
--   user   an artist's own profile page    users.theme
-- ============================================================================

CREATE TABLE IF NOT EXISTS site_themes (
  org_id     VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- '' is the site-wide default. Any other value scopes to one page, using
  -- whatever key that app routes by ('hub', 'about', a thread slug).
  page_key   TEXT        NOT NULL DEFAULT '',
  vars       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, page_key)
);

COMMENT ON TABLE site_themes IS
  'CSS custom property overrides per org, optionally per page. page_key = '''' is the site default.';
COMMENT ON COLUMN site_themes.vars IS
  'Untyped {"--name":"value"} map — each app declares which variables it exposes.';

CREATE INDEX IF NOT EXISTS idx_site_themes_org ON site_themes (org_id);

-- An artist's own look, carried across every org that publishes them. Kept on
-- users rather than org_profiles on purpose: this is the person's identity,
-- and identity is the thing users owns (see profiles.ts — the artist edits
-- their identity, an org only controls whether they are published).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.theme IS
  'CSS custom property overrides for this person''s own profile pages.';
