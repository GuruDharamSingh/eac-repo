-- 218: installation lighting (loft scene editor phase 3), 2026-10-30.
--
-- art_installation.scene holds scene-wide settings as one document; for now
-- only `lighting` (room brightness, warmth, key light, background, picture
-- lamps; see packages/three/src/hallway/lighting.ts). An empty document means
-- the venue's own lighting, as before.
--
-- art_installation_piece.lamp is the piece's picture lamp: a named fixed point
-- (`at`: above, above-left, above-right, pair, uplight, wash, off). `offset`
-- is reserved for a freely placed lamp later, so that needs no migration.

ALTER TABLE art_installation
  ADD COLUMN IF NOT EXISTS scene JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE art_installation_piece
  ADD COLUMN IF NOT EXISTS lamp JSONB NOT NULL DEFAULT '{"at": "above"}'::jsonb;
