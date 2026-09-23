# Brief D — Sync the Nextcloud Forum app with each org's site forum

Sprint board: `SPRINT_2026-09-18_onboarding.md`. Read memories *NC Forum app*,
*The Grand Forum*, *threads is a shared namespace*, *Nextcloud Provisioning*, and
*Org General Chat* (the Talk guest pattern) first.

**Sequencing:** Brief B owns `packages/forum-ui/**` and `apps/*/src/app/forum/**`.
Build the sync core (services + migration + job) first, and touch forum-ui only once B
is logged done, or coordinate on the sprint board.

## The ask (user's decisions, 2026-09-18)
1. **Per org, one Nextcloud category.** It's named after the org (self-titled) and
   restricted to the org's Team, `organizations.nextcloud_circle_id` (all 17 orgs
   have one). Synced topics live there. Scope = Team → org.
2. **Only opted-in content syncs.** A topic syncs if (a) an **admin-level** person
   (`canModerate`: org owner/guide, or global admin) created it on the site with
   "Sync to Nextcloud" ticked, or (b) it was created on Nextcloud inside an org's
   category. *(b) is the PM's reading of "however a way". Confirm with the user if
   unsure.* Everything else on either side stays put.
3. **Replies to a synced topic sync both ways.** Replying requires **member** level
   (`isOrgMember`). Exception: when the org's category is **marked public**, anyone
   signed in may reply. Their reply goes to NC via the robot (see authorship below).
4. **Authorship on NC:** (b) **the person's own NC account** when they have a stored
   credential; otherwise (a) **the robot account**, with the post headed
   "Posted by <display name> via <site>". In a public category (a) also stands in for
   the guest-posting idea, so outsiders never need an NC account.
5. **On the site:** synced topics and replies get an **NC badge**. "See on Nextcloud"
   opens the NC thread **in a new tab** (`target="_blank" rel="noopener"`),
   `NEXTCLOUD_PUBLIC_URL` + the forum app's thread route (slug).
6. **Existing NC content (6 categories, 6 topics, 9 posts) all belongs to
   `inner_group`.** Move or copy it into the new `InnerGathering` NC category, bring it
   into innergathering's forum as synced topics, then delete the old categories.
   **Destructive: dump the `oc_forum_*` tables first, and get the user's go-ahead on
   the exact delete list before running it.** Threads 1–3 point at category 1, which no
   longer exists; they're included in the move.

## What exists (verified 2026-09-18)
- NC Forum app 1.4.1 has a full OCS API: `/ocs/v2.php/apps/forum/api/{categories,threads,posts,teams}`,
  plus `/api/categories/{id}/permissions` with `target_type` `role|team`,
  and `PUT /api/threads/{id}/{move,lock,pin}`. Send `OCS-APIRequest: true`.
- **It dispatches no events.** Inbound has to poll. Prefer the API as the robot, and
  give the robot the forum Admin role (`occ forum:set-role` or `SetRole` command).
  Read-only SQL on `oc_forum_*` is the fallback only.
- NC posts are **BBCode**; the site stores Tiptap HTML. Write one converter pair in
  services and run site→NC output through `sanitizeRichText` on the way back in
  (memory: *Test through the boundary*).
- Robot creds: `NEXTCLOUD_ADMIN_USER/PASSWORD` (`packages/nextcloud/src/client.ts`).
  Per-user creds: `users.nextcloud_user_id` (10 of 51) and `users.nextcloud_app_password`
  (**1 of 51**). Expect the robot path to be the common case for now.
- Site write path: `packages/services/src/forum-write.ts` (`createTopic`, `postReply`,
  `canModerate`, `isOrgMember`). Replies live in `replies`; topics in `threads`.

## Build
- **Migration** (next free number, currently 144; check `ls packages/db/migrations`):
  - `org_nc_forum (org_id PK, nc_category_id, is_public bool)`
  - `nc_forum_links (local_kind 'thread'|'reply', local_id, nc_kind, nc_id, nc_updated_at, via 'self'|'robot')`,
    with UNIQUE on both sides so nothing is copied twice or bounces back.
- **Provision:** an idempotent script creates each org's self-titled category, sets its
  Team permission (view/post/reply for the Team, moderate for the robot), and writes
  `org_nc_forum`. Run it for `inner_group` first; other orgs only when the user says so.
- **Outbound** (in services, called from `createTopic`/`postReply`/edit/delete/lock/pin
  when the thread is linked): it runs after the local write commits. If NC fails,
  the local post stands, a retry is queued, and the author sees it's unsynced. It
  never loses the post.
- **Inbound job:** poll each linked category (a few minutes apart, plus
  on-demand when `/forum` is opened with a short cooldown). Upsert threads/replies by
  link. For NC authors, map `author_id` → `users.nextcloud_user_id`; if nobody matches,
  show the NC display name without creating a `users` row. Handle edits and deletes
  (`deleted_at`).
- **Loop guard:** anything the sync itself wrote is identified by its link row and
  skipped when polled.
- **Visibility:** synced topics are `ORGANIZATION` unless the org's category is public,
  and then `PUBLIC`. Keep `OFF_FEED_KINDS` rules; the Brief B leak probe must
  still pass.
- **UI:** a "Sync to Nextcloud" checkbox on New topic, shown only to `canModerate`;
  an NC badge; and a "See on Nextcloud" link that opens a new tab.

## Watch out
- Don't add a `users` row per NC author (memory: *Identity & Pseudonyms*).
- NC timestamps are **seconds** (int), site is timestamptz. Compare carefully
  (memory: µs vs ms trap).
- Never `JSON.stringify(x)::jsonb`; use `db.json()`.
- Hosts are prod builds: back up `.next` before rebuilding.

## Done when
- inner_group: old NC content lives in the InnerGathering category and shows in
  innergathering `/forum` with badges; the old categories are deleted after the user
  approves the list.
- Round trip, verified by rendering (not status codes): an admin creates a synced topic on
  the site → it appears on NC. A member replies on NC → it appears on the site. A member
  replies on the site with no NC creds → it appears on NC as the robot with "Posted by …".
  A non-member can't reply unless the category is public.
- A topic *without* sync stays off NC; an NC post in a non-org category stays off the site.
- Test rows cleaned up; log line on the sprint board.
