# Apply-day checklist: content migrations (ELKTOURS_MOBILE_2026-11-15)

Five drafts in `migrations-draft/` (unnumbered, not applied). Number them when applying: claim the next free number by creating the file first and check `ls packages/db/migrations` just before (highest seen on disk on 2026-11-16 was 267). **Do not run `db:migrate` for these.** It applies every pending file in order, and other pending migrations (263 and later, including the booking ones) are not ours to apply on this day. Apply each file ALONE: after numbering and copying it into `packages/db/migrations/`, run the file and insert its tracker row in one transaction, for example (file `NNN_name.sql`, run inside the postgres container against the right database):

```
f=packages/db/migrations/NNN_name.sql
( echo "begin;"; cat "$f";   echo "insert into app_schema_migrations (filename, checksum) values ('NNN_name.sql', '$(sha256sum "$f" | cut -d' ' -f1)');";   echo "commit;" ) | sudo -n docker exec -i eac-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1
```

The tracker is `app_schema_migrations(filename, checksum)` with a SHA-256 of the file text (see `packages/db/scripts/migrate.mjs`). Check `select filename from app_schema_migrations order by filename desc limit 5;` before and after. Never edit an applied file.

Scratch rehearsal (2026-11-16, database `scratch` on `elk-scratch-pg`, schema-only copy): all five drafts applied cleanly in the order below, one transaction each, and one happy pass worked end to end (favourite and feature a place; save availability; artist suggestion and accept; a topic with a link and an image attachment plus a reply attachment through the real `createTopic`/`postReply`; link an experience to a stop, one invitation, accept, read back as an accepted date). The tracker rows were not inserted on scratch.

Everything below is verified against the source on 2026-11-15 unless marked assumed. "Flips" means the code already checks for the table or columns at run time, so it starts working with no edit.

Suggested order (no dependencies between them, but this puts the least risky first): 1 place_favourites, 2 artist_availability, 3 visitor_suggestions kinds, 4 forum_attachments, 5 service_commissions.

## 1. place_favourites.sql

Waiting code that flips on its own
- `apps/elktours/src/lib/places-public.ts`: `favouritesFor()` reads the table inside a try/catch. After the migration `favourite`, `featuredBy`, `favouriteCount`, `listFavouritePlaces()` return real values.
- `apps/elktours/src/lib/place-favourite-actions.ts`: `toggleFavouritePlaceAction` and `setFeaturedPlaceAction` check `to_regclass('public.place_favourites')` and return "available after migration" until then.

Still to build (not blocked by the migration, but nothing calls these yet)
- The star on each catalogue row for guides (screen 38 and the guide Places page) calling `toggleFavouritePlaceAction`.
- The "Feature on Discover" switch on the place edit page calling `setFeaturedPlaceAction`.
- The Discover shelf block (`m-places-shelf`) reading `listFavouritePlaces()`.

Check after applying
- `select to_regclass('place_favourites');` is not null.
- As a guide, star a place: row appears with `featured = true`, and `listPlacesPublic({ favouritesOnly: true })` returns it.

## 2. artist_availability.sql (two tables: artist_availability, artist_availability_notice)

Flips on its own
- `lib/artist-wizard.ts`: `getAvailability()` returns `available: true` once `artist_availability` exists (and reads notice days once `artist_availability_notice` exists).
- `lib/artist-wizard-actions.ts`: `saveAvailabilityAction` needs BOTH tables, else "available after migration".
- `lib/collaborate.ts`: `artistFreeAt()` is false for everyone until an artist has saved cells. So after the migration the auto-invites in `linkExperienceToStopAction` are still zero until artists tick their grid. This is expected, not a bug.
- `getCollaborate()` chips switch between "free" and "not_free" from the same data.

Still to build
- The 7 x 3 grid UI on the Board (artist) and wizard step III calling `saveAvailabilityAction(cells, noticeDays)` and reading `getAvailability()`.

Check after applying
- Save a grid as an artist (member with an `experience_people` artist row); `getAvailability()` returns the cells; `artistFreeAt(userId, '<a Saturday 10:00 Paris>')` is true for a ticked Saturday morning.

## 3. visitor_suggestions_artist_place_kinds.sql

Flips on its own
- `lib/suggest-lead-actions.ts` (`submitSuggestionAction`): checks the table, the `url` and `contact_email` columns, and that `visitor_suggestions_kind_check` mentions `place_lead`. All three are true after the migration.
- `lib/suggestion-actions.ts`: `listLeadSuggestionsAction` checks the `url` and `contact_email` columns, so it starts returning rows. `acceptSuggestionAction` already handles the `artist` and `place_lead` kinds (marks handled). `rejectSuggestionAction` is kind-agnostic.

Needs an edit (not done: existing UI files outside the lanes so far)
- `apps/elktours/src/components/manage/suggestions-queue.tsx` and `apps/elktours/src/app/manage/suggestions/page.tsx`: add a section "Artist and place leads" that calls `listLeadSuggestionsAction()` (type `LeadSuggestion` from `lib/suggestion-leads.ts`) and shows name, web address (link), reason, contact email, suggester, with Accept (marks handled) and Reject buttons calling the two existing actions. `listSuggestionsAction` deliberately returns only `spot` and `route` so the current queue is unchanged.
- No edit to `VisitorSuggestion.kind` in `lib/catalogue-types.ts` is needed: leads use `LeadSuggestion`.

Check after applying
- `\d visitor_suggestions` shows `url`, `contact_email` and the 4-kind CHECK; `visitor_suggestions_spot_point` is unchanged.
- Submit a lead; it is not in `listSuggestionsAction()`, it is in `listLeadSuggestionsAction()`; accept marks it `accepted`.

## 4. forum_attachments.sql

Flips on its own
- `packages/services/src/forum-write.ts`: `saveForumAttachments` (used by `createTopic` and `postReply`) and `listForumAttachments` check `to_regclass('public.forum_attachments')`; before that they write nothing and return `[]`.

Needs an edit or build (this is the opt-in part)
- `apps/elktours/src/lib/forum.ts`: add `attachments: true` to `composeOptions` (now `{ kinds, audiences, link }` plus `attachments`). Without it, forum-ui ignores posted attachments and renders none. Other hosts (sunjay etc.) stay unchanged.
- The compose and reply forms need an uploader (client): POST each file to `/api/upload/forum` (audience matches the topic), then add one hidden field per file named `attachment` with a JSON value `{"kind":"image"|"video","url":"<returned url>","meta":{"width":..,"height":..}}`. A link is `{"kind":"link","url":"https://..."}` (max one; the card is unfurled on the server). forum-ui's action reads these only for hosts with `composeOptions.attachments`.
- CSS for `.gf-attachments`, `.gf-linkcard`, `.gf-media-grid` (rendered by `AttachmentList` in `packages/forum-ui/src/parts.tsx`) is not written. It belongs in the mobile forum CSS scope.
- The Feed post preview (screen 16/39) could also read `listForumAttachments(threadId)` for its own post. Not wired.

Check after applying
- Post a reply with a photo through the form: `select * from forum_attachments` has a row with `reply_id` set; the thread page shows the image. A topic-level attachment has `reply_id` null and appears under the opening post.

## 5. service_commissions_experience_invites.sql

Flips on its own
- `lib/collaborate.ts`: `invitationColumnsExist()` checks `stop_id`, `arrival_at` and that `service_thread_id` is nullable. After the migration `listInvitations`, `getCollaborate` (invitation states), `listAcceptedDates` and the invitation inserts work.
- `lib/collaborate-actions.ts`: `linkExperienceToStopAction`, `inviteForDepartureAction` return "available after migration" until then; `respondInvitationAction` has no guard (it only updates an existing row).
- `lib/commissions.ts` already uses a LEFT JOIN to `threads s` (done 2026-11-15, safe before the migration, no change to today's rows).

Needs an edit
- `apps/elktours/src/lib/catalogue-types.ts`: `ServiceCommission.serviceThreadId: string` → `string | null` (and read `serviceTitle` as possibly empty). `lib/commissions.ts` `mapCommission` casts `r.service_thread_id as string`; change the cast to `(… as string | null) ?? null` in the same edit. No other callers of `listCommissions`, `proposeCommission` or `respondCommission` exist outside `lib/commissions.ts` and `lib/collaborate-actions.ts` (grep). `proposeCommission` still requires a public `service` thread for the older path; leave it.
- Optional hardening: `lib/collaborate-actions.ts` could use the unique index `service_commissions_one_live_invite` with `ON CONFLICT` instead of the `NOT EXISTS` check. Both are safe.

Still to build
- Collaborate screen (36): calls `getCollaborate(tourId)`, `linkExperienceToStopAction`, `inviteForDepartureAction`.
- Board (30) artist Invitations card: `listInvitations({ artistUserId })`, `respondInvitationAction(id, "accept"|"decline")`; office "Waiting on artists": `listInvitations({})` filtered to `proposed`.
- Experience page "dates": `listAcceptedDates(experienceId)`; tour page stop pill: `publicExperiencesAtStops(stopIds)`.

Check after applying
- `\d service_commissions`: `service_thread_id` nullable, `stop_id`, `arrival_at`, index `service_commissions_one_live_invite`.
- Link a published experience (with an artist who has availability) to a stop on a tour that has upcoming departures: one `proposed` row per free departure with `arrival_at` = start + offset; link again: no duplicates; accept as the artist: `listAcceptedDates` returns it.

## Not migrations, but also waiting (data and settings)

- Feed section: `INSERT INTO org_feeds (org_id, slug, name, tagline, is_public, sort_order) VALUES ('elktours','feed','Feed','From the guides',TRUE,3) ON CONFLICT (org_id, slug) DO NOTHING;` Feed reads and writes work without it; the forum just shows no "Feed" section.
- `elktours:settings` row is optional: `getSiteSettings()` returns defaults (`holdGuidePosts: true`) when absent.
- Place tags: 0 of 85 places have tags, so `tagOrder` is empty until someone tags places.
- Membership: there are no `guide` or `member` rows in elktours today (2 owners, 1 viewer). The artist wizard needs a `member` row per artist (`inviteArtistAction` makes one for an existing account).
