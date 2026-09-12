# The Grand Forum — build plan

Working plan, 2026-09-08. Rebuilds `apps/forum` from nothing as a classic board
over `threads`, packaged so any org site mounts the same forum at `/forum` in
its own skin. UI scaffolding first; interactions second; moderation and search
last.

## 0. Decisions (settled in the Q&A, 2026-09-08)

| # | Question | Decision |
|---|---|---|
| 1 | Front door | **Classic board** — categories → topic list → paginated thread |
| 1b | Read state | **Full** — new `thread_reads` table; unread markers, jump-to-unread, mark-all-read |
| 2 | Categories | **Both axes** — org → `org_feeds` is the tree; global `topics` is a cross-cutting index |
| 2b | Taxonomy governance | **Org owners/guides propose**, global admin approves |
| 3 | Reply layout | **Flat + one level** — chronological stream; a reply-to-reply expands inline under its parent; deeper nesting flattens with "replying to @name" |
| 3b | Post #1 | **Masthead + stream** — thread page is kind-aware masthead (facts rail) with replies beneath; the thread *is* post #1 |
| 4 | Shape | **Package + thin app** — `@elkdonis/forum-ui` against connectors; `apps/forum` hosts all orgs; org sites mount it scoped |
| 4b | Row click | **Page always** — the forum navigates; never opens a surface popup |
| 5 | Author block | **Byline + hover card** — compact line; card shows roles across orgs, joined, counts |
| 5b | Profile link | **Forum member page**, framed over ArtDirect's identity lift (`ProfileView` + `getProfileBySlug`) — no second profile |
| 6 | Reactions | **Up/down votes + heart**; voters are listed by name on expand |
| 6b | Score effect | **Informational only** — never reorders or hides a reply; `Top` sort on lists only |
| 7 | Composer | **Inline at the foot of the topic list**, phpBB style; rich kinds are made on the org site |
| 7b | Who posts | **Any signed-in network user** into any public feed; org owner/guide moderate |
| — | *UI pass 2 (2026-09-08)* | |
| 8 | Look | **Discourse-clean**, compact on mobile; soft burnt-orange + blue; a Gothic undertone |
| 9 | Row density | **Title + excerpt line** + kicker; last-poster avatar at right; excerpt drops on mobile |
| 10 | Signed-in home | **Identical for everyone** — personal state lives only in unread dots and the Unread/Watching pages |
| 11 | Org colour | **Hairline only** — 3px accent bar on feed rows and org mastheads; nothing else takes org colour |
| 12 | Dark mode | **Light default, dark follows system**; faithful token swap; footer toggle remembered per viewer |
| 13 | Notifications | **Bell + dropdown** in the masthead (last 20, mark-all-read) + `/notifications` history |

## 1. State of the ground

**`apps/forum` is dead.** `packages/db/src/queries/forum.ts` still queries
`posts` / `meetings` / `post_topics` / `meeting_topics`, all dropped by
migration 030. `getForumFeed`, `getThread`, `getUserThreadState` and
`deleteThread` cannot run; only `getReplies`, `createReply`, `toggleReaction`,
`toggleWatch`, `toggleBookmark` hit live tables. Wipe the app; salvage nothing
from its components (they're an older Radix/Tailwind pass with `alert()` calls).

**The forum data model already exists**, mostly unused:

| Table | Forum role | Notes |
|---|---|---|
| `threads` | topics/posts | `pinned`, `locked`, `last_activity_at`, `reply_count`, `reaction_count`, `view_count` all present; `section` = feed slug |
| `replies` | posts in a thread | `parent_reply_id` (nesting), `edited_at`, `reaction_count` |
| `reactions` | hearts/votes | `kind` defaults `'like'`; no CHECK, no uniqueness — needs both |
| `watches`, `bookmarks`, `notifications` | subscriptions | live, shaped right, nothing writes `notifications` |
| `topics`, `thread_topics` | taxonomy | global, hierarchical (`parent_id`); **1 row, 1 link** — starts empty |
| `org_feeds` | forums within an org | `minRole` gate + `canViewFeed()` already in services |
| `users` | identity | `slug`, `avatar_url`, `comment_color`, `trust_level` (0–4), `last_seen_at`, `created_at` |
| `user_organizations` | roles | `owner · guide · member · viewer` |

**Orphans:** 24 of inner_group's 29 threads have no `section`. Every thread
needs a home forum on a classic index → each org gets a `general` feed and
sectionless threads are backfilled into it (migration, §3).

**UI substrate to reuse, not rebuild:**
- `@elkdonis/cms-ui/surface` — `threadViewParts()` (pure masthead + facts
  rail), `kindMeta()` glyphs, the `--sf-*` / `--eac-kind-*` token layer. The
  forum consumes these; it never mounts `SurfaceProvider`.
- `@elkdonis/cms-ui/profile` — `ProfileView`, the identity block ArtDirect
  already renders. The member page's header is this, unchanged.
- `@elkdonis/services` — `getProfileBySlug`, `listProfileOrgs`, `getOrgFeed`,
  `listOrgFeeds`, `canViewFeed`, `ensureUniqueThreadSlug`, `createThread`.
- `@elkdonis/ui` `RichTextEditor` (Tiptap) for the reply box and inline form.
- `site_themes` — CSS-var bags per org. The forum's stylesheet reads only
  tokens, so an org restyles it without knowing it exists.

## 2. Architecture

```
packages/forum-ui/                 @elkdonis/forum-ui   (new)
  src/
    index.ts                       renderForumRoute(), types, connectors
    forum.css                      .gf-* classes over --sf-* tokens
    connectors.ts                  ForumConnectors interface (host supplies)
    routes.ts                      segments → page component
    pages/
      IndexPage.tsx                org tree + topics rail
      BoardPage.tsx                one org: its feeds
      FeedPage.tsx                 topic list + inline new-topic form
      ThreadPage.tsx               masthead + reply stream + reply box
      TopicsPage.tsx               taxonomy index; TopicPage: cross-org list
      MemberPage.tsx               ProfileView header + activity stream
      UnreadPage.tsx / WatchingPage.tsx / BookmarksPage.tsx
    parts/
      BoardTable.tsx               the category table (classic index row)
      TopicRow.tsx                 one thread in a list: unread dot, title, kicker, counts, last post
      Pagination.tsx
      Masthead.tsx                 wraps threadViewParts() in forum chrome
      ReplyStream.tsx              flat + one level
      ReplyItem.tsx                byline, body, votes, actions
      Byline.tsx + HoverCard.tsx
      VoteBar.tsx                  ▲ score ▼ ♥, expand → voter list
      ReplyBox.tsx                 Tiptap, quote, "replying to"
      NewTopicForm.tsx             inline: title, topics, body
      InlineGate.tsx               signed-out / feed-locked states of the two forms

packages/services/src/forum.ts     (new) every query, against threads/replies
packages/db/src/queries/forum.ts   deleted after services/forum.ts lands

apps/forum/                        thin host, all orgs, port 3003
  src/app/[[...segments]]/page.tsx renderForumRoute(segments, connectors, { scope: 'network' })
  src/lib/connectors.ts            binds services + auth-server to ForumConnectors
  src/app/layout.tsx               masthead nav, viewer, forum.css + surface.css

apps/amrit-canada/src/app/forum/[[...segments]]/page.tsx
                                   same call, { scope: { orgId: 'amrit_canada' } }
```

**Connectors** (the only thing a host writes; mirrors `SurfaceConnectors`):

```ts
export interface ForumConnectors {
  viewer: () => Promise<ForumViewer | null>;          // id, slug, name, roles by org, isGlobalAdmin
  listBoards: (scope) => Promise<ForumBoard[]>;        // orgs + their feeds + counts + last post
  listTopics: (feedRef, { sort, page, viewerId }) => Promise<Paged<ForumTopicRow>>;
  getThread: (id, viewerId) => Promise<ForumThread | null>;   // SurfaceThread + forum fields
  listReplies: (threadId, { page, viewerId }) => Promise<Paged<ForumReply>>;
  createTopic, createReply, vote, heart, watch, bookmark, markRead, markAllRead,
  moderate: (threadId, action: 'pin'|'unpin'|'lock'|'unlock'|'move'|'delete', arg?) => Promise<Result>,
  listTopicsTaxonomy, proposeTopic,
  member: (slug) => Promise<ForumMember | null>;       // Profile + roles + counts
  listMemberActivity: (userId, page) => Promise<Paged<ForumActivityItem>>;
  // Network furniture (§4.0). An org-scoped host implements the first three scoped; the rest are optional.
  listHappening: (scope, { from, to, limit }) => Promise<ForumHappeningRow[]>;
  listLatest: (scope, { limit }) => Promise<ForumLatestRow[]>;          // replies ∪ new threads
  listOrgPeople: (orgId, roles) => Promise<ForumPerson[]>;
  pulse?: () => Promise<ForumPulse>;                                    // counts + newest member
  orgIdentity?: (orgSlug) => Promise<OrgIdentity | null>;
  listOrgs?: () => Promise<ForumOrgCard[]>;
  listPresent?: (minutes) => Promise<ForumPerson[]>;
  listMembers?: ({ sort, q, page }) => Promise<Paged<ForumMemberRow>>;
  hrefs: { thread(id, slug), feed(orgSlug, feedSlug), board(orgSlug), member(slug), topic(slug),
           profile?(slug) /* → ArtDirect */ };
}
```

**Scope.** `'network'` shows every org; `{ orgId }` collapses the tree to one
board: `/forum` on amrit-canada *is* `/o/amrit-canada` on the network host.
Routes inside the package are scope-relative so both hosts share one router.

**Routes** (id-first thread URLs so a slug change never breaks a link):

```
/                        index: pulse strip + board table with org mastheads + network rail
/latest  /happening      network-wide topic list; agenda of upcoming scheduled threads
/orgs  /members          directories (network host only)
/o/[org]                 board: org identity header + its feeds + bio footnote
/o/[org]/[feed]          topic list, paginated, inline new-topic form at the foot
/t/[id]-[slug]           thread page; ?page=N; #reply-<id>; /t/[id]/unread → first unread
/topics                  taxonomy index; /topics/[slug] cross-org list
/members/[slug]          member page
/unread  /watching  /bookmarks
```

## 3. Schema

**Migration 110 (`110_forum_foundation.sql`) — APPLIED 2026-09-08.** It
carries only what read-only pages need: `threads.last_activity_at`
(backfilled from newest reply / publish date, bumped by `createReply`) and a
`general` feed per org with sectionless threads moved in.

Why 110 had to add `last_activity_at` at all: migration 030's
`CREATE TABLE IF NOT EXISTS threads` was a no-op — the table already existed
from the `schemas.ts` baseline — so **every column 030 introduced that the
baseline lacked never landed**: `last_activity_at`, `time_zone`, `tags`,
`attachments`, `co_host_ids`, `auto_record`, `follow_up_workflow`,
`nextcloud_calendar_*`, `nextcloud_poll_*`, `show_on_workshops_page`,
`workshop_order`, `subtitle`, `card_colour`, `card_accent_colour`. Don't
trust 030's column list; trust `\d threads`.

**Migration 111 (`111_forum_interactions.sql`) — phase 2, not yet written:**

```sql
-- Read state: one row per (user, thread) the moment they open it.
CREATE TABLE thread_reads (
  user_id            UUID REFERENCES users(id) ON DELETE CASCADE,
  thread_id          VARCHAR(21) REFERENCES threads(id) ON DELETE CASCADE,
  last_read_reply_id VARCHAR(21) REFERENCES replies(id) ON DELETE SET NULL,
  last_read_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, thread_id)
);
-- "Mark all read" is a watermark, not N rows.
ALTER TABLE users ADD COLUMN forum_read_all_at TIMESTAMPTZ;
-- unread := last_activity_at > GREATEST(thread_reads.last_read_at, users.forum_read_all_at)

-- Votes ride on reactions. Heart is independent of the vote; up/down are exclusive.
ALTER TABLE reactions ADD CONSTRAINT reactions_kind_check CHECK (kind IN ('like','up','down'));
CREATE UNIQUE INDEX reactions_one_heart ON reactions(user_id, thread_id, COALESCE(reply_id,'')) WHERE kind = 'like';
CREATE UNIQUE INDEX reactions_one_vote  ON reactions(user_id, thread_id, COALESCE(reply_id,'')) WHERE kind IN ('up','down');
ALTER TABLE threads ADD COLUMN vote_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE replies ADD COLUMN vote_score INTEGER NOT NULL DEFAULT 0;
-- reaction_count stays = hearts. vote_score maintained in services (as toggleReaction does today).

-- Taxonomy governance.
ALTER TABLE topics
  ADD COLUMN status      VARCHAR(12) NOT NULL DEFAULT 'approved' CHECK (status IN ('proposed','approved','rejected')),
  ADD COLUMN proposed_by UUID REFERENCES users(id),
  ADD COLUMN org_id      VARCHAR(50) REFERENCES organizations(id);   -- origin, for the queue; NULL = network
-- A proposed topic is usable by its origin org at once; it joins the global index on approval.

```

(The `general` feed and orphan backfill already ran in 110.)

Nothing else changes shape. `notifications` is written for the first time by
`createReply` (to watchers) and `vote` (to the author) — reusing the columns
as they are.

## 4. UI scaffold

The classic-board skeleton, with the modern pieces (byline, hover card, votes,
inline expansion) folded in where decided. Every box below is one `parts/`
component. Class prefix `gf-`; colours and type come only from `--sf-*`
tokens, so the forum inherits an org's `site_themes` and its `--eac-kind-*`
accents.

### 4.0 The flagship rule (second pass, 2026-09-08)

`apps/forum` is the network's front door as well as its board. The way to be
both without becoming a landing page: **every network-informative element is
a piece of classic forum furniture** — the statistics strip, "who is online",
"latest posts", the category description — rebuilt from real network data,
and **every one of them is a link into a thread list**. No hero, no marketing
copy, no element that doesn't lead to a conversation. Forum first; the
network shows through the forum, not above it.

What that gives the network host that an org-scoped host doesn't render:

| Furniture | Classic ancestor | Data it's built from |
|---|---|---|
| Pulse strip | "Board statistics" | counts over `organizations`, `users`, `threads`, `replies`; newest member |
| Org masthead rows | category description | `OrgIdentity` (portrait, headline, city, tier, primary domain) |
| Happening | none — the calendar's face | `threads` with `scheduled_at > now()` across orgs |
| Latest posts | "recent activity" | last N `replies` + new threads network-wide |
| Who's here | "who is online" | `users.last_seen_at` within 15 min |
| New members | "newest member" | `listPublicProfiles` by `created_at` |
| Orgs directory | forum index, as cards | `listOrgHomes` + identity + counts |
| Members directory | memberlist.php | `listPublicProfiles` + forum counts |

### 4.1 Masthead (network host)

```
THE GRAND FORUM                                                   ⌕   🔔 3   ● Dana ▾
The conversation of the Elkdonis Arts Collective network
────────────────────────────────────────────────────────────────────────────────────────
Boards   Latest   Happening   Topics   Orgs   Members            Unread 7 · Watching · ⚑

  (signed out: right end reads  ⌕   Sign in · Join )

  🔔 opens:  ┌───────────────────────────────────────┐
             │ Notifications            Mark all read│
             │ ● Dana replied in Morning sadhana   1h│
             │ ● Jason ▲ your reply in Langar…     3h│
             │ ● Kirtan topic was approved         1d│
             │   Stephan replied in Spring results 3d│
             │               all notifications →     │
             └───────────────────────────────────────┘
  Each row links to the exact reply (#reply-<id>) or the approved topic.
  Kinds written: reply-in-watched, reply-to-you, vote-on-yours, topic-approved.
```

- Second line is the only sentence of copy on the site; it comes from
  `site_sections` so the network can change it without a deploy.
- Org-scoped host drops the masthead entirely — the org site's own header
  is the masthead — and the nav collapses to `Boards · Latest · Happening`.

### 4.2 Index (`/`)

```
 12 orgs · 50 members · 318 topics · 2,140 posts · 6 gatherings this week · newest: Priya K.
════════════════════════════════════════════════════════════════════════════════════════════
 BOARD                                   TOPICS  POSTS   LAST POST              │ HAPPENING
─────────────────────────────────────────────────────────────────────────────────│───────────────
 ╭──╮ AMRIT CANADA · Toronto · partner                        amritcanada.ca ↗  │ Tue 5:30am
 ╰──╯ Amrit Vela sadhana, yoga and langar in the Punjabi tradition               │ ◎ Morning sadhana
   ● Amrit Vela                            42    318   Morning sadhana — new time│   Amrit Canada
     Presented by Guru Ram Dass Ashram                  Guru Dharam · 2h         │ Thu 7:00pm
   ○ Yoga Classes                          11     40   Class cancelled 14th      │ ◎ Reading circle
                                                        Dana · 3d                │   Inner Gathering
   ○ Gurdwara & Langar                      9     27   Volunteers for Sunday     │ Sat 2:00pm
                                                        Jason · 1d                │ ◈ Framing workshop
─────────────────────────────────────────────────────────────────────────────────│   IFAC
 ╭──╮ INNER GATHERING · online · supported                                        │ all happening →
 ╰──╯ A Fourth Way reading and practice circle                                    │───────────────
   ● Readings                              17     94   Chapter 9                 │ LATEST POSTS
   ○ General                               24     31   Hello from Vancouver      │ Dana in Morning
─────────────────────────────────────────────────────────────────────────────────│  sadhana · 1h
 ╭──╮ IFAC · Montréal · partner                                        ifac.art ↗│ Jason in Langar
 ╰──╯ International Fine Art Collectors                                           │  volunteers · 1d
   ○ Auctions                              63    511   Spring results            │ Stephan in Spring
   ○ Members' Lounge                       20     88   Hello from…               │  results · 3d
─────────────────────────────────────────────────────────────────────────────────│ all latest →
 ● unread   ○ nothing new                                     Mark all read     │───────────────
                                                                                 │ WHO'S HERE · 4
                                                                                 │ ● Dana ● Guru D.
                                                                                 │ ● Jason ● Priya
                                                                                 │───────────────
                                                                                 │ TOPICS
                                                                                 │ Meditation 88
                                                                                 │ Yoga 31 · …
                                                                                 │ + propose
                                                                                 │───────────────
                                                                                 │ NEW MEMBERS
                                                                                 │ Priya K. · today
                                                                                 │ Marc O. · 2d
```

- **Pulse strip** (`PulseStrip`): one query, cached 60s. Every number is a
  link — `orgs` → `/orgs`, `members` → `/members`, `topics`/`posts` →
  `/latest`, `gatherings this week` → `/happening`, newest → their member
  page. Signed-out, the strip's right end reads `Sign in · Join the network`.
- **Org masthead row** (`OrgMasthead`): portrait, name, city, tier chip,
  headline from `OrgIdentity`; the primary domain (or network subdomain)
  as an outbound link. Clicking the name → `/o/[org]`. It replaces the bare
  caption row; the feed rows beneath are unchanged from the first pass.
- `BoardTable`: one `<table>` per org; feed rows link to `/o/[org]/[feed]`.
  Counts and "last post" come from one `listBoards` query (a lateral join on
  `threads` per feed), not N+1. Feed accent paints the row's left hairline.
  Feeds with `minRole` the viewer doesn't hold are omitted, not locked.
- **Rail** (`NetworkRail`), top to bottom in this order because the order is
  the argument: what's about to happen, what just happened, who's around,
  what it's about, who's new. Each block has an `all →` link to its page.
  - *Happening*: next 5 scheduled threads across orgs (`SCHEDULED_KINDS`,
    `scheduled_at > now()`, recurring threads resolved to next occurrence).
    Row → thread page. Empty state: "Nothing scheduled — start one on your
    org's site".
  - *Latest posts*: last 8 of (replies ∪ new threads) network-wide, as
    "Dana in Morning sadhana · 1h" → `#reply-<id>`.
  - *Who's here*: `last_seen_at` within 15 min, directory-listed only, dots
    in `comment_color`. Count is real; names capped at 12.
  - *Topics*: top 8 approved by usage; `+ propose` for owners/guides.
  - *New members*: last 5 directory-listed by `created_at`.
- Org-scoped host: no pulse strip, no org masthead, no `▾`; the rail keeps
  only *Happening* and *Latest posts*, both scoped to the org. The org's own
  site already says who it is.

### 4.2b Board page (`/o/[org]`)

```
‹ Boards
╭────╮  AMRIT CANADA                                              amritcanada.ca ↗
│    │  Amrit Vela sadhana, yoga and langar in the Punjabi tradition
╰────╯  Toronto · partner · 3 forums · 62 topics · 385 posts · 41 members
        Guides: ● Guru Dharam Singh   Owner: ● Justin G.
════════════════════════════════════════════════════════════════════════════════════
 FORUM                                 TOPICS  POSTS   LAST POST              │ HAPPENING HERE
────────────────────────────────────────────────────────────────────────────────│ Tue 5:30am
 ● Amrit Vela                            42    318   Morning sadhana — new time│ ◎ Morning sadhana
   Presented by Guru Ram Dass Ashram                  Guru Dharam · 2h         │ Thu 6:00pm
 ○ Yoga Classes                          11     40   Class cancelled 14th      │ ◎ Yoga class
 ○ Gurdwara & Langar                      9     27   Volunteers for Sunday     │───────────────
────────────────────────────────────────────────────────────────────────────────│ LATEST HERE
 About                                                                          │ …
 Amrit Canada gathers for morning sadhana … (OrgIdentity.bio, first paragraph,│───────────────
 "read more" expands)                                                           │ PEOPLE · 41
                                                                                │ ● ● ● ● ● ● +35
```

- The header is the org's identity (`OrgIdentity`), the same record
  arts-collective renders — never a member's profile. Guides and owners
  come from `user_organizations` and link to member pages.
- The bio sits *below* the forum table, collapsed to one paragraph: the
  board is the page, the description is its footnote. That's the
  forum-first call made concrete.
- On an org-scoped host this page **is** `/forum`, minus the header (the
  site has one) and minus the bio (the site has an About).

### 4.3 Topic list (`/o/[org]/[feed]`)

```
Amrit Canada › Amrit Vela                                       [Active] [New] [Top]
Presented by Guru Ram Dass Ashram · 42 topics                             Page 1 of 4
════════════════════════════════════════════════════════════════════════════════════
   ◎ 📌 Morning sadhana — new time          Guru Dharam    12 replies   ▲ 9    2h
 ●    Meditation · Yoga                     Guide          318 views          Dana
────────────────────────────────────────────────────────────────────────────────────
   ◉    Langar volunteers for Sunday        Jason           4 replies   ▲ 2    1d
 ●    Community                                              91 views          Guru D.
────────────────────────────────────────────────────────────────────────────────────
   ◉ 🔒 Yoga class cancelled 14th           Dana            0 replies   ▲ 0    3d
                                                             40 views
────────────────────────────────────────────────────────────────────────────────────
                                    ‹ 1  2  3  4 ›
════════════════════════════════════════════════════════════════════════════════════
NEW TOPIC in Amrit Vela
Title   [_______________________________________________________________]
Topics  [Meditation ×] [+ add]
┌ B I • " — ─────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
Events, meetings and media are made on the org's site →       [ Post topic ]
```

- `TopicRow` (decision 9): three lines on desktop — **title** (bold + dot
  when unread, kind glyph, pinned/locked marks) → `/t/[id]-[slug]` or
  `/unread`; **one clipped excerpt line** (`threads.excerpt`, else first 140
  chars of body as plain text); **kicker** (kind · feed · author · topic
  chips). Right column: replies · views · vote score · last activity, with
  the *last poster's* small avatar. A 3px feed-accent hairline on the left
  (decision 11). Under 720px the excerpt line and avatar drop and counts
  fold into the kicker. Pinned rows sort first regardless of sort.
- `Active` = `last_activity_at`, `New` = `published_at`, `Top` = `vote_score`.
- `NewTopicForm` states via `InlineGate`: signed-out → "Sign in to start a
  topic"; feed `minRole` unmet → "This forum is for members of Amrit
  Canada"; locked feed → hidden. Submit → `createThread(kind='post',
  section=feed, status='published')` through `@elkdonis/services`, then
  redirect to the thread.

### 4.4 Thread page (`/t/[id]-[slug]`)

```
Amrit Canada › Amrit Vela › Morning sadhana — new time            Watch ☆  Bookmark ⚑
════════════════════════════════════════════════════════════════════════════════════
◎ MEETING · Amrit Vela · Amrit Canada · 📌 Pinned                               ⋯ mod
Morning sadhana — new time
────────────────────────────────────────────────────────────────────────────────────
 ● Guru Dharam [Guide] · 2h · edited                     │ When    Tue 5:30am · weekly
                                                         │ Where   Online · Talk room
 Starting next week we move to 5:30am. Please confirm    │ Going   6 of 12
 you can make it.                                        │ [ RSVP ]  [ Add to calendar ]
                                                         │
 ▲ 9 ▼   ♥ 14      Reply · Quote · Share                 │
   └ ▲ Dana, Jason, Stephan, +4 · ▼ Priya   (expanded)   │
════════════════════════════════════════════════════════════════════════════════════
 12 replies                                                                Page 1 of 1
────────────────────────────────────────────────────────────────────────────────────
 ● Dana · 1h                                                                 #2
   │ Please confirm you can make it.
   Yes — 5:30 works for me.
   ▲ 2 ▼  ♥ 1      Reply · Quote                                    ▸ 1 reply
────────────────────────────────────────────────────────────────────────────────────
 ● Jason · 40m    ↳ replying to Guru Dharam                                  #3
   Can't do Tuesdays, otherwise yes.
   ▲ 0 ▼  ♥ 0      Reply · Quote                                    ▾ 1 reply
   ┌──────────────────────────────────────────────────────────────────────────
   │ ● Stephan · 20m
   │   Same here.
   │   ▲ 1 ▼  ♥ 0    Reply · Quote
────────────────────────────────────────────────────────────────────────────────────
 ───────────────────── new since your last visit ─────────────────────
 ● Priya · 5m                                                                #5
   …
════════════════════════════════════════════════════════════════════════════════════
REPLY
┌ B I • " — ─────────────────────────────────────────────────────────────────┐
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                                                  [ Post reply ]
```

- `Masthead`: `threadViewParts(thread)` gives main + rail + kicker; the forum
  adds breadcrumb, watch/bookmark, moderation menu, and the vote bar on the
  OP. Kind accent from `--sf-kind-<kind>`. A `post` has no rail → single
  column.
- `ReplyStream`: page of top-level replies (`parent_reply_id IS NULL`,
  chronological, 20/page). Each carries its direct children count; `▸ n
  replies` expands them inline (fetched via `listReplies(threadId,
  {parentId})`). Grandchildren flatten into that expansion with
  `↳ replying to @name`.
- Numbering (`#2`, `#3`) is position in the top-level sequence — classic
  boards' permalink habit; `#reply-<id>` is the real anchor.
- "New since your last visit" rule is placed at `thread_reads.last_read_reply_id`;
  `/t/[id]/unread` redirects to the page containing it and scrolls there.
  Opening the page writes `thread_reads` (last reply on the page).
- `VoteBar`: ▲ score ▼ ♥. Clicking the score expands the named voter list
  (one `listVoters` fetch). Own vote is highlighted; voting on your own
  post is disabled. Locked thread → vote bar stays, reply box → "Locked by
  Guru Dharam · 3d".
- `ReplyBox`: Tiptap; `Quote` inserts a blockquote of the selection or the
  whole post; `Reply` on a reply sets `parent_reply_id` and shows a
  "replying to @Dana ×" chip.
- Network host only: the rail gains a `From Amrit Canada` block under the
  facts — portrait, headline, `board →`, `site ↗` — so a thread reached from
  `/latest` or a search still tells you whose conversation you're in.

### 4.5 Byline + hover card

```
● Dana · 1h                          ┌─────────────────────────────────────┐
  ▲ hover / tap name                 │ ╭───╮  Dana Whitfield                │
                                     │ │ D │  she/her · Toronto             │
                                     │ ╰───╯  Member · Amrit Canada         │
                                     │        Guide · Inner Gathering       │
                                     │ Joined May 2025 · 214 posts          │
                                     │ [ Forum profile ]  [ ArtDirect ↗ ]   │
                                     └─────────────────────────────────────┘
```

- Name coloured by `users.comment_color`. Role chip inline only for
  `owner`/`guide` in *this thread's org*; every org role appears on the card.
- Card data: `getProfileBySlug` + `listProfileOrgs` + two counts; fetched on
  first hover, cached per page.

### 4.6 Member page (`/members/[slug]`)

```
┌ ProfileView (unchanged, from @elkdonis/cms-ui/profile) ──────────────────────┐
│ ╭───╮ Dana Whitfield                                                         │
│ │ D │ Painter · Toronto · she/her                                            │
│ ╰───╯ bio…                                        Full profile on ArtDirect ↗│
└──────────────────────────────────────────────────────────────────────────────┘
 Member · Amrit Canada     Guide · Inner Gathering     Joined May 2025
────────────────────────────────────────────────────────────────────────────────
 [Activity] [Topics started 31] [Replies 183]
────────────────────────────────────────────────────────────────────────────────
 replied in  Morning sadhana — new time · Amrit Vela                        1h
   Yes — 5:30 works for me.
 started     Langar volunteers for Sunday · Gurdwara & Langar               1d
 replied in  Chapter 9 · Readings · Inner Gathering                          2d
```

- The header *is* ArtDirect's identity: same component, same `Profile`
  record. The forum adds roles, join date, and the activity stream. If the
  person has no ArtDirect dossier the header still renders from `users`.
- `isSelf` is never passed — editing happens on ArtDirect.

### 4.7 Topics (`/topics`, `/topics/[slug]`)

```
TOPICS                                                    + Propose a topic
────────────────────────────────────────────────────────────────────────────
 PRACTICE            Meditation 88 · Yoga 31 · Sadhana 40
 READING             Fourth Way 17 · Gurbani 12
 ART & COLLECTING    Auctions 63 · Studio talk 12 · Framing 4
 proposed by you     Kirtan (awaiting approval)
```

- `/topics/[slug]` is the topic list layout (§4.2) across orgs with an org
  column added and no inline form (a topic has no home feed).
- `+ Propose`: owners/guides only; inserts `status='proposed'`, immediately
  usable on that org's threads; global admin approves in `apps/admin`
  (one list + approve/reject/merge-into).

### 4.8 Network pages (network host only)

The rail blocks, each at full size. Same `TopicRow` / `OrgMasthead` /
`Byline` parts as everywhere else — these are lists, not designs.

```
/latest      network-wide topic list (§4.3 layout + org column), sorts Active/New/Top.
             The modern feed, one click from the board — never the front door.

/happening   HAPPENING                                    [This week] [Month] [All]
             ─────────────────────────────────────────────────────────────────
             TUESDAY 10 SEPT
              5:30am  ◎ Morning sadhana          Amrit Canada · Amrit Vela   6 going
              7:00pm  ◎ Reading circle, ch. 9    Inner Gathering · Readings  4 going
             SATURDAY 14 SEPT
              2:00pm  ◈ Framing workshop         IFAC · Auctions             $40 · 3 of 8
             An agenda, not a calendar grid: dated rows, org + feed kicker,
             attendance or price. Row → thread page; RSVP happens there.
             `.ics` for the whole list via the existing surface/ics.ts.

/orgs        ORGS · 12                                         [Partner] [Supported] [Free]
             ┌ ╭──╮ AMRIT CANADA          ┐ ┌ ╭──╮ INNER GATHERING    ┐
             │ ╰──╯ Toronto · partner     │ │ ╰──╯ online · supported │
             │ Amrit Vela sadhana, yoga…  │ │ A Fourth Way reading…   │
             │ 3 forums · 62 topics · 41  │ │ 2 forums · 41 topics    │
             │ last: Morning sadhana · 2h │ │ last: Chapter 9 · 1d    │
             │ board →        site ↗      │ │ board →       site ↗    │
             └────────────────────────────┘ └─────────────────────────┘
             OrgMasthead as a card. The one page that reads as a directory;
             it earns that by being the index with the feeds folded away.

/members     MEMBERS · 50                     [Most active] [Newest] [A–Z]   ⌕ name
             ● Dana Whitfield     Member · Amrit Canada, Guide · Inner G.   214 posts
             ● Guru Dharam Singh  Guide · Amrit Canada                      180 posts
             ● Priya K.           Member · IFAC                    joined today · 2 posts
             listPublicProfiles + forum counts; row → member page.
```

- All four are server-rendered lists over one connector each; nothing here
  needs client state beyond the sort tabs.
- Org-scoped host: `/latest` and `/happening` exist, scoped; `/orgs` and
  `/members` do not.

### 4.9 Moderation (`⋯ mod` on masthead; owner/guide of the thread's org, or global admin)

Pin · Lock · Move to another feed (same org) · Delete. Each writes an
`events` row (existing audit log). Locked and pinned states already exist on
`threads`. A mod log page (`/o/[org]/log`) is a filtered read of `events` —
phase 5, not phase 1.

### 4.10 Tokens and skinning

```css
/* forum.css reads only these; hosts set them (or site_themes does). */
--gf-row-hover:   color-mix(in srgb, var(--sf-fg) 3%, var(--sf-bg));
--gf-unread:      var(--sf-accent);
--gf-quote-rule:  var(--sf-line);
--gf-vote-up:     var(--eac-kind-post, var(--sf-accent));
--gf-vote-down:   var(--sf-danger);
--gf-density:     1;        /* 0.85 compact, 1 classic, 1.15 airy */
```

Everything else is `--sf-*` (bg, fg, muted, line, accent, radius, fonts).
`apps/forum` sets a neutral palette; amrit-canada sets nothing and gets its
Cinzel/Lora paper look because its `globals.css` already defines the
`--card`/`--foreground` tokens the surface layer maps from.

### 4.11 What makes it feel like a forum

The layouts above are necessary and not sufficient. These are the behaviours
a board is judged on in the first minute; each is a phase-1 or phase-2 line
item, not polish for later.

**Speed and stillness**
- Every list and thread page is server-rendered HTML. No skeletons, no
  spinners, no layout shift; the only client JS on a list page is the sort
  tabs and the hover card. A board that flickers isn't a board.
- Pagination is real links (`?page=3`), so back/forward, middle-click and
  "open in new tab" all behave. Infinite scroll is not used anywhere.
- Row hover is a full-width tint (`--gf-row-hover`); the whole row is the
  hit target, but title, author, feed and "last post" stay distinct links —
  three destinations per row, like every board since 2001.

**Memory**
- Unread is bold + dot, and it *persists*: come back tomorrow and the same
  rows are still bold until read. `Mark all read` is one click, one
  watermark, with an undo toast.
- The "last post" cell links straight to `#reply-<id>` of that post, and the
  title links to `/unread` when there's anything new — the two jumps a
  regular uses without thinking.
- The reply box keeps a draft per thread in `localStorage`; navigating away
  and back restores it, with a "draft restored" line.

**Orientation**
- Breadcrumb on every page: `Boards › Amrit Canada › Amrit Vela › Thread`.
  Each segment is a link. On an org host the first segment is the site.
- Post numbers (`#2`, `#3`) are permalinks that copy on click; the URL bar
  updates to the anchor as you scroll past posts, so a link shared
  mid-thread lands where the sharer was.
- Sticky, slim thread toolbar on scroll: title, `Reply`, `▲ top`, page
  `3 of 7` with prev/next. Nothing else sticks.
- The "new since your last visit" rule is a real horizontal rule in the
  stream, and the page scrolls to it on open.

**Keyboard** (signed-in, list and thread pages)
- `j`/`k` move a row highlight; `Enter` opens; `u` jumps to first unread on
  a thread; `r` focuses the reply box; `.` opens the row's actions;
  `Esc` closes the hover card. Shown once in a dismissible footer line.

**Density and mobile**
- `--gf-density` 0.85 / 1 / 1.15 as a footer toggle, remembered per viewer.
- Under 720px the board table collapses to a two-line list (title + counts
  / kicker + last post), the rail moves *below* the board (Happening first,
  the rest folded), and the thread rail becomes a facts strip under the
  masthead. The reply box becomes a bottom sheet with the composer chrome
  hidden until focus.

**Tone**
- Empty states are one sentence and always contain the next action: "No
  topics yet — start one below." / "Nothing scheduled — start one on your
  org's site". No illustrations.
- Timestamps are relative under 7 days, absolute after; `title=` carries
  the full stamp in the viewer's zone.
- Edited posts say `edited · 12m` in the byline; deleted replies leave a
  single grey `removed by Guru Dharam` line so numbering and quotes still
  make sense.

### 4.12 Visual language (network host)

Decisions 8–12 as concrete tokens. The org hosts override all of this via
`site_themes`; this is what `apps/forum` sets.

```css
:root {
  /* Ground and ink — Discourse-clean, warmed slightly toward paper. */
  --sf-bg:        #fbfaf8;
  --sf-bg-soft:   #f3f1ec;
  --sf-fg:        #1d1c1a;
  --sf-muted:     #6b6762;
  --sf-line:      #e6e2db;
  --sf-rule:      #cfc9bf;          /* section rules, a shade heavier than row lines */

  /* The two colours. Orange leads (links, unread, primary); blue supports
     (kickers, meeting/event kinds, focus rings). Both desaturated. */
  --sf-accent:    #c2622b;          /* burnt orange */
  --gf-blue:      #3f5f8a;          /* slate blue */
  --sf-danger:    #a63d2f;

  --eac-kind-post:      #c2622b;
  --eac-kind-meeting:   #3f5f8a;
  --eac-kind-event:     #3f5f8a;
  --eac-kind-workshop:  #7a5c3a;
  --eac-kind-poll:      #5c6b3f;

  --sf-radius: 4px;

  /* Type. The Gothic undertone lives in ONE place: the display face on the
     site title and org mastheads. Everything else is a clean humanist sans. */
  --sf-font-title:  "Cormorant Garamond", "EB Garamond", Georgia, serif;   /* mastheads, thread titles */
  --gf-font-display: "UnifrakturCook", "Cormorant SC", var(--sf-font-title); /* "THE GRAND FORUM" only */
  --sf-font-body:   "Inter", system-ui, sans-serif;
  --sf-font-record: ui-monospace, "SF Mono", Menlo, monospace;            /* counts, kickers, #n */

  --gf-density: 1;
}

@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* decision 12 */
  --sf-bg: #18191d;  --sf-bg-soft: #1f2126;  --sf-fg: #e8e5df;  --sf-muted: #9a958d;
  --sf-line: #2a2c33; --sf-rule: #3a3d46;
  --sf-accent: #d8804d;  --gf-blue: #7d9cc6;  --sf-danger: #d1665a;
  --eac-kind-post: #d8804d; --eac-kind-meeting: #7d9cc6; --eac-kind-event: #7d9cc6;
}}
:root[data-theme="dark"] { /* same block; the footer toggle wins over system */ }
```

Rules that follow from the decisions:

- **Where the Gothic shows** — the display face on "THE GRAND FORUM" and on
  org masthead names; the heavier `--sf-rule` under section headings; the
  glyphs (◉ ◎ ◈) drawn slightly larger than the text. Nowhere else. Body
  text, rows and the reply stream are plain Discourse-clean so long threads
  stay effortless.
- **Where orange goes** — links, unread dot and bold, the primary button,
  the vote-up arrow, the "new since your last visit" rule. **Where blue
  goes** — kickers, meeting/event glyphs, focus rings, the Happening rail's
  dates. Neither is ever a background fill larger than a chip.
- **Org accents** (decision 11) — only the 3px hairline on feed rows and the
  org masthead's left edge, read from `org_feeds.accent`. The org portrait
  is not tinted.
- **Avatars** — 24px round in rows (last poster only), 32px in bylines, 64px
  on hover card and member page. Initials fallback on `--sf-bg-soft`.
- **Compact on mobile** — decision 8's rider, made specific: under 720px
  row height ≈ 56px (title + kicker), no excerpt, no avatar; the masthead
  collapses to title + ⌕ + 🔔 + avatar with the nav as a horizontal
  scroller; the pulse strip becomes two lines; the rail stacks below the
  board with only Happening open.
- **Identical index for everyone** (decision 10) — the signed-in state
  adds only: the dots, `Unread n`, the bell, and the avatar menu. No
  reordering, no "your boards", no digest.

## 5. Phases

Each phase ends green on `pnpm check-types`, the migration applied against
live Postgres, and a screenshot of every page in the phase.

**Phase 0 — clear the ground — DONE 2026-09-08**
- `apps/forum/src` removed (configs, `package.json`, Docker service kept).
- `packages/services/src/forum.ts` (new): `listBoards`, `listTopics`,
  `getForumThread`, `recordThreadView`, `listReplies`, `listReplyChildren`,
  `listHappening`, `listLatest`, `getPulse`, `getViewerRoles`, with
  `ForumScope` / `ForumViewer` and the per-viewer visibility predicate.
  Exported from the services index.
- `packages/db/src/queries/forum.ts` trimmed to the reply surface
  (`getReplies`, `getRepliesFlat`, `buildReplyTree`, `createReply`) that
  `apps/inner-gathering` still imports — *not* deleted. Everything else in
  it was dead: the feed/thread reads hit dropped tables, and the three
  toggles wrote to `reactable_type` / `watchable_type` /
  `bookmarkable_type` columns that never existed.
- Migration 110 applied (see §3). Live check: 0 threads without
  `last_activity_at`, 0 without a section, 15 `general` feeds.
- Verified by running every read function against the live DB from inside
  the amrit-canada container (esbuild-bundled `forum.ts`; the services
  index can't be loaded by plain node because it pulls `next`). 81ms for
  the full pass. Builds must run in a container — `dist/` is root-owned.
- Two things the data showed, for phase 1: with a `general` feed on every
  org, **all 15 orgs now have a board**, eleven of them empty — the network
  index should hide boards with zero visible topics (an empty board is not
  a board; flip to "show with a 'no topics yet' line" if the directory
  feel is wanted). And amrit_canada carries test rows titled `sdfsdf` /
  `test` — clean them before screenshots.

**Phase 1 — the board, read-only — DONE 2026-09-08 (scaffold)**

Built: `packages/forum-ui` (`connectors.ts`, `routes.tsx`, `pages.tsx`,
`parts.tsx`, `thread.tsx`, `adapters.ts`, `format.ts`, `forum.css`) and the
thin host — `apps/forum` is `layout.tsx` (masthead), `lib/site.ts`,
`lib/viewer.ts`, `globals.css` (the §4.12 tokens) and one catch-all
`[[...segments]]/page.tsx` of 25 lines. Pages: index (pulse strip, org
mastheads, board tables, rail), board, feed (sort tabs, pagination), thread
(SurfacePage masthead + flat stream with `<details>` one-level expansion,
read-only vote bar), `/latest`, `/happening` (agenda). Zero client JS in the
package; every list is links.

Verified: all routes 200 on the host dev server (index 4.1s cold, then
200–700ms), unknown → 404; type-check clean for package and app; the
members-only thread renders its reply stream for a member via an SSR
harness (breadcrumb, kicker, `#2`, Owner chip, `members` chip); screenshots
at 1280 and 400 reviewed and the first-pass visual fixes applied (masthead
underlines, doubled byline, doubled sign-in, mobile count labels, org names
moved off the blackletter — it stays on the site title only, empty
`general` rows hidden).

**How to run it (until the compose service has an image):** the forum
container has no image and the Dockerfile's `pnpm install` fails; host
`pnpm install` also refuses (root-owned `node_modules`). The workspace
symlinks for `forum-ui` were created from inside the amrit-canada container
and the dev server runs on the host:
```
set -a; . ./.env; set +a
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB" \
REDIS_URL=redis://localhost:6379 NEXT_PUBLIC_NETWORK_URL=http://localhost:3007 \
pnpm --filter forum dev        # http://localhost:3003
```
Screenshots: `docker run --rm -u root --network host -v $DIR:/out zenika/alpine-chrome --no-sandbox --headless --screenshot=/out/x.png URL`.

Left for later passes, deliberately: Who's here / New members rail blocks,
the `From <org>` block's site link (`hrefs.orgSite` returns null until org
domains are wired), `--gf-density` toggle (needs a client component), the
inline new-topic form and reply box (phase 2). `Happening` is empty on
real data because nothing is scheduled ahead — the agenda layout is
untested against rows.

*(Original phase-1 scope, for reference:)*
- `packages/forum-ui` skeleton, `forum.css`, `ForumConnectors`, router.
- Index with pulse strip, org mastheads and the rail (Happening, Latest,
  Topics; Who's here and New members can be static-empty until phase 3),
  board page with identity header, topic list, thread page (masthead + flat
  stream, no interactions), pagination, byline (no hover card yet).
- `/latest` and `/happening` — they're the rail blocks at full size, so
  they fall out of the same queries.
- `apps/forum` host: masthead, connectors, catch-all page.
- Screenshots of §4.1–4.4 and §4.8 against real inner_group / amrit_canada
  data. Note there are **0 upcoming scheduled threads** in the DB today —
  seed two meetings so Happening renders non-empty.

**Phase 2 — interactions — DONE 2026-09-08**

Built: migration **112** (`thread_reads` + `users.forum_read_all_at`; vote
CHECK + one-vote indexes + `vote_score` on threads/replies with backfill;
`topics.status/proposed_by/org_id/reviewed_at`), the services write layer
`packages/services/src/forum-write.ts` (`postReply`, `createTopic`,
`setVote`, `toggleHeart`, `listVoters`, `toggleWatch`, `toggleBookmark`,
`markThreadRead`, `markAllRead`, `proposeTopic`, `reviewTopic`,
`moderateThread`, notifications), read-layer additions (per-viewer `unread`
on rows and `unreadCount` on feeds, `viewerVote`/`viewerHearted`,
`firstUnreadReply`, `unread`/`watching`/`bookmarks` list targets), and in
the package: `actions.ts` (`handleForumAction` — every interaction is a
plain `<form method="post">` to `/api/forum/<action>`, 303 back with
`?notice=`/`?error=`; still zero client JS), the reply box (textarea;
blank line = paragraph, `>` = quote; Reply/Quote links prefill via
`?replyTo=`/`?quote=`), vote bar with named voters via `?voters=`,
watch/bookmark/moderate toolbar (pin/lock/move/archive in a `<details>`
menu), the "new since your last visit" rule, `/t/[id]/[slug]/unread`
redirect, unread dots + per-feed unread chips + mark-all-read, the inline
new-topic form with its three gate states and topic checkboxes + propose
field, `/unread` `/watching` `/bookmarks` `/notifications`, and the
`<details>` bell in the masthead. Host gained
`app/api/forum/[action]/route.ts` (5 lines), `lib/connectors.ts`, and a
`FORUM_DEV_VIEWER_ID` impersonation knob (non-production only) because the
host dev server has no auth service to sign in against.

Verified end to end over HTTP as a member and as the owner: reply and
nested reply (303 to the anchor, HTML escaped, blockquote rendered),
vote/heart/watch/bookmark with correct counters, own-post vote refused
with the error in the query, notifications to watchers and the parent's
author, new topic from the inline form, propose (admin → approved at
once), pin, `/unread` redirect to the exact first-unread reply, bell count
and `Unread 13` in the masthead. Screenshots reviewed. **All test rows were
deleted afterwards** — the exercise had posted under a real member's name.

Not done in this pass: reply-box draft persistence (needs JS), edit/delete
own reply, `Who's here`, `topic_approved` notification on review, the
admin review page for proposed topics (service exists: `reviewTopic`).

*(Original phase-2 scope, for reference:)*
- Migration 111. Read state (`markRead` on thread open, unread dots, the
  "new since" rule, `/unread`, mark-all-read).
- Reply box, quote, replying-to chip, inline expansion.
- Votes + hearts + voter list; watch; bookmark; `notifications` writes.
- Inline new-topic form with its three gate states.

**Phase 3 — people and taxonomy — DONE 2026-09-08**

Built: `packages/services/src/forum-people.ts` (`listPeopleCards`,
`getMember`, `listMemberActivity`, `listMembers`, `listPresent`,
`listNewMembers`, `touchLastSeen`, `listOrgCards`, `listTopicEntries`,
`getTopicBySlug`, `reviewTopicAndNotify`); in the package `people.tsx` —
the CSS-only hover card (`:hover`/`:focus-within`, fed by one
`listPeopleCards` query per thread page), the member page (ArtDirect's
`ProfileView` unchanged, plus roles / joined / ArtDirect link and the
activity stream with Topics-started / Replies tabs), `/members` (sort +
name search), `/orgs` (masthead cards with tier filter), `/topics`,
`/topics/[slug]`, `/topics/review` (admin approve/reject → notification to
the proposer), and the Who's here / New members rail blocks. Masthead nav
now carries Topics · Orgs · Members. `configureForumMedia()` lets a host
without a media route resolve `/api/media/…` avatars elsewhere (this host →
ArtDirect).

Presence: nothing on the network wrote `users.last_seen_at` (only
pigeonshoot's guest code), so the forum's viewer resolver now touches it,
throttled to once per 5 min.

Verified: every route 200 as a guest; `ProfileView` needed the
`--eac-profile-*` / `--ink` / `--paper` tokens mapped in the host or the
name rendered near-invisible; avatars are stored as app-relative paths and
were broken until the media resolver.

*(Original phase-3 scope, for reference:)*
- Hover card; member page over `ProfileView`; activity stream.
- `/orgs`, `/members`, Who's here, New members, the thread rail's
  `From <org>` block.
- `/topics`, `/topics/[slug]`, propose flow, admin approve list.

**Phase 4 — second host — DONE 2026-09-08 (the replicability proof)**

Mounted on amrit-canada at `/forum` in **45 lines**: `src/lib/forum.ts`
(25 — org scope, viewer from the site's own `getViewer` + `getViewerRoles`,
`orgHrefs({ base: "/forum" })`, `actionBase`), the catch-all page (13) and
the action route (7). Plus one `@import` each of `forum.css` and
`profile.css`, `@elkdonis/forum-ui` in `transpilePackages` and
`package.json`, and a "Forum" link in the site header. No forum CSS in the
host: it renders in Cinzel/Lora on the warm ground with the saffron feed
hairline, from the site's existing `--eac-surface-*` tokens.

Verified on a host dev server (port 3016; the production container needs
`next build` + restart to show it): `/forum`, feeds, sort, latest,
happening, members, topics, thread all 200; `/forum/orgs` 404 by design;
guest POST → 303 with the error; org-scoped pages show no pulse strip or
org masthead.

Two things it exposed, both fixed: an empty rail panel on posts (a truthy
empty fragment), and **migration 110's `general` feed had appeared as a
"General" link in every org site's nav** because sites build nav from
`org_feeds WHERE is_public` — migration 113 makes `general` non-public and
the forum includes it regardless. If any org site had been rebuilt between
110 and 113 it briefly showed that link.

*(Original phase-4 scope, for reference:)*
- Mount at `apps/amrit-canada/src/app/forum/[[...segments]]`; add "Forum" to
  its `SiteHeader`. This is the replicability proof: if the host file is
  longer than ~40 lines, the package is leaking host concerns.
- Confirm `site_themes` restyles it with no forum-specific vars.

**Phase 5 — moderation, search, hygiene — DONE 2026-09-08**

Migration **114**: generated `search_tsv` columns on `threads` (title A,
excerpt B, de-tagged body C) and `replies`, GIN indexes, a trigram index on
`threads.title`, and `idx_events_org_created` for the log.
`packages/services/src/forum-search.ts`: `searchForum` (websearch syntax —
quoted phrases, `-` exclusion — plus trigram title fallback, per-viewer
visibility, `ts_headline` snippets and whole-title highlighting) and
`listModLog`. In the package, `search.tsx` with `/search` (Everything /
Topics / Replies facets, `<mark>` styling) and `/o/[org]/log` (`/log` on an
org host), a `SearchBox` in the masthead, and a "Moderation log →" link in
the moderation menu.

**Fixed a real defect found here:** `moderateThread` wrote its audit row
with `actor_id`/`entity_type`/`metadata`, but `events` has
`user_id`/`resource_type`/`data` — and my own try/catch swallowed the
error, so **every moderation act since phase 2 was logged nowhere**. It now
writes the correct columns, reusing the existing `EventAction` vocabulary
(`content_pinned` etc.) so the admin dashboard's filters still work, and
tags `data.via='forum'`.

Verified: search hit counts, phrase and exclusion queries, title and body
highlighting; pin+unpin both recorded and rendered on the log page; the
rate limiter allowed exactly 10 replies in the window and refused the next
2. All probe rows deleted afterwards.

*(Original phase-5 scope, for reference:)*
- Pin/lock/move/delete + `events` rows; mod log page.
- Postgres FTS: `tsvector` generated columns on `threads(title, body)` and
  `replies(content)`, GIN indexes, `⌕` box → `/search?q=`.
- Rate limit in `createReply`/`createTopic` (per user, per 10 min) — the
  one real gap for an open-posting forum.

## 6. Known edges

- **`getOrgRole` returns null for non-members**, and `canViewFeed` treats
  that as signed-out. That is right for `minRole` feeds; for posting, the
  gate is *signed-in + feed.minRole is null*, not membership. Don't reuse
  `requireOrgEditor`.
- **`RESERVED_SLUGS`** — if arts-collective ever mounts the forum, `forum`
  must be in its middleware `PASSTHROUGH_PATHS`; it isn't today.
- **Host `pnpm install` hangs** — run installs in the container (known).
- **`replies.session_id`** and **`users.trust_level`** exist; the forum
  ignores both in phase 1. `trust_level` is the natural later gate for
  rate limits and unmoderated topic proposals.
- **Every thread is on the forum** (settled 2026-09-08). The forum decants
  the whole `threads` table; `visibility` decides only who sees a row —
  `PUBLIC` everyone, `ORGANIZATION` members of that org (row carries a
  small `members` mark), `INVITE_ONLY` invitees. There is no opt-in, no
  "share to network" state, and `threads.share_to_network` is ignored by
  the forum entirely. Counts in the pulse strip and board table are
  computed per viewer for the same reason.
- Two-level reply expansion needs a `child_count` per top-level reply: a
  lateral count in `listReplies`, not a stored column.
- **Who's here depends on `users.last_seen_at` actually being touched** on
  session reads. It defaults to `now()` at creation; verify `auth-server`
  updates it (or add a throttled touch in the forum's `viewer()` connector)
  before the block goes live, or it will show everyone as present forever.
- **Org mastheads need `OrgIdentity` rows.** `profile_user_id` is null for
  orgs that predate migration 099 and were never linked; the masthead must
  degrade to name + slug, not vanish.

## 6b. The forum as a face and a surface (2026-09-09)

The board is pages — rows navigate, nothing pops (decision 4b). That is right
*inside* a forum. Seen from **outside** — a hub tile beside the calendar and
the pipeline — the forum is a face that opens a surface, answering "is
anything happening in there?" without leaving the page. The two do not
contradict: on the board a row is a destination, on the tile it is a preview.

**Layering, deliberately:**

| Layer | Holds | Never |
|---|---|---|
| `@elkdonis/cms-ui/surface` | `SurfaceForum` shape, `SurfaceForumConnectors`, `ForumSurface`, `ForumMini`, the `forum` kind + `--sf-kind-forum` token, `?surface=forum` | imports the data layer — the whole package is free of it |
| `@elkdonis/forum-ui` | `forumSnapshot()` — the mapping from `threads` onto that shape, for both scopes | knows any host's routes |
| host | `connectors.forum` + one `<ForumFace>`; `getForumSnapshot()` is its single definition | reimplements either |

This is the same shape as the Deck board (`SurfaceBoard` / `BoardMini` /
`connectors.board`), so a host with conversations stored elsewhere can fill in
`SurfaceForum` and get the identical tile.

Sections are the org's feeds on an org host and the **orgs themselves** on the
network host — the level a person actually picks between in each place. Every
count is per viewer, because visibility is.

**On amrit-canada:** `src/lib/forum.ts` gained `forumHrefs`, `getForumViewer`
and `getForumSnapshot` (one definition, used by the tile, the surface's
refresh route `/api/hub/forum`, and the board's connectors); `ForumFace` in
the hub; `connectors.forum` in `HubSurfaces` with a `markAllRead` that posts
the board's own `/api/forum/read-all`.

Verified live: the snapshot JSON for both scopes, the tile, and the popup
opened by `?surface=forum` on a public page — which also exercises the
serialize/parse round-trip added to `url.ts`.

## 6c. Mounted on hidden-enneagram and IFAC (2026-09-09)

Four hosts now: `apps/forum` (network), amrit-canada, hidden-enneagram, IFAC.

**hidden-enneagram** — the full treatment, because it already had
`SurfaceProvider`: board at `/forum`, action route, `getForumSnapshot()`,
`<ForumFace>` on the hub, `connectors.forum`, nav link. `ForumFace` itself
moved from amrit-canada into `@elkdonis/cms-ui/surface` on the way — it is
pure presentation over `SurfaceForum`, so copying it per host was the
duplication this project keeps trying to avoid. Amrit-canada now imports it.

**IFAC** — board + a tile, but no popup: this app keeps its own
`HubCard`/native-`<dialog>` system, so the tile uses `ForumMini` inside
IFAC's `HubCard` and navigates to `/forum`. Mounting `SurfaceProvider` here
later would turn that face into a popup without touching `lib/forum.ts`.

**Two traps found by doing it, both recorded:**

1. **A stale Turbopack CSS chunk, not the `@import`.** An earlier pass here
   concluded that importing the package stylesheets into IFAC's
   `globals.css` collapsed its CSS. **That was wrong.** Both imports work —
   the chunk goes 112KB → 194KB with IFAC's own `main-nav` intact. What
   actually happened is that Turbopack kept serving a cached chunk: edits to
   `globals.css` did not change the emitted content hash, through both
   `touch` and a container restart, and at one point it served a near-empty
   5.8KB file. Clearing the cache (`find .next -mindepth 1 -maxdepth 1
   -exec rm -rf {} +` inside the container, then restart) fixed it and every
   edit has landed since. Suspect the cache before the CSS.

2. **A dark host must map the surface tokens.** hidden-enneagram is
   permanently dark and defined no `--eac-surface-*`, so the surface layer
   fell back to its light defaults and the whole forum rendered dark-on-black.
   Mapped onto its shadcn tokens in `:root`; this also fixes its pre-existing
   compose popup. IFAC gets the same mapping scoped to the forum route, onto
   its own `--ink`/`--paper`/`--line`/`--oxide`/`--blue`.

Verified live in both containers (hidden-enneagram rebuilt, IFAC hot-reloaded):
every route 200, `/forum/nope` 404, guest POST → 303 with the error, and both
boards screenshotted in their own skins.

**Screenshot gotcha:** `docker run --network host` does *not* reach the host's
`localhost` on this box — use the host IP (192.168.0.11). A blank 5.9KB PNG
means the browser never connected, not that the page is broken.

## 6d. A second skin: the modern card feed (2026-09-12)

Decision 1 chose the classic board. This adds the **modern feed as an
option** rather than a replacement — `theme: "classic" | "modern"` on the
forum connectors, defaulting to classic.

**It is only CSS.** `packages/forum-ui/src/forum-modern.css`, every rule
scoped under `[data-forum-theme="modern"]`, which `renderForumRoute` emits on
its own root (`.gf-root`) so the thread view — which sits outside `Layout` —
is covered too and no host touches its markup. A host opts in with one
`@import` and one connector field; the stylesheet is inert until the
attribute is set, so importing it always is safe.

This works because the classic markup was already semantically a feed: a
topic is an `<li>` with a glyph, title, excerpt, kicker and stats group, and
a board section is a table of feed rows. Cards need different boxes, not
different HTML. The consequence that matters: **the two skins cannot drift**
— a feature built for one appears in both, because there is one set of
components.

What changes: a card per topic with a hover lift; two lines of excerpt
instead of one clipped line; the kind glyph in a tinted circle; counts as
pills under the body instead of a right-hand column; segmented pills for
sort; the board index as a responsive grid of section cards with the feed
accent as a top edge; rail blocks, replies, forms, search hits, members and
the mod log all as cards; pagination as pills.

Two judgements worth keeping:
- **Unread is marked once.** The classic row uses a dot plus bold; a card can
  carry a coloured left edge, so the dot is hidden in modern rather than
  marking one fact three times.
- **An empty section earns a quieter card.** `:has(.gf-last--none)` fades the
  top edge, greys the ground and drops the last-post line — otherwise an
  empty feed takes the same visual weight as a busy one in a grid.

Kept: real `?page=` links, the plain-form reply box, server-side read state,
and colour only from `--sf-*` tokens — so an org theme restyles the modern
skin exactly as it restyles the classic one, and both work with JS off.
`prefers-reduced-motion` drops the lift.

The network host reads `FORUM_THEME=modern` (env, defaults classic).
Verified live in both skins: index, `/latest`, thread, mobile; classic
screenshotted after the change to confirm no regression from the new wrapper.
