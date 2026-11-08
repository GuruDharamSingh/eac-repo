# Discussion block: merged contract (2026-11-07)

This merges two phase-1 designs:
- `docs/sessions/2026-11-07_discussion-block-puck.md` (the Puck specialist)
- `docs/sessions/2026-11-07_discussion-block-direct-edit.md` (the direct-edit generalist)

Read those for file paths and evidence. This doc records what was **decided between them** and the **defaults** that apply until Justin overrides them.

## 1. The block: `discussion` (shared, in the block registry, not app-local)

- It is built from a server shell plus a client island, and styled with tokens (no Tailwind).
- The existing `au-discussion` (art-auction) becomes a **preset** of this block. It is not a second block.
- The existing `SrsDiscussion` (the series page, hand-built) stays until the series template replaces that page.

### Binding: what the discussion is about

The two designs disagreed here. **Decided:** use the Puck agent's three scalar props, which work with Puck fields and `when` conditions. The direct editor's "About: X" chip writes the same three props.

| Prop | Values | Generalist's name |
|---|---|---|
| `topic` | `auto` \| `page` \| `group` \| `pick` | `near` / `route` / `group:<key>` / a record ref |
| `topicGroup` | string (a reserved prop that page-builder adds to every block) | the `<key>` in `group:<key>` |
| `subject` | `binds: "record"` ref: `thread:<id>`, `artwork:<id>`, `series:<id>`, `url:<href>` | the record ref |

- **`about` is a BlockDef declaration**, not a prop. A block that can be a subject declares `about: { kind, prop?, page? }`. The first such blocks are `ktp-piece`, `au-article`, `pt-event-about` and the series blocks.
- **The one rule is `findTopics(doc, contract, metadata)`**, a pure whole-page pass:
  - **auto:** look at the earlier siblings (last first), then the parent's earlier slots, then the parent, and so on up the tree. A container holding several different subjects is skipped. At the top it falls back to `metadata.subject`, the page's own record.
  - **group:** take the nearest block with the same `topicGroup`.
  - **page:** use the route record.
  - **pick:** use `subject`.
- **Default:** auto looks **above** the block only, never below. On a tie, the nearest earlier sibling wins.

The pass runs in three places:
- **Published pages:** `resolvePage()` runs it before `resolveAllData`.
- **Puck Studio:** a `topicsPlugin` reruns it on every change and calls `resolveDataById(id, "force")`. Puck doesn't re-resolve after a reorder on its own.
- **Canvas / house:** calls the same function.

### Other props

All props are plain scalars, so both editors can read and write them.

- **Words** (each editable inline on the canvas through its part's `prop`): heading, intro, empty message, closed note, and the forum, post, sign-in and follow labels.
- **Layout and look:** `layout` (auto|full|split|compact), `look`, `density`, show avatars/times/count. Free adjustment goes through `morph` parts and tokens.
- **Replies:** `limit`, `sort` (newest|oldest|top), `threading`, `reactions`, `refresh`, `forumLink`.
- **Posting:** `composer` (inline|link|none), `whoCanPost`, `allowReplies`, `follow`, `noTopic`.
- **Locked:** reply bodies and authors are data and are never editable in either editor.
- **Resolved keys:** `found`, `thread`, `viewer`, `placement`. They are declared once as `resolved` on the BlockDef. That single list feeds the page-builder strip, the house `settle()` and the canvas `resolvedRows`.

### Data

- A discussion is a forum thread's `replies`, written through `postReply` (`services/forum-write.ts`). That keeps the rate limit, locks, the member rule and notifications.
- **Which thread:**
  - **Event:** the event's own thread.
  - **Series:** the mirror thread in `auction_series.thread_id` (`ensureSeriesThread`).
  - **Artwork:** `auction_series_slot_artwork.discussion_thread_id`, or a new mirror thread.
  - In every case the thread is created **on the first visitor post only**.
- **Default:** the Follow button writes `watches`. On an event, `thread_rsvps` means attendance, so it can't double as follow. The series page also reads its existing `thread_rsvps 'subscribed'` rows as legacy follows.
- **Inert while editing:** the composer does nothing while either editor is open.

## 2. Shared contract changes (in page-builder / blocks / direct-edit; additive only)

1. `PropDef.group` override, so not every select lands in Layout.
2. `PropDef.when`, a condition that shows or hides a prop.
3. `BlockDef.about`, passed through `contractOf`.
4. `BlockDef.resolved`: one list of resolved keys.
5. A reserved `topicGroup` prop.
6. `BlockPlacement` gains `parentRef` and the siblings' record refs, and page groups are added to resolver metadata.
7. One route-record key across templates (`metadata.subject`).
8. `findTopics`, `resolvePage`, `topicsPlugin`.
9. A Puck custom field that mounts the shared chooser, and canvas multi-pick (rows) for shelf items.
10. A way to set and read the Puck selection from outside Puck, for the house's shared selection.
11. Part names never equal prop names.

## 3. Content source registry (feeds both editors' "From what?" chooser)

- It is split like the actions registry: a client-safe list of kinds, plus server-side `list`/`resolve` functions with visibility rules.
- **Kinds:** artwork, thread (article/post/event/meeting/workshop), series, gallery, person, media, tour, url.
- **Scopes:** this site, mine, the network, beyond the site.
- **Beyond the site:** `url:` link cards built from `packages/lms/src/unfurl.ts` (OpenGraph with an SSRF guard). **Default:** a cached snapshot, added by editors only, and not discussable in v1.
- Refs match `/channel`'s `thread:` / `artwork:` subjects.

## 4. Series-detail template

- `puck:series-detail`, drawn for every `/series/<slug>` the way `event-detail` is.
- It is built from series blocks, a shared `content-shelf` and `discussion` (with `topic: page`).
- The shelf shows the series' own lots and articles, plus items picked through the registry.
- **Default:** one shared template, with per-series overrides later.

## 5. Para Theater event-detail

- Add a fourth `pt-band` after `pt-event-about`, holding `discussion` with `topic: page`.
- `/event-detail` answering 404 is intended: it is a template, drawn on each gathering that opts in.

## 6. The house editor

- Today it is a decision (2026-11-06: "our editor stays the house; Puck is reached from it"). Its only code is a harness at `packages/direct-edit/harness/frankenstein/house.tsx`.
- **For this block it owns:**
  - shared selection across both editors
  - one save path (both editors' saves already go through `savePageAction`)
  - outlining the bound block or the group's members
  - rerunning `findTopics` after a switch or a move
- **Gap:** `page_revisions` doesn't exist, so the last save wins and goes live at once. Drafts and conflict checks are phase 3 unless Justin pulls them forward.

## 7. Not now

- **Puck 0.24:** it adds field groups and tabs, but `<Render>` now applies field transforms, so published pages must be tested before upgrading. Upgrade after v1.
- **Puck AI:** a paid cloud service and not MCP. Skip.
- **Puck MCP:** none exists. A small in-repo MCP/CLI over `loadPage`/`savePage` is sketched in the Puck doc: scoped to one org, with patch operations checked against the contract and publishing only on a human yes. Later.

## 8. Build order (proposed)

- **2a: shared contract changes** (section 2) and the source registry. Puck specialist.
- **2b: the `discussion` block**, the canvas chip/chooser and inline labels, and the house wiring. Generalist, against 2a's types.
- **2c: Para Theater event-detail band and the series-detail template.** Going live needs rebuilds of the sunjay and art-auction apps. Those rebuilds ship other sessions' uncommitted work, so they need Justin's OK each time.
