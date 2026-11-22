# IG-landing: block-forward pass on the innergathering landing page (2026-11-21)

Source only. No commits, installs, migrations or writes. Dev copies ran as one-off scratch production builds (`~/scratch/manjushri/ig/next-before`, `next-after`) on 127.0.0.1:4531, background timers off, now removed; `next-env.d.ts` unchanged. Nothing stored was converted.

## 1. The map (elkdonis-arts.org, top to bottom)

The live page is a **saved tree** (the `puck:landing` row): generic boxes and words adopted from the code the first time it was edited, plus nine live parts (`data-landing-part`) the code still draws. Read from the live HTML (`data-page-root`, section labels); I did not read the stored row itself (schema-only rule).

| # | Piece | What it is today | Data it reads | Why hard to edit or theme |
|---|---|---|---|---|
| 1 | Opening (header) | Saved boxes: small line, title, subtitle, gold rule, tagline, picture | Hero words from site sections; picture from admin image space | Words are copied into the saved boxes, so changing the site-section card no longer changes the page. The header carries one raw colour `background:#ffffff` (an earlier edit) that ignores Site style |
| 2 | Sign-in buttons | Live part `hero-actions` | The viewer | Finished HTML, no settings |
| 3 | **Current offerings** | Live part `offerings` (`OfferingsBand`), one sealed card | Offerings feed, RSVP counts, the viewer's answer | Nothing inside could be set; cover, words, panel all code |
| 4 | Sign-in banner | Live part `login-banner` (empty when signed in) | The viewer | Words in code |
| 5 | **A Mutual Aid Society** | Not a special block. A saved `section` box named "About": a heading box and a two-column grid box with three paragraph boxes, every style inline | Nothing | It is one big layer with grid, fonts and sizes all in inline styles on boxes, so it behaves as one sealed lump in the layer tree and cannot be restyled as a unit. Its colours and faces already come from `--ig-*` variables, so Site style reaches it |
| 6 | Gallery | Live part `gallery` (`GallerySlider`) | Admin image space | No settings |
| 7 | Join | Live part `join`: `BaroqueSignup` plus copy | None | Copy welded in a client component |
| 8 | **The Grand Forum** | Live part `forum`: heading, line, button, the forum on the work-question thread, guest answer box | Work question, forum thread, viewer | Sealed; words in code |
| 9 | Fundraising | Boxes with two live parts (money bar, status line) | Fundraising config | Words and the GoFundMe link are in boxes; status/bar are parts |
| 10 | Cities | Saved boxes (Reveal) | None | Three cities with words welded in |
| 11 | Board | Boxes plus live part `board-list` | Members' profiles | List is a part |
| 12 | Vision | Saved boxes, one quote | None | Words in boxes; inline styles use variables |

Of 37 inline styles on the page, 1 holds a raw colour (the header's white); the rest use `--ig-*` variables.

## 2. Proposal

| Piece | Becomes | Made of |
|---|---|---|
| Current offerings | Smart block `offerings-band` (built) | Parts: small line, heading, card, cover, details, title, facts, buttons, right-hand panel, row beneath, closing link. Next step: split cover / details / panel into three slot blocks sharing the card's call context |
| Grand forum | Smart block `grand-forum` (built) | Parts: small line, heading, paragraph, button, forum conversation, answer box |
| A Mutual Aid Society | Ordinary blocks, no special block | `section-heading` + `split-row` of `prose` (pattern `ABOUT_PATTERN`) |
| Hero, cities, vision, board heading, fundraising copy | Ordinary text/picture/box blocks (already boxes) | Move words out of inline styles into block settings over time |
| Sign-in buttons, sign-in banner, gallery, join, board list, money bar | Keep as live parts for now; later smart blocks (`sign-in-banner`, `gallery`, `member-list`) | |
| Patterns worth keeping | "Offer card + row", "Forum band", "About: heading and two columns", "Join: sign-in beside copy" | |

How patterns are stored today: only as `PageTemplate` objects in code (`packages/blocks/src/templates/person.ts`, `store.ts`): id, name, description, swatch, content nodes without ids, applied when a new page starts. Missing: inserting a pattern into an existing page, patterns saved by an owner, and a picker listing them.

## 3. Built

- `apps/innergathering/src/components/landing/offerings-block.tsx`: block `offerings-band`. Settings: small line, heading, featured gathering (`binds: "thread"`), right-hand panel (RSVP / sign-in form / nothing), row beneath (next gatherings / latest posts / none) and how many, closing link words and address, cover across/down/zoom (the `{fx, fy, zoom}` shape of `cms-ui` `cover-frame.ts`, drawn with its `coverFrameStyle`). `reads`: site org, viewer signed-in, record via `featured`, flow rsvp. Eleven parts.
- `components/landing/OfferingsBand.tsx` (edited): optional `eyebrow, heading, panel, frame, rows, allLabel, allHref`; every default is the old markup. `OfferingSignIn.tsx` + `offering-signin.css` (new): the site's own `BaroqueSignup`, never drawn when signed in; no password handling written.
- `components/landing/forum-block.tsx`: block `grand-forum`. Settings: small line, heading, paragraph, button words and address, show forum, show answer box. `reads`: site org, viewer, flow work-question. Seven parts.
- `lib/landing-offerings.ts`, `lib/landing-forum.tsx` (server loaders), `app/api/blocks/offerings/route.ts` (public, same data as the page, for the canvas).
- `lib/puck/landing-blocks.ts` (list, `swapLandingParts`, `ABOUT_PATTERN`), `landing-resolved.ts` (keys stripped on save).
- Edited, small hunks: `config.client.ts` (resolvers, blocks, `canvasContract`), `config.server.ts` (resolvers, blocks), `actions.ts` (resolved keys), `page-editor-mount.ts` (`resolvedKeys`, `puckConfig`, `contract` so Settings... opens Puck), `app/page.tsx` (saved parts `offerings` and `forum` are read as the blocks; row untouched).
- `scripts/check-landing-blocks.mts`.

### (c) Landing mount
Settings... needed `puckConfig` and a contract in the mount; both now passed. For the saved tree this works through the read-time swap above (the editor opens the swapped tree; saving writes the blocks). **Missing for the no-saved-tree first visit:** `openPageAsTree` (`packages/direct-edit/src/puck/open-page.ts`) only knows `data-landing-part`; `data-landing-block` is handled only by `openVisitorPage` (its `existing` hook). Fix for the PM: give `openPageAsTree` the same `existing` hook and `parts[block] = innerHTML` line. I did not mark `data-landing-block` in the page, since in tree mode it would be adopted as plain boxes and lose RSVP.

## Pixels (signed-out, full page, 1440 and 390, `shots-ig.cjs`)
before1 vs before2: identical, so nothing was excluded. Before vs after (both pairs): **identical at both widths**. A first after-build differed (the forum paragraph and 107 px on phone): a node with only an id got no default for a paragraph setting; fixed (components now fall back to declared defaults) and re-measured. Not seen on the live page, only in a scratch render (`shots/variants-d.png`, `-m.png`): sign-in panel fits the right column; framed/zoomed cover; no panel/no row/no link.

## Checks
`check-landing-blocks.mts`: 66 passed, 0 failed (catalogue, sample, reads, parts exist in markup, server render, registration in both configs, resolved keys, swap, sign-in never for signed-in and no member data, panel/row/link/cover settings, forum switches, bare-node defaults, About pattern uses only shared blocks). tsc `apps/innergathering`: 0 before, 0 after.

## Decisions and cuts
- Stored rows not converted. To make About ordinary blocks: replace the saved "About" section with `ABOUT_PATTERN` (words shortened there) and set the heading face; this will not match today's pixels, so it needs Justin's call.
- Featured picker is a text field holding a thread id (no record source wired; needs `RecordSources` and a contract-backed lister). Cover framing is three sliders; the drag `CoverFramer` needs a new "frame" prop kind in page-builder.
- Not tested signed in (no test account on this org): Settings... on both blocks, the canvas resolvers, saving.
- Pattern insertion, further splitting into cover/details/panel blocks: not built.
- Hero `background:#ffffff` left alone.

## Rebuild
innergathering (live parts become blocks, new route, config, editor mount). Also direct-edit/house-editor changes from other lanes if not yet built.
