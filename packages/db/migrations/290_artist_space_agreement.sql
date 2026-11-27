-- 290: the artist agreement, as a draft (2026-11-24).
--
-- One org_agreements row under `oad` (the org whose membership marks an artist
-- of the collective, docs/reference/identity-and-tenancy.md), key
-- `artist-space`. It is what a person accepts when they choose "Join the
-- collective as an artist" on the marketplace Sell page (art-auction
-- /studio/apply), which then runs gainSpace().
--
-- Inserted as `draft`: acceptAgreement refuses a draft, so nobody can accept
-- until the text is published from the hub's agreements console
-- (publishAgreement). The wording below is the developer's four points; read
-- it before publishing. revenue_share_percent is 0: this agreement authorises
-- no org cut (resolveOrgShare), and store-level commission is a separate fact.

INSERT INTO org_agreements (org_id, key, version, title, summary, body_html, revenue_share_percent, terms, status, requires_acceptance)
SELECT 'oad', 'artist-space', 1,
  'Artist of the collective',
  'Joining gives you cloud space, a page on ArtDirect and its classifieds for your art and paid work, and the use of the collective''s Stripe account to be paid, extended on trust.',
  '<p>By joining the collective as an artist you agree to the following.</p>'
  || '<ul>'
  || '<li><strong>Cloud space.</strong> The collective gives you a storage folder on its cloud (Nextcloud) for your images, documents and recordings. It is yours to use for your work; what you store there is published only where you choose to publish it.</li>'
  || '<li><strong>A page for your art and paid work.</strong> You are listed on ArtDirect, the collective''s artist directory, with a page and a place in its classifieds where you can show your art and offer paid work. You can edit the page or hide it at any time.</li>'
  || '<li><strong>The collective''s Stripe account.</strong> Until you connect a Stripe account of your own, the collective takes card payments for your sales and services through its Stripe account, and holds your share for you. The collective extends this on trust, and you agree to use it only for your own work and to give an accurate payout address.</li>'
  || '<li><strong>Your work stays yours.</strong> You remain responsible for what you publish and sell, and for the rights to it.</li>'
  || '<li><strong>Leaving.</strong> You can withdraw at any time from your account; withdrawing ends the use of the collective''s Stripe account for new sales.</li>'
  || '</ul>'
  || '<p>These terms sit beside the network''s Terms and Acceptable Use.</p>',
  0, '{}'::jsonb, 'draft', true
WHERE EXISTS (SELECT 1 FROM organizations WHERE id = 'oad')
ON CONFLICT (org_id, key, version) DO NOTHING;
