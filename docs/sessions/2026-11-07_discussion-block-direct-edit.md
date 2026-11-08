# Discussion block: the direct-edit side (design, 2026-11-07)

Phase 1 research and design by the direct-edit generalist on a two-agent team (a Puck specialist works in parallel on Puck internals and the block definition; a coordinator merges both into one contract). It covers: what the "house" editor and direct edit are today; the reference discussion box on the auction-series page and its data model; how Para Theater's event-detail page is built and where a discussion block goes; the content kinds a picker can offer and a proposed content source registry; how the discussion block's parts map to props and looks so Puck and direct edit read and write the same data; and what the house editor must own. Nothing was built, committed, rebuilt or restarted. The only file written is this one. Labels: **verified** (with how and when), **proposal**, **assumed**, **unknown**.

## 1. The house editor and direct edit today

### 1.1 What "the house" is

- **Decision, not a component.** 2026-11-06, agreed with the developer: "our editor stays the house for the live page; Puck is reached from it and reaches into it; per-page looks now, versions later" (`docs/open/EDIT_LOOK_POPUP_BRIEF_2026-11-06.md`, intro; `docs/sessions/2026-11-06_editor-house.md` section 1). Division of labour: Puck owns placement and structure (add, move, order, delete, block settings, outline); the look layer owns the look of a block's parts, written to `props.morph` (`packages/direct-edit/harness/frankenstein/PARITY.md`).
- **The only "house" code is a harness.** `packages/direct-edit/harness/frankenstein/house.tsx` (verified by grep 2026-11-07; no `house` symbol in `packages/page-builder/src`, `packages/direct-edit/src`, `packages/studio/src` or any app studio, apart from katie-the-potter's unrelated "House" card look). It holds one document and two rooms, one writer at a time: Arrange = page-builder's `PuckEditor` with the parts plugin, Shape = direct-edit's `mountTreePage`. Switching rooms is a handoff with three rails: (1) the leaving room's document is cleaned as a save would (`stripResolved` + `cleanBoxDoc`); (2) the handoff is refused if a surviving block lost a prop; (3) each handoff is logged with a hash, so undo across rooms is "back to that handoff". `house.cjs` 16/16 (2026-11-06, reported in its README).
- **What runs live (Para Theater, apps/sunjay), two doors over one row** (verified by reading 2026-11-07):
  - Puck Studio `/studio/<slug>` (`apps/sunjay/src/app/studio/[slug]/page.tsx`, `components/studio/page-editor.tsx`): `PuckEditor` + `partsPlugin({ contract, look, panel: mountLookPanel, developer: false, popup: openStudioPopup })`. Click into a block's parts, edit their look in Puck's right column, "Edit look" / double-click opens the block popup.
  - Canvas `/studio/<slug>/canvas` (`app/studio/[slug]/canvas/page.tsx`, `components/studio/CanvasEditor.tsx`): the tree editor with sealed blocks, the block popup on double-click, the "From what?" chooser.
  - Both save through `savePageAction` (`apps/sunjay/src/lib/puck/actions.ts:39`) → `cleanBoxDoc(stripResolved(data))` → page-builder `savePage` (`packages/page-builder/src/store.ts:78`), an upsert of `site_config` `puck:<slug>`. Last write wins, no version or `updated_at` check, public at once. Page-builder keeps unsaved Puck work in the browser (`packages/page-builder/src/editor.tsx:113`).
- **Three layers** (katie-the-potter's account, `apps/katie-the-potter/docs/editor.md`, "Three layers, three jobs"):

| Layer | Changes | Stored as |
|---|---|---|
| Block settings | what a block shows: record, layout choice, typed overrides, toggles | the node's props |
| Look | how one block's parts look on this page | the node's `props.morph` (`{ v: 1, parts, tokens }`), drawn by `MorphMark` |
| Site style | the whole site: theme variables, header and footer parts | `site_themes` (page_key '') + `site_config` `site-style:chrome` |

  Precedence: site style sets the defaults; a block's look wins for that block; typed words win over a bound record.

### 1.2 Code that a discussion block would use

| Piece | Path | Role |
|---|---|---|
| Morph model | `packages/direct-edit/src/block/morph.ts` | `NodeMorph`, `cleanMorph`, `morphCss`; parts and tokens; pure, server-safe |
| Contract | `packages/direct-edit/src/block/contract.ts` | `BlockContract`, `ContractPart.prop` (typable words, `"<rows>.<field>"`), `partRef` `<id>~p:<part>[:i]` |
| Block types | `packages/blocks/src/types.ts` | `PropDef` (`binds`, `inlineEditable`, `format: "color"`), `PartDef` (`sel`, `repeat`, `draws`, `prop`) |
| Look panel in Puck | `packages/direct-edit/src/puck/look-panel.ts:185` `mountLookPanel` | full Properties panel for a part, Tweaks for tokens, Code only with `developer` |
| Parts plugin | `packages/page-builder/src/parts/` (`partsPlugin`, `popup.tsx`, `store.ts`) | click into parts inside Puck, writes `morph` through `replace`, one undo step per spell |
| Block popup | `packages/direct-edit/src/canvas/popup.ts`, `puck/studio-popup.ts` | one block alone; look, layout, words; handed back as one `replace` |
| Inline words | `packages/direct-edit/src/canvas/tree-editor.ts:1188` `wordsTarget`, `:1217` `startOwnWords` | typing into a part whose `prop` names a string, text or rich-text prop; data words locked with a note |
| "From what?" | `packages/direct-edit/src/canvas/records.ts` | `RecordSources` (`handles`, `sources`, `choices`, `resolve`, `describe`), two-step drawer, follows |
| Record kit | `packages/blocks/src/record/`, `docs/reference/record-blocks.md` | `placementRules` (proximity), `RecordFrame` (width), `editingOf`, `RecordEmpty`, `defineLooks`, `stripResolvedKeys` |
| Opens | `packages/blocks/src/opens.ts` | `OPENS_PROP` (`binds: "opens"`), `openedAttrs` |
| Site style | `packages/direct-edit/src/site/style.ts`, `site/SiteStyleEditor.tsx` | theme variables by kind, chrome parts |

### 1.3 Limits that shape the design

- Morph: a value at most 160 characters (`MAX_VALUE`, `morph.ts:42`), a morph at most 16 KB, 64 parts, 24 tokens, 4 fonts. A part's raw `css` may not set `position`, `z-index`, `pointer-events`, `cursor`, `transform`, `rotate` (`REFUSED_PROPS`). Absolute and sticky positions are dropped from part looks. Token names `--[a-z][\w-]{0,40}`; `var()` only of `--blk-*`, `--eac-*`, `--dv-*`.
- Page-builder custom CSS: a value at most 200 characters (`packages/page-builder/src/style/schema.ts:212`). A page at most 512 KB (`store.ts:76`).
- `url(`, `image-set`, `expression`, `attr(`, `env(`, `@`, `\`, braces, `!`, comments and control characters are refused in morph values (`FORBIDDEN`, `morph.ts`) and in site theme values (`packages/services/src/themes.ts:40`). Consequence: avatars, covers and external pictures in the discussion block are `<img>` elements fed by props or rows through `safeSrc`, never CSS backgrounds.
- Puck 0.23: a plain `replace` runs no resolver; a block is re-resolved when moved to another parent, not when reordered within one (`page-builder/src/config.tsx:76-81`); an object prop without a field needs a hidden custom field (done for `morph`).
- **elktours direct-edit type errors** (`docs/open/NOTE_for_direct-edit_session_2026-11-04.md`): fixed. Verified 2026-11-07 with `tsc --noEmit` in a throwaway `eac-dev` container, repo mounted read-only, no network: elktours 0, sunjay 0, direct-edit 0, page-builder 0.

## 2. The reference box and the event-detail page

### 2.1 The discussion box on the auction-series page

- **Where.** market.arts-collective.com is `apps/art-auction`. The series page `app/series/[slug]/page.tsx` is code-built React, not Puck; editors edit in place through `page-editor.tsx` (hero, write-up, add artwork, add article). The box is `SrsDiscussion` in `app/series/[slug]/series-social.tsx`, styled by `series-template.css:167-185`. Verified 2026-11-07 by curl (signed out): `section#discussion.srs-discussion` with a main column (heading "Discussion", "Open in the forum →", note "Posts here appear in the forum under Auction series.", "Sign in to add to the discussion.", "No posts yet.") and an aside "Follow this series" with "Sign in to follow".
- **Layout.** Flex row with wrap, gap 48 px; main `flex: 999 1 560px`, aside `flex: 1 1 300px`, so the follow box drops below the discussion on narrow screens. Fonts Cormorant (serif) and Jost (sans), `--srs-*` variables.
- **Data model** (`packages/commerce/src/server/series-social.ts`, migration 212):
  - The series has a mirror forum thread: `ensureSeriesThread` (`:43`) creates on first need a `threads` row of kind `post` in the org's public feed `auction-series` (`org_feeds`, created if missing), `visibility PUBLIC`, `status published`, `metadata.auctionSeriesId`, and stores it in `auction_series.thread_id`. `syncSeriesThread` keeps its title and body in step.
  - Posts are `replies` rows on that thread. Columns (verified 2026-11-07, `information_schema`, read-only): `id, thread_id, parent_reply_id, session_id, user_id, content, reaction_count, created_at, updated_at, edited_at, vote_score, search_tsv`.
  - Read: `listSeriesDiscussion` (`:140`) newest first, limit clamped 1-50, HTML through `sanitizeRichText`, plus `threads.reply_count`.
  - Write: `postSeriesReply` (`:173`) → `postReply` in `packages/services/src/forum-write.ts:160`, the forum's write path: signed in; locked threads closed to non-moderators; a Nextcloud-synced, non-public thread takes replies from org members only; 40,000 characters; rate limit 10 posts per 10 minutes per account across identities; then `watches`, `thread_reads` and notifications (`reply`, `reply_to_you`).
  - Follow: `thread_rsvps` with `status 'subscribed'` (`setSeriesFollow` `:90`, `seriesFollowState` `:104`); the desk's week letters read it (`listSeriesFollowers`).
  - Server actions: `app/series/[slug]/actions.ts` `replySeriesAction`, `followSeriesAction` (signed in, series published).
- **Auth.** `getCurrentUserId` (`apps/art-auction/src/lib/marketplace-auth`), network SSO.
- **Moderation.** Thread level only: `moderateThread` (`forum-write.ts:624`) pin, lock, archive ("delete"), move; owners, guides and global admins (`canModerate` `:130`); logged in `events`. There is no reply-level hide or delete: `replies` has no status column, and `listSeriesDiscussion` filters nothing.
- **Reusable read path with visibility** (the series code uses its own SQL): `getForumThread(id, viewer)` (`packages/services/src/forum.ts:644`, includes `viewer_watching`, `nc_public`), `listReplies(threadId, { limit, page, viewer })` (`forum.ts:768`, chronological, child counts, hearts, scores, author role, avatar, `comment_color`), `listReplyChildren` (`:811`), `toggleWatch` (`forum-write.ts:435`).

### 2.2 Para Theater's event-detail page

- **App and route.** paratheater.arts-collective.com is `apps/sunjay`. `event-detail` is a template slug (`lib/puck/reserved.ts:24`, `TEMPLATE_SLUGS`), so `/event-detail` has no address: verified 404 by curl 2026-11-07. A gathering with a detail page is drawn from it by `app/[feed]/[slug]/page.tsx:122-145`: `readDetailPage(thread.id)` then `renderPuckPage("event-detail", { template: true, metadata: { threadId } })` (`lib/puck/render.tsx`). Editors get `EditThreadButton` and `EventPageToggle` under it. Other gatherings keep the coded page.
- **It is Puck.** The stored document `site_config` `puck:event-detail` (2,408 bytes, updated 2026-11-06 21:30 UTC, read-only query 2026-11-07): `pt-band` (plain, wide) › `pt-event-header`; `pt-band` (raised, rule) › `split-row` (wide-start) with start `pt-steps`, `pt-talk-room`, `pt-notice` and end `pt-event-rsvp`, `pt-event-materials`; `pt-band` (plain, narrow, rule) › `pt-event-about`. The starting document is `EVENT_DETAIL_TEMPLATE` (`lib/puck/templates.ts:43`). One gathering uses it today: `/gatherings/qi-gong-and-alchemical-yogas` (200, curl 2026-11-07; the page ends with "About this gathering", then the footer).
- **How event blocks find their record.** The route's `threadId` in resolver metadata: `loadEvent` (`lib/puck/data-event.ts:31-46`) reads `ctx.threadId`; a published thread for anyone, a draft for editors; without one (in the editor) it falls back to the next upcoming gathering.
- **Where the block slots in.** A fourth `pt-band` (plain, standard or narrow, rule) after the about band, holding the discussion block with `about: "route"`. Two edits: append it to `EVENT_DETAIL_TEMPLATE` for new documents, and add it to the stored `puck:event-detail` through Studio or the canvas (the canvas warns: "This template draws every event's page. Saving changes all of them right away.", `components/studio/CanvasEditor.tsx:39`).
- **The event thread is the discussion thread.** No mirror is needed: replies go on the gathering's own thread. Two differences from the series box:
  - `thread_rsvps` on a gathering means attendance (RSVP). "Follow" on an event discussion must use `watches` (`toggleWatch`), not `thread_rsvps` `subscribed`, or a follower would be counted as attending.
  - A gathering with a Talk room may be Nextcloud-synced: `postReply` then accepts replies from org members only unless the category is public (`forum-write.ts:168-169`). The block must show why the composer is closed rather than offer it and fail.

## 3. The content picker and library

### 3.1 What exists

- **Channel** (`arts-collective.com/channel`, apps/arts-collective): signed-in only (curl 2026-11-07 redirects to `/login?next=%2Fchannel`). A piece is `{ key: "thread:<id>" | "artwork:<id>", subject: { kind, id }, kind: PieceKind }` (`src/lib/channel/model.ts:130`); kinds `artwork, product, writing, video, series, meeting, event, workshop` (`model.ts:44`). The loader (`src/lib/channel/load.ts:239-300`) reads `threads` of kinds `writing, post, meeting, reading_group, series, workshop, event` (map at `:97`) and artworks from the org's stores (`listStoreArtworks`) or the person's (`listArtworksForPerson`). The library (`src/components/channel/Library.tsx`) is a brick grid with a lightbox over the sites already loaded for that channel; there is no network-wide content search on that host (its own comment).
- **Studio** (`packages/studio`, another session's; import only): kinds registry `STUDIO_KINDS` (`src/kinds.ts`); the host contract has `searchThreads(kind, q)` (`src/types.ts:161`), the canvas card picker.
- **Per-app pickers, each listing kinds by hand:**
  - danamccool: `/api/blocks/artworks` (`?picker=1`, `?ids=`, `?gallery=`, `?page=`), `/api/blocks/card-record?ref=artwork:<id>|gallery:<id>`, `components/studio/record-picker.tsx`, `artwork-picker.tsx`, `gallery-picker.tsx`.
  - katie-the-potter: `/api/blocks/artworks`, `components/studio/artwork-picker.tsx`.
  - sunjay and elktours: `RecordSources` hosts (`components/landing/person-records.ts`) over server actions (`lib/featured-person-actions.ts`, `lib/opens-server.ts`): `person`, `opens`, `record` (gatherings, series, writing; published, PUBLIC, no `min_role`).
  - art-auction: `RepostPicker` (`app/series/[slug]/manage/panels.tsx:845`) over `searchRepostable` (`packages/commerce/src/server/series.ts:760`): public `post` and `writing` threads on the whole network, or only the actor's own; `addWeekItemAction(..., { weekNo, kind: "article", threadId })` puts one in a series week.
  - Media: `MediaPicker` (`@elkdonis/cms-ui/files`) with `/api/media/library` and `/library/mine`; `Private/` pictures refused (`isPrivatePicture`).
- **External links.** `packages/lms/src/unfurl.ts`: OpenGraph and `<title>` from a typed URL, with an SSRF guard (http(s), default ports, every hop's address checked against private ranges, 3 redirects, 4 s, 512 KB, HTML only). `embedSrc` (`apps/art-auction/src/app/series/[slug]/series-template.tsx:35`) turns video links into embed addresses. No oEmbed client exists (grep 2026-11-07).

### 3.2 Content kinds and how to query them

| Kind | Stored ref | Table | List / search | Resolve one | Public rule |
|---|---|---|---|---|---|
| Artwork (and product) | `artwork:<id>` | `artwork` + `store` (active) | `listArtworks` (`packages/commerce/src/queries/index.ts:277`, status `available` by default), `listStoreArtworks` (`:1023`), `listArtworksForPerson` (`:485`) | danamccool `loadArtworksByIds` | store active; status or "show on site" |
| Article, writing, post | `thread:<id>` | `threads` kind `writing`, `post` | `searchRepostable`, Studio `searchThreads` | `getForumThread` | `publicThreadClause` / published, PUBLIC, no `min_role` |
| Event, meeting, workshop, reading group | `thread:<id>` | `threads` | sunjay `opens-server.ts`, Channel loader | `getThreadById`, `loadEvent` | as above; drafts for editors only |
| Series (thread kind) | `thread:<id>` | `threads` kind `series` | as above | as above | as above |
| Auction series | `series:<slug or id>` | `auction_series` (+ `thread_id`) | commerce `getSeriesBySlug`, `listSeriesLots` | `getSeriesBySlug` | `status = published` |
| Gallery | `gallery:<id>` | danamccool galleries | `/api/blocks/artworks?gallery=` | `loadCardRecord` | owner's public |
| Person | `user:<id>` | `users` | `@elkdonis/services/featured-people` | `personWhoAction` | public profile |
| Media item | a URL | Nextcloud / `/api/media/library` | `MediaPicker` | n/a | not under `Private/` |
| Tour, experience, place | `tour:<id>` etc. | elktours tables | elktours `opens-server.ts` | `resolveOpens` | published, public |
| Beyond the site | `url:<https…>` | none yet | n/a (typed) | `unfurl` | public web only |

### 3.3 Proposal: a content source registry

Shared, registry-driven, with the split the action registry uses (`packages/actions/src/types.ts`: catalogue, present, server):

- **Catalogue** (client-safe, proposal `@elkdonis/blocks/sources`): one entry per kind: `{ kind, label, noun, glyph, ref: "artwork", binds: ["artwork", "record", "discussion"], scopes: ["site", "mine", "network", "beyond"] }`. The ref grammar is one string `<kind>:<id>`, already used by danamccool (`artwork:`, `gallery:`), Opens (`popup:thread:`), Channel (`thread:`, `artwork:`) and Featured person (`thread:` follows).
- **Server** (proposal `@elkdonis/services/sources`): per kind `list({ scope, orgId, viewer, q, limit })`, `resolve(ref, { orgId, viewer })` returning a common summary (the `CardRecord` shape in `packages/blocks/src/blocks/feature-card.tsx:32`: kind, title, href, image, kicker, excerpt, meta) plus a kind-specific `detail`, and `threadOf(ref)` for blocks that need a conversation (section 4.4). Every list and resolve applies the kind's public rule and the deployment's org; a stored ref never reveals a draft, a member-only thread or another org's private record (the Opens rule, `docs/open/COMPONENT_CONNECTIONS_2026-11-06.md` section 4).
- **Present**: one adapter `recordSourcesFrom(registry, host)` that returns a `RecordSources` for "From what?", so the canvas, the block popup and Puck Studio's custom field share it; and one route per app (`/api/sources?kind=&scope=&q=`, `/api/sources/resolve?ref=`) generated from the registry. The per-app `/api/blocks/artworks?picker=1`, `person-records.ts` lists and `RepostPicker` can move onto it one at a time.
- **Scopes**, as step one of the chooser: this site (the deployment's org); mine (the signed-in person's own work across orgs, as Channel's artist scope); the network (public records of any org, as `searchRepostable` does today); beyond (a typed web address).
- **Beyond the site** (open, section 7): a `url:` ref resolved once at choose time through `unfurl`, cached in a small table (`external_refs`: url, title, description, image_url, site_name, fetched_at; migration needed) and re-fetched on a schedule, never per page view (SSRF surface and latency). The picture is drawn as `<img>` through `safeSrc` (or a proxy, if the site's image policy requires one). Video links can embed through `embedSrc`. A discussion about an external piece needs a thread of its own (section 4.4).

## 4. The discussion block, direct-edit side

All of this is a **proposal**. The block definition itself is the Puck specialist's; this section states what direct edit needs from it.

### 4.1 Shape

- A shared block in `packages/blocks` (id `discussion`; a site offers it by listing it), a server component (not `interactive`), so it receives Puck's `puck` context and `editingOf` works (`.claude/rules/areas/puck-blocks.md`, 2026-11-07). The composer, follow button and "show more" are a client island (`discussion.client.tsx`), as `tab-set.client.tsx` is. Built on the record kit: `RecordFrame` for width, `placementRules` for "auto" layout, `RecordEmpty` when unbound in the editor, `defineLooks` for presets.
- The island calls host-supplied server actions (post, follow); the server decides every permission. Editors choose labels and what is shown, never who may post.

### 4.2 Props (one set, read and written by both editors)

| Prop | Kind | Group | Default | Typed on the page | Notes |
|---|---|---|---|---|---|
| `about` | string, `binds: "discussion"` | content | `""` (auto) | no: the chip (4.4) | the binding; one string |
| `group` | string | behaviour | `""` | no | only when `about` is `group:…` (4.4) |
| `heading` | string | content | "Discussion" | yes, part `title` | |
| `note` | text | content | "Posts here appear in the forum." | yes, part `note` | |
| `composeLabel` | string | content | "Add to the discussion" | yes, part `composeLabel` | |
| `placeholder` | string | content | "What caught your eye?" | panel only | an attribute, not text |
| `postLabel` | string | content | "Post" | yes, part `postBtn` | inert while editing |
| `signInText` | string | content | "Sign in to add to the discussion." | yes, part `signIn` | the link wraps the whole line, so no markup is stored |
| `emptyText` | string | content | "No posts yet." | yes, part `empty` | |
| `closedText` | string | content | "The discussion opens when this is published." | yes, part `closed` | |
| `forumLabel` | string | content | "Open in the forum →" | yes, part `forumLink` | |
| `moreLabel` | string | content | "All {{count}} posts in the forum →" | yes, part `more` | `{{count}}` filled at render (`fillTokens`, `block/bind.ts:51`) |
| `followHeading`, `followText` | string, text | content | "Follow this discussion", "" | yes, parts `followTitle`, `followNote` | |
| `followLabel`, `followingLabel` | string | content | "Follow", "Following ✓" | yes, part `followBtn` (shows `followLabel` while editing) | |
| `limit` | number 1-50 | behaviour | 12 | no | clamped in the resolver as `listSeriesDiscussion` does |
| `order` | select newest / oldest | behaviour | newest | no | |
| `threaded` | boolean | behaviour | false | no | flat as the series box, or one level of replies (`listReplyChildren`) |
| `showCompose`, `showFollow`, `showForumLink`, `showAvatars` | boolean | behaviour | true | no | hide only; cannot open a closed composer |
| `layout` | select auto / side / stacked | layout | auto | no | `layoutProp`-style; auto = follow box beside when wide (container query), below when narrow |
| `followAt` | select end / start / below / none | layout | end | no, Arrange in the popup | the series box's aside |
| `look` | select | look | `""` (as around it) | no | `defineLooks`: "As around it", "Series" (the srs look), "Quiet", "Card" |
| `morph` | hidden | look | none | n/a | parts and tokens, as every block |

Resolved keys (never stored; stripped on save by `stripResolvedKeys` with the site's table): `discussion` (thread id, slug, forum href, reply count, replies), `subject` (what it is about, how it was chosen, `CardRecord` summary), `viewerState` (signed in, `canPost` with a reason, watching), `placement`. No resolved key equals a prop name (`docs/reference/record-blocks.md` section 6).

### 4.3 Parts, and which edits each allows

Part names differ from prop names (katie's rule), and selectors use the block's own classes (`dsc-*`), never the kit's.

| Part | Selector (proposal) | Words | Free adjust (morph) |
|---|---|---|---|
| `root` | `> .dsc` | | ground, padding, width, gap between columns, corners, border |
| `main` | `.dsc-main` | | padding, ground, text defaults inherited by children |
| `sechead` | `.dsc-head` | | layout (row / stack), alignment, gap, rule under |
| `title` | `.dsc-title` | `heading` | font (library), size, weight, colour, letter spacing, case |
| `forumLink` | `.dsc-forum` | `forumLabel` | colour, size, underline |
| `note` | `.dsc-note` | `note` | font, size, colour |
| `compose` | `.dsc-compose` | | gap, ground, padding, corners |
| `composeLabel` | `.dsc-compose-label` | `composeLabel` | font, size, colour |
| `field` | `.dsc-field` | (placeholder in panel) | ground, ink, border, corners, min height |
| `postBtn` | `.dsc-post` | `postLabel` | fill, ink, size, corners, case, letter spacing |
| `signIn` | `.dsc-signin` | `signInText` | colour, size |
| `empty`, `closed` | `.dsc-empty`, `.dsc-closed` | `emptyText`, `closedText` | colour, size, style |
| `list` | `.dsc-list` | | gap, rules between items |
| `item` (repeat) | `.dsc-item` | data, locked | padding, border, layout (avatar left / above) |
| `avatar` (repeat) | `.dsc-avatar` | | size, shape, hide |
| `meta` (repeat) | `.dsc-meta` | data, locked | font, size, colour |
| `body` (repeat) | `.dsc-body` | data, locked | font, size, line height, colour |
| `more` | `.dsc-more` | `moreLabel` | colour, size |
| `follow` | `.dsc-follow` | | ground, border, padding, corners, width |
| `followTitle`, `followNote` | `.dsc-follow-title`, `.dsc-follow-note` | `followHeading`, `followText` | font, size, colour |
| `followBtn` | `.dsc-follow-btn` | `followLabel` | fill, ink, border, corners |

Tokens (Tweaks): `--dsc-bg`, `--dsc-ink`, `--dsc-accent`, `--dsc-line`, `--dsc-radius`, `--dsc-font-title` (a font token, library families only). Each falls back to the site style's `--blk-*`.

How the edits divide:

- **Inline** (typed on the page in the canvas and the block popup, through each part's `prop`; `startOwnWords` writes the same prop Puck's field edits): heading, note, compose label, button labels, sign-in line, empty and closed text, forum and more links, follow heading and text. In Puck's own canvas, `heading` and the follow heading can additionally be `inlineEditable`, if the component renders them verbatim (`PropDef.inlineEditable`, `types.ts`); the Puck specialist decides.
- **Free adjust** (morph, through the look panel in Puck and the canvas panel and thin bar in direct edit): spacing, size (Hug / Fixed / Fill, on the grid), layout inside a part (stack / row / grid, gap, alignment), colours at every part, fonts from the library, borders and corners, hide. Arrange in the popup: follow box start / end / below (writes `followAt`, a prop, not a look, because it changes structure).
- **Panel only**: `placeholder`, `limit`, `order`, `threaded`, the `show*` switches, `layout`, `look`.
- **Locked**: reply bodies, author names and times, counts. A double-click there says: "These words are the discussion's posts. They are changed in the forum." (the existing `locked` note path, `tree-editor.ts:1193`).
- **In the editor** the block draws sample replies from its contract `sample` when the subject has none, never stored (stone 1 rule), and the composer and buttons are inert (`editingOf(...).drawn`).

### 4.4 Binding: "About what?" by route, proximity or group

**One stored string, `about`**, like `person` and `opens`:

| Value | Meaning | Resolved to |
|---|---|---|
| `""` | auto: the route's record if the page has one, else the nearest record block | as below |
| `route` | the page's own record | `metadata.threadId` (event-detail), the series of a series template, a piece of a piece template |
| `near` | the nearest record-bound block: the enclosing block's record first ("About: …" of a box), then the record of a sibling in the same slot | that block's ref |
| `group:<key>` | every block whose `group` prop is `<key>` on this page | one conversation for the group |
| `thread:<id>`, `artwork:<id>`, `series:<id>`, `url:<…>` | a fixed record, chosen with "From what?" | that ref |

Resolution order for auto: route, then parent, then the nearest sibling by index, then nothing (editor: `RecordEmpty` "Choose what this discussion is about"; visitors: nothing drawn).

**Where the replies live.** A discussion needs a thread.
- `route` on a gathering, or `thread:<id>`: that thread's own replies.
- `series:<id>`: the series' mirror thread (`ensureSeriesThread`), so the new block and the existing series box show the same posts.
- `artwork:<id>`, `group:<key>`, `url:<…>`: a mirror thread generalised from `ensureSeriesThread`, created on the first post (never at render, never by the editor), in a public feed of the org (for example "Discussions"), recorded in a lookup table keyed by subject (proposal `discussion_subjects (org_id, subject_ref, thread_id)`, migration 256 or the next free number; add it to the `eac_tenant` policy set as 227 does). A group's subject ref must be stable: `group:<page slug>:<key>`, so renaming a page or key is a new conversation unless it is carried (open question).

**How the binding shows in the direct editor** (and in Puck's canvas, since the block draws it while editing):
- A chip at the block's top-left, drawn only while editing (`editingOf(...).editing || drawn`; no visitor markup): "About: Qi Gong and Alchemical Yogas · this page's gathering", "About: Salt Marsh · the artwork beside it", "About: group Week 2 · 3 pieces", "About: nothing yet". The chip is the block's own element marked `data-edit-skip`, so click-through ignores it as a box; a click on it is the gesture.
- Click the chip: the "From what?" drawer opens with a step zero, "How is it chosen?": This page's record, The nearest piece, A group on this page, A fixed record (then the registry's scopes and kinds, section 3.3), Beyond the site (a web address). The chosen value is written to `about` as one undo step.
- With the discussion selected, the house outlines the blocks it is bound to (the sibling, the parent, or every member of the group) with their names, and dims the rest. Selecting a record block that a discussion follows shows "Discussed by: Discussion below" in its panel.
- Groups: any record block can carry a `group` prop (a shared `GROUP_PROP`, declared like `OPENS_PROP`, a short key such as `week-2`). The panel offers the page's existing keys as a list plus "New group…", with a colour per key in the outline. A later gesture, not in the first build: drag the chip onto another block to bind to it.
- Proximity is shown as computed, not stored: moving the discussion (or its neighbour) changes what "near" means. The chip says so in words, and the house re-resolves after every move (section 5), because Puck alone re-resolves only on a change of parent.

### 4.5 A template modelled on the auction-series page

A Puck template (data only, as `EVENT_DETAIL_TEMPLATE`) for a collection page: hero (`hero-banner` or a site banner), a facts bar, the write-up (`prose`), one or more rows of record cards (a record card block on the record kit, `ktp-piece`-like, accepting `artwork:` and `thread:` refs; each row may carry a `group` key, which plays the role of the series' weeks), a journal (`entry-list`), and the discussion at the bottom with `about: route` (or `group:` per row). In the house, "Add from library" on a selected row opens the registry chooser and inserts a record card with the chosen ref into that row's slot (one `insert` in Puck, one undo step). Nothing is copied from the record into the page; only the ref is stored.

## 5. The house editor's coordination role

What the house should own when it becomes product code (proposal; today only the harness exists):

1. **The document and one save path.** Rooms never save. The house's `save(doc)` calls the host's action, which runs `stripResolvedKeys` (site table) + `cleanBoxDoc` + `savePage`. This replaces today's two save buttons over one row.
2. **Versions instead of instant canonical edits.** A draft per page that both rooms write, a publish step, and revisions with a published pointer (the shape is in `docs/open/PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md`; follow `lms_course_versions`, which exists; `page_revisions` does not, verified 2026-11-07 `to_regclass`). Template pages need this most: today a save to `puck:event-detail` changes every gathering's page at once. Preview a template draft against a chosen record ("Preview with: Qi Gong…") before publishing.
3. **Conflict check.** A save carries the revision (or `updated_at`) it started from and is refused if the row moved, instead of last-write-wins between Studio, the canvas and another person.
4. **Shared selection.** One selection value in the grammar both rooms already use: a node id, or a part ref `<id>~p:<part>[:i]` (`contract.ts` `partRef`). On a room switch the house hands it over: to Puck by `getSelectorForId` + `setUi({ itemSelector })` (plus the parts plugin's part), to the canvas by its select call. The panel opens on the same part in either room.
5. **Handoff rails.** The three rails of `house.tsx` (clean as a save, refuse a lost prop, log with a hash), and undo across rooms as "back to that handoff"; each room keeps its own undo inside a session.
6. **Resolver rows outside the document.** One cache of what resolvers drew, by node id and by value (as `Binding` in `records.ts` does for "From what?"), fed to both rooms; never in the document.
7. **Re-resolving bound blocks.** After a handoff, after any move (including a reorder within a slot), and after a `group` or `about` change, call `resolveDataById` for the discussion blocks and anything bound by proximity or group, because Puck 0.23 does not.
8. **Binding overlay.** The outlines and chip behaviour in 4.4, drawn by the house over whichever room is open, from `subject` and the page's groups.
9. **The chooser and the registry adapter**, passed to both rooms (`records` to the canvas and popup, a custom field to Puck), so "From what?" is one component.
10. **Role gates.** `developer` (Code tab, Detach) for platform admins only; owners and guides edit; nothing in the house widens who may post in a discussion.

What stays with each room: Puck keeps placement, the drawer, viewports, the outline and block settings; direct edit keeps click-through, the look panel, the thin bar, inline words, resize on the grid and the block popup.

## Shared schema I need from the Puck side

1. **Placement with refs, not only types.** Extend `BlockPlacement` (`packages/page-builder/src/config.tsx:83`) with `parentRef` (the enclosing block's bound record, if any) and `siblings: Array<{ id, type, ref? }>`, where `ref` is the value of the sibling's record-binding prop. The contract must say which prop that is (a `PropDef.binds` value from the registry's list, or a block-level `recordProp`).
2. **Page groups in resolver metadata.** `metadata.groups: Record<key, Array<{ id, type, ref? }>>`, computed by page-builder from the whole document before `resolveAllData` on the server and kept current in the editor, so a `group:` discussion can resolve on both sides from the same input.
3. **Route record in metadata, named once.** One key for "this page's record" across templates (`metadata.record = { ref: "thread:<id>" }`), with sunjay's `threadId` and katie's piece mapped onto it, so `about: "route"` works on every template.
4. **The block definition**: props, parts and tokens as in 4.2-4.3 (names fixed once stored), `about` declared `binds: "discussion"`, `GROUP_PROP` shared like `OPENS_PROP`, `morph` hidden field, sample replies in the contract, the island split.
5. **Resolved keys** `discussion`, `subject`, `viewerState`, `placement` in each site's `RESOLVED_KEYS`, and ideally one source of truth for them (the record kit notes two today: static tables and page-builder's `resolverKeysFor`).
6. **A custom field for `binds` props** in Puck Studio that mounts the same chooser (`mountRecordChooser` with the registry adapter), as elktours' Studio field does for `person`/`opens`/`record`.
7. **A re-resolve hook.** A way for the house to ask Puck to re-run resolvers for a set of node ids (wrapping `resolveDataById`), used after moves and group changes.
8. **Selection API.** Set and read the selected node and part from outside Puck (`getSelectorForId`, `setUi`, the parts plugin's part state), for the shared selection in section 5.
9. **Draft and revision hooks** in `savePage`/`loadPage`: a draft key, a revision id returned on load and checked on save.

## Open questions for Justin

1. Follow: on events, "Follow" as a forum watch (notifications on new posts) rather than the series' `thread_rsvps` `subscribed`? Should the series box move to watches too, so one meaning holds everywhere?
2. Who may post on an event discussion: any signed-in network user (the forum's rule), or only the org's members, or attendees?
3. Moderation: replies cannot be hidden or deleted today, only whole threads locked or archived. Is reply-level hide (owners and guides) needed before the block goes on public pages? It needs a migration.
4. Groups: what is a group for you, in words: a series week, a row of artworks, a tag? Should a group's conversation survive renaming the group or moving it to another page?
5. Proximity: when a discussion sits between two record blocks, which wins: the one above, the enclosing box, or should the editor ask?
6. Beyond the site: may a discussion be about an external page (a museum's artwork page, a YouTube video)? Should external items be cached copies (title, picture) or live links only?
7. Where these posts appear in the forum: one "Discussions" feed per org, or the feed of the record's own kind (events under Gatherings)?
8. The series-style template: for which sites first (Para Theater, Collect Art, an org site), and is the artwork or article row free to take records from other orgs on the network?
9. Template changes: should a change to `event-detail` (adding the discussion band) go live for every gathering at once, or wait for drafts and a publish step?
10. Presets: should the "Series" look (dark, Cormorant and Jost) be offered on every site, or only where it matches the site style?

## Constraints for the build phase

- Do not edit `packages/studio` or `packages/actions` (other sessions); import only. `packages/services`, `packages/blocks/src/index.ts` and `CLAUDE.md` hold other sessions' uncommitted work: `git diff` before editing.
- Store references only, never copies of records or replies, so a retitled or moderated record is right on every page (Opens and record-kit rule).
- Create discussion threads only from a visitor's first post on the server, so opening an editor or rendering a page never writes to the database.
- Keep the composer's rules on the server (`postReply`): the block's switches only hide.
- A block with no morph and no new marks must publish the same markup (published-markup check, as stone 2).
- No production rebuild, restart or commit without the developer's word (`docs/reference/ops.md`).

## History

- 2026-11-07: research and design written (this file). Verified by curl: the series page box (signed out), `/event-detail` 404, the one gathering using the template, `/channel` signed-in only. Read-only queries: `replies` columns, `puck:event-detail` row, `page_revisions` absent. Type checks 0 in elktours, sunjay, direct-edit, page-builder (read-only throwaway container).
