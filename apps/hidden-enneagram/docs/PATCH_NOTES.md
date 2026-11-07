# The Hidden Enneagram: patch notes
> Your friendly neighbourhood patch log: what changed, why, and what it touched. Newest first.
> Guide to the editor and blocks: `docs/editor.md`.

## 2026-11-07 · Round 1 review fixes (preview)
- Home intro: drop capital off ("In" read as "I n"); the drop cap itself sits tighter (0.04em) where it is used.
- Figure: the Qualities step only looked faded mid-transition (the 0.3 s fade-in); settled, the text is #a8a294 on #10131e (about 7:1). Screenshot 22.
- Figure: the dossier id came from useId(), which differed between Puck's server render and the client (a hydration warning on / and /enneagram). It now comes from the block's own id (`idBase`).
- Studio: `card-grid` dropped from the catalogue. It and `grid` are both labelled "Grid" in the shared set; no stored page used it. katie and sunjay show the same pair.
- Booking checkout, params only (`scripts/booking-params.ts`, no Stripe call): the one-on-one reading is 12000 CAD, a destination charge to the thread author's connected account, application fee 0. The author is Guru Dharam Singh, not Ario.

## 2026-11-07 · Re-stand, round 1 (preview only; live not rebuilt)

### Thwip: the shell
- Header and footer now live in the root layout (`components/site-header.tsx`,
  `site-footer.tsx`, `data-chrome` + `data-part` for Site style). `SiteNav`/`SiteNavBar` are
  retired (removed from 9 pages); Silex pages keep their "Edit page" (Silex) as a floating button.
- Menu: The Figure, the org's feeds (as before), Course (Sophia), Forum, About. Collapses to a
  sheet under 1080px (an editor sees eight links).
- Account menu: Manage, Edit the site, Hub, Center, Channel, Account, Sign out.
- The layout's wrapper is a `<div>`, not `<main>`: most pages bring their own `<main>`
  (they did before), and studio pages draw theirs (`lib/puck/render.tsx`).

### Thwip: the house look
- Ario's ÆON draft is the house look: night ground with a faint gold/violet glow, warm ink,
  gold accent, gut teal / heart rose / head violet; Marcellus, Spectral, Chivo Mono
  (`lib/fonts.ts`, next/font). Tokenised in `app/palette.css`; Site style edits it.
- Replaces the 2026-09-09 light theme. The Silex pages were always dark, so the site is now one
  piece. All defaults keep the draft's measured contrast (ink 16.5:1, quiet ink 7.8:1, gold 8.2:1).
- The forum, /about, /services, /hub and /manage read the same shadcn tokens, so they turned
  dark with it.

### Thwip: the page builder
- `/` and `/enneagram` are Puck pages with code defaults (`lib/default-pages.ts`); `/studio`,
  `/studio/<slug>`, parts plugin, look panel, Edit-look popup, MorphMark, Site style.
- `[page]` order is now studio page -> Silex page -> feed -> 404, so a Silex page moves into the
  builder by publishing at its address.
- Blocks: Opening (`he-hero`), Passage (`he-passage`), The Figure (`he-enneagram`), Course card
  (`he-course`).

### Thwip: nothing Ario wrote is lost
- The Silex home's two sections ("What is the Enneagram?", "Core Fixation") are carried into
  DEFAULT_HOME verbatim, with its chapter buttons as links. The Silex index page itself is
  untouched in Nextcloud; it is just no longer drawn at `/`.
- Not carried: the line "Read more on the Enneagram of Process" (plain text on the Silex home,
  not a link; nothing to point it at). Add it back as a link when there is a page for it.
- The hero copy is the ÆON draft's; the eyebrow is the site copy's ("A map of nine fixations").
  The site copy's hero subtitle ("Formative developmental imprints …") stays the meta description.
- About: the site copy's about section is a Passage on the home page; `/about` is unchanged.

### Thwip: the Figure
- `~/aeon-enneagram/js/aeon.js` + `content.js` ported to React (`components/aeon/*`): four
  lenses, stress and growth lines, wing arc, the five-step dossier, arrow keys round the circle,
  `#type-N` deep links. The draft's edit mode (localStorage) is not ported: the studio replaces it.
- `/triads`: its top diagram is now the new figure (Object-relation lens, wheel only) with a link
  to The Figure; its triad sections and the centres diagram are unchanged.
- `/type-1` … `/type-9` stay the Silex pages (Ario's published dossiers); each dossier in the
  Figure links to its type page.

### For Justin and Ario to rule on: wording differences (ÆON wording used in the Figure)
| Where | ÆON draft (used in the Figure) | Live site / older repo |
|---|---|---|
| 3-6-9 triad | Attachment (=) | "3-6-9 Harmony" (/triads heading "The Harmony Triad"; the old diagram's toggle). The live type pages already say "Attachment (=)". |
| First centre | Gut (8-9-1), "Energy of the Body" | Body (repo data; the live home says "Body, Heart, Head") |
| The three lenses | Object relation · Energy style · Attitude style | "Object Relation, Energy Orientation, Harmonic Style" (live home, carried verbatim into Core Fixation) |
| Polarity marks | (+) (−) (=) on every triad | none |
| Keywords | none | four per type (kept: shown in the Figure's summary) |
Nothing on the Silex pages or /triads was reworded.

### Thwip: back office and network
- `/manage` on `@elkdonis/cms-ui/manage`: tabs Content, Orders, Contacts, Newsletter (was
  unlisted), Pages (new), Site (new), Visitors. PageHeader on Content, Orders, Contacts.
- Fixed: no sonner `<Toaster>` was mounted anywhere, so every toast in /manage (confirm order,
  archive, save, media upload) was silent. Mounted via `components/manage/manage-toasts.tsx`.
- Fixed copy: Contacts said "Pages are built with the Silex editor"; now names the page editor.
- `/center`: sunjay's full Center + `/api/center/*` (byte-identical copies; `getApiMember`
  added to `lib/auth.ts`). Its heading takes the house ink (the kit's cards keep their own hand).
- `/channel`: katie's redirect to the network console. `/hub`: Rooms cards.
- Bookings and Stripe: untouched (`services/*`, `api/checkout/return`).

### Thwip: plumbing
- `package.json`: + `@elkdonis/blocks`, `@elkdonis/direct-edit`, `@elkdonis/page-builder`,
  `@puckeditor/core 0.23.0` (installed via `docker compose run --rm install`; lockfile diff is
  these four lines only). `next.config.ts`: transpile those (+ analytics, redis); `127.0.0.1` in
  `allowedDevOrigins` (dev only).
- `docker-compose.yml`: new service `hidden-enneagram-preview` (profile `preview`, port 3024,
  `next dev`, own `.next` volume, live's env with dev mode and `NEXT_PUBLIC_APP_URL=http://localhost:3024`).
- `app/icon.svg` (the triangle in the three hues): the site had no favicon (404).
- `scripts/mint-session.ts` (katie's) + `.gitignore` for `.session-*`.

### Known rough edges
- Center's display fonts (`/fonts/Basteleur-*`, `BrothersTypeface`) 404 here, as on sunjay: the
  kit expects them in `public/fonts`. Falls back to system fonts.
- The About guide photo `/api/media/EAC_Network/inner_group/Profile Pictures/…` 404s (also on live).
- `/triads`: React warns of an attribute hydration mismatch inside the OLD `CentersDiagram`
  (float rounding; existing code, dev-only warning).
- The dev preview restarts itself near its 2 GB heap after many compiles; harmless.
