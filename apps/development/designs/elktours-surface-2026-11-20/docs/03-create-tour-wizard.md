# 03 · Create a tour (wizard) + Add a place

File: `designs/Create Tour Wizard.html` (plain HTML + Leaflet 1.9.4, OSM tiles, Nominatim reverse geocoding with an offline fallback). Sources it replaces or extends: `apps/elktours/src/components/manage/{tour-form,stops-editor}.tsx`, `components/places/{place-catalogue,place-details,location-creator,pin-map}.tsx`, `app/hub/page.tsx`.

## Hub
Bands of `SurfaceCard`s:
- **Run tours:** Offer availability (calendar ▦), Offer a tour (event ◆), Personal takes (post ◉).
- **Make tours:** Create a tour (proposed `tour` kind, brass, glyph ⌖), Add a place (proposed `place` kind, #8fb3c4, ⊙), Add an experience (`disabled`, "Coming soon.").

The Create a tour card shows draft progress (3 segments, title, step, saved time, "Resume").

## Wizard surface (size full, 1180; height min(88vh, 860px))
Head: glyph ⌖, kicker `‹ Hub · New tour · [Draft]`, title = the tour title or "Untitled tour", ✕ (closes and keeps the draft). Steps strip = 02a. Foot: status "Draft saved HH:MM", buttons Save & close (quiet), Back, Next: {step} / Save tour (primary).

### 1 Description (main + 340px rail)
- **City:** Paris preselected, "Another city" disabled ("appear here once the office lists them").
- **Title:** large field, max 80.
- **One-line summary:** max 140, with a counter.
- **Description:** rich text, optional at this stage.
- **Meeting point:** a 300px map. Click to drop a pin, or click a catalogue dot to choose that place; the pin is draggable. Readout: "1" badge, name, address, then either "from the catalogue" or "lat, lng · a pin, not a place yet" with a **Save as a place** button (stacked Create place surface). Nearby places appear as chips. The meeting point becomes stop 1.
- **Practical** (kept from /tours/new): cover image, Price per person (EUR prefix; empty = "price on request"), Max per booking, Length (fields.css duration slider, 30–300 step 15, plus a number), Languages (pills), Walking.
- **Rail:** a preview of the public TourCard ("Dates coming"), the note "stays off /tours until a date is offered", and a checklist (title, summary, meeting point, 2+ stops).

### 2 Route (flush map + 390px rail)
- **Map modes** (segmented control, top left):
  - **Browse.** Click a catalogue dot to open a popup with distance from the last stop, description, tags, author and private-note count, plus Close / Add as stop N.
  - **New place.** Click the map to drop a pin. The popup gets a suggested name and address ("suggested" badges, editable or clearable), then Cancel / Add as stop N.
  - **Draw path.** Clicks add vertices in #e8805c; clicking a stop snaps to it. Undo point / Clear / Done.
- **Rail list (02-1f):**
  - Stop 1 is the start.
  - Each stop row opens to show:
    - the place card (address, tags, added by, link);
    - private notes credited per author;
    - Notes for this stop;
    - Time here (0–60 step 5);
    - Media thumbnails plus Add;
    - Earlier / Later / Remove.
  - **Add a stop** lists the 5 nearest to the last stop and draws dotted lines to them on the map; there is also "New place on the map".
  - **Confirm route** shows totals (stops, walking distance, time), the path status and a confirm checkbox. With no drawn path, the walk is estimated at 1.3 × the straight lines. Time is walk / 75 m per min plus the stop durations.
- Markers: catalogue dot 16px with a #8fb3c4 ring; stop 28px brass square with its number (the start has a ring); dashed ivory straight lines; drawn path #e8805c, 4px.

### 3 Details (preview + 340px rail)
- **Preview:** `/tours/{slug}`: cover, title, lede, facts (Meets, Length, Walking, Price, Languages), highlights, a static route map, then the stops.
- **Each stop in the preview:** the shown media, alternative thumbnails, an **inline caption (1c)**, the notes or "Write them on Route", and a dashed "Guide's take" slot.
- **Rail:** stop chips, then a media list with caption, role ("Shown with the stop" / "Alternative n") and ↑ ↓ ✕, plus Add media. "Tour page extras": Highlights, What is included.
- **Save tour** validates title, summary, meeting point and ≥2 stops (the strip flags missing steps). It then pushes a compact "Tour saved" surface: "It stays off /tours until a date is offered", with Back to the hub / Offer a date.

## Create place surface (standard 640; stacked from the wizard or standalone from the hub)
- Map with a draggable pin.
- **Name** and **Address**, both "suggested" from reverse geocoding.
- **Public description**, **Tags** (pills).
- **Link**: auto-filled from the establishment's website when OSM has one.
- **Private note**: "every guide can read it, credited to you".
- Foot: "The place joins the catalogue. You're credited; it isn't yours to delete." Cancel / Save place.

## State (draft)
Draft fields:
- `step`, `city`, `title`, `summary`, `body`
- `meeting {placeId|null, title, lat, lng, address}`
- `cover`, `price`, `length`, `maxParty`, `languages[]`, `effort`, `highlights`, `includes`
- `stops[] {uid, start?, placeId, title, lat, lng, address, notes, duration, media[] {id, label, caption}, open}`
- `path[[lat, lng]]`, `routeConfirmed`, `savedAt`, `status draft|ready`, `customPlaces[]`

The prototype autosaves to localStorage after 600ms; production should save through a server action. Places keep author-credited `notes[] {by, text}`.

## Known prototype limits
In sandboxed previews OSM may return "Access blocked" tiles (a referrer issue). Production should use the app's existing map setup.
