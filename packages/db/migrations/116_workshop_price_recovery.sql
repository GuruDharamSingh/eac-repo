-- ============================================================================
-- Migration 116: recover the price 115 could not read
-- ============================================================================
-- workshop_details.pricing on th_Iutg4U9dGrOGuBb3gx ("Creative Writing:
-- Exquisite Corpse") was double-encoded: a JSON string whose contents were
-- '{"amount":20,"currency":"USD"}', not an object. 115's jsonb_typeof test
-- therefore saw a string and carried nothing, and the table is gone. The
-- value was read and recorded before 115 ran; this puts it where every
-- reader now looks. Same double-write as upsertWorkshopOffering.
-- ============================================================================

BEGIN;

UPDATE threads
SET price = COALESCE(price, 20), currency = 'USD', updated_at = NOW()
WHERE id = 'th_Iutg4U9dGrOGuBb3gx' AND kind = 'workshop';

UPDATE workshop_pages
SET price_member = COALESCE(price_member, 20), updated_at = NOW()
WHERE thread_id = 'th_Iutg4U9dGrOGuBb3gx';

COMMIT;
