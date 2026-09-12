-- ============================================================================
-- 120: Elastrocal — charts with an unknown birth time
--
-- Very many people don't know their birth time. Until now the form demanded
-- one, so those charts were either not made or made with a fabricated time
-- that then looked authoritative. A chart can now record that the time is
-- unknown: it is cast for local noon (the convention every chart service
-- uses), and the engine flags that the houses, the angles and the Moon (which
-- moves ~13° a day) are approximate. birth_time stays NOT NULL — it is the
-- time actually used — and time_known says whether it was given or assumed.
-- ============================================================================

BEGIN;

ALTER TABLE astro_charts
  ADD COLUMN IF NOT EXISTS time_known BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN astro_charts.time_known IS
  'false = birth time unknown; birth_time then holds the assumed local noon and houses/angles are approximate.';

COMMIT;
