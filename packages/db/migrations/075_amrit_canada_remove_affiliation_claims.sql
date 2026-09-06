-- ============================================================================
-- Migration 075: Remove unauthorised affiliation claims (Amrit Canada)
-- ============================================================================
-- Migrations 073/074 credited Guru Ram Das Ashram as the "presenter" of the
-- Amrit Vela and Gurdwara feeds, and put the ashram's name in the site header
-- and footer. That framing was invented during the rebuild — the original site
-- never claimed it.
--
-- It is not accurate and not authorised. Guru Dharam Singh lives and practises
-- at that address; he has no mandate from the ashram's board, and none from
-- Lotus Yoga, to present either as a sponsor of this site or to imply the
-- site and those organisations are one entity. Stating otherwise on a public
-- site is a misrepresentation of a real organisation, so it is removed rather
-- than softened.
--
-- What stays: factual, first-person descriptions of where practice happens,
-- in the site's own original words. What goes: any framing that reads as
-- institutional endorsement, sponsorship, or shared identity.
--
-- The street address is also removed from the published copy. The original
-- site never listed it; it entered during the rebuild. It is a private
-- residence, and publishing it is the owner's call to make deliberately —
-- re-add via /manage/pages → Visiting if wanted.
-- ============================================================================

BEGIN;

-- No third party "presents" these. Yoga keeps Guru Dharam Singh, which is
-- simply true — they are his own classes.
UPDATE org_feeds SET presenter = NULL
WHERE org_id = 'amrit_canada' AND slug IN ('amrit-vela', 'gurdwara');

-- The gurdwara description previously opened by naming the ashram as host.
-- Reworded to describe the gathering itself, in the same register.
UPDATE org_feeds SET
  tagline     = 'Sangat & communal meal',
  description = 'Gurdwara gatherings — a sacred space for prayer (Simran), scripture reading (Gurbani), and communal sharing. All are welcome regardless of background or tradition. Langar, the free communal meal, is served after the service, embodying the Sikh principle of equality: all sit together and eat together, regardless of status or faith.'
WHERE org_id = 'amrit_canada' AND slug = 'gurdwara';

UPDATE org_feeds SET
  description = 'A 4:00 AM, 2.5 hour journey of Jap Ji, Yoga and Kirtan. We follow a Sikh Dharma tradition rising 4 hours before sunrise in the hour known as the Amrit Vela. We meet once a month, either in a Church or on a Ski Hill in Etobicoke — check the listings below for which and when.'
WHERE org_id = 'amrit_canada' AND slug = 'amrit-vela';

-- Visiting: practical guidance only. No venue branding, no street address.
UPDATE org_site_sections SET
  content = '{"title":"Visiting","body":"Cover your head, remove your shoes at the door, and come as you are. If it is your first time, arrive a few minutes early and someone will show you where to sit.","notes":"Practice is held in a private home. Please treat it as someone''s home, because it is. Get in touch for the location before your first visit."}'::jsonb,
  updated_at = NOW()
WHERE org_id = 'amrit_canada' AND section_key = 'visiting';

-- Footer carried "Amrit Canada · Guru Ram Das Ashram, Toronto".
UPDATE org_site_sections SET
  content = '{"body":"Crown yourself in the early hours of the morning 🙏","note":"Amrit Canada · Toronto · part of the Elkdonis Arts Collective network."}'::jsonb,
  updated_at = NOW()
WHERE org_id = 'amrit_canada' AND section_key = 'footer';

COMMIT;
