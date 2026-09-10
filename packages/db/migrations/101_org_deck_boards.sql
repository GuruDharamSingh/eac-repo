-- Per-org Nextcloud Deck board.
--
-- Until now the one wired-up kanban view (amrit-canada's /hub/pipeline)
-- pointed at a board id from an env var, which resolved to a board owned by
-- another member and shared with the whole `Elkdonis Arts Collective` group —
-- so an org's hub showed a board that is not the org's, and any org pointed at
-- the same id would see the same cards. The board an org's hub renders is now
-- a property of the org.
--
-- deck_board_id: id of the org's own Deck board, owned by the service account
--   (NEXTCLOUD_ADMIN_USER) and shared only with that org's members. NULL until
--   provisioned — see ensureOrgDeckBoard() in @elkdonis/services.
--
-- Access is enforced in the app, not by Nextcloud: every read and write goes
-- out over the one service-account credential, so Deck's own board ACL cannot
-- see who is asking. The ACL still matters for members who connect their own
-- Nextcloud account, which is why boards are shared per-user and never with a
-- broad group.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS deck_board_id INTEGER,
  ADD COLUMN IF NOT EXISTS deck_board_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_deck_board
  ON organizations (deck_board_id)
  WHERE deck_board_id IS NOT NULL;
