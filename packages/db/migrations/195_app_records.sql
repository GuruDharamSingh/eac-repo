-- 195 — app_records: what the network's own apps keep for a person, synced
-- from the device (Jerusalem first). 2026-10-03.
--
-- One row per record: an Index entry, a prep note on a sky event, an episode.
-- `data` is the app's JSON for it; attachments inside it point at files in
-- Nextcloud (org-relative paths, uploaded through /api/mobile/v1/media).
-- Sync is last-write-wins on updated_at (the device's clock); a deletion is a
-- tombstone (deleted_at) so other devices learn of it.
--
-- Justin's Index entries and his reasons are training material for the astro
-- model; they live here, in the database, rather than only on a phone.

CREATE TABLE IF NOT EXISTS app_records (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app         text NOT NULL,                 -- 'jerusalem'
  kind        text NOT NULL,                 -- 'index-entry' | 'prep' | 'episode'
  record_id   text NOT NULL,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL,
  deleted_at  timestamptz,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app, kind, record_id)
);

CREATE INDEX IF NOT EXISTS app_records_synced ON app_records (user_id, app, synced_at);
