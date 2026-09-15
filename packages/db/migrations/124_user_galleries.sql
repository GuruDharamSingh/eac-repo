-- ============================================================================
-- 124: user_galleries — as many gallery pages as a person wants.
--
-- `users.portfolio` (migration 084) is ONE highlight grid on the profile. An
-- artist with a body of work wants more than one: a series, a show, a year.
-- Each row here is a page of its own (/artists/<slug>/galleries/<gallery>),
-- owned by the PERSON, not the org — like the portfolio and the files under
-- EAC_Network/users/<slug>/, it follows them across every org that publishes
-- them. The org only decides whether it links to them (is_public + the
-- org_profiles publish state of the person).
--
-- `items` is the same [{id,url,title,x,y,w,h}] shape as users.portfolio so the
-- shared ProfileGallery (@elkdonis/cms-ui/gallery) renders both unchanged.
-- URLs are platform media URLs (/api/media/EAC_Network/...), which may point
-- into the person's own folder OR the org's tree — a gallery may mix the two,
-- and the media proxy's authz (media-authz.ts) is what gates each file, not
-- this table.
--
-- `settings` is an untyped map for per-gallery presentation (theme vars,
-- column count…), sanitised in app code the same way site_themes.vars is.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_galleries (
  id          VARCHAR(21)  PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug        VARCHAR(80)  NOT NULL,
  title       TEXT         NOT NULL,
  description TEXT,
  cover_url   TEXT,
  items       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  settings    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  is_public   BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS user_galleries_user_idx
  ON user_galleries (user_id, sort_order, created_at);

COMMENT ON TABLE user_galleries IS
  'A person''s gallery pages. Owned by the user (follows them across orgs); items share the users.portfolio item shape so ProfileGallery renders both.';
COMMENT ON COLUMN user_galleries.items IS
  '[{id,url,title,x,y,w,h}] — same shape as users.portfolio. URLs are platform /api/media paths, gated per file by media-authz, not by this row.';
COMMENT ON COLUMN user_galleries.settings IS
  'Per-gallery presentation map (e.g. {"--frame":"#fff"}). Untyped like site_themes.vars; sanitised in app code.';
