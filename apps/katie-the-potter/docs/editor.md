# Katie the Potter: the editor, smart pieces and the look layer

How the Studio (`/studio`, Puck 0.23 via `@elkdonis/page-builder`) is meant to
be used on this site, and how the pieces adapt. Written 2026-11-06 (round 5).
This app is the platform's reference for "smart" data blocks.

## Three layers, three jobs

| Layer | What it changes | Where | Stored as |
|---|---|---|---|
| **Block settings** (Puck's right panel) | what a block shows: which piece, layout choice, typed overrides, toggles | select a block | the block's props |
| **Look** (parts panel + "Edit look" popup) | how ONE block's parts look on THIS page: a title's size and colour, a price's weight, the card's ground and corners | click into a block, or "Edit look" / double-click | the node's `morph` (drawn by `MorphMark`) |
| **Site style** (button bottom left, editors only) | the whole site: colours, fonts, corners, header/footer parts | any page | `site_themes` (page_key '') + `site_config 'site-style:chrome'` |

Precedence: site style sets the defaults every block inherits (shadcn triplets
-> `--eac-block-*` -> `--blk-*` -> card tokens); a block's own look wins over
them for that block only; typed content overrides win over the record.

## The smart blocks

All registered in both configs (`src/lib/puck/config.server.ts` and
`config.client.ts`); block ids are stored in page JSON, never rename one.

### `ktp-piece` (Piece): one piece, anywhere

- **Data:** `artwork` binds a record (`binds: "artwork"`, only the id is stored;
  chosen with the picture picker). Typed `title`, `kicker`, `caption`, `image`
  win over the record. Price, sale state and the buy button always come from
  the record, so a sold piece can never be shown as for sale.
- **Empty:** in the editor a "Choose a piece" placeholder; on a published page
  nothing; on the piece-detail template the route's own piece.
- **Props:** `artwork`, `layout` (auto | card | compact | row | feature), `title`,
  `kicker`, `caption`, `image`, `cardClick` (page | popup; default page),
  `ctaMode` (buy-now | add-to-cart | open-popup | open-page | none; new blocks
  default to open-page "View", a block stored without it is add-to-cart),
  `ctaLabel`, `buyNowLabel`, `buyNowNote`, `pictures` (one | all: thumbnails on
  a feature), `showPrice`, `showMedium`, `showDimensions`, `showStatus`,
  `priceFormat`.
- **Clicking the card** (`cardClick`, 2026-11-07): goes to `/pieces/<slug>`
  by default; "popup" opens the popup instead. The route's OWN piece (unbound,
  on a piece's page; resolver `ownPiece`) always opens the popup, since a link
  to itself is pointless. A "View: open the popup" button always opens it.
- **Buy now** (`ctaMode: "buy-now"`, used by the piece-detail template):
  `components/buy-actions.tsx`. "Buy now" calls `buyPieceNow`
  (`lib/shop-actions.ts`): a one-piece card order (`createOrder` +
  `loadVariantItem`, the cart untouched except a line for this same piece),
  then Stripe's hosted page with `collect` = email (unless signed in) +
  shipping address (`siteConfig.shipToCountries`, CA and US). "Add to cart ·
  continue shopping" is `AddToCart` in its `ghost` style. One line under them
  (`buyNowNote`, empty = the standard line). Sold, reserved, price on request
  and portfolio pieces fall through to `AddToCart` unchanged; with card
  payments off (resolver `cardOn`) only Add to cart shows.
- **Parts** (click into the block): `root`, `frame`, `card`, `pic` (picture
  frame), `photo`, `badge`, `words`, `eyebrow` (kicker), `name` (title), `meta`,
  `note` (caption), `price`, `cta` (the View / Add to cart button, not Buy
  now), `buynow`, `buynote`. Part names avoid the prop names (`title`,
  `image`, `caption`, `kicker`) on purpose.
- **Tokens** (the "Tweaks" tab): `--ktp-card-bg`, `--ktp-card-ink`,
  `--ktp-accent`, `--ktp-radius`. Each falls back to the site style.

### How "auto" decides (proximity, then width)

1. **Proximity (where it sits).** page-builder hands every resolver
   `metadata.placement = { parentType, slot, index, siblingTypes }` from Puck's
   resolveData `parent` (top level = `parentType: null`). `layoutFromPlacement`
   (`src/blocks/piece-layout.ts`, pure, shared by editor and server) maps it:
   - in `ktp-quick-landing` -> **feature** (this site's rule; no shared block has a feature slot)
   - in `split-row` / `flow-column` -> **compact**
   - in `ktp-piece-row` / `grid` / `card-grid` -> **card**
   - on the page itself -> **card** at the page measure (`data-top`)
   Puck re-runs the resolver when a block is MOVED to another parent; the
   adapter re-runs it only because the resolver reads `placement`.
2. **Width (how much room it has).** Container queries on `.ktp-piece-frame`
   (`src/blocks/piece-block.css`) refine it, identically in the canvas and on
   the page: an auto card wider than 34rem draws as a row (picture beside
   words); a feature or row narrower than 34rem stacks; anything under 15rem
   tightens (smaller type, no plinth).
   A chosen layout (not auto) skips step 1; step 2 still applies.
3. **Spacing by place.** The resolver also returns `where` (page | hero |
   column | row | other), drawn as `data-in`: on the page the piece takes the
   page measure; in a column it keeps the page gutter (a column brings none).

In the editor a small line under each piece says what auto chose and why
("Auto: feature, in a hero's slot"). Side-by-side layouts (row, feature, a
wide auto card) put the card on a grid with a subgrid link, so the words and
the button centre together beside the picture even though the button has to
live outside the card's `<a>`.

To add a parent to the rules (say a new two-column block), add its id to the
right set in `piece-layout.ts`; nothing else changes. Resolver keys must not
equal a prop name (`placement` is resolved, `layout` is the author's choice).

Since 2026-11-06 the rules, the layout prop, the frame and the editor marks
are the shared kit `@elkdonis/blocks/record` (guide:
`docs/reference/record-blocks.md`); `piece-layout.ts` only lists this site's
parents (`ktp-quick-landing` as feature, `ktp-piece-row` as card). The /manage
pages use `@elkdonis/cms-ui/manage` (`docs/reference/manage-ui.md`).

### `ktp-piece-row` (Row of pieces)

A slot that accepts only `ktp-piece`, laid out as a grid that fits the row's
own width. Props: `heading`, `pieces` (slot), `minWidth`, `columns`
(0 = as many as fit), `gap`. Parts: `root`, `heading`.

### `ktp-quick-landing` (Quick landing): the feature slot

Set **Beside the words** to "A piece" and drop a Piece into the slot that
appears; it draws as a feature card in the picture's place. Existing pages
are unchanged (`featureSource` defaults to the picture).

### `ktp-piece-details` (Piece details)

Facts, description and previous/next for one piece; on the template it shows
the page's own piece. Props: `artwork`, `showNav`, `showFacts`,
`showDescription`, `note`. Parts: `root`, `nav`, `facts`, `body`, `aside`.

### `ktp-artwork-grid` (Artwork grid)

Draws the same `PieceCard` markup as `ktp-piece`, so a card reads the same
everywhere. `cardClick` (2026-11-07): "page" (default, also for pages stored
before it existed) makes each card a plain link to its page; "popup" brings
back the popup. A shared `?piece=<id>` link still opens the popup. `source: "more"` lists the neighbours on the
piece-detail template. Repeat parts: `cards`, `captions`, `pic`, `photo`,
`badge`, `name`, `meta`, `price`.

## Looks (round 6): Ember, Glaze Lab, Profile

The three client directions as presets a card wears. Pure CSS (`src/blocks/looks.css`),
listed in `src/blocks/looks.ts`; morph and Tweaks still apply on top.

| Look | For | What it does |
|---|---|---|
| House | the shop as designed | nothing extra |
| Ember | wood-fired work | arched kiln-mouth picture, firing glow behind the piece, rising embers, a gloss sweep on hover |
| Glaze Lab | made to order | graph-paper ground, a banding wheel that turns on hover, the piece's OWN pictures as glaze swatches that pour over the picture (only when it has 2+ pictures) |
| Profile | catalogue / collectors | a hang tag; the picture drawn as a section (outline, centre line, hatched cut half) that wipes into the finished piece on hover or focus; the record's own dimensions on the ground line (none recorded, no label); touch screens show the finished piece |

**Choosing one**
- One piece: select it, Look.
- A grid: select it, Look (its cards and its popup).
- A Row of pieces: Look; every piece in it wears it unless a piece picks its own.
- The whole shop: Site style (any public page, editors only), Theme, Shop, Card look, Save. It shows once saved.
Nearest wins: the piece, then its row, then the site. "As around it" = inherit.

**Judging them on samples:** `/preview?look=ember` and `/preview/pieces/tenmoku-tea-bowl?look=profile` (noindex).

**Pictures:** the looks need cut-out photos (transparent PNG/WebP) to show the
ground, glow and drawing around the pot. An opaque photo still works: Ember
and Glaze Lab frame it, Profile then draws a rectangle, so use Profile with
cut-outs. Motion stops under prefers-reduced-motion; text colours were chosen
at 5.9:1 or better on their grounds.

## The piece-detail template

Every `/pieces/<slug>` (and `/preview/pieces/<slug>`) draws the Puck document
`puck:piece-detail`, or `DEFAULT_PIECE_DETAIL` (`src/lib/piece-template.ts`)
until one is published: a feature `ktp-piece` with no binding (Buy now + Add
to cart), `ktp-piece-details`, and a "More pieces" grid. Edit it at **/studio/piece-detail** (listed under
"Templates" on /studio); the canvas shows a labelled sample piece. The route
keeps its OpenGraph metadata and 404s an unknown piece; `/piece-detail` itself
is never served.

## Editing surfaces and interactivity

`ktp-piece` stays a server component; its only scripts are the popup island
(`popup-host.client.tsx`), the thumbnail strip and, with Buy now, the
`BuyActions` island. On any editing surface
(`puck.isEditing` on the canvas, `puck.boxEditing` in the "Edit look" popup)
nothing in the card acts: no popup, and `AddToCart` draws an inert copy of the
button (`inert`). The popup is its own React root outside Next's app router,
where `useRouter()` throws, so the live button lives in `LiveAddToCart`.

## Saving

`savePageAction` checks the editor role, strips resolver-filled props
(`src/blocks/resolved-keys.ts`), keeps each node's look to its known shape
(`cleanBoxDoc`), stores `site_config puck:<path>` and revalidates the path (or
`/pieces/[slug]` for the template). A page with no looks renders exactly the
markup it rendered before the look layer existed.

## Tested signed in (2026-11-06, live, throwaway page /smart-test, since deleted)

Real drag-and-drop of Quick landing, Row of pieces, Two columns and five
Pieces; placement read as feature (hero slot) / card (row) / compact (column)
/ card at the page measure (top level); the phone viewport stepped the layouts
down by width; title and price looks through the parts panel (scoped to that
one block); card ground and corners through Tweaks; a title override typed in
the Edit-look popup and handed back with "Use on this page"; publish; the
published page drew the same looks with no editor marks; a site style accent
and tint saved and followed by every card (a card's own token still won),
then restored to no stored style at all.

Known rough edges in the shared look panel (not this app): after a token is
set the panel jumps back to the Properties tab; typing a text size once also
wrote a `min-height` on the part (reset it with the row's reset arrow); the
popup's floating Italic acts on a text selection only. The sample pictures
are PNGs with their own beige ground, so the "Soft tint" site colour shows
only around and behind them; a real photo with transparency or no margin will
show it fully.

## Minting a test session

`scripts/mint-session.ts` (header has the command) writes the cookie value to
a 0600 file; never print it, delete the file after. The cookie name is
`sb-eac-auth`.
