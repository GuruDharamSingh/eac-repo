-- 257 · Saved page templates ("Save as template" / New page → Saved templates).
-- 2026-11-08. docs/open/hub-cards-handoff/PLAN.md §6 B.
--
-- A SNAPSHOT of an editor page (blocks, layout, words): pages made from it get
-- their own copy, so changing or deleting the template never touches them.
-- puck_data is stored already sanitised by the host (cleanBoxDoc + resolved-key
-- strip, agreed with lane D). org_id NULL = a network-level template, for the
-- shell's catalogue later.

CREATE TABLE IF NOT EXISTS site_page_templates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         varchar(50) REFERENCES organizations(id) ON DELETE CASCADE,
  name           text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description    text        NOT NULL DEFAULT '',
  from_path      text,
  puck_data      jsonb       NOT NULL,
  block_count    integer     NOT NULL DEFAULT 0,
  created_by     uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_page_templates_org ON site_page_templates (org_id, created_at DESC);
