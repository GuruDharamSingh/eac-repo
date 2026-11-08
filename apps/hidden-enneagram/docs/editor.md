# The Hidden Enneagram: the editor, the Figure and the house look
> Re-stood 2026-11-07 in the katie-the-potter / sunjay shape. Log of every fix: `docs/PATCH_NOTES.md`.

Ario's site (hiddenenneagram.com, port 3012, org `hidden-enneagram`). Puck places
blocks; the look layer (direct-edit) shapes them; Site style sets the whole site.
The shared kits are the same as katie's: `@elkdonis/page-builder` (server code imports
`/config` and `/server` only), `@elkdonis/direct-edit`, `@elkdonis/blocks` (+ `/record`),
`@elkdonis/cms-ui/manage`.

## Three layers, three jobs

| Layer | Changes | Where | Stored as |
|---|---|---|---|
| Block settings (Puck's right panel) | what a block shows: words, lens, reader, links | select a block | the block's props |
| Look (parts panel, "Edit look" popup / double-click) | how ONE block's parts look on this page | click into a block | the node's `morph` (MorphMark) |
| Site style (button bottom left, editors only, public pages) | colours (incl. the three centre hues and the stress line), fonts, corners, header/footer parts | any public page | `site_themes` (page_key '') + `site_config 'site-style:chrome'` |

Token chain: shadcn HSL triplets (`app/palette.css`, what Site style edits) ->
`--he-*` house tokens -> the shared `--eac-block-*`, `--eac-surface-*`, `--eac-control-*`.
Code tab and Detach are off (`developer: false`).

## Pages (round 3: the quiet redesign)

Every public page Ario reads is a studio page with a code default (`src/lib/default-pages.ts`).
In the studio, the **Pages** tab (left rail) switches between them; `/studio` lists the rest and
starts a reading.

| Address | Drawn from | Edit at |
|---|---|---|
| `/` Landing | `puck:home`, else `DEFAULT_HOME`: Welcome, Opening (orb), work impressions (writing + pictures), a way into the enneagram, contact, the readings, the forum. No figure, no sound. | `/studio/home` |
| `/enneagram` the exposition | `puck:enneagram`, else `DEFAULT_FIGURE_PAGE`: the figure in a Sticky side beside all of Ario's chapters (`lib/exposition.ts`, verbatim from the old pages), the nine types as `he-type` rows, the course line. | `/studio/enneagram` |
| `/readings` | `puck:readings`, else `DEFAULT_READINGS_PAGE`: the services, then the writing. | `/studio/readings` |
| `/about` | `puck:about`, else `DEFAULT_ABOUT_PAGE` (ifac's About shape: Ario's card + statement). | `/studio/about` |
| `/services/<slug>` | `puck:service`, else `DEFAULT_SERVICE_PAGE`: ONE template for every service; `he-service` draws the service in the address. | `/studio/service` |
| `/<feed>/<slug>` (round 6) | `puck:post`, else `DEFAULT_POST_PAGE`: ONE template for every article ("Article page"); `he-post` draws the post in the address. The route keeps the gates (unknown or locked feed, member-only post, draft: 404) and the metadata. | `/studio/post` |
| `/about/<slug>` (round 6) | `puck:person`, else `DEFAULT_PERSON_PAGE`: ONE template for every person ("Person page"); `he-person` in its whole-page shape draws the person in the address (getPersonPage: portrait, bio, posts, events). 404 when there is no such person. | `/studio/person` |
| `/music` | `puck:music`, else `DEFAULT_MUSIC_PAGE` (round 2) | `/studio/music` |
| `/<slug>` | 1. a studio page `puck:<slug>`, 2. an org feed, 3. 404 | `/studio/<slug>` |

- Redirects (308, `next.config.ts`, before any route): `/introduction` → `/enneagram#introduction`,
  `/centers` → `#centers`, `/triads` → `#triads`, `/type-N` → `/enneagram#type-N` (the row opens, the
  figure selects N), `/contact` → `/#contact`, `/services` → `/readings`; `/services/<slug>/book` →
  `/services/<slug>` (page-level 308, keeps `?payment=cancelled`). Those slugs are in `ROUTE_SLUGS`, so
  the studio refuses them; `home`, `service`, `post` and `person` are in `ELSEWHERE_SLUGS`, so `[page]` never serves them.
  `/edit` (the old Silex editor bounce) → `/studio` (307).
- The studio refuses this app's own routes and the org's feed slugs (`ROUTE_SLUGS` in
  `src/lib/puck/store.ts`, feeds read live), so a page can never hide a route or a feed.
- Save: `savePageAction` (`src/lib/puck/actions.ts`) checks owner/guide, strips resolver keys
  (`src/blocks/resolved-keys.ts`, `stripResolvedKeys`), `cleanBoxDoc`, revalidates.

## The house look (round 3)

- Default = Ario's ORIGINAL Silex look (the old Silex pages' template tokens): `#0a0a0c`, ink `#ece7dd`,
  reading ink `#bcb6aa`, teal `#3aa99c`; Cormorant Garamond + EB Garamond (`lib/fonts.ts`); centred,
  one idea per band, 720px reading column (`--he-reading`), hairlines, the white-core orb (`.he-orb`,
  block `he-orb`) between bands. `app/palette.css`, `app/site.css` (round 3 section at the end).
- Site style → **Look**: Quiet (default) or **ÆON** (round 1's gold, Marcellus/Spectral/Chivo Mono).
  It is the choice variable `--he-look`; the layout writes the stored choice as `html[data-he-look]`,
  `palette.css` keys the ÆON triplets on it, and `components/site-style/look-watcher.tsx` follows the
  live preview. Colours and fonts set in Site style still win over either look.
- Token names are stored in block looks: `--he-aurum` is "the accent" (teal, or gold in ÆON).

## The type popup (round 3)

- A tap on a type on `/enneagram` (the figure's "Read type N" link, any link to `#type-N`, a chapter
  row) opens it as a Surface popup: `useSurface().open({ type: "custom", key: "enneagram-type", props: { n } })`
  (`components/exposition/type-links.tsx`, mounted by `app/enneagram/page.tsx`). The connector is
  registered in `components/hub/HubSurfaces.tsx`; the body is `components/exposition/type-surface.tsx`.
- Its full-page twin is the `#type-N` row in the page: the popup draws what that row holds (so a
  chapter edited in the studio reads the same in both); ← N → step through; "In the page" (label =
  the row's `pageLabel` prop) closes it and opens the row. Without script every tap still lands on
  the row. Custom surfaces do not deep-link through `?surface=`: the address is `/enneagram#type-N`.

## The site blocks (`src/blocks/`; ids, prop and part names are stored: never rename)

- **`he-hero` Opening.** Eyebrow, title with a lit phrase (`accent`, must appear in the title),
  lede, three links, beside them the figure as ornament (`AeonSigil`), a picture, or nothing.
- **`he-passage` Passage.** Eyebrow, heading, formatted text (optional drop capital), chapter
  links (rows) beside or under it. Carries the Silex home's sections.
- **`he-enneagram` The Figure (smart).** Server component around the client island
  `src/components/aeon/figure.tsx`. Props: eyebrow, heading, intro, `mode` (centers | object |
  energy | attitude), `start` (1-9), `reader` (auto | full | summary | none), `size`,
  `controls`, `typeLinks` (dossier links to `/type-N`), `readHref` (`{n}` = the type).
  - Reader "auto" = layout by placement (record kit `placementRules`): on the page -> full
    dossier; in a column (split-row, flow-column) -> summary and a link; a "feature" parent
    would draw the wheel alone (none listed yet). Container queries then stack the wheel over
    the dossier when narrow. The editor shows "Reader: … auto (why)".
  - Inert on every editing surface (`editingOf(puck).drawn` -> `<div inert>`), so a click
    selects the block. `#type-N` in the address opens on that type (full reader).
  - Parts: root, eyebrow, heading, intro, chips, wheel, legend, dossier, name, steps, reading,
    pager. Tweaks: `--he-gut`, `--he-heart`, `--he-head`, `--he-aurum`, `--he-card`.
- Round 3 blocks: **`he-welcome`** Welcome (greeting, rule, letter, link), **`he-orb`** Glow, **`he-works`**
  Work impressions (pictures/recordings/video rows; a quiet line while empty), **`he-shelf`** Cards from
  the site (services, or a feed's PUBLIC posts; smart, `lib/shelf.ts`), **`he-type`** a type's chapter,
  **`he-contact`** contact form (`/api/org/<org>/contact`, handled in `lib/contact.ts` since round 6),
  **`he-forum`** newest forum topics (smart), **`he-person`** portrait (profile photo, else avatar) + statement
  (smart; round 6: Shape "The whole person page" is the `/about/<slug>` template), **`he-service`** the service
  + Book and pay (smart; route keys injected by `app/services/[slug]/page.tsx`). Round 6: **`he-post`** the post
  in the address (title, date, author, cover, text; smart; `routeFeed`/`routeSlug` injected by
  `app/[page]/[slug]/page.tsx` through `lib/puck/route-props.ts`). In the editor, `he-post` and the person page
  draw a sample as a signed-out visitor sees it. Records come from data
  (`lib/record-blocks.ts`; the editor reads `/api/blocks/he-shelf` and `/api/blocks/he-records`); every
  word around them is a prop. `he-hero` gained "A glow (orb)" beside the words.
- **`he-course` Course card (smart).** Resolver reads the course's PUBLISHED version
  (`src/lib/course.ts`: lms_courses + lms_course_versions + lms_steps, one query, 60 s cache):
  title, summary, step count, modules with their first step's link. The canvas shows the static
  copy (`src/blocks/course-data.ts`). Links go to `https://sophia.elkdonis-arts.org/enneagram-foundations`
  (the course is `unlisted`: reachable by link; going public is Ario's call).
- Shared blocks offered: katie's list plus Sticky side, Tabs, Sections that open
  (`src/lib/puck/catalogue.ts`).

## The figure's content

`src/components/aeon/content.ts` is the ÆON draft's `content.js` (2026-10-29) typed, checked
string-for-string (385 values, 0 mismatches), plus the older repo's keywords and one-line
description per type. Geometry: `geometry.ts` (pure). CSS: `aeon.css` (he- prefixed, every
colour a token). Wording is ÆON's; where it differs from the live site, PATCH_NOTES lists it.

## Back office and network

- `/manage` on `@elkdonis/cms-ui/manage`: tabs Content, Orders, Contacts, Newsletter, Pages,
  Site, Visitors (owner). Toasts go to sonner through `components/manage/manage-toasts.tsx`.
- `/center` is sunjay's full Center (`app/center/page.tsx` + `app/api/center/*`, copied
  byte-identical); `/channel` is katie's redirect to the network console.
- Header account menu: Manage, Edit the site, Hub (anyone signed in), Center, Channel (editors), Account.
- Bookings (round 3): **Book and pay** on the service page goes straight to Stripe Checkout
  (`lib/booking-actions.ts` `bookAndPay` → `startServiceCheckout({ customerEmail: viewer or "",
  collect: { email: !viewer }, schedule: null })`; katie's Buy now). A sliding-scale service shows an
  amount field first. Stripe returns through `/api/checkout/return`, which carries the order id to
  `/services/<slug>?booked=1&order=<id>`, where a one-to-one service asks **When would suit you?**
  (`components/booking/when-form.tsx` → `saveBookingTimes`: `createServiceBooking` then
  `markServiceBookingPaid`, the old form's row and emails). Only a PAID order of that service with no
  times sent opens the form (`lib/booking-after.ts`). Payee: unchanged, `resolveSettlement` (author).
- Header (round 3): one line of five (The Enneagram, Readings, Writing, Music, About); Forum, the other
  feeds and the free course sit in the account menu, the phone sheet and the footer.

## The hub (round 5)

`/hub` is innergathering's "Cards 2" hub in this site's look (`app/hub/page.tsx`): a quiet header (org name,
"Signed in as …") and one `HubCardGrid` (`@elkdonis/cms-ui/hubsite`). No Silex template, no meeting banner.

| Card | Goes to | Who |
|---|---|---|
| Publish | `studio:choose` popup (round 4 `PublishCard`) | editors |
| Readings & bookings | `#bookings` if any, else `/readings` | anyone signed in |
| Forum | `ForumFace` popup (new topics) | anyone signed in |
| Chat | `/hub/chat` (native Talk mirror, `@elkdonis/chat`) | members |
| Calendar | `/hub/calendar` | members |
| Documents | `/hub/documents` | members |
| Files | `/hub/files` (WebDAV browser over `/api/center/files`) | members |
| Whiteboard | `/hub/whiteboard` (Excalidraw) | members |
| Pipeline | `/hub/pipeline` (Deck); "Not set up yet" until an editor creates the board | members |
| Your page | `/center` | anyone signed in |
| Channel · Manage · Page editor | `/channel` · `/manage` · `/studio` | editors |
| Enneagram Foundations | the course on Sophia | anyone signed in |

- Under the grid, only when non-empty: the members' feeds (Inner Work, 3 newest) and **Your bookings**.
- Roles (`lib/auth.ts`, byte-identical with innergathering/sunjay): `canEdit` = owner/guide; `isMember` =
  owner/guide/member (the tools and their APIs); `isAffiliate` = any role, a follower (`viewer`) included
  (ORGANIZATION-visibility posts, feeds). Signups are followers, so they see the hub without the tools.
- Kit copies (keep them byte-identical so the org-site kit can absorb them): `api/pipeline/*`, `lib/pipeline.ts`,
  `api/chat/*`, `api/hub/{calendar,documents}`, `hub/{pipeline,documents}/page.tsx` (innergathering);
  `hub/{chat,calendar,whiteboard}/page.tsx`, `components/hub/Calendar{PageView,Grid}.tsx`,
  `api/hub/whiteboard/route.ts` (sunjay = amrit). Re-pointed: `lib/{chat,pipeline}-api.ts` (logLabel),
  `hub/files/page.tsx` (no Nextcloud frame).
- Nextcloud frames: Nextcloud lets only `https://elkdonis-arts.org` frame it (`eac_embed frame_ancestors`), so on
  hiddenenneagram.com an opened document's frame is refused; "Open in Nextcloud ↗" under it still works.

## Preview and testing

- Preview: `sudo -n docker compose --profile preview up -d hidden-enneagram-preview` ->
  `http://localhost:3024` (`next dev`, own `.next` volume). After a fresh container, chown its
  `.next`: `docker run --rm --volumes-from eac-hidden-enneagram-preview --user 0 --entrypoint sh eac-dev -c 'chown 3003:3003 /app/apps/hidden-enneagram/.next'`.
- Signed in: `scripts/mint-session.ts` (header has the command; cookie `sb-eac-auth`, file 0600,
  never printed, delete after; `.gitignore` covers `.session-*`).
- Type-check: `sudo -n docker run --rm -v ~/eac:/app -w /app/apps/hidden-enneagram --user 3003 --entrypoint sh eac-dev -c "pnpm check-types"`.

## Round 2 (2026-11-07): readings, sound, music

### A reading for one person
- Start one: `/studio` → **Start a reading**. It opens a copy of "A reading for …" at `reading-<12 random characters>`.
- Each step (block settings → Steps):
  - core type, wings (lower / higher / both), arrows (stress / growth);
  - "Other points lit" (`2 7`), lines shown, "Your own lines" (`1-5, 4>8`), pinned notes (`4: the mask`, one a line);
  - lens, words, and a sound cue.
- "Step shown in the editor" picks which step the canvas previews.
- Publish, then copy the address and send it to the person only.
  - The page is kept out of search engines (noindex, no referrer) and listed nowhere public.
  - Anyone holding the link can read it. To withdraw it, delete the page (Manage → Pages).
- Code: `blocks/reading-block.tsx`, `components/reading/*`, `components/aeon/wheel.tsx`, `lib/reading-privacy.ts`, `lib/reading-template.ts`.

### The figure's sound
- He-enneagram settings:
  - Offer sound (default off; on for /enneagram and /music); Tuning (Site default / Ouspensky / passing tones / harmonic 9-18);
  - What "Play" plays first; Read the line from k/7; Rhythm; a timbre per centre;
  - Music on the figure (notes / ring); Offer "Sing a tone".
- Visitors turn sound on themselves. Nothing sounds before that tap, and Tone.js loads only then.
- Engine: `src/lib/sound/` (tuning, rhythm, engine, pitch, store, react). It imports nothing from the app, so it can move to a package.
- Interpretive tables (timbre per centre, feel per lens): `components/aeon/sound-config.ts`.

### Web of music
- Block `he-music-web` (ring of 9 and 12, or Tonnetz). The page `/music` is drawn from `puck:music`, else `DEFAULT_MUSIC_PAGE`; edit it at `/studio/music`.

### Ario's music
- Manage → **Music**: tracks, on/off, start volume, loop or list, which pages, and the figure's site sound defaults.
  - Stored in site_config `he-audio` (schema `lib/audio-config-schema.ts`).
  - Audio uploads go through `/api/upload` with `kind=audio`.
- The player is `components/music/site-audio.tsx`, mounted once in `app/layout.tsx` (`<SiteAudio config={audio} />`).
  - It never autoplays; visitors start it from "Play Ario's music".
  - It is hidden in /studio, /manage and iframes.

## Round 4 (2026-11-07): how Ario publishes

Three places, one Studio:

- **`/hub` → Publish** (the first card), or **Publish** in the account menu (the circle, top right). A small
  chooser asks what you are making: **Writing** (for the Writing page), **Post** (pick the page: General,
  Inner Work…), **Service** (a reading or a counselling session people can book), **Event** (coming).
- **`/manage`**: **New ▾** offers the same, the filters narrow the list to writing or services, and **Edit** on
  a row opens that piece or service. "Edit in the form" (row menu) and `/manage/content/new` are the plain form,
  kept as a fallback.
- **`/publish`** itself is the Studio full screen (the popup's "Open full screen" goes there).

In the popup:

- **Writing** saves as you type (a draft). **Publish** in the bar puts it on its page and closes the popup;
  the page underneath refreshes. "Writing as" must stay on The Hidden Enneagram: "Just me" is the network's
  personal space and is refused here.
- **Services**: fill in the name, a summary for the card, the description, then the right-hand column (price,
  sliding scale, length, how and where it is held, booking state, picture, who sees it). **Save draft** keeps
  it private; **Publish** puts it on `/readings` and at `/services/<its address>` (the `service` page
  template) and closes the popup. Payment goes to the signed-in author, so publish services as Ario.
- Closing the popup (✕) after a save refreshes the page underneath.

Where it lives: `app/publish/` (the mount), `components/publish/` (the app wrapper, the Services kind, the
"coming" kinds, the popup surface, the chooser, the /manage doors, the frame bridge), `lib/studio/` (writing
and service actions). The package (`packages/studio`) is imported, never edited.

Package asks for the Studio owner (not done here, by rule):

1. A host prop to drop the "Just me" org (`personalOrg: false`) for org-site mounts.
2. A host prop for kinds without a tab or with a host href base (`kindHref: (id) => …`), so "New ▾" does not
   fall back to `/studio?kind=…`; then `coming-kind.tsx` and the CSS that hides its tabs can go.
3. Mark `service` ready, or ship a Services kind in the package with this one's field set (this app's
   `service-kind.tsx` is a working reference against `upsertServiceOffering`).
4. An `onPublished` / `onSaved` callback on `StudioShell` (this app wraps `savePiece` to notice a publish).
5. A writing "page/section" field (a host-provided select) so a piece can move feeds in the Studio.

Actions registry entries waiting on the actions owner: `docs/actions-proposal.md`.
