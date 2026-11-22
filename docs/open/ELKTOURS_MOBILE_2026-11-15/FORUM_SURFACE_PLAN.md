# Forum on phones as the cms-ui surface pattern (plan, 2026-11-16)

Justin: "i wanted more of the surface ui feel found in the hub card of apps/sunjay. previewing a topic/session is quicker and the threads have different version of page detail vs popup ... that one cms ui surface pattern could do in for the forum page replacement."

Status: read-only plan. No source was edited. Building starts when Jay says the production rebuild is done.
Labels: **verified** (read in source, file:line or function named) or **assumed**. Paths are under `~/eac`.

## 1. What exists (verified)

The surface system already has the three sizes Justin describes, for threads, and a forum surface at popup size.

| Size | Piece | What it does |
|---|---|---|
| Face | `ForumFace` (`packages/cms-ui/src/surface/surfaces/ForumSurface.tsx`) | A hub tile: unread count, section names, latest titles. Server-renderable. Used by sunjay `app/hub/page.tsx:210` and `app/community/page.tsx`, and by `ForumView` in `apps/sunjay/src/blocks/views.client.tsx:344`. |
| Popup | `ForumSurface` (same file) | Unread banner with "See them" and "Mark all read", Sections list, Latest rows, actions "Start a topic" (`forum.composeHref`, a link) and "Open the forum". A section row pushes `{type:"forumFeed"}` (`ForumFeedSurface`, shows `connectors.forum.listFeed`). A thread row pushes `{type:"thread", id, preview}`. |
| Popup | `ThreadSurface` (`surfaces/ThreadSurface.tsx`) | Loads `connectors.loadThread(id)`, paints from `preview` first, then `threadViewParts` (body, rail), actions Edit / Remove / **Open page** (`thread.href`) / RSVP, and `connectors.threadActions`. |
| Page | `SurfacePage` (`SurfacePage.tsx`) + `threadViewParts` (`ThreadView.tsx`) | Same masthead, body and rail at page size, server-renderable. sunjay uses it in `app/[feed]/[slug]/page.tsx` for gatherings; posts go through `ArticleView`. |
| Wiring | `createHubConnectors({ forum: true })` (`packages/cms-ui/src/hub/connectors.ts:673`) | `connectors.forum.load` fetches `/api/hub/forum`; `markAllRead` posts `/api/forum/read-all`; `listFeed` is optional and must be supplied by the host. |
| Data | `forumSnapshot` and `forumFeedThreads` (`packages/forum-ui/src/snapshot.ts`) | Map forum boards, feeds and topics onto `SurfaceForum`, `SurfaceForumFeed`, `SurfaceForumThread`. `forumFeedThreads` is the proper `listFeed` source. |

elktours today (verified):
- `components/hub/HubSurfaces.tsx` already sets `forum: true` (without `listFeed`) and is mounted in the root layout. So the popups already open on any page. Custom surfaces register in `custom: {}` there (tour, experience, place, person, reviews, email, whiteboard).
- `app/api/hub/forum/route.ts` returns `getForumSnapshot()`. `app/api/hub/threads/[id]/route.ts` returns one thread in `SurfaceThread` shape and already follows visibility, including `INVITE_ONLY` with a `min_role`.
- `app/api/forum/[action]` is forum-ui's form-action handler (reply, topic, read-all, ...), answering with redirects.
- `app/[feed]/[slug]/page.tsx` renders a `post` through `ArticleView` (no replies) and other kinds through `SurfacePage` plus `threadViewParts`.
- `app/forum/[[...segments]]/page.tsx` is `renderForumRoute` wrapped with `.gf-m` and the phone top (`components/mobile/forum-home.tsx`); `forum-m.css` restyles forum-ui below md.

## 2. Target on phones

Below md, `/forum` becomes surface-shaped. At md and up it stays forum-ui, untouched. Both trees are drawn through the existing `Split` (phone tree in `<div class="elk-m md:hidden">`, so the shell hides the desktop header and footer on phones).

| Screen (pack) | Phone surface | Route |
|---|---|---|
| 18 Forum | List face: title and status line, unread banner with Mark all read, Sections (sub-sections indented with the arrow, counts including children, closed marker), Latest rows, brass "Start a topic" button. A page-size version of `ForumSurface`'s body. | `/forum` |
| 19 Section | The same list scoped to one section: breadcrumb, description, sub-section pills, rows, "Start a topic here". | `/forum/<section>` |
| Row tap | The shared `thread` POPUP (quick preview): body, link card, attachments, replies, reply box, "Open page". | `push({type:"thread"})`, no navigation |
| 20 Topic (page) | `SurfacePage` with `threadViewParts` at page size, plus link card, attachments, replies and a pinned reply bar. This is what "Open page" opens. | `/forum/t/[id]/[slug]` (phone tree) |
| 21 Start a topic | A compose surface opened as a layer: Section, Kind, Title, Body, Link, Photos & video, Who can read it. | `custom` key `forum-compose` |
| 22 City sheet | Not forum. Unaffected. | n/a |

Other forum-ui routes (latest, unread, topics, search, members, wiki, map, ...) keep forum-ui, restyled by a smaller `forum-m.css`.

## 3. Gap list (what is missing, and where it belongs)

"Shared" = `packages/cms-ui` or `packages/forum-ui`, so sunjay and others can use it, purely additive. "App-local" = `apps/elktours`.

| # | Gap | Evidence | Home | Size |
|---|---|---|---|---|
| F1 | **The thread popup shows no replies and no reply box.** `ThreadSurface` renders `parts.main` and rail only; `SurfaceThread` has no replies. | `ThreadSurface.tsx` (no reply code); `grep reply` in `ThreadView.tsx` finds none | **Shared hook, app-local content.** Add one optional connector `threadBody?: (thread: SurfaceThread, helpers) => ReactNode` (client slot, rendered under `parts.main`). sunjay can later fill it with its forum replies. elktours supplies a `ForumRepliesPanel`. | M |
| F2 | **Link card and attachments are not in `ThreadView`.** `SurfaceThread` has no `link` or `attachments`. | `types.ts:444-504` | **Shared.** Add optional `link?: {url,title,description,imageUrl,siteName}` and `attachments?: {kind,url,width,height}[]` to `SurfaceThread`; render a link card and a media grid in `threadViewParts` `main`. Additive, so sunjay posts with a link get a card. elktours maps `threads.metadata.link` and `forum_attachments` in `lib/surface-thread.ts` and the thread route. | M |
| F3 | **Sub-sections and closed sections are not on `SurfaceForumFeed`.** The board has `parentSlug` and `minRole`; the surface type has neither. Also `forumSnapshot` caps feeds at 8. | `types.ts:583`; `snapshot.ts` (`feeds.slice(0, feedLimit ?? 8)`) | **Shared.** Add `parentSlug?`, `closed?` to `SurfaceForumFeed`, fill them in `snapshot.ts`, group and indent in the list. Counts that include children are computed in the list. | S |
| F4 | **The forum list is only a popup.** `ForumSurface` is built on `SurfaceFrame` + `useLayer`, so it cannot be a page. | `ForumSurface.tsx` | **Shared.** Factor the body into `ForumBoardView({ forum, section?, onOpenThread, onOpenFeed, onMarkAllRead })`, used by the popup and by a new page-size wrapper. Popup behaviour unchanged. | M |
| F5 | **"Start a topic" is a link** (`forum.composeHref`) to the old form, not a surface. The generic `ComposeSurface` is for thread kinds (post, meeting...), with no sections, audience or link. | `ForumSurface.tsx` actions; `ComposeSurface.tsx` catalogue | **App-local first** (`ForumComposeSurface`, a `custom` surface built from `SurfaceFrame`), calling a new JSON route that wraps `createTopic` (kind, audience, link, attachments all exist in services). Candidate to move to cms-ui behind a `forum.compose` connector later. | M |
| F6 | **Reply and topic writes need JSON endpoints.** forum-ui's actions redirect (303) and are form-only; a popup cannot use them. | `packages/forum-ui/src/actions.ts` | **App-local routes** under `app/api/hub/forum/`: `replies` (GET list, POST reply using `postReply` with attachments), `topics` (POST), `audience` (POST, `setTopicAudience`), reading `listReplies` and `listForumAttachments`. Thin wrappers over services, same checks. | M |
| F7 | **Attachment picker in the surfaces.** `AttachPicker` (forum-ui) writes hidden `attachment` inputs inside a form with `textarea[name=text]`. | `packages/forum-ui/src/attach.tsx` | **Reuse as is**, exported from the forum-ui index (it is not exported today). The reply panel and compose surface each wrap it in a `<form onSubmit>` that gathers the form data and posts to the JSON routes. | S |
| F8 | **Role rings.** The surface has none; replies need owner, guide and artist rings. | `listReplies` gives `authorRole`; `lib/forum-badges.ts` gives artists | **App-local** in `ForumRepliesPanel` (phone tokens: brass for guide and owner, verdigris for artist). | S |
| F9 | **Visibility chips on your own topic** ("Your topic · who can read it"). | `setTopicAudience` exists in services | **App-local** in the page and popup panel, through `/api/hub/forum/audience`. | S |
| F10 | **Private topic preview by its author fails.** The thread route allows `INVITE_ONLY` only with a `min_role`; an author-only topic has none, so only editors read it. | `app/api/hub/threads/[id]/route.ts` (`allowed`) | **App-local fix**: also allow `thread.authorId === viewer.userId` (published or pending). | S |
| F11 | **"Open page" target.** For a forum `post`, `thread.href` goes to `/forum/t/...` (forum-ui page) and `[feed]/[slug]` shows an article without replies. | `toSurfaceThread`; `app/[feed]/[slug]/page.tsx` | **App-local**: the phone page for a topic is `/forum/t/[id]/[slug]` (SurfacePage + replies). The desktop page is unchanged. `[feed]/[slug]` stays for journal and tours. | M |
| F12 | **Mark all read** already works (`connectors.forum.markAllRead` posts `/api/forum/read-all`, which forum-ui's handler answers with a redirect, which `fetch` follows). | `hub/connectors.ts:685` | **Verify only**; add a small JSON `read-all` if the redirect proves awkward. | S |
| F13 | **`listFeed` is not wired in elktours.** Section rows would show "Open it on the forum" instead of threads. | `HubSurfaces.tsx` has `forum: true` | **App-local**: pass `forum: { listFeed }` using a new route `/api/hub/forum/feed/[slug]` over `forumFeedThreads`. | S |
| F14 | **Phone look for the popups.** The surface CSS is the desktop look; popups portal outside `.elk-m`. | `mobile.css` scopes tokens to `body:has(.elk-m)` | **App-local**: a `surface-m.css` below md remapping `.eac-surface-*` to the phone tokens (card, sheet, hairlines, brass), plus the kit `BackButton` on the page. | M |
| F15 | **Pending posts and the Feed section** appear as ordinary topics (section `feed`). Nothing extra needed. | `lib/feed.ts` | none | n/a |

Not needed: new tables or migrations. `forum_attachments` is in the drafts (migration TODO), and the picker and the services path already guard on it.

## 4. How each pack screen maps

- **18 Forum**: `ForumBoardView` over the existing `getForumSnapshot` (raise `feedLimit`, add `parentSlug` and `closed`). Unread banner and Mark all read are already in `ForumSurface`. Roles: the closed "Guides & artists" section only appears for members (`org_feeds.min_role`, enforced by `listBoards`).
- **19 Section**: same view, `section` set; rows from `forumFeedThreads` via the new route; sub-section pills from `parentSlug`; "Start a topic here" opens the compose surface with the section preselected.
- **20 Topic**: popup = `ThreadSurface` + `threadBody` (replies, reply box with `AttachPicker`, role rings, visibility chips). Page = server `SurfacePage` with `threadViewParts`, link card and attachments in main, the same replies panel under it. The page is the popup at page size, which is the "continuation, not a jump" the surface docs promise.
- **21 Start a topic**: `ForumComposeSurface` layer. Section chips (children as "Parent › Child"), kind chips (post, idea, event), title, body, link, `AttachPicker`, audience chips (Public, Members, Private = author only). Validation per the pack: title, body, and a private topic needs people (people still unsupported: v1 Private is author-only, as agreed).
- **22**: untouched.

## 5. Files I would touch

Shared (additive, no behaviour change for sunjay):
- `packages/cms-ui/src/surface/types.ts`: `SurfaceThread.link/attachments`, `SurfaceForumFeed.parentSlug/closed`, `SurfaceConnectors.threadBody`.
- `packages/cms-ui/src/surface/ThreadView.tsx`: link card and media grid in `main`.
- `packages/cms-ui/src/surface/surfaces/ThreadSurface.tsx`: render `connectors.threadBody` under the body.
- `packages/cms-ui/src/surface/surfaces/ForumSurface.tsx`: factor `ForumBoardView`; group and indent sub-sections.
- `packages/cms-ui/src/surface/index.ts`: export it. `packages/cms-ui/src/surface/surface.css`: a few classes for the card and grid.
- `packages/forum-ui/src/snapshot.ts`: `parentSlug`, `closed`, larger `feedLimit`. `packages/forum-ui/src/index.ts`: export `AttachPicker`.

elktours:
- `app/forum/[[...segments]]/page.tsx`: phone tree via `Split` (home, section, topic), desktop forum-ui unchanged.
- NEW `components/mobile/forum-surface-page.tsx` (list page), `forum-topic-page.tsx` (page detail), `forum-replies-panel.tsx` (client), `forum-compose-surface.tsx` (client), `surface-m.css`.
- NEW routes `app/api/hub/forum/replies`, `topics`, `audience`, `feed/[slug]`.
- `components/hub/HubSurfaces.tsx`: register `custom["forum-compose"]`, pass `threadBody`, pass `forum: { listFeed }`.
- `app/api/hub/threads/[id]/route.ts`: author may read their own private topic; map link and attachments. `lib/surface-thread.ts`: map `metadata.link`.
- `lib/forum.ts`: no change expected (composeOptions and roleBadges already set by Jay).
- Delete `components/mobile/forum-home.tsx` once unused; trim `components/mobile/forum-m.css` to the forum-ui pieces still shown on phones (latest, unread, search, members pages).

## 6. Risks and open questions

1. `HubSurfaces.tsx` is a client component mounted for the whole site; adding `threadBody` and `listFeed` touches every popup. The hook is additive and returns nothing for threads that are not forum topics (it checks `feed`/`section`), so tours, meetings and journal posts are unchanged.
2. Replies in the popup need the thread's org feed visibility; the JSON routes must reuse `postReply` and `listReplies`, which already enforce it. No new permission logic.
3. Private (author-only) topics and the thread route (F10) is a real existing bug for authors, independent of this work.
4. Cost: the phone tree and the desktop forum-ui both render server-side in `Split`. If this proves heavy, gate the desktop tree behind a cookie or accept it.
5. Question for Justin: for "Open page", is `/forum/t/[id]/[slug]` (a forum topic page with replies) right, rather than `/[feed]/[slug]` (the reading page for posts, no replies)? The plan assumes the forum topic page, because replies live there.
6. Question: should Section be a page (`/forum/<section>`) as the pack draws it, or a pushed popup layer (`forumFeed`) as the sunjay popup does? The plan uses a page on phones and keeps the layer for popups opened from elsewhere.
