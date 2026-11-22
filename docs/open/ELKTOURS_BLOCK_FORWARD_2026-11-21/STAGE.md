# STAGE: the phone stage, opened up for workshops (lane STAGE, 2026-11-21)

## For Justin, in plain words

**What the stage is made of today.** On a phone, a tour page opens on a stage. It has five parts:
1. The **hero**: the whole-tour face (a picture, the opening line, "Start with stop I").
2. The **walk**: one face per stop, swiped or tapped, each with a picture band, a line about the stop, the guide's take, and "min walk to the next".
3. **Stop media**: the stop's own pictures, then the place's, then a live Street View.
4. **Place cards**: the small sheet for the place a stop is at (address, opening hours, website, Wikipedia).
5. The **dock** at the bottom: the strip of faces, the **Book** button, and the **index** (What to expect, The route, Dates & times, Meeting point, What's included, Your guide, Good to know).

**What is only about tours:** Street View, walking minutes, the route length, the map pins, the meeting point, "Place", "Stop IV", "Book this walk", "Your guide". **What is general:** an ordered list of steps, each with words, pictures and one linked thing; one big button; a few side sections; a list of dates.

**How a workshop would use it.** Same stage, different words and different attached things:
- Stops become **sessions** ("Session 3"), each with its topic, its length, its pictures or recording.
- Place cards become **materials**: the handout, reading or link that belongs to that session.
- Book becomes **Join** (the link to the room or call). Today the join link is only given to people who have signed up, are hosts or are editors; the stage would show "Join" only to them and "Reserve" to everyone else.
- "Your guide" reads "Your facilitator". The words come from a small table, one row per kind, so nobody edits code to say "Session".

**What you would be able to set** (few, because the block works most out for itself): which words to use (left on "from the page", it picks Tour or Workshop by what the page is about), whether the index shows, what the big button says, and the settings the hero stage already has (opens on, first tab, where stop pictures come from, strip, height, line length, hide a stop).

**What I did and did not do.** I wrote the neutral shape, the word table and the tour converter as new files, and proved that converting a real tour into the neutral shape and back gives exactly what the phone index gets today, for all 8 published tours. Nothing a visitor sees has changed and no stage component was touched. A workshop needs real work before it can use this (see "What a workshop lacks").

---

## 1. The stage as it is

Files (read, not edited): `apps/elktours/src/components/tours/stage/` (`tour-stage.tsx` desktop and popup, 715 lines; `phone/tour-stage-phone.tsx`, 678; `phone/index/data.ts` with `buildModel`; `types.ts`), data from `lib/tour-stage-data.ts` (`loadTourStageData`) through `lib/tour-page-data.ts` (`loadTourPageData`) into `TourPageData.stage`, read by the components through `useTourPage()`.

Two data shapes feed it:
- `TourStageData` (per stop: `StageStopData`: id, number, numeral, title, narrative, stopPhotos, placePhotos, cover, streetView, place, walkMinutesToNext, takes, durationMinutes; for the whole: tourLede, overviewPhotos, tourTakes, guidePhotos).
- `buildModel(page, chosenDepartureId, now)` -> `IndexModel` for the phone index: the stops again, plus dates (`deps`), the date in view (`selected`), facts, map pins, meeting point, includes, guide, notes, and the `sections` list with their titles and teasers.

Words are hard-coded in the components and in `buildModel` ("Stop IV", "Place ·", "Place page →", "Book", "Book this walk", "The walk", "Overview", "About this tour", "Your guide", "min walk", "min here", "Time here", "No pictures for this stop yet", the section titles and teasers, "TOURS").

## 2. The neutral model

`apps/elktours/src/lib/stage-model/types.ts` (`StageModel`):

```
StageModel
  kind           "tour" | "workshop"            picks the vocabulary row
  steps[]        StageStep: id, number, marker, title, narrative(+from,+isFallback),
                 media {own[], related[], cover, live}, card, travelToNext, minutes, voices[]
  occasions[]    StageOccasion: id, day, date, time, host, hostId, availability, full, note, label
  selectedId, selectedIsNext, moreOccasions
  action         {kind "book"|"join", priced, priceLabel, href}
  headlineFacts, aboutFacts, summary, highlights, extent, pins[], gathering, gatheringHelp
  included[], host{name,photo,sub,voice}, notes[], goodToKnow[]
  sections[]     {id: about|sequence|occasions|gathering|included|host|notes, n, title, teaser}
StageCard        id, slug, title, where, summary, link, links[], when, by, cost
```

Generic parts, as Justin named them: **sequence** = `steps`; **step media** = `steps[].media` (two lists of references `{url, caption, alt, credit}` plus a cover and an optional live view); **attached cards** = `steps[].card`; **primary action** = `action`; the dates are `occasions`; the words are not in the model at all (below).

### Tour adapter, field by field (`tourToStageModel`, and back with `stageModelToIndexModel`)

| neutral | today (`IndexModel` / `StageStopData`) |
|---|---|
| steps[] | stops[] (`numeral` -> marker, `stopPhotos` -> media.own, `placePhotos` -> media.related, `streetView` -> media.live, `place` -> card, `walkMinutesToNext` -> travelToNext, `durationMinutes` -> minutes, `takes` -> voices) |
| card (where, summary, link, links, when, by, cost) | `StagePlace` (address, excerpt, website, links, hours, businessName, ticket) |
| voices (personId, personName) | `StageTake` (guideUserId, guideName) |
| occasions[] (host, hostId, availability) | `deps[]` `DepRow` (guide, guideUserId, left) |
| selectedId / moreOccasions | selected / moreDates |
| action {priced, priceLabel} | priced, priceLabel |
| headlineFacts / aboutFacts | keyFacts / expectFacts |
| extent | km |
| pins[] | mapStops |
| gathering / gatheringHelp | meetingPoint / meet |
| included | includes |
| host {voice} | guide {take} |
| notes | know |
| sections (ids generic) | sections (`expect, route, dates, meet, incl, guide, know`) |

The forward adapter recomputes every field from `TourPageData` using the vocabulary (it does not call `buildModel`), so the check below proves the vocabulary holds today's exact words.

### Vocabulary table (`vocabulary.ts`)

| word | tour | workshop |
|---|---|---|
| step | stop / stops | session / sessions |
| step marker | Stop IV | Session IV |
| attached card | Place (kicker "Place", link "Place page →") | Material (link "Open material →") |
| whole-thing face | The walk (Overview) | The sessions (Overview) |
| start / end lines | Start with stop... / The end of the walk · back to the overview | Start with session... / The end of the workshop · back to the overview |
| about | About this tour | About this workshop |
| no media | No pictures for this stop yet | ...for this session yet |
| live view | Street View | Recording |
| travel | N min walk | (none) |
| time in step | Time here / N min here | Length / N min |
| action | Book / "Book this walk" (join: Join) | Reserve / "Reserve a place" (join: Join / "Join this workshop") |
| host | Your guide (· and their take) | Your facilitator (· and their note) |
| back link | TOURS | WORKSHOPS |
| sections | What to expect, The route, Dates & times, Meeting point, What's included, Your guide, Good to know | ..., The sessions, ..., Where we meet, ..., Your facilitator, ... |

## 3. Workshop adapter, sketched against the real tables

Read with `\d` (read only): `threads` (title, body, scheduled_at, duration_minutes, location, meeting_url, attendee_limit, price, currency), `workshop_pages` (subtitle, description_short, level, language, session_count, session_duration_hrs, recurrence_label, location_address, registration_url, registration_status, registration_deadline, cover_image_url, gallery_image_urls, promo_video_url, hero_media_url), `workshop_sessions` (thread_id, session_number, topic, scheduled_at, duration_minutes, notes jsonb; 7 rows on the platform), `series_sessions` (a series thread with one thread per session: number, starts_at, status), `workshop_join_requests` (pay-and-join requests), `booking_offers` / `booking_slots` (keyed by thread), `lms_workshop_listings`. Types in `packages/cms-bindings/src/workshop/types.ts` (`WorkshopPageData`, `WorkshopSession`). Join-link rule in `packages/services/src/join-link.ts` (`mayReceiveJoinLink`).

| neutral | workshop source |
|---|---|
| steps[] | `workshop_sessions` ordered by `session_number` (or `series_sessions` for a series, one thread each) |
| step title | `"Session N"` + `topic` |
| narrative | `notes` jsonb (if it holds a summary) else null; no per-session body column exists |
| media.own / related / cover | none per session; related = the workshop's `gallery_image_urls`, cover = `cover_image_url` |
| media.live | `promo_video_url` / a recording (no table) |
| card | a material (no table; see below) |
| travelToNext | null |
| minutes | `workshop_sessions.duration_minutes` else `workshop_pages.session_duration_hrs` x 60 |
| occasions[] | `booking_slots` of the workshop's offer (dates with capacity), else the sessions' `scheduled_at` |
| action | `registration_url` / `registration_status` and price from `threads.price`; kind "join" only when the viewer passes `mayReceiveJoinLink`, with `href = meeting_url`; otherwise "book" through the existing booking offer |
| headlineFacts | level, language, session_count, session_duration_hrs, price (`price_member`, `price_sliding_min`) |
| gathering | `location_address` / `location`; no lat/lng |
| host | the thread author's artist profile (`facilitator_name`, `facilitator_photo`) |
| notes / goodToKnow | `accessibility_notes`, `sliding_scale_note`, `author_note` |

**What a workshop lacks that the stage needs:** (1) a **materials** table (nothing exists for workshops; `reading_resources` belongs to reading circles' units and `forum_attachments` to posts; the nearest honest start is a `workshop_materials` table of session_id, title, kind, url or media id, position, shaped like `reading_resources`); (2) **per-session media** (no asset table like `tour_assets`; MEDIA's model should cover it, keyed by a session instead of a stop); (3) a **per-session summary** line (only `topic` and a free `notes` blob); (4) **voices**, the facilitator's note per session (tours have `tour_guide_takes`); (5) one place that says which dates a workshop is offered (a thread has one `scheduled_at`; offered dates live in `booking_slots`, series in `series_sessions`: the adapter has to pick); (6) a position for sessions, only if a workshop is on a site and wants a map (not needed).

**What the stage has that a workshop would not use:** Street View and its still, walking minutes and the route length, map pins, the place-linked picture fallback ("stop then place"), the meeting point's coordinates and Google directions link, the guide-take-at-stop idea, the Roman-numeral markers (a workshop may prefer plain 1, 2, 3).

## 4. The stage as a smart block (description only)

The block already exists as `TourStage` (`apps/elktours/src/blocks/tour/config.tsx`, hero stage). Its `def.id` must not be renamed (stored in page JSON). The open version would be a shared record block, in the family of `record-header` / `record-body` / `checkoutBlock(host)` (`packages/blocks/src/blocks/record-parts.tsx`), with a new id (for example `record-stage`), leaving `TourStage` working until pages are moved.

```
id:          record-stage            (new; TourStage stays as is)
description: "A walk-through of the page's thing, one step at a time (stops of a tour, sessions of a workshop), with
              its pictures, the small card for each step, a date list and one big button."
reads:       [ { from: "route",  what: "record", kinds: ["tour", "workshop"] },   // the record in the address; its kind picks the words
               { from: "site",   what: "org" },                                   // which organisation's places, bookings and photos
               { from: "viewer", what: "role" },                                  // edit marks for the guide; join link only for those who may have it
               { from: "viewer", what: "signed-in" },                             // "Join" vs "Reserve"
               { from: "flow",   what: "booking" } ]                              // the Book sheet and the chosen date
settings:    words        "from the page" (default) | Tour | Workshop             // overrides the vocabulary row
             showIndex    yes/no (default yes)
             actionLabel  text, empty = the vocabulary's word (Book / Reserve / Join)
             + today's: startAt, lead, media, showStrip, height, narrativeMax, perStop (stop squares)
no setting for: the record (the address gives it), the organisation, the dates, prices, any wording that is in the vocabulary.
```

Who names what with TEMPLATE (posted on the board): the stage's big button is the **primary action**; TEMPLATE's Booking options block owns the dates list and booking form content that the Book sheet shows. The stage's **attached cards** are the small sheet for one step; TEMPLATE's Map / locations block owns the page's map and place list.

Needs from MEDIA: step media stays as references `{url, caption, alt, credit}`, two lists per step (the step's own and the linked thing's) plus a cover; if the reference shape changes, only `stepOf`/`stopOf` in the adapter change.

## 5. What I built

New files only, nothing under `components/tours/**` touched, no component rewired, nothing a visitor sees changes:
- `apps/elktours/src/lib/stage-model/types.ts` (neutral model)
- `apps/elktours/src/lib/stage-model/vocabulary.ts` (tour and workshop rows)
- `apps/elktours/src/lib/stage-model/tour-adapter.ts` (`tourToStageModel`, `stageModelToIndexModel`)
- `apps/elktours/src/lib/stage-model/index.ts`
- `apps/elktours/scripts/check-stage-model.mts`

Check (reads only, run as given in the brief): 51 passed, 0 failed. For each of the 8 published tours (heritage-de-napoleon-bonaparte 6 stops, french-revolution-bastille-to-invalides 7, parisian-food-tour-rue-montorgueil 5 stops (also with its 2nd date chosen), montmartre 11, the-marais 17, the-latin-quarter 17, legends-symbols-saints 7, discover-the-heart-of-paris-ile-de-la-cite 9): `JSON.stringify(buildModel(...))` equals `JSON.stringify(stageModelToIndexModel(tourToStageModel(...)))` byte for byte (8,696 to 24,732 bytes each), also equal with keys sorted; the neutral model survives a JSON round trip; its section ids are generic. Vocabulary checks: counts ("1 stop", "3 sessions") and that the workshop row has every key of the tour row.

Note: a first run with plain `listTours()` returned only 2 tours (the ones with open dates, as far as I can tell; not investigated); `listTours({ includeDrafts: true })` returned 8 tours, all with status published. I used the latter.

Type-check `apps/elktours` (`pnpm check-types`): before 0 errors, after 0 errors.

## 6. Next step and risks

Next: rewire the phone components to read `StageModel` + `vocabularyFor(kind)` instead of `IndexModel` and hard-coded words, one component at a time, each held to the same byte check (the stage components are Justin's, so this waits for his session to be done). Then a workshop adapter, which needs the materials table and per-session media first.
Risks: (a) the tour adapter duplicates about 100 lines of `buildModel`; until the components move, a change to `buildModel` must be mirrored (the check will fail loudly if it is not); (b) the desktop stage and the stage popup read `TourStageData` directly and are not covered by this index check; (c) some words (index fact labels "Walk", "Pace", the "Note ·" and "Contact" lines) are still literal in the tour adapter, not in the vocabulary; (d) the join link must only be filled on the server for people allowed to receive it, never sent to the browser for others.
