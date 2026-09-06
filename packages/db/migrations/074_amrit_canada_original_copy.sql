-- ============================================================================
-- Migration 074: Restore Amrit Canada's original site copy
-- ============================================================================
-- Migration 073 seeded placeholder wording written during the rebuild. This
-- replaces it with the site's actual copy, recovered from the pre-rebuild
-- components (git HEAD before the 2026-07-26 rewrite):
--
--   src/app/page.tsx            hero titles, portal tiles, "Our Tradition"
--   src/app/sadhana/page.tsx    section header, blockquote, resource blurbs
--   src/app/yoga/page.tsx       about-the-classes text and quote
--   src/app/gurdwara/page.tsx   langar description and quote
--
-- Two corrections of substance, not just tone:
--
--  1. The monthly Amrit Vela gathering is NOT at the ashram — the original
--     site says "either in a Church or on a Ski Hill in Etobicoke". The 073
--     seed wrongly implied 348 Palmerston for it. The DAILY sadhana is at the
--     ashram; the monthly gathering moves.
--
--  2. Attribution restored: Guru Fatha Singh Ji began this sadhana and it has
--     been carried for about a decade; Guru Dharam Singh took responsibility
--     for it in 2023. That history was lost in the rewrite.
--
-- Spelling note: the original site consistently writes "Guru Ram Das Ashram"
-- (one 's'), so that spelling is used throughout here.
-- ============================================================================

BEGIN;

UPDATE org_feeds SET
  name        = 'Amrit Vela Sadhana',
  tagline     = 'Crown yourself in the early hours of the morning',
  description = 'A 4:00 AM, 2.5 hour journey of Jap Ji, Yoga and Kirtan. We follow a Sikh Dharma tradition rising 4 hours before sunrise in the hour known as the Amrit Vela. We meet once a month, either in a Church or on a Ski Hill in Etobicoke — check the listings below for which and when.',
  presenter   = 'Guru Ram Das Ashram'
WHERE org_id = 'amrit_canada' AND slug = 'amrit-vela';

UPDATE org_feeds SET
  name        = 'Yoga Classes',
  tagline     = 'Kundalini Yoga with Guru Dharam Singh',
  description = 'Whether you are new to yoga or have practiced for years, these classes offer a powerful technology for elevating consciousness, strengthening the nervous system, and opening the heart.',
  presenter   = 'Guru Dharam Singh'
WHERE org_id = 'amrit_canada' AND slug = 'yoga';

UPDATE org_feeds SET
  name        = 'Gurdwara & Langar',
  tagline     = 'Sangat & communal meal at Guru Ram Das Ashram',
  description = 'The Guru Ram Das Ashram hosts regular Gurdwara gatherings — a sacred space for prayer (Simran), scripture reading (Gurbani), and communal sharing. All are welcome regardless of background or tradition. Langar, the free communal meal, is served after the service, embodying the Sikh principle of equality: all sit together and eat together, regardless of status or faith.',
  presenter   = 'Guru Ram Das Ashram'
WHERE org_id = 'amrit_canada' AND slug = 'gurdwara';

-- Site copy, including the per-feed pull quotes from the original section
-- pages (keyed quote_<feed slug with underscores>).
INSERT INTO org_site_sections (org_id, section_key, content) VALUES
  ('amrit_canada', 'hero', '{"eyebrow":"Amrit Vela — The Ambrosial Hours","title":"Amrit Vela Sadhana","subtitle":"A 4:00 AM, 2.5 hour journey of Jap Ji, Yoga and Kirtan","body":"Crown yourself in the Early Hours of the Morning. We follow a Sikh Dharma tradition rising 4 hours before sunrise in the hour known as the Amrit Vela.","note":"We meet once a month, either in a Church or on a Ski Hill in Etobicoke. Check below to see which and when."}'::jsonb),
  ('amrit_canada', 'about', '{"title":"Our Tradition","body":"Guru Fatha Singh Ji began this Sadhana and we''ve been carrying it on for the last decade. Guru Dharam Singh has carried on the responsibility of ensuring its success since 2023. You can find Guru Dharam''s related effort on this site, including Yoga Classes, and Gurdwara at Guru Ram Das Ashram.","linkLabel":"see his website here","linkUrl":"https://gurufathasingh.com","imageUrl":"/GD4to5 for Lotus.JPG","imageAlt":"Guru Dharam Singh"}'::jsonb),
  ('amrit_canada', 'quote_amrit_vela', '{"body":"Join us for the sacred early morning practice. Amrit Vela, the ''ambrosial hours'' before dawn, is the most powerful time for spiritual practice. Experience transformation through this 2.5-hour journey of consciousness."}'::jsonb),
  ('amrit_canada', 'quote_yoga', '{"body":"Kundalini Yoga is the yoga of awareness. It works on the total being — body, mind, and soul."}'::jsonb),
  ('amrit_canada', 'quote_gurdwara', '{"body":"The Gurdwara is the doorway to the Guru — come as you are, leave transformed."}'::jsonb),
  ('amrit_canada', 'visiting', '{"title":"Guru Ram Das Ashram","address":"348 Palmerston Blvd, Toronto, Ontario","body":"The yoga space is on the third floor, where daily 4:00 AM Aquarian Sadhana is held. A curtained area opens for Gurdwara service. Cover your head, remove your shoes at the door, and come as you are.","notes":"The ashram is a private residence as well as a practice space. Please treat it as someone''s home, because it is."}'::jsonb),
  ('amrit_canada', 'resources', '{"title":"Sadhana Resources","body":"Sacred texts and songs to support your practice."}'::jsonb),
  ('amrit_canada', 'footer', '{"body":"Crown yourself in the early hours of the morning 🙏","note":"Amrit Canada · Guru Ram Das Ashram, Toronto · part of the Elkdonis Arts Collective network."}'::jsonb)
ON CONFLICT (org_id, section_key) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW();

COMMIT;
