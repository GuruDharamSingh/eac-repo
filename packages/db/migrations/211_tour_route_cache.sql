-- 211: cached Street View stills per stop and cached walking geometry per tour (2026-10-18).
--
-- Both exist to keep Google Maps Platform and OSRM calls to one per edit
-- instead of one per page view:
--   tour_stops.still_url   a Street View Static image at the stop's pose, fetched
--                          once when the stop is saved and stored in the org's
--                          media folder (served by /api/media); NULL until made
--   threads.metadata.tour.route  (no column) the OSRM foot geometry between the
--                          meeting point and the stops, refreshed on save
-- The route lives in metadata because it belongs to the tour row and is read
-- with it; the still gets a column because the stop editor rewrites rows.

ALTER TABLE tour_stops ADD COLUMN IF NOT EXISTS still_url text;
