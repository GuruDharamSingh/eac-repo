# Discussion block, series template and Puck: the Puck side (design, 2026-11-07)

Phase 1 of a two-agent task: research and design only. This is the Puck specialist's half. The direct-edit generalist
writes the other half (direct editor, house, content picker), and the coordinator merges the two into one contract.
No code was changed. The only file written is this one. All database reads were read-only `SELECT`s. Live sites were
fetched signed out with `curl` (status and HTML only).

Contents: 1 Puck today · 2 The reference discussion box · 3 The smart discussion block contract · 4 The series
template · 5 Where the files live · 6 Puck MCP findings · 7 Open questions · 8 What the direct-edit side must agree to.

---

## 1. Puck today

### 1.1 Version

- `@puckeditor/core` **0.23.0**, pinned exactly in `packages/page-builder` and in 11 apps (art-auction, artdirect,
  arts-collective, danamccool, elktours, hidden-enneagram, ifac, innergathering, katie-the-potter, sunjay, and
  page-builder itself). One install: `node_modules/.pnpm/@puckeditor+core@0.23.0_*`.
- Upstream is at **0.24.0** (released 2026-10-29): field groups and tabs (`renderFields`, `FieldGroup`, `FieldTab`),
  checkbox fields, drag handles, expandable object fields, and **field transforms in `<Render>`**. The last one matters
  before any upgrade: page-builder's published config relies on `<Render>` transforming only slots and rich text
  (see the `richText` and `morph` comments in `packages/page-builder/src/config.tsx`). Field groups would suit a block
  with as many settings as the one below. No upgrade is proposed here.

### 1.2 Where Puck is mounted

| App (org) | Editor route(s) | Published from | Stored rows (`site_config` `puck:*`, read 2026-11-07) |
|---|---|---|---|
| sunjay (Para Theater) | `/studio/[slug]` Puck Studio with `partsPlugin`, look panel and block popup (`components/studio/page-editor.tsx`); `/studio/[slug]/canvas` the direct-edit canvas (`components/studio/CanvasEditor.tsx`); `/manage/builder` page list | `lib/puck/render.tsx`; templates `event-detail`, `journal-piece`, landing | `puck:event-detail` (2,408 B, 2026-11-06), `puck:try` |
| art-auction (market) | `/edit/[slug]` (`components/pages/page-editor.tsx`); `/panel/[orgSlug]` store panel | `lib/puck/render.tsx`; template `article-detail` draws `/read/<slug>` | none stored |
| elktours | `/studio/[slug]`, layout studio, `/manage/builder` | `lib/puck/render.tsx` | `puck:landing`, `puck:tour-detail` |
| katie-the-potter | `/studio/[...path]`; whole site is `[[...path]]` | `app/[[...path]]/page.tsx`, `lib/piece-render.tsx` | none under `site_config` yet |
| danamccool | `/studio/[...path]`; whole site `[[...path]]` | same | 26 pages |
| hidden-enneagram, innergathering | `/studio/[slug]` | `lib/puck/render.tsx`, `/p/[slug]` | innergathering 3 (`inner_group`) |
| arts-collective | `/hub/sites/[slug]/design` (`OrgPageEditor`) | `lib/puck/render.tsx` (`puck:home` per org) | per org |
| artdirect | person page designer (`user_pages`, migration 157) | `lib/person-pages.ts` | `user_pages` |
| ifac | render only (`components/person-view.tsx`) | | |

The auction-series page (`market.arts-collective.com/series/<slug>`) is **not a Puck page**. It is a hand-written
template (`apps/art-auction/src/app/series/[slug]/page.tsx` + `series-template.tsx`) with editing in place
(`page-editor.tsx`).

### 1.3 The shared config and how app blocks register

- `@elkdonis/blocks` declares every block as data: `defineBlock(def, Component, sample?)`, with `def.props: PropDef[]`
  (kinds `string text richtext number boolean select list url image slot rows`; extras `binds`, `format`, `min/max`,
  `options`, `allow`, `fields`). `SHARED_BLOCKS` is the shared catalogue; nothing in blocks imports Puck.
- `@elkdonis/page-builder` `buildPuckConfig({ resolvers, blocks, fields, root, decorate, blockStyle, style, morph })`
  turns the catalogue into a Puck `Config`. It adds the generic Style (`blkStyle`) and a hidden `morph` field to every
  block, maps `memberSafe` to Puck permissions, and wraps each resolver: it computes `metadata.placement` from Puck's
  `parent` (`placementOf`), memoises the call by the props and metadata keys it **read** (`remember`), and marks the
  output `readOnly`. `buildEditorConfig({ media, ... })` (client) adds the editor-only controls (image picker, sliders,
  rich text, canvas drag, empty-block cards).
- Each app builds its catalogue as `[...SITE_BLOCKS, ...SHARED_BLOCKS.filter(curated ids)]` (`lib/puck/catalogue.ts`)
  and builds **two** configs from it: `config.server.ts` (resolvers read the database) and `config.client.ts`
  (resolvers call the app's `/api/*` routes, with sample fallbacks). A block missing from the server config renders
  nothing.
- Published pages: `loadPage` → `resolveAllData(data, serverConfig, { orgId, slug, canEdit, ...route metadata })` →
  `<Render>` from `@puckeditor/core/rsc`. Template routes pass the record they draw as metadata (`threadId` on sunjay's
  event route; `slug` and `threadId` on art-auction's `/read/<slug>`).
- Saving: each app's `savePageAction` runs `stripResolvedKeys(data, RESOLVED_KEYS)` (`@elkdonis/blocks/record`) or an
  older private walker (art-auction and arts-collective still have their own).
- Known import trap (still true): `packages/page-builder/src/index.ts` re-exports the editor, the field controls and a
  client store. Server code must import `@elkdonis/page-builder/config` or `/server`.

Puck APIs in use: fields (text, select, array, custom, richtext with `contentEditable`), `defaultProps`,
`resolveData` (with `parent`, `trigger`, `readOnly`), `permissions`, `categories`, `root`, slots, plugins
(`templatesPlugin`, `partsPlugin`, editor tabs), `overrides` (`iframe`, `fields` in the parts plugin), `useGetPuck`,
`resolveDataById` (parts popup), `history.setHistories`, `walkTree` and `getParentById` (editor chrome), `metadata`,
`viewports`, `resolveAllData` and `Render` from `/rsc`. Not used: `resolveFields`, `resolvePermissions`, `onAction`,
Puck AI, and the 0.24 field groups.

### 1.4 The house

- In production the house is the **direct-edit canvas** that hosts Puck. Agreed model (developer decisions,
  `docs/sessions/2026-11-06_editor-house.md` section 1): Puck places blocks, the direct editor shapes their look, and the canvas
  stays the house for live pages with sealed blocks. On sunjay: `/studio/<slug>/canvas` mounts
  `@elkdonis/direct-edit/puck` `mountTreePage` with `canvasConfig` and `canvasContract = contractOf(CATALOGUE)`,
  rows from `resolveAllData` (by node id, never saved), `records` ("From what?") and `blockEditorHref: /studio/<slug>`
  (Puck Studio on the same document).
- The two-room experiment (`packages/direct-edit/harness/frankenstein/house.tsx`): one document, Arrange (Puck) and
  Shape (canvas), one writer at a time. A handoff `settle()`s the document as a save would (strip resolved keys and
  `readOnly`, `cleanBoxDoc`), refuses a handoff that drops a prop of a surviving block, and logs it.
- The direct editor reads a block through `contractOf(blocks)` (`packages/blocks/src/contract.ts`): each prop is given
  a `group` by kind (`groupOf`: slot → none; colour string → look; string/text/richtext/url/image/rows/list →
  content; everything else → layout). The panel (`direct-edit/src/canvas/block-fields.ts`) shows
  `rows` and `list` only as counts, and offers "From what?" for `binds` props when the host passes `RecordSources`.

### 1.5 What Puck 0.23 gives a block about its surroundings (read from the installed bundle)

- `resolveData(data, { changed, lastData, metadata, trigger, parent, root })`. `parent` is the **parent node with its
  stored props**, so inside a slot the block sees its siblings' stored props (types, bound ids). At the **top level the
  parent is the root** (`type: "root"`, root props only). `data.content` is not in it, so a top-level block **cannot
  see its siblings**. This holds in the editor (`appStore.resolveComponentData`, `chunk-K2LNXU54.mjs`) and in
  `resolveAllData` (`chunk-YQWFSBOU.mjs`).
- In `resolveAllData` siblings resolve in parallel (`Promise.all`). A block never sees another block's resolved rows.
- Puck's own resolver cache (`resolve-component-data.ts`) **skips** a block unless its own data changed, or it moved to
  a different parent (`trigger: "move"`), or the trigger is `force`. Changing the artwork in the block above a
  discussion does **not** re-run the discussion's resolver, and neither does reordering within one parent.
- A new `metadata` prop on `<Puck>` reaches the store (`generateAppStore` dependency) but triggers no re-resolve.
- The tools exist for an outside pass: `walkTree`, `getParentById`, `getSelectorForId`, `resolveDataById(id, trigger)`
  and `resolveDataBySelector`. Rule already recorded: a plain `dispatch({type:"replace"})` runs no resolver.
  `resolveFields` does receive `appState`, but it returns fields, not data, so it is not a place to resolve a topic.

Consequence for the design: proximity cannot be solved inside one block's resolver. It needs a **whole-document pass**
that runs before resolving (server, canvas) and on every change (Puck editor), and whose result reaches resolvers
through `metadata`. Section 3.3 gives that pass.

---

## 2. The reference discussion box

### 2.1 Files

| What | Where |
|---|---|
| Series page section (the reference) | `apps/art-auction/src/app/series/[slug]/series-social.tsx` `SrsDiscussion` (client): heading, "Open in the forum →", note, inline composer (textarea + Post), replies list (avatar initial, name, "x min ago", sanitised HTML), "All N posts in the forum →", and a **Follow this series** aside |
| Its actions | `apps/art-auction/src/app/series/[slug]/actions.ts` `replySeriesAction`, `followSeriesAction` (signed in, series published) |
| Its data | `packages/commerce/src/server/series-social.ts`: `ensureSeriesThread`, `syncSeriesThread`, `listSeriesDiscussion`, `postSeriesReply`, `setSeriesFollow`, `seriesFollowState`, `listSeriesFollowers` |
| Its CSS | `series-template.css` (`.srs-discussion`, `.srs-compose`, `.srs-replies`, `.srs-follow`) |
| The Puck sibling already on art-auction | `apps/art-auction/src/blocks/article-blocks.tsx` `au-discussion` + `discussion.client.tsx` `DiscussionView` (polls `/api/auction/discussion` every N s, "Join the discussion" opens the forum, no inline composer, Tailwind, `interactive: true`) |
| Its data | `apps/art-auction/src/lib/article-data.ts` `loadDiscussion` (public thread in a public feed with no `min_role`), `app/api/auction/discussion/route.ts` (public, `no-store`, id-shape check) |
| The forum write path both rely on | `packages/services/src/forum-write.ts` `postReply` (sign-in, locked, Nextcloud-shared rule, 40 KB cap, rate limit, watches, notifications, reads), `toggleWatch`, `toggleHeart`/`setVote` (replies have `vote_score` and `reaction_count`, migration 112), `moderateThread` |

Live, signed out (2026-11-07): `/series/ifac-fall-auction` answers 200 and draws "Discussion · Open in the forum → ·
Posts here appear in the forum under Auction series. · Sign in to add to the discussion. · No posts yet. · Follow this
series …".
`paratheater.arts-collective.com/event-detail` answers 404 by design: `event-detail` is a template slug
(`apps/sunjay/src/lib/puck/reserved.ts`). It draws `/<feed>/<slug>` for each gathering with
`threads.metadata.detailPage = true` (one today), and it is edited at `/studio/event-detail(/canvas)`. Its stored
document is `pt-band > pt-event-header`, `pt-band > split-row > (pt-steps, pt-talk-room, pt-notice | pt-event-rsvp,
pt-event-materials)`, `pt-band > pt-event-about`. A discussion would go in a fourth band at the bottom.

### 2.2 Data model

A discussion is **a forum thread's replies**: `threads` (one row, any kind) and `replies` (`parent_reply_id` for one
level of nesting, `vote_score`, `reaction_count`). Nothing is copied.

| Subject | Its thread | State |
|---|---|---|
| A forum topic or article | the thread itself (`kind = 'post'`) | built (`au-discussion`) |
| An event or gathering (sunjay) | the event's own thread (`threads.id` = `metadata.threadId` on the route) | thread exists; no discussion block yet |
| An auction series | mirror thread `auction_series.thread_id` (migration 212), a `post` in the org's public `auction-series` feed, created on publish or first need by `ensureSeriesThread` | built (series page) |
| An artwork in a series | `auction_series_slot_artwork.discussion_thread_id` (migration 190, comment: "created on first view") | **column only; no code uses it** |
| An artwork anywhere else (katie, danamccool, a store) | none | not modelled |

Following differs: the series uses `thread_rsvps(status = 'subscribed')`, which the desk's week letters read through
`listSeriesFollowers`. The forum's own follow is `watches`, which drive notifications. `postReply` adds a `watches` row
for every poster.

Visibility rules that must stay: a thread is shown only when it is `published` and `PUBLIC` **and** its feed is public
with no `min_role` (the forum gates by feed). Replies carry a display name or "A member", never an email. Bodies go
through `sanitizeRichText`.

### 2.3 Reuse versus wrap

- **Reuse as the engine:** `postReply` (writes), the public-feed join from `article-data.ts loadDiscussion`, the
  series query shape (`listSeriesDiscussion`, with `authorSlug` and `mine`), `ensureSeriesThread`, the follow helpers,
  and `DiscussionView`'s poll loop (visibility-aware, server clock skew, `useFlash` on a new count). Lift them into
  one shared server module (section 5) instead of the third and fourth copies.
- **Reuse as a look:** `SrsDiscussion`'s markup and `.srs-*` rules become the block's `journal` look. The shared block
  is `styling: "tokens"`, so the Tailwind `au-discussion` styling is not reused.
- **Wrap, don't replace (yet):** the hand-coded series page keeps `SrsDiscussion` until the series template (section 4) is
  published for it. `au-discussion` keeps its id: it is stored in no page today (`market` has no `puck:*` rows), but
  ids are never reused. It either stays as it is or is redeclared as a preset of the shared block (open question
  7.6).

---

## 3. The smart discussion block

### 3.1 Identity

- `def.id`: **`discussion`** (shared, in `SHARED_BLOCKS`; no collision found in `packages/blocks` or any app's blocks).
- Label "Discussion"; category `listings`; `memberSafe: true` (it shows only public replies, and the write path
  checks the viewer); `dataDriven: true`; `styling: "tokens"`.
- **Not** `interactive`. The declaration and the shell are a server component, so the shell receives `puck`
  (`editingOf(p.puck)`: inert while editing, `RecordEmpty` when nothing is found). The composer, polling, hearts and
  Follow are an island, `discussion.client.tsx`, which receives only plain data. This follows the rule in
  `.claude/rules/areas/puck-blocks.md` on the `puck` prop and islands.

### 3.2 Props (all plain scalar `PropDef`s, so both editors can edit them)

Every prop below is stored in the page. None is filled by a resolver. Resolver output uses other names (3.5).

**About what** (group: content)

| name | kind | default | notes |
|---|---|---|---|
| `topic` | select | `auto` | `auto` "What sits above it" · `group` "Blocks with the same group key" · `pick` "A record I choose" · `page` "This page's own record" |
| `topicGroup` | string | `""` | shown when `topic = group`. The same prop name is added to every subject block (3.4) |
| `subject` | string, `binds: "record"` | `""` | shown when `topic = pick`. A reference: `thread:<id>`, `artwork:<id>`, `series:<id>` (grammar shared with `feature-card` and the Channel library's `Piece.key`) |

**Words** (content)

| name | kind | default |
|---|---|---|
| `heading` | string, `inlineEditable` | "Discussion" |
| `intro` | text | "" (e.g. "Posts here appear in the forum under Auction series.") |
| `emptyMessage` | string | "No posts yet. Start the conversation." |
| `closedNote` | string | "" (empty: the source's own words, e.g. "The discussion opens when the series is published.") |
| `forumLabel` | string | "Open in the forum →" |
| `placeholder` | string | "What caught your eye?" |
| `postLabel` | string | "Post" |
| `signInLabel` | string | "Sign in to add to the discussion." |
| `followHeading` | string | "Follow this" (empty: "Follow this <kind>") |
| `followText` | text | "" (empty: the source's own sentence, e.g. the series' "A short email when new lots go up…") |

**Layout and look** (layout / look)

| name | kind | default | notes |
|---|---|---|---|
| `layout` | select | `auto` | `auto` · `full` (replies under the heading) · `split` (replies beside a Follow aside, the series page) · `compact` (count, latest two, link). Auto, by placement (3.3.4) |
| `look` | select via `defineLooks` | `""` | `""` as around it · `house` · `journal` (the series page) · `forum` (forum-ui steel) · `cards`. An app adds its own with `defineLooks` |
| `density` | select | `comfortable` | `comfortable` · `compact` |
| `showAvatars`, `showTimes`, `showCount` | boolean | true | |

**Replies** (behaviour)

| name | kind | default | notes |
|---|---|---|---|
| `limit` | number 1–30 | 8 | |
| `sort` | select | `newest` | `newest` · `oldest` · `top` (`vote_score`, then hearts) |
| `threading` | select | `flat` | `flat` · `nested` (one level, `parent_reply_id`) |
| `reactions` | boolean | false | hearts on replies (`toggleHeart`) |
| `refresh` | number 0–60 s | 10 | 0 = no live polling |
| `forumLink` | boolean | true | |

**Posting and moderation** (behaviour)

| name | kind | default | notes |
|---|---|---|---|
| `composer` | select | `inline` | `inline` (post on the page, the series box) · `link` (button to the forum, today's `au-discussion`) · `none` (read only) |
| `whoCanPost` | select | `signed-in` | `signed-in` · `members` (org members) · `team` (the site's editors). Checked by the write route, on top of `postReply`'s own rules |
| `allowReplies` | boolean | false | reply to a reply |
| `follow` | boolean | false | draws Follow (the aside in `split`, a button otherwise) |
| `noTopic` | select | `hide` | published page with nothing found: `hide` · `note` (draws `emptyMessage`). In an editor it always draws a "Nothing to discuss yet" placeholder with the reason |

Not props (decided by the platform, never by a page): which replies a visitor may see (the feed and thread rules in
2.2), locking and deleting (forum `moderateThread`), the rate limit. A "Moderate in the forum" link shows to moderators
only.

Count: 30 props, which is why section 8 asks for `group` overrides and conditional visibility, and why Puck 0.24's field
groups would help.

### 3.3 Finding the topic: proximity and group

#### 3.3.1 Subjects: which blocks are "about" something

A new optional, data-only field on `BlockDef`:

```ts
about?: {
  kind: string;        // a content-source kind: "thread" | "artwork" | "series" | "record" (the ref carries its kind)
  prop?: string;       // the prop holding the bound value; its value wins
  page?: string;       // the metadata key of the page's own record of this kind, used when `prop` is empty
};
```

| Block | `about` |
|---|---|
| `ktp-piece` (katie) | `{ kind: "artwork", prop: "artwork", page: "piece" }` |
| `au-article` | `{ kind: "thread", prop: "slug", page: "threadId" }` (a slug is resolved by the source) |
| `pt-event-header`, `pt-event-about` (sunjay) | `{ kind: "thread", page: "threadId" }` |
| `pt-article` (sunjay writing) | `{ kind: "thread", prop: "piece", page: "piece" }` |
| `feature-card` | `{ kind: "record", prop: "record" }` |
| series template blocks (section 4) | `{ kind: "series", page: "seriesId" }` for the hero; the lot and shelf blocks have no `about` of their own |

`subjectOf(node, page)` returns a ref or null: the trimmed `props[about.prop]`, prefixed with `kind:` unless it already
carries a kind; else `kind:<page[about.page]>` when the page has that record; else null.

The page's own subject: every route that draws a template passes **`metadata.subject`**, a ref, beside what it passes
today. sunjay's event route adds `subject: "thread:<id>"`; `/read/<slug>` adds `subject: "thread:<id>"`; the series
route adds `subject: "series:<id>"`; katie's piece route adds `subject: "artwork:<id>"`. One more key, so blocks stop
needing to know which metadata name each app uses.

#### 3.3.2 The pass: `findTopics(doc, contract, metadata) → Record<discussionId, Found | null>`

Pure and client-safe, with no Puck import: it walks stored page JSON (`content`, slots at any depth, legacy `zones`).

```
Found = { ref: string; via: "auto" | "group" | "pick" | "page"; from?: string /* node id */; reason: string }

1. Order. Walk the document depth-first, pre-order. A node's slots are visited in the order its def DECLARES them
   (contract props), never by stored key order: Puck reorders keys when it flattens nodes (frankenstein finding).
   Legacy zones `<id>:<zone>` come after that node's slots, in zone-name order. Each node gets `order` (its position in
   reading order), `parentId` and `slot`.
2. For each node of type "discussion", D:
   pick  → parseRef(D.subject) or null                                            reason "chosen"
   page  → metadata.subject or null                                               reason "this page's own"
   group → among nodes N ≠ D with N.topicGroup == D.topicGroup (trimmed, non-empty) and subjectOf(N) ≠ null,
           take the smallest |order(N) − order(D)|; on a tie the one before D      reason "same group “k”: <label>"
           none → metadata.subject                                                 reason "nothing in “k”; this page's own"
   auto  → climb from D:
           a. in D's own slot list, look at the siblings BEFORE D, nearest first; then at the owner's EARLIER slots
              (declared order), last node first. For each candidate S:
                - subjectOf(S) → take it
                - S holds slots → search S's subtree from its LAST descendant backwards; first subject wins,
                  unless that subtree holds two or more DIFFERENT subjects and S has none of its own:
                  then skip S (reason line: "skipped <label>: several")
           b. then the block that owns this slot list: subjectOf(owner) → take it
           c. repeat (a, b) one level up (the owner's own siblings), until the top level
           d. at the top: metadata.subject, else null                              reason "this page's own" / "nothing above it"
3. A discussion never takes another discussion as its subject, and never looks below itself (open question 7.2).
```

Worked example, sunjay `event-detail` with a fourth band holding `discussion` (auto). Its band has no earlier sibling.
The band's owner has no `about`. Up one level, the bands before it, nearest first: band 3 holds `pt-event-about`, whose
subject is `thread:<route event>` (from `metadata.threadId`). Found, with reason "the event above". The same document
draws every event, and each one gets its own thread.

Worked example, a `split-row` with `ktp-piece` (artwork A) in its `start` column and `discussion` in `end`. The
discussion has no earlier sibling in `end`. `start` is declared before `end`, so step a searches `start` next and
finds artwork A ("the piece beside it"). Without the earlier-slot rule it would climb past the split-row and could end
on the page's own record, which is not what an author expects.

Worked example, a row of six pieces (`ktp-piece-row`) and then a discussion. The row holds six different subjects and
has no `about` of its own, so it is skipped ("skipped Row of pieces: several"). The pass climbs on. To discuss one of
the six, set `topic: pick` or give that piece and the discussion the same `topicGroup`.

#### 3.3.3 When the pass runs

| Where | How |
|---|---|
| Published page | `resolvePage(data, config, metadata)` (new, `@elkdonis/page-builder/config`, server-safe) runs `findTopics` and then `resolveAllData(data, config, { ...metadata, topics })`. Each app's `render.tsx` swaps one call. The `discussion` resolver reads `metadata.topics[props.id]` |
| Puck Studio | `topicsPlugin({ contract })` (new, page-builder, client). It seeds `topics` from the initial document before Puck mounts (so the first `load` resolve is right), subscribes to `appState.data` (debounced about 150 ms), recomputes `findTopics`, keeps the map in a small module store the client resolver reads, and calls `getPuck().resolveDataById(id, "force")` for each discussion whose `Found` changed. `force` is needed: Puck's cache skips blocks whose own data did not change (1.5) |
| Canvas (direct edit) | The house's `resolveAllData` call (`CanvasEditor.tsx`, `house.tsx`) becomes `resolvePage`. After any structural edit (move, add, delete, a subject's bound prop changed) the canvas recomputes `findTopics` on its document and refetches rows for the discussions whose `Found` changed. Owned by the direct-edit agent; the pass is the shared function |
| Save | Nothing to do for topics: `topics` lives in metadata, never in the document |

Editor "why" line (as `describeLayout` does for record blocks), under the block while editing: "About: the event above
(pt-event-about)" · "About: chosen (Lot 12, Kiln study)" · "About: group “fall-lots”, Lot 3" · "Nothing to discuss
yet: place it under an artwork, an article or an event, or choose one."

#### 3.3.4 Placement (layout `auto`)

Use the record kit's `placementRules` (`@elkdonis/blocks/record`) for `where`, then map: `page`/`other` → `split`
when `follow` is on, else `full`; `column`/`row`/`hero` → `compact`. The frame is `RecordFrame` (an `inline-size`
container), so container queries can further stack `split` under about 34 rem, as `ktp-piece` does. Puck re-runs the
resolver on a move to another parent, because it reads `placement`.

### 3.4 The group key on subject blocks

`topicGroup` (string, default `""`, label "Group key", help "Discussions set to the same key take this as their
subject") is added by `buildPuckConfig` to every block whose def declares `about`, the same way it adds `blkStyle`.
Name checked: `group` is already a select on `au-timeline` (`apps/art-auction/src/blocks/auction-blocks.tsx:112`), so
the universal key cannot be called `group`. `topicGroup` is unused. It must become a reserved prop name (with
`morph`, `blkStyle`) so a block cannot declare it with another meaning.

### 3.5 Resolver output and stripping

The resolver (both configs) returns these keys, none equal to a prop:

| key | shape (plain JSON) |
|---|---|
| `found` | `{ ref, via, reason, title?, href?, kind? } \| null`: what the pass found, for the why line and the heading's kicker |
| `thread` | `{ threadId, forumHref, replyCount, replies: [{ id, parentId, authorName, authorSlug, html, at, hearts?, mine? }], open: boolean, closedReason? } \| null`: today's `WireDiscussion` plus `open` |
| `viewer` | `{ signedIn, name?, canPost, following?, followCount? }`: per request on the published page. In the editor it is the editor's own, and it is stripped on save |
| `placement` | `ResolvedPlacement` from the record kit |

Stripping: add `discussion: ["found", "thread", "viewer", "placement"]` to each host's `RESOLVED_KEYS` for now.
Proposed: declare it once on the def (`resolved: ["found", "thread", "viewer", "placement"]`) and derive each app's
table from the contract (`resolvedTableOf(contract)`). That closes the "two sources of truth" limit listed in
`docs/reference/record-blocks.md`, and gives the canvas's `resolvedRows` (`CanvasEditor.tsx`) the same list without
a copy. `stripResolvedKeys` walks slots and zones already. Resolver output must stay plain JSON: Dates go out as ISO
strings.

The client resolver (editor) asks `GET /api/discussion?topic=<ref>&limit&sort&threading` (5.2). It falls back to the
block's `sample()` when the topic has no thread yet, and labels it as a sample, as art-auction's editor does today.

### 3.6 Parts and tokens (for the look layer)

Parts (names differ from prop names): `root` (`> .blk-disc`), `head`, `title`, `note`, `compose`, `field`, `post`,
`list`, `reply` (repeat), `who`, `when`, `body`, `more`, `aside`, `followBtn`. Tokens: the shared `BLOCK_TOKENS` plus
`--blk-disc-reply-bg` (colour) and `--blk-disc-gap` (length).

---

## 4. The series template (Puck), modelled on the auction-series page

### 4.1 Shape

The series page today, top to bottom: nav · hero (video or image, curator) · bar (dates, lots, artists, countdown) ·
curator write-up beside "where the money goes" · the weeks · the lots · series journal · articles · discussion +
follow · footer. As a Puck template it becomes a document like sunjay's `event-detail`: one stored template
(`puck:series-detail`, a `TEMPLATE_SLUG`) that draws every `/series/<slug>`, with route metadata
`{ seriesId, slug, subject: "series:<id>" }`, editable at `/edit/series-detail` (art-auction) and later in the house.
Until a template is published, the hand-coded page stays (the same fallback the event and article routes use).

```
series-hero           about { kind: series, page: seriesId }   props: media (auto|image|video), showCurator, height
series-bar            (art-auction)                            props: show dates/lots/artists/countdown
split-row (wide-start)
  start: prose-from-record "write-up"                          (the series' description_html, read-only, typed override)
  end:   series-money                                          (commission sentence, partners)
series-weeks          (art-auction)                            props: show focus/question, highlight current
content-shelf "Lots"  source: series-lots + picks              props below
series-journal        (art-auction)
content-shelf "Articles" source: series-articles + picks
pt-band/section
  discussion          topic: auto → finds series-hero → series:<id>; layout split; follow on; composer inline
```

### 4.2 Adding artworks and articles: `content-shelf` and the content source registry

`content-shelf` (shared, tokens) is a smart list of cards. Props:

| name | kind | notes |
|---|---|---|
| `heading`, `intro`, `emptyMessage` | string/text | |
| `source` | select | `picked` (only the picks) · `record` (what the page's subject holds: a series' lots or week articles, a person's works) · `record+picked` (the record's, then the picks) |
| `items` | rows of `{ ref (binds "record"), label, note }` | the picks. `ref` grammar: `artwork:<id>`, `thread:<id>`, `series:<id>`, `url:<https…>` |
| `kinds` | list | filter for `record`: `artwork, writing, video, event…` (the Channel `PieceKind`s) |
| `layout` | select | `grid` · `row` · `list` · `feature-first` |
| `columns` | number 0–6 | 0 = as many as fit |
| `cardLook` | select | the card looks (`blkStyle` presets) |
| `limit` | number | |
| `showPrice`, `showStatus`, `showKicker` | boolean | prices, sale state and the buy or bid button always come from the record |

The card for each item is drawn from one **resolved card shape**, the `CardRecord` `feature-card` already uses (kind,
title, href, image, excerpt, meta), plus `price`, `status`, `lotNumber` and `bidCount` when present. A shelf
in a series template lists the series' lots by default (`source: record`), and an editor adds a work from elsewhere
with "+ Add" (a pick).

The **content source registry** (server, one per deployment, extended per app):

```ts
interface ContentSource {
  kind: string;                                   // "artwork" | "thread" | "series" | "url" | …
  label: string;                                  // "An artwork", "A piece of writing", …
  /** "From what?" step 1 and 2, only what this editor may pick AND a visitor may see. */
  sources(ctx): Promise<RecordSourceItem[]>;      // "This site", "The network", "My works", "Paste a link"
  choices(ctx, source, query): Promise<RecordChoice[]>;
  /** Draw: a ref to a card, under the visibility rules; null when gone or hidden. */
  card(ref, ctx): Promise<CardRecord | null>;
  /** What a page subject of this kind holds, for `source: record`. */
  holds?(ref, ctx, { kinds, limit }): Promise<string[]>;   // refs
  /** Discussion: the thread for this subject, creating it only when `create` (first post). */
  thread?(ref, ctx, { create }): Promise<{ threadId: string; forumHref: string; open: boolean; closedReason?: string } | null>;
}
```

It feeds both pickers: Puck's custom field for `binds: "record"` (sunjay's `PersonPickerField` already does this for
`record`) and the canvas's `RecordSources` ("From what?"). Its `card()` is the resolver for shelf items, `feature-card`
and the discussion's `found.title`. The `/channel` library already enumerates content as `Piece.subject = { kind:
"thread" | "artwork", id }` across eight piece kinds (`apps/arts-collective/src/lib/channel/model.ts`). The network
source should read the same query (`listArtworksForPerson`, `listStoreArtworks`, the org thread lists), so "what is on
the site" in the picker is the library Justin already sees at arts-collective.com/channel.

### 4.3 "Beyond the site" (open question 7.4)

- `url:<https…>` refs, unfurled server-side (OpenGraph, or oEmbed for YouTube, Vimeo and Instagram), cached in a table
  and re-fetched on a schedule. Drawn as a link card (title, site, image proxied through our media route), never as
  a third-party iframe unless the provider is on an allowlist.
- Series week items already carry `link` and `media` (the Articles section draws them). The same `url:` card can draw
  them.
- Undecided: whether outside items may have a discussion (a `url:` topic would need a mirror thread like the series),
  the licence and attribution of outside pictures, and whether a member (not only an editor) may add outside links.

---

## 5. Where the files live

Shared from the start, so every app (and the org-site kit, `docs/open/ORG_SITE_KIT_BRIEF_2026-11-06.md`) gets the same
block with no copy:

| Piece | Home | Client-safe? |
|---|---|---|
| `about` on `BlockDef`, `topicGroup` reserved, optional `group` and `when` on `PropDef`, `resolved` on `BlockDef` | `packages/blocks/src/types.ts`, `contract.ts` (passed through `contractOf`) | yes |
| `findTopics`, `subjectOf`, `parseRef` (ref grammar) | `packages/blocks/src/topic/` → `@elkdonis/blocks/topic` | yes, pure |
| `discussion` declaration + server shell | `packages/blocks/src/blocks/discussion.tsx` (in `SHARED_BLOCKS`) | yes (no DB) |
| composer, polling, hearts, Follow island | `packages/blocks/src/blocks/discussion.client.tsx` | client |
| `content-shelf` | `packages/blocks/src/blocks/content-shelf.tsx` | yes |
| `resolvePage` (pass + `resolveAllData`) | `packages/page-builder/src/config.tsx` → `@elkdonis/page-builder/config` | server-safe |
| `topicsPlugin` | `packages/page-builder/src/topics/plugin.tsx` (main entry) | client |
| Discussion data (load, post, follow, `thread()` per kind) | `packages/services/src/discussion.ts` → `@elkdonis/services/discussion`, built from commerce `series-social.ts`, art-auction `article-data.ts` and `forum-write.ts` | server |
| Content source registry (`thread`, `artwork`, `series`, `url`) | `packages/services/src/content-sources/` → `@elkdonis/services/content-sources` | server |
| Routes `GET/POST /api/discussion`, `POST /api/discussion/follow`, `GET /api/content-sources` | a factory `discussionRoutes(site)` / `contentSourceRoutes(site)` in services (like `centerRoutes()`), later kit table entries (`area: "api"`, gate `public` / `signed-in`) | server |
| Series template | `packages/blocks/src/templates/series.ts` (data only, as `templates/store.ts`) | yes |
| Auction-only blocks (`series-bar`, `series-weeks`, `series-journal`, `series-money`) | `apps/art-auction/src/blocks/series-blocks.tsx` (Tailwind is allowed there; tokens preferred) | |
| Looks for the discussion (`journal`, `forum`, `cards`) | `packages/blocks/src/blocks.css` (`.blk-disc*`, layered) | |

Per app, wiring only: add `discussion` (and `content-shelf`) to the curated `SHARED_IDS`, register the resolver in both
configs (or receive it from page-builder when `resolvePage` gains a default for shared data blocks), mount the two route
files, and pass `metadata.subject` on template routes.

---

## 6. Puck MCP findings

Searched npm (registry search API: "puck mcp", "puck-mcp", "puckeditor", "puck ai") and GitHub (repository search:
"puck mcp", "puckeditor mcp", "puck-mcp", "mcp puck editor"), and read the Puck docs and blog. Nothing was installed.
The CLI tarball's file list and bundle were read as a stream (`tar -t`, `tar -xO | grep`), never unpacked or run.

| Name | Maintainer | Licence | Activity | What it is | Fit |
|---|---|---|---|---|---|
| **No Puck MCP server exists**, official or community, as of 2026-11-07 | | | | | |
| Puck AI: `@puckeditor/plugin-ai`, `@puckeditor/cloud-client`, `@puckeditor/ai-types` | Puck (chrisvxd) | no licence field on npm; a paid Puck Cloud service (plans Pay as you go, Launch, Growth, Enterprise) | 0.8.3 latest, canaries daily (modified 2026-11-07); 0.8 blog 2026-07-28 | Chat plugin in the editor plus a server proxy (`puckHandler`). Headless `generate({ prompt, config, pageData? })` returns Puck Data. "Assembly" mode uses your components; "design" mode generates new ones. Custom `tool()`s with a Zod schema run **on your server**. OpenAI models; bring-your-own-key on some plans | Not MCP. Sends our config and page data to Puck Cloud. Writes Puck Data through their agent, not through our store, rules or sanitisers |
| `@puckeditor/plugin-pages`, `@puckeditor/plugin-auth` | Puck | no licence field | 0.8.3 / 0.9 canary | Puck Cloud page storage and auth | Cloud only |
| `@puckeditor/cli` | Puck (chrisvxd) | MIT | 0.24.0 canaries only, created 2026-09-29, 9 versions | "Set up Puck and Puck Cloud from the command line. Built for coding agents." Commands seen: `init`, `add`, `login`, `pages`; ships Puck's docs as markdown (`dist/docs/**`) and app templates. No `mcp` string in the bundle | Scaffolding, not page data |
| `puckeditor/skills` | Puck | MIT | 7 stars, pushed 2026-09-29 | An Agent Skill (and Claude Code plugin) that teaches coding assistants to integrate Puck, author a config, wire routes, add Puck AI | Useful as reading for agents; does not touch live data |
| `yahyatarique/futuremod` | individual | none | 1 star, last push 2026-05-05 | An app (Puck + Supabase + Workers) tagged `mcp` | Not a reusable server |

### What a small in-repo MCP (or CLI) over our Puck data would need (described only)

- **Store access, server side only.** Read through `loadPage` / `listPages` / `loadUserPage` (which run `validatePage`).
  Write only through `savePage` / `saveUserPage` (which sanitise) after `stripResolvedKeys`. Never raw `site_config`
  SQL. Scope every call to one org: the org comes from the server's own config, never from the tool arguments (the
  block-route rule).
- **Tools.**
  - `list_pages(org)`
  - `get_page(org, path)` (the document with ids; optionally resolved through `resolvePage` for a preview)
  - `list_blocks(app)`: the `contractOf` catalogue with props, kinds, options, `binds`, `about`, parts
  - `validate_page(org, path, doc)`: `validatePage`, unknown types, props against `PropDef` (kind, options, min/max),
    slot `allow`, reserved names
  - `patch_page(org, path, ops)`: small operations (insert a block of a type at a selector, set props, move, remove)
    instead of whole documents, so a model cannot drop what it did not read. Each op is checked against the contract.
    The house's "dropped prop" rail is applied.
  - `save_draft` and `publish(org, path)`: publish needs an explicit human yes. A template slug says how many pages it
    draws (sunjay's `TEMPLATE_NOTICE`).
  - `find_topics(org, path)`: section 3.3, for checking what each discussion block will be about.
- **Safety.**
  - Writes run as a named editor identity, with the same role check as `savePageAction`.
  - Back up the previous row before each publish (as `~/eac-backups/site-config/`).
  - Rich text only through `sanitizePageText`, `blkStyle` through `cleanStyle`, and nothing resolver-filled is ever
    stored.
  - Read-only by default, with writes behind a flag.
- **Where.** `packages/page-builder/scripts/puck-mcp.ts` (stdio, for Claude Code on eris over `ssh eris`), or the same
  operations as a CLI (`pnpm puck pages list|get|patch|publish`). The MCP is a thin wrapper over the CLI's functions.
  It can run in a throwaway `eac-dev` container like the type checks, so it touches no live app container.

---

## 7. Open questions for Justin

1. **Whose thread is an artwork's discussion?** For an artwork in a series there is a spare column
   (`auction_series_slot_artwork.discussion_thread_id`). For any artwork there is nothing. Options:
   - one mirror thread per artwork, network-wide;
   - one per artwork per series (the column);
   - a general mapping table `topic_threads(subject, thread_id, org_id)` that also absorbs `auction_series.thread_id`.

   And when is the thread created: on publish, on the first post (recommended, so crawlers create nothing), or on first
   view (the column's comment)?
2. **"Above it" only, or also below?** The proposal looks before the block and up the tree, never after it. Should a
   discussion placed above a piece take that piece?
3. **Follow.** The series uses `thread_rsvps 'subscribed'` (the desk's letters), the forum `watches` (notifications).
   Keep both (Follow on a series = both; elsewhere = `watches`), or make one?
4. **Beyond the site.** May outside links (`url:`) be added by editors only or by members? May they be discussed? Is an
   embed allowed (and from which providers), or a link card only?
5. **Who may post by default.** Signed-in anyone (today's series box), org members, or the team? Should a series
   discussion stay closed until publish (today) and an event's until the event is announced?
6. **`au-discussion`.** Keep it as is, or make it a preset of the shared `discussion` (same id kept)? It is stored in no
   page today.
7. **Series template reach.** One `series-detail` template for every series (like `event-detail`), or a template that
   each series copies and edits as its own page?
8. **Puck 0.24.** Upgrade before building (field groups for a 30-prop block), or after? The `<Render>` field-transform
   change needs a check on published pages first.
9. **Puck AI.** It is paid and cloud-hosted, and it writes page data outside our rules. Is it of interest at all, or
   only the in-repo MCP/CLI in section 6?

---

## 8. What the direct-edit side must agree to (the shared schema)

1. **Props are scalar `PropDef`s only.** The block declares no object-valued props. Conditions and groups are
   declarative, not code.
2. **`group?: OptionGroup` on `PropDef`**, overriding `groupOf()` (today every select lands in "layout", so `sort`,
   `composer` and `whoCanPost` would show under Layout). Both panels use it: Puck through 0.24 field groups or section
   labels, and the canvas through `SECTION`.
3. **`when?: { prop: string; is: readonly (string | boolean)[] }` on `PropDef`**: show the prop only when another
   prop has one of these values (`topicGroup` when `topic = group`, `subject` when `topic = pick`, the composer words
   when `composer = inline`). page-builder applies it with `resolveFields`, and the canvas with `blockSlots`. Hidden
   values are kept, not cleared.
4. **`about` on `BlockDef`, passed through `contractOf`.** The canvas must know which blocks are subjects in order to run
   `findTopics` and to draw the why line.
5. **`topicGroup` is a reserved, page-builder-added prop** on every block with `about`, like `blkStyle`. The canvas
   shows it under Behaviour for those blocks.
6. **`resolved` on `BlockDef`** (the resolver's keys), so `stripResolvedKeys`, the house's `settle()` and the canvas's
   `resolvedRows` read one list.
7. **`findTopics` is the one rule.** Both editors and the server call the same pure function. The canvas recomputes it
   after moves, adds, deletes and changes to a subject's bound prop, and refetches rows for the discussions whose result
   changed. Puck does the same through `topicsPlugin` with `resolveDataById(id, "force")`.
8. **`binds: "record"` and the `<kind>:<id>` grammar** are shared by `subject`, shelf `items[].ref` and `feature-card`.
   One content source registry serves Puck's picker field and the canvas's `RecordSources`.
9. **Rows need editing in the canvas.** Shelf `items` is a `rows` prop, which the canvas shows only as a count today.
   It needs either a rows editor or a multi-pick "From what?" that appends refs.
10. **Inert while editing.** The block is a server component that receives `puck`. Under `puck.isEditing` or
    `puck.boxEditing` the composer is drawn but disabled, polling is off, and Follow does nothing. The canvas must pass
    `boxEditing` as the popup already does.
11. **Part names never equal prop names** (3.6), and ids and part names are never renamed once stored.

## Verification on record

Read-only only. Puck's resolver behaviour was read from the installed 0.23.0 bundle
(`resolve-component-data.ts`, `resolve-all-data.ts` and the app store's `resolveComponentData`). Stored rows were
read with `SELECT org_id, key, length(value::text) … WHERE key LIKE 'puck:%'`. Block types in `puck:event-detail` were
read with a `regexp_matches` over `value`. Opt-in gatherings and series threads were counted. Live pages:
`curl -s` signed out. Nothing was built, run, restarted or committed.
