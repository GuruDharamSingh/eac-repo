-- ============================================================================
-- Migration 076: Correct the seeded guide bio (Amrit Canada)
-- ============================================================================
-- Migration 073 seeded a placeholder bio for Guru Dharam Singh that was
-- written during the rebuild, not supplied by him. It named Guru Ram Das
-- Ashram, the street it is on, and Lotus Yoga — three things the site has no
-- standing to assert (see migration 075 and the brand doc §3).
--
-- Replaced with a bio drawn only from what the site itself already said: he
-- teaches Kundalini Yoga in Toronto, holds the daily sadhana, and has carried
-- responsibility for the monthly Amrit Vela since 2023, continuing what Guru
-- Fatha Singh Ji began.
--
-- This is placeholder text either way — it is his page and his words to write.
-- Editable at /manage/people.
-- ============================================================================

BEGIN;

UPDATE artist_profiles SET
  bio = 'Guru Dharam Singh teaches Kundalini Yoga in Toronto and holds the daily 4:00 AM Aquarian Sadhana. Since 2023 he has carried responsibility for the monthly Amrit Vela gathering, continuing the practice begun by Guru Fatha Singh Ji.'
WHERE org_id = 'amrit_canada'
  AND slug = 'guru-dharam-singh'
  -- Only overwrite the seeded text; never clobber a bio he has since written.
  AND bio LIKE '%Guru Ram Dass Ashram on Palmerston Blvd%';

COMMIT;
