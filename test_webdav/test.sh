#!/bin/bash
set -a; source ../.env; set +a
URL="$NEXTCLOUD_PUBLIC_URL"
USER="$NEXTCLOUD_ADMIN_USER"
PASS="$NEXTCLOUD_ADMIN_PASSWORD"
DAV="$URL/remote.php/dav/files/$USER"

echo "1. PROPFIND root:"
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' -u "$USER:$PASS" -X PROPFIND -H 'Depth: 0' "$DAV/"

echo "2. MKCOL /Silex:"
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' -u "$USER:$PASS" -X MKCOL "$DAV/Silex/"

echo "3. MKCOL /Silex/_phase1_check:"
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' -u "$USER:$PASS" -X MKCOL "$DAV/Silex/_phase1_check/"

echo "4. PUT index.html:"
echo '<h1>phase1 check</h1>' | curl -sS -o /dev/null -w 'HTTP %{http_code}\n' -u "$USER:$PASS" -T - "$DAV/Silex/_phase1_check/index.html"

echo "5. GET index.html:"
curl -sS -u "$USER:$PASS" "$DAV/Silex/_phase1_check/index.html"
echo ""

echo "6. CLEANUP:"
curl -sS -o /dev/null -w 'DELETE file HTTP %{http_code}\n' -u "$USER:$PASS" -X DELETE "$DAV/Silex/_phase1_check/index.html"
curl -sS -o /dev/null -w 'DELETE folder HTTP %{http_code}\n' -u "$USER:$PASS" -X DELETE "$DAV/Silex/_phase1_check/"

echo "7. Confirm /Silex exists:"
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' -u "$USER:$PASS" -X PROPFIND -H 'Depth: 0' "$DAV/Silex/"
