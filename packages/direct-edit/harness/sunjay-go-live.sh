#!/bin/bash
# Para Theater go-live, 2026-11-04. Run by the developer: the permission system
# refuses a production rebuild and live database writes to agents.
#   bash packages/direct-edit/harness/sunjay-go-live.sh
#
# 1. Backs up the running build and the Ritual Theatre Lab join values.
# 2. Builds in the live container. The site can fail requests while it builds.
#    Retries only on the Google Fonts failure (docs/reference/ops.md); on any other
#    failure it restores the backup and stops.
# 3. Restarts the site.
# 4. Cleans the one thread that held the Zoom link in its place field.
# 5. Adds the unlinked test page /try (noindex). Delete it with:
#    sg docker -c "docker compose exec -T postgres psql -U postgres -d elkdonis_dev -c \"delete from site_config where org_id='sunjay' and key='puck:try'\""
# 6. Prints a short check.
set -u
cd /mnt/pool1/home/guru/eac || exit 1
STAMP=$(date +%Y%m%d-%H%M)
B=~/eac-backups/next; mkdir -p "$B" ~/eac-backups/direct-edit
FILE=sunjay-$STAMP.tgz
ID=u_Nc_PUtWLPnSRjxAjWu2
H=paratheater.arts-collective.com
psql_() { sg docker -c "docker compose exec -T postgres psql -U postgres -d elkdonis_dev -v ON_ERROR_STOP=1 $1"; }
code() { curl -sk -o /dev/null -w '%{http_code}' --resolve "$H:30022:127.0.0.1" "https://$H:30022$1"; }

echo "== Backup"
sg docker -c "docker exec eac-sunjay sh -c 'cd /app/apps/sunjay && tar -czf - --exclude=.next/cache .next'" > "$B/$FILE" || { echo "Backup failed. Nothing changed."; exit 1; }
tar -tzf "$B/$FILE" | grep -q BUILD_ID || { echo "Backup has no BUILD_ID. Nothing changed."; exit 1; }
(umask 077; psql_ "-At -c \"select id,is_online,location,meeting_url from threads where id='$ID'\"" > ~/eac-backups/direct-edit/ritual-theatre-lab-join-$STAMP.txt)
echo "saved $B/$FILE"

echo "== Build"
ok=0
for try in 1 2 3; do
  LOG="$B/sunjay-build-$STAMP-$try.log"
  if sg docker -c "docker exec eac-sunjay sh -c 'cd /app/apps/sunjay && NEXT_BUILD_CPUS=4 pnpm build'" > "$LOG" 2>&1; then ok=1; echo "built on try $try"; break; fi
  tail -5 "$LOG"
  grep -q 'exactly one entry' "$LOG" || break
  echo "Google Fonts failure, trying again"
done
if [ $ok != 1 ]; then
  echo "Build failed. Restoring the backup."
  sg docker -c "docker stop eac-sunjay"
  sg docker -c "docker run --rm --volumes-from eac-sunjay -v $B:/backup:ro --user 3003 --entrypoint sh eac-dev -c 'cd /app/apps/sunjay && rm -rf .next/* && tar -xzf /backup/$FILE'"
  sg docker -c "docker start eac-sunjay"
  echo "Restored. See $LOG"
  exit 1
fi

echo "== Restart"
sg docker -c "docker compose restart sunjay" 2>&1 | grep -v level=warning
for i in $(seq 1 30); do [ "$(code /)" = 200 ] && break; sleep 2; done

echo "== Zoom thread: place cleared, link kept for signed-in people and RSVP mail"
psql_ "-c \"update threads set location = null, meeting_url = substring(meeting_url from 'https?://[^[:space:]]+'), is_online = true where id = '$ID' and org_id = 'sunjay'\"" 2>&1 | grep -v level=warning

echo "== Test page /try"
python3 -c "
import json
d = json.dumps(json.load(open('packages/direct-edit/harness/sunjay-try-page.json')))
print(\"INSERT INTO site_config (org_id,key,value,updated_at) VALUES ('sunjay','puck:try',\$seed\$\" + d + \"\$seed\$::jsonb,now()) ON CONFLICT (org_id,key) DO NOTHING RETURNING key;\")
" | psql_ "-At" 2>&1 | grep -v level=warning

echo "== Check, signed out (expect 200, 200, 307, then 0 and 0)"
echo "/                    $(code /)"
echo "/try                 $(code /try)"
echo "/studio/try/canvas   $(code /studio/try/canvas)"
z=0; for p in / /community /gatherings /gatherings/ritual-theatre-lab /about/jason-ford '/forum/happening?range=all' /try; do
  n=$(curl -sk --resolve "$H:30022:127.0.0.1" "https://$H:30022$p" | grep -oE 'zoom\.us|pwd(=|%3D)' | wc -l); z=$((z+n)); done
echo "Zoom link on public pages: $z"
echo "Editor marks on /:         $(curl -sk --resolve "$H:30022:127.0.0.1" "https://$H:30022/" | grep -oE 'data-tree-|de-vpanel|data-de-ui|data-morph' | wc -l)"
echo "Done. Backup: $B/$FILE"
