# The Hidden Enneagram: patch notes
> Your friendly neighbourhood patch log: what changed, why, and what it touched. Newest first.
> Guide to the editor and blocks: `docs/editor.md`.
## 2026-11-08 · Round 6: Puck-first (preview only; live not rebuilt)

### Thwip: articles are a template
- Every `/<feed>/<slug>` (e.g. `/writing/what-the-map-is-for`) is now the studio page `post` ("Article page" in the
  Pages tab, `/studio/post`; `DEFAULT_POST_PAGE` until published) around the new record block `he-post`: title,
  date, author, cover and text come from the thread; the back link (`← {feed}`), the label above the title
  ("Writing") and "Members only" are props. Same markup as before (ArticleView; the plain byline for other kinds).
- The route keeps its gates and metadata unchanged: unknown or locked feed, member-only post for a visitor, draft
  or unknown slug: 404; title, description, robots (noindex when not public), OpenGraph image. The resolver
  (`lib/record-blocks.ts` loadPostBlock) repeats the same viewer-aware read, so the block can never show more
  than the route allows. The page had no comments or forum link; none added.

### Thwip: person pages are a template
- Every `/about/<slug>` (e.g. `/about/aeon`) is now the studio page `person` ("Person page", `/studio/person`;
  `DEFAULT_PERSON_PAGE`) around `he-person` with its new Shape "The whole person page" (`layout: "page"`):
  getPersonPage as before (portrait from the Profile Pictures path, bio, posts and events in the org's order,
  drafts and empty notes only for the person). Back link, section headings and empty notes are props. The
  card on `/about` is untouched (no `layout` = card). 404 and metadata stay in the route.

### Thwip: the last Silex dependency is gone
- `/api/org/<org>/contact` now calls `lib/contact.ts` (the old shared handler, only what this route needs): same
  validation and messages, the `contacts` row (its stored `source` value kept as it was), the owner note by
  @elkdonis/email, and the same responses (201 `{ok:true}`; 400/404/500 `{error}`).
- `@elkdonis/silex-render` dropped from `package.json` and `next.config.ts`; `docker compose run --rm install`
  changed the lock only in this app's importer block (the three `@elkdonis/silex-render` lines).
- Silex mentions in `src/` removed; one line in `app/palette.css` still says where the house look came from.

### Thwip: tests
- tsc clean (throwaway container). Signed out, :3024 = live :3012 (status, main text, title, description,
  robots, og:image, images, links) for every thread of the org, unknown slugs and feeds, `/post`, `/person`,
  `/about/aeon` (portrait 200), `/about`, `/`, `/readings`, `/writing`, `/enneagram`. Signed in as Ario: the same,
  plus "Edit this page" on the two templates (as on service pages). Contact: validation and unknown-site
  responses identical on both; no message sent, no row written.
- Studio as Ario (session minted, then revoked; own Chromium on eris): both templates open, a framing field
  edited, the canvas follows, closed without publishing (site_config unchanged).
- Known: the templates sit in `<main class="he-content">`, so 24px more space above the footer than before
  (as on service pages).

## 2026-11-07 · Round 5: hub + cleanup (preview only; live not rebuilt)

### Thwip: the hub drops its Silex suit
- `/hub` no longer renders the Silex hub template ("Members" masthead, "What you can do" tiles). Gone with it:
  `lib/hub-template.ts`, `/api/silex/templates/hub.css`, the `.eac-hub` token block and the `feed-list.css` import
  (only the template's org-feed slot used it). The dev hydration mismatch on `/hub` went with the template.
- New `/hub` = innergathering's "Cards 2" in this site's look: quiet header (org name, "Signed in as …"), one grid.
  Cards: Publish (editors) · Readings & bookings · Forum (popup) · Chat · Calendar · Documents · Files · Whiteboard ·
  Pipeline (members) · Your page · Channel · Manage · Page editor (editors) · the course. Table in `editor.md`.
- Inner Work and Your bookings stay as quiet sections under the grid, each shown only when it has something:
  they are content (what is new, what you booked), not tools, and neither has a page a card could open.
- Pipeline has no Deck board yet: the card says "Not set up yet", and `/hub/pipeline` shows the kit's
  "Create the board" (editors). Nothing was created.

### Thwip: the kit, copied byte-identical
- From innergathering (= sunjay = amrit): `api/pipeline/*` (16), `lib/pipeline.ts`, `api/chat/{identity,messages,provision}`,
  `api/hub/{calendar,documents}`, `hub/pipeline/page.tsx`, `hub/documents/page.tsx`, `lib/auth.ts`.
- From sunjay (= amrit; whiteboard page also = ifac): `hub/{chat,calendar,whiteboard}/page.tsx`,
  `components/hub/{CalendarPageView,CalendarGrid}.tsx`, `api/hub/whiteboard/route.ts`.
- Re-pointed, not identical: `lib/{chat,pipeline}-api.ts` (logLabel only); `hub/files/page.tsx` (innergathering's
  without the framed Nextcloud Files, which `eac_embed` only allows on elkdonis-arts.org).
- Chat is sunjay's native Talk page, not innergathering's framed one, for the same frame reason.

### Thwip: who counts as a member
- `lib/auth.ts` is now the kit's: `isMember` = owner/guide/member, plus `isAffiliate` = any role. It used to be
  "any role", so every signup (a follower) passed `/api/center/files` and the member gates. Content reads that
  meant "any role" now say `isAffiliate` (`[page]`, `[page]/[slug]`, `api/hub/threads/[id]`): no visible change.
  The header's Hub link shows for anyone signed in (the hub page itself never required a role).

### Thwip: cleanup
- Removed: `[page]`'s Silex step, `lib/silex-pages.ts`, `app/edit` (now `/edit` → `/studio`, 307), `api/silex/*`
  (token, assets, `enneagram.css`, `hub.css`), `components/edit-page-button.tsx`, the `.he-silex-edit` CSS, the
  "Still in Silex" card on Manage → Pages, the Silex sentences on `/studio` and Manage → Contacts,
  `components/enneagram/*` (old EnneagramDiagram / CentersDiagram, the `/triads` hydration warning),
  `components/manage/media-field.tsx`, unused shadcn `components/ui/{card,input,label,select,separator,switch,tabs,textarea}`.
- Dependencies: removed `@elkdonis/cms-bindings`, `@elkdonis/nextcloud`, six `@tiptap/*`, `next-themes`; added
  `@elkdonis/chat`, `@elkdonis/pipeline`, `@elkdonis/primitives`, `@excalidraw/excalidraw` (install via
  `docker compose run --rm install`; the lock changed only in this app's importer block). Kept
  `@elkdonis/silex-render`: `handleOrgContact` (the contact form's route) lives there.

### Thwip: fixes
- Center display fonts: `public/fonts/` gets ifac's five files (Basteleur Bold/Moonlight woff+woff2,
  BrothersTypeface), byte-identical. `/fonts/*` 404 → 200.
- Toasts (Manage): the sonner wrapper read `var(--popover)`, a bare HSL triplet here, so toasts had no
  background; now `hsl(var(--…))`, theme fixed to dark (no `next-themes`).
- Borders: Tailwind 4 draws a bare `border` in the ink colour; kit pages (chat, pipeline) had near-white frames.
  A base-layer default (`border-color: var(--color-border)`) in `globals.css`.
- Passages and the other site blocks inside ANY column (Split, Tabs, Sticky…) fill the column instead of
  taking the page gutter again (`.blk :is(.he-hero, .he-passage, .he-fig-block, .he-course-block)`); this
  generalises round 3's Sticky-only rule. `/`, `/enneagram`, `/readings`, `/about` measure the same as before.
- Publish popup "double navigation": one document load, then StudioShell's `history.replaceState` added `org=`
  to the frame's address ~200 ms later. The frame now opens with `org=` already in it, so that write changes
  nothing. (StudioShell still calls replaceState unconditionally: a package note, not changed here.)
- `/account`: "booking history will live here" → points at the hub ("Open the hub →").

### Thwip: tests
- tsc clean (throwaway container). Signed-out route sweep on :3024 = live :3012 except the intended: `/edit` 307
  → `/studio`, `/api/silex/*` 404, `/hub/*` 307 → login, `/fonts/*` 200.
- Signed in as Ario (session minted, then revoked; own Chromium on eris): every hub card's page 200 with no
  console errors; Forum popup and Publish → chooser → Writing (Studio frame) open. Screenshots in
  `%TEMP%\.playwright-mcp\he-r5\`.

## 2026-11-07 · Round 4: Studio (preview only; live not rebuilt)

### Thwip: the network's Studio lives here now
- `@elkdonis/studio` is mounted on Ario's site at **`/publish`** (not `/studio`: that stays the Puck page
  editor, the katie/elktours/sunjay convention). Editors only (owner/guide via `lib/auth.ts`); anyone else is
  sent to `/login?next=/publish…`. `app/publish/page.tsx` + `publish.css` (fixed over the site chrome).
- Dependency added through `docker compose run --rm install`; `next.config.ts` transpiles `@elkdonis/studio`.
- Modelled on arts-collective's `/studio` + `components/studio/StudioApp.tsx`. Copied byte-identical:
  `app/api/studio/image/route.ts` (the image editor's convert route). Re-pointed rather than copied:
  `lib/studio-actions.ts` → `lib/studio/writing-actions.ts` (see below).

### Thwip: the kinds
- **Writing** (the Studio's own editor, canvas included) writes THIS site's posts: `threads.kind 'post'`,
  org `hidden-enneagram`, feed `writing` by default or `?feed=<slug>`. Not the network's `writing` kind homed on
  the directory, because `/writing` and every shelf here read the org's own posts. Delete = `/manage`'s delete.
- **Services**: an app-side Studio extension (`components/publish/service-kind.tsx`; the package still marks
  `service` not ready). Title, line under it, card summary, description, price + currency, sliding scale (floor
  + note), length in minutes, sessions, one to one / group / not live, online / in person / either, place,
  booking state, picture, who sees it. Saves through `saveContentAction` → `upsertServiceOffering`, so the
  author is the signed-in editor (payee rule, migration 253) and it lands on `/readings` and `/services/<slug>`.
- **Coming** (stub panels, no tab; reachable from "New ▾"): Events/meetings (pages here show no dates yet),
  Social posts (need network-held Meta connections), Video, Recordings, Word art. They exist so "New ▾" never
  falls through to `/studio?kind=…` (the page editor).

### Thwip: the popup and the doors
- Custom surface **`studio:compose`** (`components/publish/studio-surface.tsx`): `/publish?…&framed=1` in a
  same-origin iframe inside the site's one SurfaceHost. Publish inside → the popup closes; closing after any
  save → `router.refresh()` underneath; "Open full screen" in the kicker; leaving `/publish` inside the frame
  (the Studio's ←, a view link) closes it and navigates the page. Messages: `components/publish/bridge.ts`.
- Custom surface **`studio:choose`** (`components/publish/publish-door.tsx`): Writing · Post (pick the page) ·
  Service · Event (soon). Doors: the **Publish** card on `/hub` (replaces "Write something"), **Publish** in the
  account menu, and on `/manage`: kind filters (All · Writing and posts · Services), **New ▾**, and **Edit** on
  each row (the dropdown keeps "Edit in the form"). `/manage/content` redirects to `/manage`.
  `/manage/content/new` and `/manage/content/<id>` stay as the plain-form fallback.
- Registered in `HubSurfaces.tsx` with one spread (`...publishSurfaces(feeds)`) beside round 3's `enneagram-type`.

### Thwip: the hub, tidied (approved pass)
- `/hub` top: the template sections "To hand" (static Notes/Recordings/Worksheets rows that linked nowhere) and
  "Lately" (an org-feed embed that rendered outside its slot, light cards edge to edge) are left out via
  `OMIT_SECTIONS` in `lib/hub-template.ts` (one id each to restore). The package template is untouched.
- One grid at the template column (min(1040px, 100% - 48px)), `HubCardGrid`: Publish (editors) · the forum card ·
  Readings & bookings (to `#bookings` when there are any, else `/readings`) · Center · Channel · Manage · Page
  editor · the course. Publish is now a plain `eac-hp-card` (`PublishCard`), no ghosted chooser behind it.

### Thwip: tests
- tsc clean (throwaway container). Playwright (own Chromium on eris, compose network): hub Publish → chooser →
  Writing popup → TEST post autosaved as draft; Service → TEST service draft (author Ario, 90 CAD, floor 60,
  1.25 h); `/manage?kind=service` row → Edit → Publish closed the popup and the row read "published";
  on `/readings` and `/services/<slug>` (the `service` template) with its description; the account-menu door
  opened the chooser. Both rows then deleted by exact id; org counts back to before. Session revoked.
- Found and fixed on the way: the stub tabs pushed Publish off the popup's bar (tabs now hidden by
  `publish.css`); a refresh-on-unmount that React dev runs at mount reloaded the frame (now: refresh only after
  a save).

## 2026-11-07 · Round 3: redesign (preview only; live not rebuilt)

### Thwip: the look goes home
- Ario's ORIGINAL Silex look is the default again, matched to live `/introduction` and the template tokens:
  `#0a0a0c` ground, `#ece7dd` ink, `#bcb6aa` reading ink, teal `#3aa99c`, Cormorant Garamond + EB Garamond
  (`lib/fonts.ts`), centred bands, a 720px column, hairlines, and the white-core orb between bands (now a
  block, `he-orb`, and the hero's ornament). `app/palette.css`, `app/site.css` (round 3 section).
- Round 1's ÆON look stays as a Site style preset: **Look → ÆON** (`--he-look`, `html[data-he-look]`,
  `components/site-style/look-watcher.tsx` for the live preview). Owner colours/fonts still win over both.
- Header: one line at desktop, signed in or out (five links; Forum, other feeds and the course moved to the
  account menu, the phone sheet and the footer). The free course: no hero button, no nav link; one quiet line
  in the footer and one at the foot of `/enneagram`.

### Thwip: the landing is quiet
- `/` = Welcome (new `he-welcome`, art-auction's `.hw` in Ario's palette) → Opening with the orb →
  work impressions (his public writing + `he-works`, a graceful empty line until media exists) → a short way
  into the enneagram → contact (`he-contact`, the existing `/api/org/<org>/contact`) → the readings
  (`he-shelf`) → the forum (`he-forum`). No figure, no sound (so round 2's `sound: false` home figure is gone
  with the figure; `FIGURE_SOUND` lives on, on `/enneagram` and `/music`).
- The welcome letter is a DRAFT built from the site's own copy (org_site_sections.about); Ario should rewrite
  it at `/studio/home`.

### Thwip: one exposition page
- `/enneagram` holds all of it: the figure (small, summary reader, sound opt-in) in a Sticky side; Ario's
  chapters scroll beside it, folded VERBATIM from `/introduction`, `/centers`, `/triads` and `/type-1..9`
  (`lib/exposition.ts`; extracted by script from the live HTML, /triads transcribed from its page.tsx).
  Duplicates kept once ("What is the Enneagram?" was on 10 pages; the two Object Relations blocks on all 9).
  The sticky side scrolls on its own when it is taller than the window.
- The nine types are `he-type` rows (`#type-N`): open in place without script; with script a tap (row,
  figure link, any `#type-N` link) opens a Surface popup (`enneagram-type`, registered in HubSurfaces).
  ← N → step through; "In the page" returns to the row.
- Redirects (308): `/introduction`, `/centers`, `/triads`, `/type-N`, `/contact`, `/services`, and
  `/services/<slug>/book`. `SILEX_PAGES` is empty; `app/triads/page.tsx` deleted (its words are in the page).
- Not carried: the `/triads` intro line "Click any point… Use the toggles…" (the figure's own intro says it)
  and the Silex contact page's form (the landing's form replaces it).

### Thwip: readings, Book and pay
- `/readings` (new page): the services, then the writing. `/about` is an editable page in ifac's shape
  (`he-person`: the profile photo, else the person's avatar; statement = the site's about copy).
- `/services/<slug>` is one studio template (`service`) around `he-service`. **Book and pay** goes straight
  to Stripe (katie's Buy now): `startServiceCheckout({ customerEmail: viewer or "", collect: { email },
  schedule: null })`. Times and a note move AFTER payment: "When would suit you?" on the return
  (`?booked=1&order=<id>`), saved as before (`createServiceBooking` + `markServiceBookingPaid`).
- Shared, additive: `packages/checkout/src/server/thread-checkout.ts` takes an optional `collect` and passes
  it on; an empty `customerEmail` is documented as allowed with `collect.email`. Other callers unchanged.
- `/api/media`: sunjay's `Profile Pictures` exception copied as written, so Ario's portrait
  (`EAC_Network/inner_group/Profile Pictures/…`) loads on `/about` and `/about/aeon`.

### Thwip: tests
- `scripts/booking-params.ts` now builds the Book-and-pay params (no Stripe call): 12000 CAD, destination =
  Ario's connected account (…uyLR), application fee 0, no `customer_email`.
- `scripts/booking-times-test.ts` (new): the after-payment save with an exact revert (test order + line +
  booking, deleted; no emails: markServiceBookingPaid's UPDATE is done by hand).

## 2026-11-07 · Round 2: readings, sound, the web of music, Ario's music (preview only)

### Thwip: a reading for one person (`he-reading`)
- New block "A reading": the figure as Ario's instrument for ONE person. Steps (Puck rows) each set a core type, wings,
  stress/growth arrows, other lit points, which lines show, his own marks ("1-5" a line, "4>8" an arrow), notes pinned
  to points ("4: the mask"), a lens, the words, and a sound cue. Visitors step through it (Back/Next, dots, arrow keys,
  `#step-N`), switch to "Written out" (every step as text beside a small still figure), or Print (prints the written-out
  list on white, without the site chrome).
- A block of its own, not a mode of The Figure: a different document with list props, and it makes its page private.
  The Figure's stored props are untouched.
- Inert in the editor; "Step shown in the editor" picks the step the canvas previews.
- Private by default (`lib/reading-privacy.ts`): any page holding a reading gets `noindex, nofollow, nocache` and
  `no-referrer`, on every route that draws studio pages. The site has no sitemap and lists studio pages only to editors.
- `/studio` gets "Start a reading": a fresh, unguessable address (`reading-` + 12 random characters) opened on the
  "A reading for …" starter (`lib/reading-template.ts`). Ario writes, publishes, and sends the link to that person only.
  Anyone holding the link can read it: it is private, not locked.

### Thwip: the figure sounds (`src/lib/sound/`, app-local, extractable)
- Engine: Web Audio, with Tone.js imported on the first tap only (an AudioContext is made inside the click, so Safari
  is happy; iOS `audioSession.type = "playback"`). tonal + xen-dev-utils for notes, cents and ratios; pitchy for the mic.
  All MIT. No GPL/AGPL/LGPL code.
- Tunings: Ouspensky's octave (default; 9 do, 1 re, 2 mi, 4 fa, 5 sol, 7 la, 8 si; 3 and 6 are the shocks, sounded as a
  breath of noise and a struck bowl), and, labelled "an interpretation", shocks as passing tones (layout B) and the
  harmonic series 9 to 18 (layout C: the triangle is 4:5:6). The seven notes in just, equal or Pythagorean tuning.
- The Figure block gains a sound bar (opt-in speaker toggle, volume): tap a point, Play the line 1-4-2-8-5-7
  (re-fa-mi-si-sol-la; read from any seventh 1/7 … 6/7; steady, aksak E(4,9) or agsag-samai E(5,9)), Walk the octave,
  Sound the triangle, a drone on do, and "Sing a tone" (mic, after its own note; heard in the tab only, nothing kept;
  visible off switch; "Make this my do"). Centres set the timbre, lenses the feel (interpretive; the page says so).
- Settings: `sound` (default OFF; on for /enneagram and /music), tuning (or "Site default"), melody, rotation,
  rhythm, a timbre per centre, "Music on the figure" (each point's note, or the 36-tick ring of 9 and 12), mic.
- Site defaults (tuning, temperament, do, follow the track's key) live with the music settings, not in Site style
  (Site style edits theme tokens; sound did not fit there cleanly).

### Thwip: the web of music (`he-music-web`, `/music`)
- `/music` (built-in studio page `music`, code default `DEFAULT_MUSIC_PAGE`): the web of music, then the figure with the
  twelve-note ring laid on it, then the sources. The web: a 36-tick ring (every 3rd tick a pitch class in fifths from do,
  every 4th an enneagram point; they meet only at 9, 3, 6), the enneagram with each point's note, an interval-cycle
  explorer (steps round 9 or 12), and a Tonnetz (triads sound when touched). The mic lights what it hears.
- Copy: interpretive and artistic, not clinical; Ouspensky, ISOTM ch. 14 credited. The research: `docs/audio-research.md`.

### Thwip: Ario's music
- Manage → Music: upload (through `/api/upload`, `kind=audio`, 60 MB) or pick tracks, title/artist/key, on/off, start
  volume, loop one or play the list, every page or chosen pages, and the figure's sound defaults. Stored in site_config
  `he-audio`. Notice: upload only music you have the rights to.
- Player (`components/music/site-audio.tsx`, one island in the root layout): never plays by itself, "Play Ario's music"
  invitation, remembered in `he.music.v1`; pause, next, volume, close always visible; Media Session; ducks about -12 dB
  under the figure; one tab at a time; absent in the studio, back office and iframes; keeps playing across client
  navigation (tested).
- Media route: Nextcloud answers ranges with 206 (tested); the route now also says `Accept-Ranges: bytes`.

### Spidey-sense (what went sideways, and the fix)
- My first push from a reused scratch folder carried round 1's stale copies of 35 files; restored from HEAD within ~20
  minutes (preview only; live untouched). Push explicit file lists.
- A session cookie over 4096 bytes is dropped by curl and browsers. `sb-eac-auth.0` / `.1` chunks of 3180 work (contrary
  to docs/reference/testing.md's note): tested on this preview.
- The shared Playwright MCP browser is used by other sessions too: never put a signed-in cookie in it. Launch a
  separate browser from the script (`browserType().launch({ channel: "chrome" })`).


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
