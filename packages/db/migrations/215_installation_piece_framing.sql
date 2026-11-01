-- 215: framing on installation pieces — the frame's proportion and the crop
-- inside it (loft scene editor phase 2). 2026-10-29.
-- ratio: 'auto' (the picture's own) or a fixed shape such as '4:5'; the
-- vocabulary lives in packages/three/src/hallway/framing.ts, not a CHECK.
-- crop_x / crop_y: where the picture is centred inside the frame, 0–100 %.
-- crop_zoom: how far it is zoomed in, 1–3.

ALTER TABLE art_installation_piece
  ADD COLUMN IF NOT EXISTS ratio TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS crop_x REAL NOT NULL DEFAULT 50 CHECK (crop_x >= 0 AND crop_x <= 100),
  ADD COLUMN IF NOT EXISTS crop_y REAL NOT NULL DEFAULT 50 CHECK (crop_y >= 0 AND crop_y <= 100),
  ADD COLUMN IF NOT EXISTS crop_zoom REAL NOT NULL DEFAULT 1 CHECK (crop_zoom >= 1 AND crop_zoom <= 3);
