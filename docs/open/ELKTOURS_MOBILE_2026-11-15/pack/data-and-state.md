# Data, state and rules

The prototype keeps everything in one in-memory object (`window.__elkStore` in `Elkdonis App.dc.html`) so the phones stay in sync. In the real app each part is server data. This document lists the entities, how each one is believed to map to `eac-repo`, and the rules the UI depends on.

**Confidence.** "In repo" means the designer read that file. "New" means nothing matching was read; check the repo before adding a table or column.

## Entities

| Prototype | Shape | Maps to | Confidence |
|---|---|---|---|
| `TOURS` | id, title, type, mins, km, price, min, max, cutoff, langs, guide, meet, blurb, stops[] | Tour thread + `tour_stops`; read via `apps/elktours/src/lib/tours.ts`, drawn by `blocks/tour/blocks.tsx` | In repo |
| `deps` (slots) | tour, day, time, guide, booked, min, max, cutoff (hours), mins, price, wl, wlCap, wait[], status, manifest[] | `tour_departures`, one row per dated departure; `components/manage/departures-panel.tsx`, `schedule-planner.tsx`, `repeat-scheduler.tsx` | In repo |
| Bookings | name, party, note | `components/tours/booking-form.tsx` and its API | In repo |
| `exps` | title, artist, kind, format, place, mins, group, fee, feeUnit, priv, status, strange (pitch), body | A thread of kind `experience`; the artist in `experience_people`; `components/experiences/*`, `manage/experience-form.tsx` | In repo (per `docs/open/ELKTOURS_EXPERIENCES_SPEC_2026-11-02.md`) |
| `links` | tour, stop index, exp | `tour_stops.experience_id` | In repo (spec) |
| `invites` | departure, exp, status: proposed / accepted / declined | A `service_commissions` row per date: asked / confirmed / declined | In repo (spec) |
| `artists` | name, craft, area, about, works[], avail | Artist profile; public page on ArtDirect | Partly; **availability grid is new** |
| `media` | per tour: film, map3d, cover, gallery, stills (booleans), lead | `TourAsset` rows with a `visible` switch; kinds `film`, `poster`, `image`, `still`, `map3d`, `streetview`, `document`; role `gallery` (`manage/asset-panel.tsx`, `lib/catalogue-types`) | In repo, except **`lead` is new** |
| `flyReq` | tour → requested | A fly-over render request (`renderRequestId` on the asset) | In repo (field seen) |
| `places` | name, kind, area, addr, hours, blurb, site, biz, fav, by (guide), tags[], optional tour + stop | Places catalogue (`lib/catalogue-types`, `PlaceBusinessSummary`, `stops[].placeId`) | Catalogue in repo; **`tags`, `fav`/featured and "by guide" are new** |
| `posts` (feed) | kind post / link, by, title, body, src, status review / public / declined, comments[] | A thread authored by a guide, published by an editor; shown through the forum's Feed section | **New as a feature**; threads and draft/published status exist |
| `forum.threads` | sec, kind, by, vis, with[], title, body, link, media[], replies[] | `@elkdonis/forum-ui` (`renderForumRoute`, `serviceConnectors`, `forumSnapshot`), `SurfaceForum*` types in `packages/cms-ui/src/surface` | Forum in repo; see "Forum" below for what is new |
| `forum.read` | thread id → read | The forum's unread tracking (`unreadCount`, `markAllRead`) | In repo |
| Suggestions | kind, name, url, why, email | A contact/enquiry record for the office | **New** |

## Rules the UI depends on

**Slot state** (`stateOf` in the prototype). `close = start − cutoff hours`.
- Cancelled → "Cancelled · guests refunded".
- Ended → "Finished".
- Before `close` → open. Shows "Booking closes in …" and either "Minimum reached" or "N short of the minimum". Full slots take waitlist joins while the waitlist has room.
- After `close` with booked ≥ min → "Confirmed".
- After `close` with booked < min → depends on a site setting:
  - **Guide decides** (default): state "Needs your call"; the guide runs it, reopens booking, or cancels and refunds.
  - **Auto-cancel**: cancelled and refunded automatically.
- Guest-facing rule text is generated from the same setting and shown on Dates and Pay.

**New slots.** A candidate slot is blocked if it overlaps another slot of the same guide that day, or if its booking close time is already in the past.

**Waitlist.** When a place frees up before close, the guide offers it to the first in line; accepting moves them into the manifest.

**Experience on a stop.** Arrival time at a stop = tour start + (duration × stop index ÷ number of stops), rounded to 5 minutes. An artist is "free" if their availability grid has that weekday and part of day (before 12:00 morning, before 17:00 afternoon, else evening). Linking an experience to a stop creates one invitation per upcoming date the artist is free. Guests only see an experience on a stop when the experience is public; the experience page lists only dates the artist has accepted.

**Experience status.** review → public / members / draft ("sent back with notes"). Only the office changes it.

**Tour hero.** Available kinds, in fallback order: `film` (a film exists and is on), `map3d` (on, and stops are placed on the map), `photos` (cover and/or gallery on). The page opens on the guide's `lead` if it is available, otherwise the first available. This extends the current rule in `TourFilmBlock` (film → route preview → cover) with a guide choice. The film must always be shown whole, never cropped (Map Tiles attribution). The 3D map mounts only when the guest presses play, as `RoutePreviewLauncher` does.

**Places.** A place's tags are free text. The catalogue's filter chips are All, Favourites, then every tag in use ordered by how many places carry it. Starring a place features it on Discover and on the starring guide's profile.

**Feed.** Guide submits → status `review` → office confirms (`public`) or declines. Office posts skip review. A public post appears in three places backed by one record: the Feed row and page on Discover, the author's guide profile, and the forum's **Feed** section as a public topic. Comments in the post preview and replies on the forum topic are the same list.

## Forum
Follow `ForumSurface.tsx` for structure and wording ("Sections", "Latest", "N topics have something new", "Mark all read", "Start a topic") and `kinds.ts` for glyphs. `apps/sunjay/src/lib/forum.ts` shows how a site scopes the forum to its org and resolves the viewer.

What the design adds or assumes — confirm each against `@elkdonis/forum-ui`:
- **Sub-sections**: a section may have a parent. Counts on a parent include its children.
- **Three visibility levels per topic**, chosen by the author and changeable later on their own topic:
  - Public — anyone can read, signed in or not; members reply.
  - Members — signed-in members only.
  - Private — the author and the people they add.
- **Closed section** ("Guides & artists"): visible only to guide, artist and office roles.
- **Attachments** on topics and replies: one link (shown as a card; opens in the in-app web view) and any number of photos or videos. Uploads should go through the existing `/api/upload` route (it already accepts image and video).
- **Roles shown on posts**: Guest, Guide, Artist, Office, each with its own ring colour.
- Topic kinds offered when composing: `post` (Discussion), `idea`, `event`.

## Client state (per screen)
Server data aside, the screens hold only this:

| State | Used by |
|---|---|
| Navigation stack | Back button on every non-root screen |
| Tours: filter chip, search text | Tours |
| Tour detail: saved, hero kind, map live / current stop / playing, film paused, gallery index, open stop | Tour detail |
| Dates: picked day, picked slot, party size | Dates, Pay |
| Pay: method | Pay |
| Discover: open guide card | Discover |
| Places: filter; open place sheet | Places, Discover, Tour detail, Guide profile |
| Local Artists: filter | Local Artists |
| Feed: open post sheet, comment draft | Feed, Discover |
| Web view: URL | Any link |
| Forum: section, topic, reply draft + pending media, compose draft | Forum screens |
| Board: role (session), week, day filter, guide filter | Board, Schedule |
| Forms: new slots, wizard, place edit, share post, suggest | Their screens |

## Validation
- Suggest: name, and a URL or a reason.
- Share a post: title and body; a link post needs a URL containing a dot.
- Place: name and area.
- Start a topic: title, body, and at least one person if private.
- Wizard: step I name (and an email with `@` for new artists); step II title, pitch, and a place unless online; step III at least one cell; step IV at least one of the two offers.
- Reply: text or at least one attachment.

## Not designed
Sign-in and account screens, artist payouts, the business profile for a place, notifications and email, empty and error states beyond the few noted, loading states, and any layout wider than a phone.
