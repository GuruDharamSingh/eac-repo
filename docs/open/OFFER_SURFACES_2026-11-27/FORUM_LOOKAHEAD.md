# Forum and content library as the two indexes: look-ahead (2026-11-27)

Read-only findings by a search agent for Manjushri, condensed. Nothing was changed, built or run. "Inference" marks what was worked out rather than seen. Verify before acting.

## Short answer

The forum and the content library are two indexes over the same `threads` rows and the same ids. Replies exist only on the forum side. The offer kit's talk layer can be backed by the real forum through the mechanism Sunjay's card uses, but arts-collective has none of the forum routes yet, and writing pieces and artworks need extra work before they can carry a talk.

## What the forum is

- A topic is a `threads` row; a reply is a `replies` row (`thread_id`, `parent_reply_id`, `user_id`, `content`). Counters `reply_count` and `last_activity_at` sit on `threads`. "Every thread in the database is on the forum" (`packages/services/src/forum.ts:12-15`); `visibility` only decides who sees it.
- An event, service, series or piece of writing IS the thread: its talk is `replies.thread_id = <that id>`. No separate linked thread. Exceptions use a derived mirror thread (auction series, one week of a series). Artworks have no thread; the rule is to add a mirror thread when one is needed.
- `OFF_FEED_KINDS` includes `writing`: every forum read, search and people query skips writing pieces. Replies on them can still be written (`postReply` does not check kind).
- Posting is signed-in only (`forum-write.ts:256`), 10 posts per account per 10 minutes. `replies.user_id` is a NOT NULL account, so guest posting has no path.
- Notifications are in-app only. No email is sent for replies or watches.
- Moderation is per thread (pin, lock, archive, move). There is no hide, edit or delete for a reply.
- Forum search (`forum-search.ts`) is its own full-text query over threads and replies, can be scoped to one org.

## Sunjay's forum card and frame, the mechanism

1. The hub page builds a snapshot on the server (`forumSnapshot`: sections, six latest topics, counts, unread).
2. `ForumFace` (`packages/cms-ui/src/surface/surfaces/ForumSurface.tsx`) is the card: "N new", "N topics · M posts", up to six titles. It opens `{type: "forum"}`.
3. `ForumSurface` loads the same snapshot from `/api/hub/forum`. A row in Latest pushes `{type: "thread", id, preview}`.
4. `ThreadSurface` paints the head from the preview at once, then `connectors.loadThread(id)` → `/api/hub/threads/<id>`. `threadViewParts` returns main, rail and kicker for the frame.
5. Under the body sits a `threadBody` slot. **Sunjay fills nothing there: its popup shows no replies and no reply box**; replying happens on the forum page. The only filled `threadBody` is elktours' (`ForumRepliesPanel`, JSON routes `api/hub/forum/replies`, `lib/forum-data.ts`, photo uploads through `api/upload/forum`).
6. One dialog, a stack, `?surface=thread:<id>` or `forum` in the URL.

## How the two indexes relate

- `content_index` covers thread kinds writing, post, meeting, reading_group, series, workshop, event, service. A forum topic of kind `post` is indexed as library type `writing`.
- Replies are not in `content_index` at all: no reply text, no reply count.
- Same keys: `thread:<id>` everywhere.
- Two rights rules for the same rows: the forum's `visibleTo` and the library's `contentReadSql`. The cornerstone plan lists "a search that covers the forum only" as one of the partial copies and makes moving forum search onto `content_index` an optional Step 7. Not done.
- Only the forum knows: replies, counts, unread and watch state, sections, attachments, per-person activity. Only the library knows: artworks, files, people, prices, the offers view, checkout.

## Backing the talk layer with the real forum

Today the kit's `Talk` (`offer-surface/layers-read.tsx`) is local state with sample comments. **Bug in our code:** it resolves its key through `findPiece`, which falls back to the first writing piece, so an event's "Talk · 8" shows a writing piece's comments.

Reusable as is: `postReply`, `listReplies`, `listReplyChildren`, `getForumThread`, `toggleWatch`, attachments (`forum-write.ts`, `forum.ts`); `AttachPicker` from forum-ui; the elktours JSON reply door as the pattern; the surface stack and URL.

Suggested shape (inference): keep talk as the kit's own layer in the packet's look; replace the local comments with new, additive `SurfaceActions` (`talk.load`, `talk.post`, `talk.follow`); map the offer key straight to the thread id.

Missing on arts-collective:
1. No forum route of any kind, and its one thread read needs a signed-in org role. A talk route must resolve the org from the host and check the thread belongs to it.
2. Reading a writing piece's talk signed out needs its own gated read (the forum read excludes writing).
3. Artworks need a mirror thread.
4. Guest posting, reply moderation (hide by owners and guides) and email for follows do not exist.
5. A member photo upload route.
6. `SurfaceSiteData` has no talk, reply count or member replies fields. "8 replies on this site" in the member profile needs an org-scoped variant of `listMemberActivity` (`forum-people.ts:102`).

## Decisions for Justin

1. Does a writing piece's talk stay off the org's forum feeds (its own reader), or become a forum topic?
2. Talk on artworks: a mirror thread, in which org and section.
3. Posting: sign-in only, or an email-verified guest door. Either needs a moderation answer first.
4. Reply hide for owners and guides before any public talk on free-tier sites.
5. Follow by email: watches plus a new sender, or the series-style "subscribed" list plus letters.
6. Whether a sign-in carries across `<org>.arts-collective.com` (cookie domain).
7. Whether forum search moves onto the content index, and whether replies become index rows.
