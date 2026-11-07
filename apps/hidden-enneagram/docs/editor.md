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

## Pages

| Address | Drawn from | Edit at |
|---|---|---|
| `/` | `site_config puck:home`, else `DEFAULT_HOME` (`src/lib/default-pages.ts`) | `/studio/home` |
| `/enneagram` "The Figure" | `puck:enneagram`, else `DEFAULT_FIGURE_PAGE` | `/studio/enneagram` |
| `/<slug>` | 1. a studio page `puck:<slug>`, 2. a Silex page, 3. an org feed, 4. 404 (`app/[page]/page.tsx`) | `/studio/<slug>` |

- Built-in pages draw their code default until published; the studio opens on it.
- The Silex pages (`/introduction`, `/centers`, `/contact`, `/type-1` … `/type-9`, list in
  `src/lib/silex-pages.ts`) still come from Silex, with "Edit page" (Silex editor) for editors.
  Publishing a studio page at one of those addresses replaces it: that is how they move over,
  one at a time, without a deploy.
- The studio refuses this app's own routes and the org's feed slugs (`ROUTE_SLUGS` in
  `src/lib/puck/store.ts`, feeds read live), so a page can never hide a route or a feed.
- Save: `savePageAction` (`src/lib/puck/actions.ts`) checks owner/guide, strips resolver keys
  (`src/blocks/resolved-keys.ts`, `stripResolvedKeys`), `cleanBoxDoc`, revalidates.

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
- `/hub` keeps its members' room and gains Rooms cards (Center, Channel, Manage, Page editor, Course).
- `/center` is sunjay's full Center (`app/center/page.tsx` + `app/api/center/*`, copied
  byte-identical); `/channel` is katie's redirect to the network console.
- Header account menu: Manage, Edit the site, Hub (members), Center, Channel (editors), Account.
- Bookings (`/services/<slug>/book`, `startThreadCheckout`, `/api/checkout/return`) are unchanged.

## Preview and testing

- Preview: `sudo -n docker compose --profile preview up -d hidden-enneagram-preview` ->
  `http://localhost:3024` (`next dev`, own `.next` volume). After a fresh container, chown its
  `.next`: `docker run --rm --volumes-from eac-hidden-enneagram-preview --user 0 --entrypoint sh eac-dev -c 'chown 3003:3003 /app/apps/hidden-enneagram/.next'`.
- Signed in: `scripts/mint-session.ts` (header has the command; cookie `sb-eac-auth`, file 0600,
  never printed, delete after; `.gitignore` covers `.session-*`).
- Type-check: `sudo -n docker run --rm -v ~/eac:/app -w /app/apps/hidden-enneagram --user 3003 --entrypoint sh eac-dev -c "pnpm check-types"`.
