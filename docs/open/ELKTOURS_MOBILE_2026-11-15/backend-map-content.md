# Elktours mobile redesign: backend map, content side (2026-11-15)

Read-only survey for Jay (platform lead). Scope: everything except booking, departures and payment. Nothing was edited, migrated, rebuilt or committed. The only write is this file.

Labels: **verified** (read in the repo or queried on eris on 2026-11-15, with file:line or query) or **assumed**. Paths are relative to `~/eac`. "App" = `apps/elktours/src`.

Design pack read: `pack/README.md`, `data-and-state.md`, `screens-guest.md`, `screens-board.md`. I did not open the per-screen HTML files. The two screen docs carry the behaviour, so every contract below is inferred from them (assumed where the HTML might say more).

## 0. Headlines

1. **The design pack understates what is already in the repo.** Several items marked "new" already exist:
   - Place `tags` is a real column (`places.tags text[]`, migration 235). It is empty on all 85 rows.
   - Forum sub-sections exist (`org_feeds.parent_slug`).
   - A closed section by role exists (`org_feeds.min_role`, `post_role`).
   - Thread audience already has three-plus levels (`PUBLIC` / `ORGANIZATION` / `INVITE_ONLY` + `min_role`).
   - A review queue exists (`threads.status='pending'`, `reviewed_by`, `reviewed_at`, `reviewThread()` in `packages/services/src/moderation.ts`).
   - A visitor suggestions table, an experience enquiry action and a reviews table exist.
2. **A server-side link unfurl exists**, and it is SSRF-hardened: `packages/lms/src/unfurl.ts`, re-exported at `packages/lms/src/index.ts:16`. elktours does not depend on `@elkdonis/lms` today. Recommended home: move it to `@elkdonis/utils`. Size S, no migration.
3. **The biggest real gaps**:
   - Forum attachments. `replies` has no metadata column, `createTopic` and `postReply` take text only, and `/api/upload` is editor-only (owner/guide).
   - "Private + chosen people" topics. There is no per-person audience table.
   - The "artist" role. It is not a membership role, and the roles are `owner|guide|member|viewer`.
   - Artist availability. There is no table and no column.
   - Guide-post review. `statusForNewThread` treats guides as moderators, so a guide post publishes outright.
   - Commissions per departure. `service_commissions.service_thread_id` is NOT NULL and must be a public `service` thread, and nothing calls `proposeCommission` (verified by grep).
4. **Roles today (verified, query)**: elktours has 3 membership rows: 2 `owner` (jg, danamccool) and 1 `viewer`. Signup and follow create `viewer` rows (`app/api/auth/signup/route.ts:21`, `app/api/center/follow/route.ts`). There are no `guide` or `member` rows yet.

## 1. Roles: guest / guide / artist / office

**What exists (verified).**
- `user_organizations.role` is constrained to `owner|guide|member|viewer` (`\d user_organizations`).
- `lib/auth.ts` has `EDITOR_ROLES = [owner, guide]`. `canEdit` = owner or guide. `isMember` = owner, guide or member. `isAffiliate` = any row.
- Forum viewer roles come from `getViewerRoles` (`packages/services/src/forum.ts:995`) as an `org_id → role` map.
- The artist link today is `experience_people(thread_id, user_id, role artist|host)` (migration 236). 2 rows today: 1 host, 1 artist.
- `org_profiles` is the public roster (32 rows, all public): `role_title`, `tags`, `bio_override`, `sections`, `portfolio`.
- Guides on screen come from `getGuides()` (`lib/data.ts:636`) over `org_profiles` where the person is a user.

**Proposed mapping (assumed, needs Justin's yes).**

| Design role | Stored as | Note |
|---|---|---|
| Guest | `viewer` (or no row) | This is today's signup default. |
| Guide | `guide` | **Conflict:** `guide` = `canEdit`. A guide can already run /manage, /api/upload and moderate. That fits the Board (schedule, places, tour media) but means "guide" is a trusted editor, not a light role. |
| Artist | `member` plus an `experience_people` artist row and/or tag `artist` on their `org_profiles` | There is no artist membership role. `member` also unlocks hub, attendee lists, private media and chat (`auth.ts` comment on `isMember`). |
| Office | `owner` | Dana and jg today. |

- Role ring colour (brass guide, verdigris artist, grey guest) is derived on read from the author's role plus `experience_people` or the tag. It is not stored.
- The closed forum section "Guides & artists" works as `org_feeds.min_role='member'` (verified: `canViewFeed` in `packages/services/src/org-feeds.ts:61` uses a rank). Guests are `viewer` and below `member`, so they never see it.
- Gap: if a guest is ever promoted to `member`, they see the closed section. Cosmetic, but note it.

**Open question:** is `member` acceptable for artists, or do we add a real `artist` org role (CHECK constraint change on a shared table, which affects every org)? Recommendation: `member` plus profile tag, no shared change.

## 2. Gap table

Sizes: S = under a day, M = 1-3 days, L = more. "Mig" = needs a migration. All new org-owned tables should join the `eac_tenant` RLS loop (pattern in 233/235/239).

| # | Gap | Screens | Proposed home | Size | Mig |
|---|---|---|---|---|---|
| G1 | Tour hero `lead` (guide's chosen opening kind) | 03, 37 | Top-level `threads.metadata.heroLead` (`film|map3d|photos`), written by a `patchTourAction`-style merge. The `TourFilmBlock` hero becomes a switcher. No new table. | S | No |
| G2 | Hero pills switch between film, 3D route and photos (the block today is film, else route preview, else cover) | 03 | App-local `blocks/tour/blocks.tsx`, data already in `publicTourAssets()` | M | No |
| G3 | Place tags | 12, 13, 38 | Column exists. Gap is UI plus backfill: `listPlaceTags()` exists (`lib/places.ts:187`), `savePlaceAction` takes `tags`. Add tag-count ordering to the public read. | S | No |
| G4 | Place favourite / featured, "by guide" | 01, 09, 12, 38 | New table `place_favourites(org_id, place_id, user_id, featured bool, created_at)`, PK (place_id, user_id). Not a column: favourites are per guide. | S | Yes |
| G5 | Public place read exposing tags, favourites and `suggested_by` | 12, 13 | Extend `listPublicPlaces/getPublicPlace` (`lib/places.ts:303,323`) | S | No |
| G6 | Suggest an artist or place (name, URL, reason, optional email) | 14 | `visitor_suggestions` exists, but `kind` CHECK is `spot|route` and `spot` requires lat/lng. Add kinds `artist` and `place_lead` plus nullable email/url (or put them in `payload` jsonb). Reuse `/manage/suggestions` queue and `suggestionAllowanceAction` rate limit. | S-M | Yes (CHECK relax) |
| G7 | Suggest by a signed-out or unsigned guest | 14 | Today `canSuggest` needs an affiliate row (`suggestion-actions.ts:22`). The design allows an email only. Decide, see Q4. | S | No |
| G8 | Link previews (web view cards, feed link posts) | 15-17, 18-21 | `unfurl()` and `assertPublicUrl()` from `packages/lms/src/unfurl.ts`. Move to `@elkdonis/utils`. Add route `GET /api/link-preview?url=`. Cache in the post's metadata at write time. | S | No |
| G9 | In-app web view: many sites refuse iframes | 17 | Not solvable server-side with an iframe. Fallback is the unfurl card plus "Open in browser". Do not proxy pages. | S | No |
| G10 | Guide feed posts with review, 3 homes, shared comments | 15, 16, 39, 09, 01 | Thread `kind='post'` in a new `org_feeds` row `feed`. `status='pending'` then `published` or `archived` via `reviewThread()`. Link post data in `metadata.link`. Comments = `replies`. All three views read the same thread. | M | No (data rows only) |
| G11 | Guide posts held for office; guides cannot approve their own | 39, 30 | `statusForNewThread` (`moderation.ts:~85`) returns `published` for owner or guide. Needs a "hold guides too" rule and an owner-only decision. Cleanest: add optional `holdRoles` to `statusForNewThread`/`reviewThread` in services (shared edit), or an app-local wrapper. | S-M | No |
| G12 | Forum sub-sections | 18, 19, 21 | `org_feeds.parent_slug` exists. Gap: parent counts include children, and the forum-ui reads. Data only for the section rows. | S | No |
| G13 | Three visibility levels, changeable by the author | 20, 21 | Public = `PUBLIC`; Members = `ORGANIZATION` (any signed-in affiliate); Private = `INVITE_ONLY`, `min_role` null (author only). `audienceToStorage` exists (`packages/services/src/thread-audience.ts:37`). Gap: the change-later action. `createTopic` always writes `PUBLIC`. | M | No |
| G14 | Private plus added people | 21 | New table `thread_audience_users(thread_id, user_id, added_by)` and extend the read predicate in `restrictedReadSql`/forum read SQL (shared, read in many queries). Useful to every site's forum. | L | Yes |
| G15 | Closed section by role | 18 | `org_feeds.min_role='member'` (see section 1). Data only. | S | No |
| G16 | Attachments on topics and replies (one link, N photos or videos) | 20, 21 | New table `forum_attachments(id, org_id, thread_id|reply_id, kind link|image|video, url, meta, position, created_by)`. Shared: any forum can use it. `replies` has no jsonb column (verified: `replies` columns). | M | Yes |
| G17 | Upload by non-editors (guests, artists, guides posting photos) | 20, 21, 39 | `/api/upload` is `getApiEditor()` only (`app/api/upload/route.ts:61`). Add a member-or-follower route (`/api/upload/forum`) with size/type caps, EXIF stripping (`stripImageMetadata` exists in `lib/assets.ts:455`), and `visibility` set by the topic audience (Private audience files go under `Private/`). | M | No |
| G18 | Topic kinds `post`, `idea`, `event` | 21 | `createTopic` forces `kind: 'post'`. Add a `kind` param (allow-list of 3). Glyphs already match (`cms-ui/surface/kinds.ts`: post ◉, idea ✦, event ◆). | S | No |
| G19 | Role rings on posts | 20 | Derived (section 1). Add `roleRing` to the reply/topic row DTO. | S | No |
| G20 | Reply-to-reply, pinned topics, pen names | 20 | Not designed. The model already has `parent_reply_id`, `threads.pinned` and `getIdentityIds` pen names. No work unless asked. | n/a | No |
| G21 | Unread and "Mark all read" | 18 | Exists (`thread_reads`, `markAllRead`, `forumSnapshot` unread). Zero gap. | n/a | No |
| G22 | Artist availability grid (7 x 3) plus notice (1d, 2d, 1w) | 35, 30, 36 | New table `artist_availability(org_id, user_id, weekday smallint, part morning|afternoon|evening)` plus notice days. Keep it out of shared `org_profiles`. | S | Yes |
| G23 | Artist self-service experience (wizard): create, submit for review | 35 | `saveExperienceAction` is `requireOrgEditor()` only (`lib/experience-actions.ts:~57`). `setExperienceStatusAction` takes `draft|published|archived`, with no `pending`. Add an artist path (author = artist, `isExperiencePerson` exists) and `pending` plus owner decision (Publish / Members only / Send back) via the same review plumbing. | M | No |
| G24 | Experience offer fields (fee, per run or per guest, standalone price, notice, visibility wanted) | 35, 36 | `threads.price/currency` exist. Per-run fee, unit and notice go in `metadata.offer` (jsonb, top-level key). | S | No |
| G25 | Experience visibility "Members only" | 06-08, 30 | `ExperienceVisibility = PUBLIC|ORGANIZATION` already. Map "Members only" to `ORGANIZATION` (any affiliate, followers included) or `INVITE_ONLY+member`. Decide, see Q6. | S | No |
| G26 | Collaborate: invitations per departure | 36, 30 | `service_commissions` has `experience_thread_id`, `tour_thread_id`, `departure_id`, `unit`, `quantity`, `price_cents`, `status proposed|accepted|declined|cancelled|completed`. `proposeCommission` requires a public `service` thread, so it cannot be used for an experience with no service listing. Make `service_thread_id` nullable (and carry fee in the commission), add unique (experience, departure), add `stop_id`. Needs UI plus actions. | M | Yes |
| G27 | "Free" test and auto-invite on link | 36 | Pure function of stop arrival time (tour start plus duration x index / stops, rounded to 5 min) and G22. App-local helper plus an action `linkExperienceToStop(stopId, experienceId)` that inserts commissions. | M | No |
| G28 | Guide profile: favourites, "Shared by" posts, tours | 09 | `getGuideBySlug`, `getThreadsByAuthor` exist (`lib/data.ts:662,683`). Needs G4 and G10 reads filtered to `kind='post' AND section='feed'`. | S | No |
| G29 | Local Artists directory (guides plus artists, filters) | 10, 11 | Guides: `getGuides()`. Artists: join `experience_people(role='artist')` to `org_profiles`. App-local read `listPeople({kind})`. | S | No |
| G30 | Discover composition (featured tour, favourite places, experiences coming, guides, newest post, forum unread count) | 01 | App-local aggregator over existing reads plus `forumSnapshot` | S | No |
| G31 | City sheet (cities, "more coming") | 22 | Copy, not data. Put in `org_site_sections` or `site_config` so the editor can change it. | S | No |
| G32 | Direct-edit and Puck for new copy (About, intros, city sheet) | 11, 01, 02, 22 | See section 12. | S-M | No |

## 3. Discover (01) and Tours list (02)

**Exists (verified).**
- Tours: `listTours()`, `nextDepartures()` (`lib/tours.ts:220,281`). 8 published, 3 draft, 1 archived.
- Films, posters, stills and map3d rows in `tour_assets` (`query`: film hero 15 visible plus 1 hidden, poster 8, still 96, streetview 96, map3d 11).
- Places via `listPublicPlaces()`, experiences via `listExperiences()`, guides via `getGuides()`, forum unread via `forumSnapshot()` (`lib/forum.ts:getForumSnapshot`).
- The page copy mechanism `org_site_sections` (read by `getSiteSections`, `lib/data.ts:707`). Table is empty for elktours (query).

**Gap.** The mobile "This week's walk" card needs "next departure within the week" selection (app-local, departures are the other agent's area, so I only consume `nextDepartures`). Intro lines are placeholders awaiting Justin's wording.

**Contract (assumed signatures, app-local, server components or server actions).**
```ts
getDiscover(): Promise<{
  featured: { tour: Tour; next: TourDeparture | null; seatsLeft: number | null } | null;
  favouritePlaces: PublicPlace[];          // G4 + G5, featured = true, limit 8
  experiencesComing: Experience[];         // published, public, limit 3
  guides: Array<Guide & { leading: Array<{ tour: Tour; next: TourDeparture | null }> }>;
  feed: { count: number; newest: FeedPost | null };   // G10
  placesCount: number;
  forum: { unread: number } | null;        // signed in only
  copy: SiteSections;                      // intro, issue line
}>
listToursForList(opts: { q?: string; type?: TourType }): Promise<TourCard[]>   // wraps listTours + nextDepartures
```

**Editable by the house editor:** intro line, issue label ("Autumn . No. VII"), section headings, featured-tour override. Store in `org_site_sections` (existing table, see section 12).

## 4. Tour hero media (03, 37)

**Exists (verified).**
- `tour_assets` registry with a per-row `visible` switch (migration 233). Kinds `film|poster|image|still|map3d|streetview|document`.
- `publicTourAssets(threadId)` (`lib/assets.ts:138`) returns `{ film, poster, streetview, stills, stopImages, images }`.
- `setAssetVisibleAction`, `upsertAssetAction` (`lib/asset-actions.ts`) and `manage/asset-panel.tsx` are the editor today.
- Fly-over requests: `render-request-actions.ts` and `lib/render-requests.ts`.
- The current hero rule in `TourFilmBlock` (`blocks/tour/blocks.tsx:103`): film, else `RoutePreviewLauncher` if stops are placed, else cover. It has no switcher and no `lead`.
- The 3D map mounts on press via `RoutePreviewLauncher` (verified: `blocks.tsx` uses it). That matches the design rule.

**Gap.** `lead` is new (G1). Photos need a "cover and gallery" read: `images` is in `PublicTourAssets`, but "cover on/off" and "gallery on/off" are two toggles in the design. Today cover = `metadata.coverImageUrl`/`tour.coverImageUrl` and gallery = visible `image` assets. Model "cover on/off" as `metadata.heroCover boolean` or as a visible `image` row with `role='cover'` (assumed; decide with the media UI owner).

**Recommended home.** `metadata.heroLead` plus the asset rows. No migration.

**Contract.**
```ts
publicTourHero(threadId): Promise<{
  kinds: Array<"film" | "map3d" | "photos">;   // available, in fallback order film, map3d, photos
  lead: "film" | "map3d" | "photos";           // heroLead if available else kinds[0]
  film?: PublicTourAssets["film"]; stops?: ...; photos?: PublicTourAssets["images"]; cover?: string | null;
}>
setTourHeroLeadAction(threadId, lead: "film"|"map3d"|"photos"|null): Promise<Result>   // editor, merges metadata.heroLead
setAssetVisibleAction(id, visible)         // exists
requestFlyoverAction(threadId, style)      // exists in render-request-actions.ts
```
Rule to keep: a delivered film arrives with `visible=false` (matches 233 design and the screen note).

## 5. Experiences (06, 07), artist profile (08)

**Exists (verified).**
- `threads.kind='experience'`, status draft, pending, published, archived (the DB CHECK allows `pending`). 2 rows: 1 published, 1 draft (query).
- `experience_people` artist/host. `lib/experiences.ts` has `listExperiences`, `getExperienceBySlug`, `getExperienceById`, `listExperienceTours`, `artistProfileUrl` (ArtDirect link).
- Pages at `/experiences`, `/experiences/[slug]`, popup API at `/api/surfaces/experience`.
- Standalone enquiry: `sendExperienceInquiryAction` (emails owners and hosts, `lib/experience-actions.ts:~237`). This is the "Ask about a private visit" action, ready.
- `experience` is in `OFF_FEED_KINDS` (`packages/services/src/thread-kinds.ts:41`), so it does not leak into the forum or feeds.

**Gap.** "Upcoming dates the artist has accepted" needs commissions joined to departures (G26). The artist profile "Work grid" (3 columns) and "Find {name} on" are reads over ArtDirect (portfolio link) and `listExperienceTours`. Artist status ("Presenting on tours", "By request", "Coming soon") is derived: has an accepted commission on a future departure, else has a public standalone offer, else none.

**Contract.**
```ts
listExperiences({ publishedOnly: true }): Promise<Experience[]>          // exists
getExperienceBySlug(slug): Promise<Experience | null>                    // exists
listExperienceTours(id, { publishedOnly }): Promise<ExperienceTourUse[]> // exists
listAcceptedDates(experienceId): Promise<Array<{ departureId; startsAt; tourSlug; tourTitle; stopPosition }>>  // NEW, G26
getArtist(slug): Promise<{ person: Guide; experiences: Experience[]; tours: TourCard[]; works: ArtDirectLink[]; status: ArtistStatus }>   // NEW, app-local
sendExperienceInquiryAction(input)                                       // exists
```

## 6. Guide profile (09), Local Artists (10), About (11)

**Exists (verified).** `getGuides`, `getGuideBySlug`, `getThreadsByAuthor`, `getGuideStore` (`lib/data.ts:636-690`). `/about` and `/about/[slug]` pages. The About page already renders sections with "Dana to write" placeholders visible only to editors (`app/about/page.tsx`).

**Gap.**
- Guide "favourite places" (G4) and "Shared by {name}" (G10, G28).
- Local Artists needs a combined people read (G29) with a Guides/Artists filter.
- About copy. Sections are placeholders waiting for Justin.

**Recommended home.** App-local reads in `lib/people.ts`. Copy in `org_site_sections`.

```ts
listPeople(filter: "everyone" | "guides" | "artists"): Promise<Array<{ kind: "guide"|"artist"; slug; name; craft; area; status; avatarUrl }>>
getGuideProfile(slug): Promise<{ guide: Guide; tours: TourCard[]; favouritePlaces: PublicPlace[]; posts: FeedPost[] }>
getAboutCopy(): Promise<SiteSections>      // existing getSiteSections
```
Other sites would want: none strictly, but a shared "people roster with kind filter" is an ArtDirect/arts-collective pattern (`org_profiles` is shared).

## 7. Places (12, 13, 38)

**Exists (verified).** `places` (85 rows, 75 public, 0 with tags), `place_links`, `place_stats` view, `tour_stops.place_id`, `tour_assets.place_id` (place photos), `place_businesses` (242). Read and write: `lib/places.ts`, `lib/place-actions.ts` (`savePlaceAction`, `listPlacesAction`, ...). Public read: `listPublicPlaces({q, tag, limit})`, `getPublicPlace(slugOrId)`. `suggested_by` column credits a follower for an accepted suggestion.

**Gap.**
- Tags: column and `listPlaceTags()` exist. No data. Need a ranked tag list for the filter chips: count per tag, descending.
- Favourites and "by guide": no table (G4).
- "On a tour . Stop IV" link in the place sheet: derived from `listPlaceUsage` (exists).
- A guide editing a place: today `savePlaceAction` is editor-gated. A `guide` is an editor, so it works. Artists cannot edit places, which matches the design (guide-only).
- Kind chips on the edit page (Gallery, Studio, Shop, Food & drink, Landmark): `places` has `operating_kind` (free text from classification). Map the five chips to `operating_kind` values or `tags`. Assumed; check with the classify script's vocabulary (`scripts/classify-places.mts`).

**Contract.**
```ts
listPublicPlaces({ q?, tag?, favouritesOnly?, limit? }): Promise<PublicPlace[]>   // extend with tags, favouredBy
listPlaceTagCounts(): Promise<Array<{ tag: string; count: number }>>              // NEW
toggleFavouritePlaceAction(placeId, on: boolean): Promise<Result<{ featured: boolean }>>   // NEW, guide, per user
savePlaceAction(input: PlaceInput): Promise<Result<{ place: Place }>>             // exists (tags included)
getPublicPlace(slugOrId): Promise<PublicPlace | null>                             // exists
```
Other sites: the catalogue is elktours-specific. The favourites table pattern could serve any "curated by people" list but not worth generalising now.

## 8. Suggest (14)

**Exists (verified).** `visitor_suggestions` (migration 239) with `kind spot|route`, status pending/accepted/rejected/withdrawn, `result_place_id`, rate limit `DAILY_LIMIT` in `lib/suggestion-actions.ts`, queue UI `components/manage/suggestions-queue.tsx` at `/manage/suggestions`, `acceptSuggestionAction` (spot becomes a catalogue place credited to the person).

**Gap.** The design's Suggest is "an artist or a place" with name, URL, reason and optional email (G6). That does not fit `spot` (needs a map point) or `route`. Two options:
- (a) Add kinds `artist` and `place_lead`, relax the `visitor_suggestions_spot_point` CHECK so only `spot` needs lat/lng, put `{ url, why, email }` in `payload`. Reuses the queue. Recommended.
- (b) A separate `contact_suggestions` table. More tables, no benefit.

An accepted artist suggestion has no automatic result row (an artist is a person). The office follows up by email. The accept action just marks it accepted.

**Contract.**
```ts
submitSuggestionAction(input: { kind: "artist" | "place"; name: string; url?: string; why?: string; email?: string }): Promise<Result<{ suggestion: VisitorSuggestion }>>
// validation (from the pack): name, and a URL or a reason
suggestionAllowanceAction(): Promise<{ signedIn; canSuggest; usedToday; limit }>   // exists
// office: listSuggestionsAction / acceptSuggestionAction / rejectSuggestionAction  (exist)
```
The pack says all phones assume a signed-in guest, so signed-in plus the existing daily limit is consistent. See Q4.

## 9. Feed (15, 16, 39)

**Model (recommended).** One thread, three views, no copy:
- Thread `kind='post'` (or `kind='post'` with `metadata.link` for a link post), `org_id='elktours'`, `section='feed'`, `author_id` = the guide.
- `status`: `pending` (review) then `published` (public) or `archived` (declined). Uses the platform review queue (`listPendingThreads`, `countPendingThreads`, `reviewThread`).
- Views: Feed list and Discover = the section's published threads. Guide profile = same, filtered by author. Forum Feed section = the same section, rendered by forum-ui.
- Comments = `replies` rows (the forum topic's replies). So "comments shared with the forum topic" is true by construction.
- `org_feeds` today has `tours`, `journal`, `general`, `experiences` (query). Add one row `feed` ("Feed") as data.

**Gap.** G10, G11 (guide posts held for office), G8 (preview card for link posts), attachments (G16) if a post has photos, and `statusForNewThread` treating guides as moderators (verified: `moderation.ts` `canModerateOrg` = owner or guide).

**Contract.**
```ts
submitFeedPostAction(input: { kind: "post" | "link"; title: string; body: string; url?: string }): Promise<Result<{ threadId: string; status: "pending" | "published" }>>
// owner (office) posts publish directly; guide posts return "pending" (G11)
listFeed(opts: { authorId?: string; limit?: number }): Promise<FeedPost[]>     // published only, + the viewer's own pending
getFeedPost(id): Promise<{ post: FeedPost; comments: ForumReply[]; forumHref: string }>
reviewFeedPostAction(threadId, decision: "approve" | "reject"): Promise<Result>   // owner only: wraps reviewThread
postReply(viewer, { threadId, text, parentId? })       // exists in services (forum-write.ts:160)
linkPreview(url): Promise<Unfurled>                    // G8, called at submit time, stored in metadata.link
```
`Unfurled = { url, title, description, imageUrl, siteName }` (verified: `unfurl.ts`).

**Other apps:** any site that wants "guides post, office confirms, shows in the forum" (sunjay, innergathering). The `organizations.member_posts_review` flag already serves members. The reusable piece is G11 (hold roles) in services.

## 10. Web view and link previews (17)

**Investigation result (verified).**
- Server-side unfurl exists: `packages/lms/src/unfurl.ts` (`unfurl()`, `assertPublicUrl()`), exported from `packages/lms/src/index.ts:16`. It follows http(s) only, default ports only, refuses private addresses at every hop, follows at most 3 redirects, has a 4 s budget and a 512 KB cap, accepts HTML only, and falls back to host-as-title on failure.
- It is used only by `packages/lms/src/pool.ts` (verified by grep). No elktours or forum use.
- No other `og:`, `unfurl` or `oEmbed` fetcher exists in apps or packages. The other `og:title` hits are page output (`arts-collective/.../article-render.ts`) or UI strings, not fetchers.
- elktours sets no `X-Frame-Options` or CSP on its own pages (grep of `next.config.*` found no `headers()`), which does not matter here: the issue is the third-party sites refusing to be framed.

**Recommendation.**
1. Move `unfurl.ts` to `@elkdonis/utils` (`packages/utils/src/unfurl.ts`), keep `@elkdonis/lms` re-exporting it. Size S, no migration.
2. Add `GET /api/link-preview?url=` in elktours (signed-in only, rate limited, 24 h cache in memory or a `geo_suggest_cache`-style table is not needed at this volume).
3. Web view sheet: try the iframe only for hosts known to allow it; otherwise show the unfurl card (title, image, description) with "Open in browser". Decision for Justin (pack's open question), see Q3.
4. Store the unfurled card in the post's `metadata.link` at submit time so feed rows do not fetch on read.

**Caveat.** The unfurl User-Agent string names Sophia (`SophiaLinkPreview/1.0 (+https://sophia.arts-collective.com)`). Make the UA a parameter before reuse. Assumed to be a small change.

## 11. Forum (18-21)

**Exists (verified).** `@elkdonis/forum-ui` (`renderForumRoute`, `serviceConnectors`, `forumSnapshot`, form actions at `app/api/forum/[action]`). elktours mounts it at `/forum` (`app/forum/[[...segments]]/page.tsx`) via `lib/forum.ts`. The forum UI is server-rendered HTML forms and does not provide the mobile design's components. The mobile screens call the services (`listBoards`, `listTopics`, `listLatest`, `getThread`, `listReplies`, `postReply`, `createTopic`, `markAllRead`) directly and reuse forum-ui only for the desktop route. Services underneath:
- Sections: `org_feeds(slug, name, parent_slug, min_role, post_role, is_public, accent)`.
- Topics: `threads` with `section`, `visibility`, `min_role`, `pinned`, `locked`, `kind`.
- Replies: `replies(thread_id, parent_reply_id, user_id, content, ...)`.
- Unread: `thread_reads`.
- Thread audience helpers: `thread-audience.ts`, `thread-access.ts`.

**Per design item.**

| Item | Status |
|---|---|
| Sub-sections | Column exists (`parent_slug`). Counts-including-children is a read-side sum. |
| 3 visibility levels | Maps to `everyone`, `followers`, `author` (G13). No action for "change later". `createTopic` hardcodes `PUBLIC` (`forum-write.ts` around `createThread`). |
| Private + people | No storage (G14). |
| Closed section | `min_role` on the feed (G15). |
| Attachments | None (G16, G17). |
| Role rings | Derived (G19). |
| Kinds post/idea/event | `kind` forced to `post` (G18). Kind glyphs exist. |
| Unread/Mark all read | Exists. |

**Recommended home.** Shared work goes into `@elkdonis/services` and `@elkdonis/forum-ui` because every site's forum benefits: `forum_attachments`, `thread_audience_users`, `createTopic({ kind, audience, attachments, people })`, `setTopicAudience(viewer, threadId, audience, people?)`, plus `postReply({ attachments })`. The mobile UI stays in elktours.

**Contract.**
```ts
// services (shared, new or extended)
createTopic(viewer, { orgId, feedSlug, title, text, kind?: "post"|"idea"|"event", audience?: "everyone"|"followers"|"author",
                      people?: string[] /* userIds, only if audience==="author" */, attachments?: Attachment[] }): WriteResult<{ threadId; slug }>
setTopicAudience(viewer, threadId, audience, people?): WriteResult              // author or moderator only
postReply(viewer, { threadId, text, parentId?, attachments?: Attachment[] }): WriteResult<{ replyId; page }>
type Attachment = { kind: "link"; url: string; card?: Unfurled } | { kind: "image" | "video"; url: string; width?; height?; seconds? }
// elktours app-local
uploadForumMediaAction(file: File, audience): Promise<Result<{ url; kind: "image"|"video" }>>   // G17
getForumHome(): Promise<{ sections: Section[]; latest: TopicRow[]; unread: number; me: { name; role } }>
getForumSection(slug): Promise<{ section: Section; children: Section[]; topics: TopicRow[] }>
getTopic(id): Promise<{ topic; replies; canChangeAudience: boolean; audience }>
markAllReadAction(): Promise<Result>   // exists as markAllRead(viewer)
```

**Risk notes.**
- The forum read predicate is used in many queries (`restrictedReadSql`, forum.ts). G14 touches it, so test with the existing visibility test pattern (`packages/lms/scripts/test-visibility.mts` is the model).
- Forum topics of kind `idea` and `event` show in other surfaces by default (opt-out model, `thread-kinds.ts` header). Confirm that an `event` kind topic does not appear on the tours calendar. The elktours `getUpcomingThreads` filters on `scheduled_at`, which these will not have (assumed).

## 12. Board: review queues (30), artist wizard (35), Collaborate (36), City sheet (22)

### Review queues (30)
**Exists (verified).** Thread review: `listPendingThreads`, `countPendingThreads`, `reviewThread` (`packages/services/src/moderation.ts`). Suggestions queue (`/manage/suggestions`). Render requests queue (`/manage/flyovers`). Reviews moderation (`setReviewHiddenAction`).

**Gap.** The Board has three office queues (experiences to review, posts to confirm, invitations waiting). Only posts match the existing queue (and see G11). Experiences need `pending` handling (G23). "Waiting on artists" is a commissions read.

```ts
getBoard(role: "guide"|"artist"|"office", userId): Promise<{
  invitations?: Commission[];            // artist: status proposed
  comingUp?: AcceptedDate[];             // artist
  myExperiences?: Array<Experience & { status: "review"|"public"|"members"|"sent_back" }>;
  availability?: AvailabilityGrid;       // artist
  decisions?: { belowMinimumCount: number };   // guide: counts only, owned by the booking agent
  experiencesOnTours?: Array<{ stopId; tour; exp; confirmed: number; asked: number }>;
  myPosts?: Array<{ post: FeedPost; status: "public"|"review"|"declined" }>;
  toReview?: Experience[];  postsToConfirm?: FeedPost[]; waitingOnArtists?: Commission[];   // office
}>
decideExperienceAction(id, decision: "publish"|"members"|"send_back", notes?): Promise<Result>   // owner only (G23)
```
The real role comes from the session (`getViewer().role` plus the artist test), never from a switch.

### Artist sign-up wizard (35)
**Gap.**
- Step I: "new artist" creates a user. The auth flows exist (`app/api/auth/signup/route.ts`). A new artist gets a `viewer` row. Promoting to `member` and adding an `org_profiles` row should be an office or system step. Assumed: the wizard is signed-in only, with the office confirming, because "Sign-in and account screens" are not designed.
- Steps II-IV map to G23, G24, G22.
- Availability (G22) is a new table. Notice is stored beside it.

```ts
saveArtistProfileAction(input: { name; craft; area; about; link?; email? }): Promise<Result>
saveAvailabilityAction(cells: Array<{ weekday: 0..6; part: "morning"|"afternoon"|"evening" }>, noticeDays: 1|2|7): Promise<Result>
submitExperienceForReviewAction(input: ExperienceInput & { offer: { onTour?: { fee: number; unit: "per_run"|"per_guest" }; standalone?: { pricePerGuest: number }; wantedVisibility: "members"|"public" } }): Promise<Result<{ id: string; status: "pending" }>>
```

### Collaborate (36)
**Exists (verified).** `tour_stops.experience_id` and `place_id` (235); `StopDraft` and `pickExperienceAction` (`lib/experience-actions.ts:209`); `service_commissions` with `departure_id`. Commission API: `proposeCommission`, `respondCommission`, `setCommissionStatus`, `listCommissions` (`lib/commissions.ts`). No callers outside the file, no UI (grep), and 0 rows. `payment_status` is a stub (`CHECK payment_status = 'stub'`), so payouts stay undesigned, as the pack says.

**Gap.** G26 and G27. Specifically:
1. `service_thread_id` NOT NULL plus `kind='service' AND visibility='PUBLIC'` check blocks invites for experiences with no service listing. Make it nullable, snapshot the fee from the experience's `metadata.offer`.
2. Add `stop_id` and a unique index (experience_thread_id, departure_id) so linking twice is idempotent.
3. `linkExperienceToStop` inserts one `proposed` row per upcoming departure where the artist is free (G22). Unlinking cancels open ones.
4. Chip states map: `accepted` = Confirmed, `proposed` = Asked, `declined` = Declined, none and free = "+ Invite", none and not free = "Not free".
5. Fee shown ("EUR 90 per run") comes from `price_cents` and `unit` (exist).

```ts
linkExperienceToStopAction(stopId, experienceId | null): Promise<Result<{ invited: number }>>   // guide/office; creates commissions
inviteForDepartureAction(stopId, departureId): Promise<Result>                                    // manual "+ Invite"
respondInvitationAction(commissionId, "accepted"|"declined"): Promise<Result>                    // artist (respondCommission exists)
getCollaborate(tourId): Promise<Array<{ stop; offsetMinutes; experience: Experience|null; artist; dates: Array<{ departureId; startsAt; state: "confirmed"|"asked"|"declined"|"free"|"not_free" }> }>>
```
Departures come from the booking agent's area. I only read `tour_departures` (3 rows today, query), so the departure id is the shared key.

**Other apps:** none (artist commissioning is elktours-specific, but `service_commissions` is already platform-level).

### City sheet (22)
Copy only plus a "Suggest" link. No backend. Store the city list and the "more cities coming" line in `org_site_sections` so the editor can change it. Single city "Paris" today.

## 13. House editor (direct-edit / Puck): what stays editable

**How elktours wires it today (verified).**
- `blocks/tour/config.tsx` is a Puck `Config` (components TourFilm, TourIntro, TourMain, TourMore, TourText), doc stored in `site_config` key `puck:tour-detail`, read by `lib/tour-layout.ts`. Publish: `app/studio/actions.ts` (`publishTourLayoutAction`, editor-only). Layout editor mounted at `/studio/tour-detail`. Keys are persisted ids, do not rename.
- Experience layout: `site_config` `puck:experience-detail`, per-experience override in `metadata.page` (`lib/experience-layout.ts`, `publishExperiencePageAction`; an experience person may edit their own page: `experience-actions.ts:190`).
- Landing page: `puck:landing`. Site chrome look: `site-style:chrome` (header/footer), schema in `lib/site-style-schema.ts`, saved by `saveSiteStyleAction` (editor-only). Direct-edit is used for the site-style tool (`components/site-style/SiteStyleButton.tsx`, `@elkdonis/direct-edit/site`) and the landing page editor mount (`components/landing/*`). Puck stays pinned at 0.23.0 per the code map.
- Page copy: `org_site_sections` read by `getSiteSections` (empty for elktours).
- `site_config` rows for elktours today (query): `puck:landing`, `puck:tour-detail`, `site-style:chrome`. No `puck:experience-detail` yet, so defaults draw.

**Editable by the house editor (copy and settings).**
- Intro lines on Discover, Tours, Experiences; "Read more" target; issue label; About page sections (copy plus photo); City sheet text; Suggest page copy; Forum header copy and section descriptions (`org_feeds.tagline/description`); feed intro; place kind and tag names (data); tour page block layout (existing); style tokens (existing).
- Settings: guide-decides vs auto-cancel (belongs to the booking agent's scope, but the home matters). **No such setting exists today** (grep for auto-cancel and below-minimum logic found nothing in the app). Recommended: one `site_config` key `elktours:settings` (jsonb) read by one `getSiteSettings()` helper, with a single editor surface (a small settings form, or a direct-edit "settings" panel). Also candidates for that key: post review on or off for guides, "guests may start private topics", daily suggestion limit, notice defaults. No migration.

**Stays out of the editor.** Posts, topics, places, experiences, availability (domain data, edited through their own forms), and anything that is a business rule with money consequences (below-minimum rule changes should be an owner-only setting with confirmation).

**Backend support needed.**
- A `getSiteSettings()` and `saveSiteSettingsAction()` pair (editor-only, validated with zod, versioned by `updated_at`). S.
- New Puck blocks for mobile (hero switcher, feed shelf, places shelf) can stay app-local in `blocks/` and be added to the existing `tourConfig`/landing catalogue. The persisted-id rule means add, never rename.
- Direct-edit and Puck write whole documents. Do not put per-user data (favourites, availability) in `site_config`.

## 14. Reuse versus build summary

| Reuse as-is | Extend (shared package) | New table | App-local only |
|---|---|---|---|
| `org_feeds` sections, sub-sections, `min_role`; `thread_reads`; `replies`; `reviewThread` queue; `visitor_suggestions` queue; `sendExperienceInquiryAction`; `tour_assets` registry; `places.tags`; `org_site_sections`; `site_config` | `unfurl` into `@elkdonis/utils`; `createTopic`/`postReply` (kind, audience, attachments) and `setTopicAudience` in services; `statusForNewThread` hold rule (G11); forum-ui row DTO with role ring | `place_favourites`; `artist_availability`; `forum_attachments`; `thread_audience_users`; plus altering `service_commissions` (nullable service, `stop_id`, unique) and the `visitor_suggestions` kind CHECK | Discover and people reads; hero switcher; `heroLead`; artist wizard; Collaborate; board aggregator; member upload route; settings helper |

Migrations needed (counting separately): `place_favourites`, `artist_availability`, `forum_attachments`, `thread_audience_users` (the L item, can slip), `service_commissions` alter, `visitor_suggestions` CHECK relax. The next free migration number is not in this survey's scope (highest seen on disk is 249); claim it by creating the file first, as the code map says. The existing 233-242 elktours migrations are untouched.

## 15. Open questions for Justin

1. **Artist role.** Is `member` plus an artist tag acceptable? A real `artist` org role would change a shared CHECK constraint on `user_organizations`.
2. **Guide = editor.** The `guide` role already means full /manage access in elktours. Is that intended for every guide, or do you want a narrower guide role (own slots, own posts, places only)?
3. **Blocked link previews.** Fallback: unfurl card plus "Open in browser" (recommended), or try the iframe first and fall back? Proxying pages is not recommended.
4. **Suggest.** Signed-in only (existing rule, daily limit), or open to anyone with an email? Open raises spam.
5. **Private topic with named people.** Worth the L cost now (touches the shared forum read predicate), or ship Public and Members first and keep Private as author-only for the first release?
6. **"Members only" experiences.** Map to `ORGANIZATION` (any signed-in follower can see it) or `INVITE_ONLY + member` (real members only)? The design says "signed-in members".
7. **Guide posts.** Should the office also approve guide *comments*, or only posts? (Comments are forum replies and publish immediately today.)
8. **Artist fee.** Invitations show a fee but payouts are stubbed (`payment_status='stub'`). Confirm that the fee on an invitation is informational only for now.
9. **Where does the guide-decides/auto-cancel switch live?** Proposed `site_config` `elktours:settings`. Needs agreement with the booking agent so both use one key.
10. **Tag vocabulary.** The 85 places have no tags. Who seeds the first set, and are the edit page's five kind chips a fixed list or free tags?
