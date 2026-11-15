-- 266: bookings.site_url (2026-11-15). The public base of the site a booking
-- was made on (origin plus any basePath), so mail sent later from a path that
-- has no request (confirmOrderPaid, an expiry sweep) links the booker to
-- <site_url>/bookings/<token> and the host to <site_url>/bookings on the same
-- site. NULL falls back to the network hub. Additive.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS site_url text;
