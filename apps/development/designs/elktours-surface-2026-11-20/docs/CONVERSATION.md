# Conversation log: decisions, in order

A summary of this design session (not a verbatim transcript), for whoever picks the work up.

## 1. Look at cms-ui / Surface UI first
- **Ask:** look into cms-ui and Surface UI, how apps/sunjay uses them (page, popup, card), and show their variations before designing. The goals in view were business/place cards (map, link, description) and a mini card form for an expandable list.
- **Done:**
  - Read `packages/cms-ui/src/surface/*`, hubsite, wizard, sunjay `globals.css` and `hub/page.tsx`, and the elktours globals, hub, place popup, business card and catalogue.
  - Built the **specimen** (docs/01).
  - Delivered a first handoff (the specimen only).
- **Findings:**
  - The danger colour fails contrast on the dark card.
  - Places have no kind.
  - No maps in faces or surfaces.
  - `/hub` uses link cards, not faces.
  - Two label voices (mono kickers vs opacity text).

## 2. Forms and a Create Tour wizard (the owner's brief, summarised)
The hub cards should open popups "the surface ui way".

**Hub cards:**
1. Offer personal availability.
2. Offer a tour: pick a tour and a day/time. It goes straight to `/tours`, which **only shows tours with published start times**. A calendar for adding start times is planned.
3. **Create a tour:** a wizard, back and forth, saved as a draft. Description → Route → Details.
4. Add an experience: **"coming soon" card**.
5. Add a place: pin, suggested search, or custom with a photo. Published places show their creator but don't belong to them.
6. Personal takes on a tour: a guide's own notes shown on their departures, beside the canonical notes.

**Create a tour, step by step:**
- **Description:** city (Paris default), title, one-line summary, meeting point by **pin drop** (not lat/lng). Price, cover and language stay as on `/tours/new`.
- **Route:** the start is stop 1, and a raw pin can become a place via a small popup. A map with the meeting point in the middle and places around it; click a place to read it and add it. Or "New place": drop a pin and get a suggested name and address (accept, ignore or overwrite). Each stop is a collapsed row that opens a place card with notes, media and duration. Then a "confirm route" row where you draw the likely walking path.
- **Details:** a preview of the tour page, media order, captions per stop, alternative media per place.

**Other notes from the brief:**
- Private notes are credited to their author and visible to all guides.
- The link field is auto-filled for establishments with a public website.
- Also wanted: an owner-level "remove" for cancelled bookings on `/schedule`.

**Done:**
- **Surface Forms** (docs/02).
- **Create Tour Wizard** prototype with the hub, wizard, Create place, real map and draft save (docs/03).

## 3. The hero artifact
- **Brought in:** a Claude-made "Hero combined (1 + 4 + 3)" artifact (mini cards as stop thumbnails) plus an agent's notes. Those notes covered: photos first with Street View as a button; a narrative card (text left, picture right); a tour bar with Book; a details panel that grows over the narrative; a strip of mini cards; the film and 3D map load on press; a new stop narrative field.
- **Their open questions:** does the route section below the hero stay? Which email goes in the booking boxes? The waiting rebuild. New database fields (need owner approval).
- **Asked:** redesign it with Surface in mind; maybe a "herohybrid" mode or a wide-and-slim frame.
- **Done:** **Tour Hero Stage** as `SurfaceStage`, the surface docked into the page (docs/04). The owner liked the function and proportion and asked to bring it closer to Surface; that's done.
- **Phone version** made as a separate file at the owner's request (the desktop file was left as it was).

## 4. Below the hero
- **v1:** a long page plus a mid-scroll state.
- **Owner's direction:** stage → (full-page snap) → an **index** screen that suggests there's more → free scroll through everything.
- **Typography change:** **no more Brothers**; Basteleur Moonlight for text, a bolder Basteleur for titles, Venture still for labels.
- **v2 built** (docs/05).
- **Then:**
  - remove the "swipe for the practical part" hint;
  - add a **way back to the tours list or home**, small but obvious, in the foot;
  - start a **lighter theme**: Parisian blue and white, keeping some of the yellow (docs/06).

## Open items
- The light theme needs the owner's reaction before it becomes the site palette.
- Switch Brothers → Basteleur in the specimen, wizard and hero files.
- Faces not wired in the prototype: Offer availability, Offer a tour (calendar for start times), Personal takes.
- Owner-level "Remove" for cancelled bookings on `/schedule` (fix the danger token first).
- The `/hub` vs `/manage` split, and whether the desktop hub replaces the phone back-office.
- Database fields: stop narrative, place author-credited private notes, place link.
- The booking email and the "waiting rebuild" (from the hero hand-off).
