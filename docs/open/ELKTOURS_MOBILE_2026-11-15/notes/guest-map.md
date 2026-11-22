# Guest screens 01-23: where they live in apps/elktours today

Researcher: UI-mapping (read-only). 2026-11-15. Paths are relative to `~/eac/apps/elktours/src` (`app/`, `blocks/`, `components/`, `lib/`) unless they start with `packages/`.
Numbering follows the brief; the pack file is in each heading (pack numbering differs: City sheet is `22-`, Tours `02-`, etc.).

## 0. Findings that shape everything

- **Theme already matches.** `app/globals.css` is the "zinc and brass" theme: Basteleur/Brothers/Venture `@font-face` (l.58-61), `--background` zinc, `--primary` brass `#c9a25c`, `--brass-light`, `--terracotta` (= pack vermilion), `--card #343941`. Missing: verdigris, `#31353c` card, `#2f3339` sheet, `#3d424a` well, hairline ramp, arch/porthole/cut-corner utilities. `--radius: 0rem` today, so cut-corner and arch are new CSS. Shared blocks read `--eac-block-*` / `--eac-surface-*`, which point at the same vars.
- **Site is desktop-first with a header nav.** `app/layout.tsx` -> `HubSurfaces` (surface provider) -> `components/site-header.tsx` (sticky top bar, `data-part` hooks for the site-style editor) + `components/site-footer.tsx`. No bottom nav, no mobile shell. Guest nav (23) is new.
- **Three editability tiers exist:**
  1. *Puck + sealed page blocks* on `/` and `/studio/<slug>` (`lib/puck/catalogue.ts` = curated `@elkdonis/blocks` SHARED_BLOCKS + `featuredPerson`; `lib/puck/config.client.ts` builds editor config; `components/landing/EditPageButton.tsx` + `page-editor-mount.ts` is the direct editor; landing live parts passed in `metadata.parts` with `data-landing-part` + `data-edit-name`). Only `/` and the generic fallback in `app/[feed]/page.tsx` (`renderPuckPage`, `lib/puck/render.tsx`) use it.
  2. *Template layouts*: tour page (`blocks/tour/*`, site_config `puck:tour-detail`, studio `app/studio/tour-detail`) and experience page (`blocks/experience/*`, `puck:experience-detail`, studio `app/studio/experience-detail`, per-experience `metadata.page`). These are **hand-rolled `Config` objects, not `@elkdonis/blocks`**: `blocks/*/config.tsx` declares fields (text/textarea/number/radio) and `TourLayout`/`ExperienceLayout` render by hand. Record words come from `TourPageProvider`/`ExperiencePageProvider` (`blocks/*/context.tsx`). Tour has an in-place edit bar (`blocks/tour/edit-bar.tsx`, `InlineText` in `blocks/tour/blocks.tsx`).
  3. *Hard-coded server pages* (tours index, experiences index, places, about, guide page): literal JSX; `getSiteSections()` (`lib/data.ts:707`, edited at /manage/pages) supplies only `hero` and `about` title/body.
- **No direct-edit anywhere else.** grep for `direct-edit|data-de|EditPageButton|site-style` hits only: `app/page.tsx`, `app/layout.tsx`, `components/site-header.tsx`, `components/landing/*`, `components/studio/*`, `components/site-style/*`, `lib/puck/*`, `lib/site-style*`, `lib/featured-person-actions.ts`, `lib/opens-server.ts`. Tours, experiences, places, about, forum, feed: none.
- **House recipe for an editable record block** (`docs/open/EDITING_LANDSCAPE_2026-11-12/detail.md` section 4): shared cms-ui `*Face` on `eac-face` grammar; the face opens a registered Surface; `parts` selectors in a data-only `*-parts.ts`; own labels `prop`-editable, data words locked; implicit binding + `RESOLVED_KEYS` strip; `interactive:true` + `EnsureSurface`. Forum is the model (`ForumFace` in `packages/cms-ui/src/surface/surfaces/ForumSurface.tsx`). Blocks use `defineBlock` (`packages/blocks/src/registry.ts`); see `packages/blocks/src/blocks/featured-person.tsx` for a sealed, data-bound block.
- **Existing popup system = bottom-sheet precedent.** `components/hub/HubSurfaces.tsx` registers custom surfaces `tour` (`components/tours/tour-popup.tsx`: Overview/Stops/Dates tabs), `experience` (`components/surfaces/experience-popup.tsx`), `place` (`components/surfaces/place-popup.tsx`, editors only, private notes), `reviews` and `person` (`components/surfaces/opens-popups.tsx`). They open via `useSurface().open(descriptor)` in a `SurfaceFrame` (`@elkdonis/cms-ui/surface`, `SurfaceShell.tsx`, `surface.css`), a centred dialog today. The pack's bottom sheet = restyle `SurfaceFrame` at mobile width (slide-up, scrim, grab bar), not a new sheet component.
- **No home yet:** guides' Feed posts with review status, Local Artists directory, artist profile page, city list, suggestion form (artist/place + URL), forum visibility Public/Members/Private, forum media attachments, in-app web view, waitlist, minimum-guest rule, favourite places by guide. Place tags column exists.

## 1. Per-screen map

Legend: Edit = **Puck** (Puck/direct-edit block), **Tmpl** (template layout block fields), **Hard** (literal JSX).

### 01 Discover (`01-discover.html`)
1. Route: `app/page.tsx`. Puck page `puck:landing` once saved (`loadPage(LANDING_SLUG)`), else code fallback: hero text (from `getSiteSections().hero`), tour cards grid, "how it works" band, guides list.
2. Reuse: `components/tours/tour-card.tsx` `TourCard({tour,next})` (hover film, opens `tour` popup; restyle to the arch featured card); `lib/tours.ts` `listTours`, `nextDepartures`; `lib/data.ts` `getGuides()` (userId, slug, displayName, roleTitle, bio, photoUrl); `components/places/*`; `components/experiences/experience-card.tsx`.
3. Edit: Puck/direct-edit on the saved tree; code fallback carries `data-edit-section` / `data-edit-name`; live parts (`hero-backdrop`, `tour-cards`, `guides`) pass via `metadata.parts` with `data-landing-part`. How-it-works is literal.
4. Proposed: `DiscoverMasthead` (wordmark, city pill, issue rule) plus one sealed block per band, each with `parts`: `FeaturedWalk` (data: lead tour + next departure; editable: kicker "Walking tour", heading "This week's walk"), `PlacesShelf` (data: starred places; editable: heading, "All" label, "See all N places" text), `ExperiencesComing` (data: next public experiences; editable: label, H2 "Something strange on the way", the copy line), `GuidesAccordion` (data: guides + their tours; editable: heading, "Local Artists" link label), `CatalogueRow` x3 for Feed / Places / Forum (data: newest post, counts, unread; editable: kicker, title/blurb). Page-level editable copy: H1, intro, "Read more" target (link/opens prop), issue-rule label "Autumn - No. VII", search placeholder. Search row links to /tours with focus.
5. Data: tours/departures yes; places yes but starred-by-guide new; guide->tours derivable from `tours.authorId`/departure guide; newest feed post new; forum unread via `getForumSnapshot()` (`lib/forum.ts`) yes.

### 02 City sheet (`22-city-sheet.html`)
1. Route: none. City is the constant `siteConfig.city` (`config/site.ts`); header shows it as text.
2. Reuse: `SurfaceFrame` via a new custom surface key `city` in `HubSurfaces.tsx`. The pill replaces `data-part="city"` in the header.
3. Edit: n/a (no existing copy).
4. Proposed: `CitySheet`. Editable copy: H2 "Choose a city", the "More cities coming" paragraph, CTA label. Data: a static one-entry city list in `config/site.ts`.
5. Data: no cities table; static Paris row is enough. Flag if the owner wants an editable list.

### 03 Tours (`02-tours.html`)
1. Route: `app/tours/page.tsx` (hard-coded: kicker=city, H1 "Tours and experiences", intro, grid of `TourCard`).
2. Reuse: `TourCard`; `lib/tours.ts` `listTours`, `nextDepartures`; `lib/tour-format.ts` `formatDeparture/formatDuration/formatPrice`.
3. Edit: Hard.
4. Proposed: `TourListScreen` (client: live title filter + type chips) and `TourRow` (arch thumb 112x144, kicker, title, guide, next date, price). Editable copy (convert page to a small Puck template, or use `getSiteSections()` keys): kicker, H1, intro, "Read more" target, chip labels, empty-state text.
5. Gap: tour `type` (Walks/Ateliers/Museums/Food/Private) is not in `readDetails` (`lib/tours.ts:154`); add to tour metadata.

### 04 Tour detail (`03-tour-detail.html`)
1. Route: `app/tours/[slug]/page.tsx` -> `TourPageProvider` + `TourLayout(loadTourLayout())` (site_config `puck:tour-detail`; default in `blocks/tour/layout-data.ts`) + `ReviewsSection` + `TourEditBar`. Shared layout edited at `app/studio/tour-detail`.
2. Reuse (`blocks/tour/blocks.tsx`): `TourFilmBlock({size,interactive})` (film, else `RoutePreviewLauncher` if stops placed, else cover; never crops film), `TourIntroBlock({showFacts})`, `TourMainBlock({showHighlights,showRoute,routeHeading,showBooking})`, `TourMoreBlock({heading,count})`, `TourTextBlock({heading,text})`. Also `components/tours/route-preview-launcher.tsx` (poster + play mounts `route-preview.tsx` on tap; the "Preview the route" behaviour), `route-preview.tsx` (478 lines), `tour-story.tsx` (stop-by-stop with map + `street-view.tsx`), `stop-details.tsx` (expanded stop: body, `BusinessCard`, `PlaceLinks`, reviews), `tour-popup.tsx` Stops tab (inline expand + experience link via `onExperience`, closest to the pack's expandable timeline), `booking-form.tsx`. Assets: `TourAsset` kinds incl. film/image/map3d/streetview (`components/manage/asset-panel.tsx`, `lib/assets.ts`).
3. Edit: Tmpl fields in `blocks/tour/config.tsx` (size, interactive, showFacts, showHighlights, showRoute, routeHeading, showBooking, More heading/count, Text heading/text). Record words (title, excerpt, body, facts, price) editable in place by editors via `TourEditBar`/`InlineText` + `patchTourAction`. No direct-edit hooks.
4. Proposed (keep the Tmpl mechanism, add mobile blocks to `tourConfig`): `TourHero` (replaces `TourFilmBlock`: film | 3D route | photos with pills; arched double frame; mounts `RoutePreview` on tap; scroll-snap photos with Roman counter), `TourTitleFacts` (title, guide row, 4-col facts strip, drop-cap blurb; extends `TourIntroBlock`), `TourRouteTimeline` (replaces the route half of `TourMainBlock`: Roman-numeral timeline with inline expand; reuse `StopDetails`/`StreetView`; "About this place" -> Place sheet; verdigris "Experience at this stop" pill -> Experience), `TourNextDates` (chips -> Dates), `TourStickyBook` (price + "Choose a date"). Puck fields: `routeHeading`, route hint line, `showFacts`, which hero kinds to allow, "Meet at" label, "Next dates" heading, CTA label. Data-driven: title, guide, facts, blurb, stops, stills, departures, price, stop->place and stop->experience links.
5. Data: stops, stills, departures, assets exist. Hero `lead` kind new. Stop->experience link per spec (check migration 236). Heart/saved is new, flag.

### 05 Date and time (`04-date-time.html`)
1. Route: none; today a select of open departures inside `BookingForm` in the `TourMainBlock` aside (`#book`). `tour_departures`: starts_at, capacity, guide_user_id, status (migration 208).
2. Reuse: `components/tours/booking-form.tsx` `BookingForm({tourSlug,departures,priceLabel,pricePerPerson,currency,maxParty,unavailable,signedInEmail,signedInName})`; `components/hub/CalendarGrid.tsx` (month grid, check reuse); `lib/tour-format.ts`; `lib/tour-actions.ts` `bookTourAction`; `@elkdonis/checkout/booking` `bookingAvailability`.
3. Edit: Hard.
4. Proposed: `DatePickerSheet` (route `app/tours/[slug]/dates` or a surface) with `MonthGrid`, `SlotCard`, `PartyStepper`. Editable copy: heading, minimum-guests rule sentence, CTA labels "Continue"/"Join the waitlist". Data: departures with booked count, min, cutoff, waitlist.
5. Gap: **min guests, booking cutoff, waitlist, "closed" state do not exist** on `tour_departures` (capacity only). Needs migration (platform teammate).

### 06 Booking and payment (`05-booking-payment.html`)
1. Route: `BookingForm` -> `bookTourAction` -> Stripe checkout redirect; return `app/api/checkout/return/route.ts`; ticket page `app/bookings/[token]/page.tsx` (+ `calendar.ics`).
2. Reuse: `BookingForm` (name/email/note/party), `bookings/[token]` page as the "You're booked" success, `lib/tour-actions.ts`.
3. Edit: Hard.
4. Proposed: `BookingSummary` + `PayStep` (Card / Apple Pay chips, price lines, cancellation policy) + `BookedSuccess`. Editable copy: cancellation policy, rule text, CTA label. Data: tour/slot/party, price, reference, queue position.
5. Gaps: payment is a Stripe-hosted redirect, not an in-page method step (decision); waitlist success needs a waitlist table; cancellation policy text has no home.

### 07 Experiences (`06-experiences.html`)
1. Route: `app/experiences/page.tsx` (hard-coded header, grid of `ExperienceCard`; editors see drafts).
2. Reuse: `components/experiences/experience-card.tsx` `ExperienceCard({experience})` (opens `experience` popup); `view.ts` `toExperienceView`; `types.ts` `ExperienceView` (people[], format, durationMinutes, location, price, excerpt); `people-chips.tsx` (`PersonAvatar`, `ArtistChip`); `lib/experiences.ts` `listExperiences`.
3. Edit: Hard.
4. Proposed: `ExperienceRow` (76px porthole, kind - minutes, title, artist - craft, pitch, "At a stop on ..."/"By request"), `ArtistsStrip` (84px portholes + status), `SuggestPill`. Editable: kicker, H1, intro, "Read more" target, "The artists" heading, "Know an artist we should meet?" label. Data: experiences, people, "where" from tour stops linked to the experience (`listExperienceTours`, `lib/experiences.ts:167`).
5. Gaps: artist `craft` and availability status ("Presenting on tours / By request / Coming soon") not modelled; pack "kind" vs repo `format`.

### 08 Experience page (`07-experience.html`)
1. Route: `app/experiences/[slug]/page.tsx` -> `ExperiencePageProvider` + `ExperienceLayout(resolveExperienceLayout(e.page))`; site default `puck:experience-detail` (`app/studio/experience-detail`); per-experience layout in `metadata.page`; `app/studio/experience/[id]`.
2. Reuse (`blocks/experience/blocks.tsx`): `ExperienceHeroBlock({size})`, `ExperienceIntroBlock({showFacts})`, `ExperienceMainBlock({showHighlights,showPeople,showInquiry,inquiryHeading})`, `ExperienceGalleryBlock({heading})`, `ExperienceMoreBlock`, `ExperienceTextBlock`; `components/experiences/experience-inquiry.tsx` `ExperienceInquiry` (posts `/api/inquiry`; the "Ask about a private visit" action); `people-chips.tsx` `PeopleList`; `components/surfaces/experience-popup.tsx`.
3. Edit: Tmpl fields (`blocks/experience/config.tsx`: size, showFacts, showHighlights, showPeople, showInquiry, inquiryHeading, gallery heading, more heading/count, text). Words edited in /manage/experiences/[id]; no in-place edit.
4. Proposed: `ExperienceHeroRound`, `ExperienceTitlePitch`, `ExperienceFacts2x2` (Length, Format, Where, Group), `ExperienceTours` ("On these tours" cards), `ExperienceDates` (accepted departures), `ExperienceEnquiry`. Fields: inquiryHeading, "On these tours" heading, "Upcoming dates" heading, enquiry button label. Data: experience, host, linked tours, accepted departures.
5. Gaps: accepted departures (`service_commissions` asked/confirmed per departure, spec 2026-11-02) need a public read; `group` fact; `listExperienceTours` exists.

### 09 Artist profile (`08-artist-profile.html`)
1. Route: none. Artists are `experience_people` rows with `profileUrl` out to ArtDirect (`forumProfileUrl`, `lib/forum.ts`; `ExperiencePersonView` in `components/experiences/types.ts`). `/about/[slug]` is guides only.
2. Reuse: `app/about/[slug]/page.tsx` as a starting point; `PersonAvatar`; shared blocks `person-header.tsx`, `person-portfolio.tsx`, `person-card.tsx` in `packages/blocks/src/blocks`; `lib/featured-person.ts`.
3. Edit: Hard (bio is the person's profile, `components/profile-edit-form.tsx`).
4. Proposed: new `app/artists/[slug]/page.tsx` + `ArtistProfile` template (arched verdigris portrait, name, craft, drop-cap bio, 3-col `WorkGrid`, their experiences, "Find {name} on" tours, ArtDirect link). Prefer a layout-config template like experiences so headings are editable: "Work", "Their experiences", "Find {name} on", link label. Data-driven: person, works, experiences, tours.
5. Gap: `craft`, `area`, works[] not modelled (ArtDirect holds the portfolio); read or link-out only.

### 10 Guide profile (`09-guide-profile.html`)
1. Route: `app/about/[slug]/page.tsx` (hard-coded; `getGuideBySlug`, `getThreadsByAuthor`, `getGuideStore`, `listWriting`). `app/about/page.tsx` lists guides as sections.
2. Reuse: that page; `components/thread-card.tsx`; `components/guide-profile-card.tsx` (+`.module.css`); `lib/data.ts` `getGuides/getGuideBySlug`.
3. Edit: Hard.
4. Proposed: `GuideProfile` sharing the `ArtistProfile` layout, brass variant. Editable: "Tours with {name}", "{name}'s favourite places", "Shared by {name}" headings. Data: guide, their tours, starred places, public feed posts.
5. Gaps: starred places and feed posts are new.

### 11 Local Artists (`10-local-artists.html`)
1. Route: none. Nearest: `app/about/page.tsx` (guides) and `/experiences` (artists via cards).
2. Reuse: `getGuides()` plus `experience_people`; `listPersonOptions` (`lib/experiences.ts:191`) is an editor picker, not public.
3. Edit: n/a.
4. Proposed: `app/artists/page.tsx` + `PeopleGrid`/`PersonCard` (arch+brass guides, round+verdigris artists), chips Everyone/Guides/Artists; also the 136px snap row used on About. Editable: kicker, H1, intro, chip labels.
5. Gap: unified public people read (guides + artists) with craft/status.

### 12 About (`11-about.html`)
1. Route: `app/about/page.tsx` (hard-coded `rows`: company, story placeholder "Dana to write", a section per guide, places, how, experiences, pictures, network, contact; editors see placeholders). Title/body from `getSiteSections().about`.
2. Reuse: that page's `Section` structure for the three ruled sections (I Tours / II Experiences / III Places and the forum); `getSiteSections`.
3. Edit: only `about.title`/`about.body` via /manage/pages; the rest is hard-coded.
4. Proposed: make About a Puck page (`/studio/about`): `AboutHero` (arched photo, H1, drop-cap paragraph), `RuledSection` (numeral, title, body, link; or shared `section-heading` + `prose`), `PeopleSlider`, `SuggestPill`. All copy editable except the people row. Note `/about` is a static route and beats the builder fallback in `app/[feed]/page.tsx`: have `app/about/page.tsx` call `renderPuckPage("about")` first, or remove it.
5. Data: only the people row. The pack says the copy awaits the owner's wording.

### 13 Places (`12-places.html`)
1. Route: `app/places/page.tsx` -> `PlacesCatalogue` + `VisitorSuggest` (hard-coded header). `/journal` redirects here.
2. Reuse: `components/places/places-catalogue.tsx` `PlacesCatalogue({places,canEdit})` (list/map toggle, search, expanding cards, reviews); `catalogue-view.ts` `CataloguePlaceView` (id, slug, title, imageUrl, excerpt, body, address, tags, tours, links, reviews, businesses); `lib/places.ts` `listPublicPlaces`, `listPlaceTags` (l.187), `getPublicPlace`.
3. Edit: Hard. Tags editable in `/manage/places` (`components/places/place-form.tsx`).
4. Proposed: `PlacesScreen` with `TagChips` (All, Favourites, then tags by use-count) and `CatalogueRow` (52x64 arch, kind - area, name, tags, "A guide favourite"). Editable: kicker, H1, "Favourites" label. Data: public places with tags, fav flag.
5. Gaps: favourite/starred-by-guide, place kind, area, hours, website are new (tags exist). Tag counts query needed.

### 14 Place sheet (`13-place-sheet.html`)
1. Route: none public. `components/surfaces/place-popup.tsx` is the **editors-only** popup (private notes/stats via `/api/surfaces/place/[id]`). Public detail today is the expanding card in `PlacesCatalogue` and `StopDetails` in the tour popup.
2. Reuse: `components/places/place-details.tsx`, `place-links.tsx` `PlaceLinks`, `business-card.tsx` `BusinessCard`/`PlaceBusinesses` (the "business profile" note), `components/reviews/reviews-section.tsx`, `lib/places.ts` `getPublicPlace`.
3. Edit: Hard (place copy comes from /manage/places).
4. Proposed: new public surface key `place-sheet` (not `place`, which is private): `PlaceSheet({placeId})` with arch thumb, kicker, name, blurb, tag pills, favourite-of, Address/Hours, "On a tour - Stop IV" button, Website (-> Web view), Directions, business note, "See all places". Editable: button labels, "Business profile coming soon" note, "See all places" label. Data: public place, tags, tour+stop (`PlaceUsage`), favourite guide.
5. Gaps: hours, website, favouriting guide; a public read API (the existing one is editor-only).

### 15 Suggest (`14-suggest.html`)
1. Route: none as a page. `components/places/visitor-suggest.tsx` `VisitorSuggest({places})` (map-pin "Suggest a spot/route", signed-in followers, rate limit; `lib/suggestion-actions.ts` -> `/manage/suggestions` queue, `components/manage/suggestions-queue.tsx`). Different shape from the pack form.
2. Reuse: suggestion actions + queue as the sink; `components/inquiry-form.tsx` (`app/api/inquiry/route.ts` needs a threadId, so not directly usable).
3. Edit: Hard.
4. Proposed: `SuggestSheet` (chips An artist / A place, name, URL, reason, optional email). Editable: per-kind field labels, success toast text, helper copy. Data: write-only.
5. Gap: kind "artist", `url`, `email` and no-login path are new; extend `lib/suggestion-actions.ts` and the migration 239 table.

### 16 Feed (`15-feed.html`)
1. Route: `app/[feed]/page.tsx` renders any `org_feeds` section as `ThreadCard`s; `app/[feed]/[slug]/page.tsx` is the thread page. **No guides' feed with review status exists.** `components/manage/feed-editor.tsx` and `app/manage/feeds/page.tsx` manage sections.
2. Reuse: `[feed]` route, `components/thread-card.tsx`, `lib/data.ts` `getThreadsForFeed`; `ForumSurface` `ThreadRow` for catalogue-style rows.
3. Edit: Hard (feed name/tagline/description come from DB).
4. Proposed: an `org_feeds` row (e.g. `guides-feed`) served by the generic route or `app/feed/page.tsx`, with `FeedRow` (arch initial, kicker "Post"/"Link - host", title, "Author - when - N comments"). Editable: H1, one-line intro (feed `tagline`/`description` already exist). Data: published threads of that feed + comment counts.
5. Gap: review -> public/declined workflow and "link post" kind (draft/published status exists; link kind and decline are new).

### 17 Post preview sheet (`16-post-preview-sheet.html`)
1. Route: thread page `app/[feed]/[slug]/page.tsx` (268 lines) and the shared `thread` surface from `HubSurfaces` (`lib/surface-thread.ts`).
2. Reuse: cms-ui `ThreadSurface.tsx`/`ThreadView.tsx`; `packages/forum-ui/src/thread.tsx` `ReplyItem`. `reviews-section.tsx` is reviews, not comments.
3. Edit: record data only.
4. Proposed: `PostSheet` (author row, title, body, link-post iframe 240px with host, "Full screen", comments + pinned comment box, "In the forum"). Data: thread + comments = forum replies (same record). Editable: "In the forum" label, blocked-preview note.
5. Gap: link embed and blocked-iframe fallback decision (open question in pack README).

### 18 In-app web view (`17-web-view-sheet.html`)
1. Route: none. Iframes exist only in `tour-story.tsx` (Street View) and cms-ui Material/Documents surfaces.
2. Reuse: `SurfaceFrame` sheet; `components/surfaces/opens-links.ts` shows how `a[data-opens]` links open a popup (pattern for link -> web view).
3. Edit: n/a.
4. Proposed: `WebViewSheet({url})` custom surface plus a global link handler for feed/forum/place links; open-in-browser fallback for sites that refuse framing.
5. Gap: none in data; decision on blocked sites.

### 19 Forum (`18-forum.html`)
1. Route: `app/forum/[[...segments]]/page.tsx` -> `renderForumRoute({connectors: getForumConnectors(), segments, searchParams})` from `@elkdonis/forum-ui` (server components; `lib/forum.ts` `serviceConnectors`, org-scoped, theme classic/modern, `forumHrefs`). Wrapped in `.gf-page`.
2. Reuse: `packages/forum-ui/src/` `routes.tsx` (dispatch), `pages.tsx` (`IndexPage`, `BoardPageView`, `ThreadPage`, `ListPage`, `FeedPage`), `parts.tsx` (`Byline`, `KindGlyph`, `Breadcrumb`, `PageHead`, `ReadAllForm`, `SectionTitle`, `RoleChip`), `thread.tsx` (`ThreadPageView`, `ReplyItem`), `category.tsx` (`NewCategoryPanel`), `forum-modern.css`/`forum-theme.css`; `packages/cms-ui/src/surface/surfaces/ForumSurface.tsx` (`ThreadRow` with unread, glyph, replies) and `kinds.ts` (glyphs). Actions: `app/api/forum/[action]/route.ts` (reply, topic, read-all, bookmark ...).
3. Edit: none (package-controlled).
4. Proposed: do **not** rewrite. Add a mobile look as CSS scoped to `.gf-page` (app `globals.css`) or a new forum-ui theme, plus `ForumFace` variants. Editable copy is minimal; if wanted, expose H1/kicker as props of a Puck `Forum` block (sunjay already wraps `ForumFace`).
5. Data: sections, sub-sections (migration 163 `forum_subcategories`), unread, read-all exist. Gaps: closed "Guides & artists" section by role, three visibility levels (+ add people), attachments (link card + media). Confirm each in forum-ui before building.

### 20 Forum section (`19-forum-section.html`)
1. Route: same catch-all (`BoardPageView` / `FeedPage` in `pages.tsx`).
2-4. As 19. "Start a topic here" preselect = the existing new-topic form with the category prefilled.
5. Sub-section pills and breadcrumb: `Breadcrumb` exists.

### 21 Topic (`20-topic.html`)
1. Route: same catch-all, `ThreadPage` (`pages.tsx:642`) -> `ThreadPageView` (`thread.tsx:358`).
2. Reuse: `ThreadPageView`, `ReplyItem`, `Avatar`, `RoleChip`, `NcBadge`; `app/api/forum/[action]` reply/vote.
3. Edit: none.
4. Proposed: restyle only: role-ringed avatar (brass guide, verdigris artist, grey guest), pinned reply bar, link card, 2-col media grid, visibility box on own topic. Editable: none (data).
5. Gaps: visibility chips, media attachments (use `/api/upload`), link card.

### 22 Start a topic (`21-start-a-topic.html`)
1. Route: forum-ui new-topic flow (`actions.ts` "topic", "propose-topic"; form in `pages.tsx`/`category.tsx`).
2. Reuse: forum-ui compose form; `components/manage/media-field.tsx`; `/api/upload`.
3. Edit: none.
4. Proposed: restyle plus kind chips (post/idea/event), visibility, Add people, media. Editable: none.
5. Gap: visibility and invitees (see 19).

### 23 Guest nav (`23-guest-nav.html`)
1. Route: none. Augment `components/site-header.tsx` (props `signedIn, canEdit, isMember, offerings`; `data-part` hooks from `lib/site-style-schema.ts`) with a mobile-only floating `GuestTabBar` (Discover `/`, Tours `/tours`, Experiences `/experiences`), shown only on those three roots; keep the desktop header at `md:` and up. Mount in `app/layout.tsx`.
2. Reuse: active-link logic (`usePathname`, `isHere`) from the header; `data-part="links|active"` naming.
3. Edit: labels could be a site-style part; otherwise static.
4. Proposed: `GuestTabBar`; labels editable site copy (low priority).
5. Data: none.

## 2. Reusable shell pieces and what exists

| Piece | Used on | Existing in repo | Action |
|---|---|---|---|
| Arched frame (double brass frame) | 01, 03, 04, 12, 13, 14, 16 | nothing; `tour-card.tsx` uses `aspect-[4/3]` boxes | New `.elk-arch` CSS util + `ArchFrame` (img/film/badge) |
| Porthole (round) | 07, 08, 09, 11 | `PersonAvatar` (`components/experiences/people-chips.tsx`, round, initials) | Generalise to `Porthole({size,src,initial,tone})` |
| Section header (Venture label + fading rule) | most | About `Section` kicker + rule (`app/about/page.tsx`), `SectionTitle` (`packages/forum-ui/src/parts.tsx`), shared `section-heading` block | New `SectionHeader`; wrap as a block for Puck pages |
| Chip (34-38px pill, brass selected) | 03, 11, 13, 15, 19-22 | `packages/primitives` `Badge`, `Tabs`, `radio-group`; none pill-styled | New `Chip`/`ChipGroup` |
| Cut-corner primary button | 04-06, 14 | `Button` in `packages/primitives/src/components/button.tsx` | Add `variant="cut"` with the clip-path |
| Bottom sheet + scrim + grab bar | 02, 14, 15, 17, 18 | `SurfaceFrame`/`SurfaceProvider` in `packages/cms-ui/src/surface` (centred dialog) | Restyle for mobile (CSS in `surface.css`/app globals); reuse open/close + descriptors; add custom keys `city`, `place-sheet`, `suggest`, `post`, `webview` in `HubSurfaces.tsx` |
| Back button (44px circle) | 04-22 | text "back" links (`TourIntroBlock`) | New `BackButton` (`router.back()` with href fallback) |
| Stop timeline (Roman numerals) | 04 | `tour-story.tsx` list, tour popup Stops tab (Arabic numbers) | New `StopTimeline` |
| Roman numerals | 04 counter/stops/chips, 12 sections | none | One `toRoman` util in `lib/tour-format.ts` |
| Catalogue row (arch thumb, kicker, title, meta, chevron) | 01, 13, 16, 19-20 | `ForumSurface` `ThreadRow`, `thread-card.tsx`, `TourCard` | New presentational `CatalogueRow` taking props |
| Kicker label (Venture caps) | all | `font-mono text-xs uppercase tracking` utility repeated inline | New `.kicker` class |
| Drop-cap body | 04, 08, 09, 12 | `.eac-article` (`data-layout="note"`) for tour/experience body | Add `.dropcap` modifier |
| Toast | 15 | `components/ui/sonner.tsx` | Restyle only |
| Facts strip (4-col / 2x2) | 04, 08 | `dl` rows in `TourIntroBlock`/`ExperienceIntroBlock` | New `FactsGrid` |
| Expand-in-place +/- ring | 01 guides, 04 stops | tour popup Stops tab; `PlacesCatalogue` card unfold | New `Disclosure` |

## 3. Editability plan (summary)

- **Make editable:** Discover (existing `puck:landing` tree), About (new `puck:about`), Tours/Experiences/Places intros (small copy via `getSiteSections()` keys at /manage/pages, or convert to template pages), Tour detail and Experience detail (extend the `Config` fields in `blocks/*/config.tsx`: one field per heading/label). Rule from the landscape doc: only a block's own labels are props; data words (titles, dates, counts) are locked and re-read per request.
- **Not editable (data or package):** forum screens, feed rows, booking path, guide/artist profile bodies (edited via profile/manage forms).
- Mechanism for new Discover bands: sealed blocks via `defineBlock` (see `featured-person.tsx`), registered in `lib/puck/catalogue.ts`, each with a `*-parts.ts`; add to `RESOLVED_KEYS` if they resolve data; mark live parts like `app/page.tsx` does.

## 4. Gaps / questions

1. **Mobile web or native** (pack README). Assumed: mobile layout of `apps/elktours`. Does the desktop keep the old design, or the mobile layout centred?
2. **Booking model (05, 06):** no min-guests, cutoff, waitlist, "closed" state on `tour_departures` (migration 208: capacity/status only). In-page Card/Apple Pay step vs the current Stripe-hosted redirect. Cancellation policy text has no home.
3. **Tour `type` (03)** and per-tour hero `lead` (04) are new metadata fields.
4. **Starred places by guide, place kind/area/hours/website (13, 14, 01, 10)** are new (tags exist). No public place read: `/api/surfaces/place/[id]` and `place-popup.tsx` are editor-only with private notes, so the public sheet needs a new surface and a public-fields read (`getPublicPlace` exists).
5. **Artists:** no public artist page; `craft`/`area`/works/availability and the status labels are not modelled; identity today is `experience_people` + ArtDirect URL. Build `/artists/[slug]` here or link out?
6. **Local Artists (11)** needs a unified guides+artists read.
7. **Guides' Feed (16, 17):** no feed-post feature with review/public/declined, link posts, or comments shared with forum topics. Which `org_feeds` row backs it, and does a forum "Feed" section exist?
8. **Suggest (15):** existing `VisitorSuggest` is map-pin and follower-only; the design is an artist/place form with URL + optional email, no login. New table or extend migration 239?
9. **Forum (19-22):** confirm in forum-ui: sub-sections (migration 163 exists), per-topic visibility + invitees, role-restricted closed section, link + media attachments. Forum is a shared server-rendered package: restyle in the package or via `.gf-page` overrides in this app? Other apps share forum-ui.
10. **Two catalogue components** (`components/places/place-catalogue.tsx` 233 lines, `places-catalogue.tsx` 204 lines); `app/places/page.tsx` imports `places-catalogue`. Confirm the other is dead before restyling.
11. **`/about` is a static route** and beats the page-builder fallback; making About a Puck page means changing that route.
12. **Route preview on phone (04):** `tour-story.tsx` mounts the map only at `min-width: 900px`; the pack's live 3D route with stop chips needs `RoutePreview` (`components/tours/route-preview.tsx`) driven by the timeline state. Check performance on phones.
13. **Heart/saved tours (04):** no persistence exists; client-only or tied to `app/api/center/follow`?
14. **Web view (18):** blocked-iframe fallback (open in browser vs server-rendered preview card).
15. **In-place edit:** tour page has an edit bar for editors, experience page does not; keep the tour bar on the mobile layout?
