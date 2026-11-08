-- Migration 254: Jason Ford's avatar becomes a square portrait.
-- 2026-11-07, at Justin's request ("Jason also has a broken avatar photo on
-- inner-group / elkdonis-arts.org"). His avatar was a 1440x2880 phone screenshot
-- of a video call; in round avatar frames it showed mostly ceiling and black bars
-- and loaded 2 MB at full size. The new file is the same photo cropped to his
-- face (800x800 JPEG), uploaded beside the original in his own Nextcloud folder.
-- The original file is kept. Only changes the row if the avatar is still the
-- screenshot, so a newer choice of his own is never overwritten.
UPDATE users
SET avatar_url = '/api/media/EAC_Network/users/rev-dr-sunjye-fnord-p-p-p-i-ulc-ac/Media/Images/jason-portrait-20261107.jpg'
WHERE email = 'fnordj@gmail.com'
  AND avatar_url = '/api/media/EAC_Network/users/rev-dr-sunjye-fnord-p-p-p-i-ulc-ac/Media/Images/screenshot-20261002-124731-79xkhs.png';
