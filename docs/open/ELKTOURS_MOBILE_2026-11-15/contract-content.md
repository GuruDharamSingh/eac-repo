# Content contract (Jay → Gee), 2026-11-15. Source: apps/elktours/src/lib/{people,places-public,feed,hero}.ts, app/api/link-preview

Note: feed.ts and hero.ts are being split into read modules (feed.ts, hero.ts) plus `*-actions.ts` ("use server"). The function names stay the same; only the actions move to the -actions files.

## people.ts (server reads)
```ts
type PeopleKind = "guide" | "artist";
type ArtistStatus = "Presenting on tours" | "By request" | "Coming soon";
interface PersonCard { userId; slug; name; kind: PeopleKind; isGuide; isArtist; craft|null; area|null; bio|null; photoUrl|null; status: ArtistStatus|null }
interface PersonExperience { id; slug; title; excerpt|null; coverImageUrl|null; durationMinutes|null }
interface PersonProfile extends PersonCard { tours: {tour: Tour; next: TourDeparture|null}[]; posts: FeedPost[]; experiences: PersonExperience[]; artDirectUrl: string|null }
listPeople(filter?: {kind: PeopleKind|"all"}): Promise<PersonCard[]>
getPerson(slugOrUserId): Promise<PersonProfile|null>
```
## places-public.ts (server reads)
```ts
interface PlaceFeaturedBy { userId; name|null; slug|null }
interface PlaceView extends PublicPlace { favourite: boolean; featuredBy: PlaceFeaturedBy[] }  // PublicPlace has tags
interface TagCount { tag; count }
tagOrderOf(places): TagCount[]
listPlacesPublic(filter?: {q?; tag?; favouritesOnly?; limit?}): Promise<{places: PlaceView[]; tagOrder: TagCount[]; favouriteCount: number}>
listFavouritePlaces(limit=8): Promise<PlaceView[]>
getPlacePublic(slugOrId): Promise<PlaceView|null>
```
Favourites are always empty until the place_favourites migration lands. 75 public places, 0 tags today.
## feed (reads in feed.ts, actions in feed-actions.ts)
```ts
interface FeedLink { url; host; title; description|null; imageUrl|null; siteName|null }
interface FeedPost { id; slug; kind: "post"|"link"; title; body|null; excerpt|null; link: FeedLink|null; status: "pending"|"published"|"archived";
  author: {userId; name; slug; avatarUrl}; replyCount; createdAt; publishedAt|null; forumHref }
listFeedPosts(opts?: {limit?; authorUserId?; includePending?}): Promise<FeedPost[]>
getFeedPost(id, opts?: {page?}): Promise<{post: FeedPost; replies: ForumReply[]; canComment: boolean}|null>
listFeedPostsToConfirm(): Promise<FeedPost[]>        // office queue
submitFeedPostAction({title, body, link?}): Result<{id; status: "pending"|"published"}>   // owner|guide; guides held if settings.holdGuidePosts
reviewFeedPostAction(id, "approve"|"decline"): Result<{status}>                            // owners only
```
The forum "Feed" section needs one data row (org_feeds feed). It is not inserted yet; it needs Justin's go.
## hero (read in hero.ts, action in hero-actions.ts)
```ts
type HeroLead = "film"|"map3d"|"photos";
getHeroLead(tour: {id}|string): Promise<HeroLead|null>
setHeroLeadAction(tourId, lead: HeroLead|null): Result<{lead}>   // editor; null clears; fallback order stays in your hero block
```
## GET /api/link-preview?url=
→ `{url, title, description, imageUrl, siteName, host}`. 400 for a bad or private URL, 429 + Retry-After over 20/min/IP. Public and cached.

## Forum Start a topic (on for elktours: lib/forum.ts composeOptions)
- forum-ui `ComposeExtras` renders kind chips (post/idea/event), audience chips (everyone=Public, followers=Members, author=Private, only you) and a link field in NewTopicForm and the rail NewTopicFold.
- `?section=<slug>` preselects and opens the section.
- The posted `kind`/`audience`/`link` go to services createTopic. The link is unfurled at write time into `threads.metadata.link = {url,title,description,imageUrl,siteName}`.
- `setTopicAudience(viewer, threadId, audience)` is in services, for "change later" (author or moderator).
- Restyle with your mobile CSS scope; there is no parallel compose.
- Not built: photo/video attachments (needs the forum_attachments migration + member upload route) and Private with named people.

## Tour type
- `tour.tourType` on every Tour row.
- lib/tour-type.ts has TOUR_TYPES, TOUR_TYPE_LABELS and readTourType; lib/tour-type-actions.ts has setTourTypeAction(tourId, type|null).

## Member upload: POST /api/upload/forum (multipart: file, audience?)
- Returns `{url, kind:"image"|"video", width?, height?}`.
- Signed-in people with any org row only. Caps: 15 MB images, 100 MB video. EXIF stripped, HEIC refused. Rate limit 20 per 10 min.
- Known v1 limit: Private (author-only) media is readable by any follower who has the URL.

## Artist wizard (35): lib/artist-wizard.ts (reads) + lib/artist-wizard-actions.ts
```ts
type ExperienceReviewState = "draft"|"sent_back"|"review"|"public"|"members"
interface ExperienceOffer { onTour: {fee:number; unit:"per_run"|"per_guest"}|null; standalone: {pricePerGuest:number}|null; noticeDays:1|2|7; visibilityWanted:"members"|"public" }
interface WizardExperience { id; slug; title; pitch|null; state; label; notes|null; offer|null; updatedAt }
interface AvailabilityCell { weekday:number /*0=Mon*/; part:"morning"|"afternoon"|"evening" }
canUseArtistWizard(); listMyExperiences(); getMyExperience(id); listExperiencesToReview() /*owner*/; getAvailability(userId?) /*available:false until migration*/
saveArtistProfileAction({name?,craft?,area?,about?})
saveExperienceDraftAction(input: {title; pitch?; body?; kindLabel?; format:"in_person"|"online"|"hybrid"; placeId?; durationMinutes?; groupSize?; offer}, id?) -> {id, slug}
submitExperienceForReviewAction(id)              // needs pitch, a place unless online, and an offer
decideExperienceAction(id, "publish"|"members"|"send_back", notes?)   // owner
inviteArtistAction(email)                        // existing account -> member; otherwise "sign up first"
saveAvailabilityAction(cells, noticeDays?)       // "available after migration" until the table exists
```
The step I "link" field is not stored (no safe column).

## Suggest (14): lib/suggest-lead-actions.ts
`submitSuggestionAction({kind:"artist"|"place", name, url?, why?, email?}) -> {id}`. Signed in only. Max 10 a day. Returns "available after migration" until the visitor_suggestions migration lands.
