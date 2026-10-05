# Design — Brief B, org `/forum` scope switcher

Design for `BRIEF_B_FORUM_SWITCHER_2026-09-18.md`, written 2026-09-25 against
the working tree (including uncommitted `packages/forum-ui` edits from another
session dated 2026-09-25). It proposes how an org site's `/forum` offers
*This org* and *The collective* from the in-process mount, lists the decisions
that need the developer, and the checks that close the brief. No code has been
written. Database facts were not queried (no database access from this
session); they are marked **unknown**.

## 1. Requirements

From the brief and its DECIDED block (user, 2026-09-18):

- One control: scope, `?scope=org|collective`, default `org`. Linkable, works
  without script.
- Layout follows scope: org → cards, collective → classic (the board/stream
  table). No separate view switch.
- Cards are a layout inside the current steel design, not the retired
  `forum-modern` skin.
- Collective scope on an org site: reading any visible org's topics; New topic
  offers only feeds the viewer can post to.
- No iframe on org sites (cross-site frames lose the session). The `/embed`
  routes stay for third-party sites.
- Must not surface another org's `ORGANIZATION`/`INVITE_ONLY` rows to a
  non-member; `OFF_FEED_KINDS` stay out of both scopes.

Non-functional: server-rendered, no client JS in `forum-ui`; one query set for
both scopes; no new tables or migrations.

## 2. Current state (verified by reading code, 2026-09-25)

- Five org sites mount the forum in-process at `/forum`:
  amrit-canada, hidden-enneagram, ifac, innergathering, sunjay
  (`apps/<app>/src/app/forum/[[...segments]]/page.tsx` →
  `renderForumRoute`). The brief named three; the design covers all five.
- Scope already exists end to end. `ForumScope = { kind: 'network' } | { kind:
  'org'; orgId }` (`packages/services/src/forum.ts:25`). Every read query takes
  it (`inScope`, `forum.ts:280`; `listBoards` `:351`). `apps/forum` runs the
  same package with `{ kind: 'network' }`.
- Pages and the shell read scope only from `connectors.scope`
  (`packages/forum-ui/src/shell.tsx:39`, `pages.tsx:69` and others). Swapping
  `scope` and `hrefs` on the connectors object is enough to render the other
  scope; no page needs a new argument.
- Thread pages are not scope-filtered: `getForumThread` checks only
  `visibleTo` (`forum.ts:670`), so `/forum/t/<id>` on any org site already
  renders a visible thread from another org.
- Routing (`routes.tsx`): `/o/[org]` and `/o/[org]/[feed]` exist only when
  `scope.kind === 'network'`; on org hosts a single segment is a feed slug.
- `orgHrefs` (`connectors.ts:375`) maps `board()` to the mount root and ignores
  the org, so it cannot link to another org's board. `networkHrefs`
  (`:349`) can, under `/o/`.
- Feed slugs that would collide with a route are refused on create
  (`RESERVED_FEED_SLUGS`, `packages/services/src/forum-write.ts:523`); `o` is
  not in the list.
- Visibility (`visibleTo`, `forum.ts:267`) is scope-independent: PUBLIC, the
  viewer's orgs' ORGANIZATION rows, the viewer's own rows (any visibility);
  global admins see every published row. Wiki/writing/document kinds are
  excluded for everyone.
- Feed `min_role` is enforced when listing boards (`forum.ts:431`) and on
  write (`forum-write.ts:273-274`). It is not referenced in `listTopics`,
  `listLatest` or `getForumThread`. See Open questions.

### Concurrent work in the same files (uncommitted, 2026-09-25)

Another session added reader controls to `forum-ui` (`parts.tsx`
`ReaderControls`, `routes.tsx` `resolveReaderPrefs`, `actions.ts`
`set-theme`, ~480 lines of `forum.css`):

- Text size (`standard|large|largest`) and a **Layout** choice (`board|cards`),
  each saved in a per-domain cookie (`forum_size`, `forum_layout`) and
  overriding a host default (`ForumConnectors.size`/`layout`).
- The cards layout is implemented in CSS on `data-forum-layout="cards"`
  (`forum.css:897` on): one card per topic, category and reply.
- IFAC sets `layout: "cards"` and `size: "large"` by default at the owner's
  request (`apps/ifac/src/lib/forum.ts`, comment dated 2026-09-23).

This covers most of the brief's card work. It also introduces a reader-chosen
layout, which the 2026-09-18 decision ruled out. Decision D1 below.

## 3. Proposed design

```
 org site request  /forum/...?scope=collective
        │
        ▼
 apps/<org>/.../forum/[[...segments]]/page.tsx     (unchanged except one arg)
        │  getForumConnectors()  → org connectors (as today)
        ▼
 renderForumRoute({ connectors, segments, searchParams, collective: {...} })
        │  scope = readScope(searchParams, segments)       // 'org' | 'collective'
        │  c = scope === 'collective' ? withCollective(connectors) : connectors
        │  layout = resolveLayout(scope, cookie, host default)   // D1
        ▼
 loadShell(c) + page(c)  ── services/forum.ts (visibleTo + inScope)
        │
        ▼
 <div class="gf-root" data-forum-scope=… data-forum-layout=…>
     <ScopeSwitch/>  <ReaderControls/>  page
```

### 3.1 Scope selection

- `readScope`: `collective` when `searchParams.scope === 'collective'` or the
  path starts with `/o/`; otherwise `org`. Unknown values fall back to `org`.
- `withCollective(connectors)` returns a copy with
  `scope: { kind: 'network' }` and `hrefs: collectiveHrefs(base)`. The data
  functions are unchanged; they already take the scope as an argument.
- Only `renderForumRoute` changes shape. Hosts opt in with one flag
  (`collective: true`, or `collective: { label }`) so an org site can stay
  org-only.

### 3.2 Links in collective scope (D2)

Recommended: stay on the org site.

- `collectiveHrefs(base)` = `networkHrefs({ base })` with `?scope=collective`
  appended to the list routes (`root`, `latest`, `happening`); boards and feeds
  live at `/forum/o/<org>` and `/forum/o/<org>/<feed>`, which imply the scope.
- Thread links stay `/forum/t/<id>/<slug>` (already unscoped). A thread page
  renders with the org shell; a "Back to the collective" breadcrumb is carried
  by `?from=collective` if wanted.
- Routing: allow the `/o/…` branch when the host enabled collective. Add `o`
  to `RESERVED_FEED_SLUGS` (`forum-write.ts:523`). Whether an existing feed is
  already slugged `o` is **unknown** (not queried); check `org_feeds` first.

### 3.3 The switch

`ScopeSwitch` in `parts.tsx`: two links (`/forum` and
`/forum?scope=collective`), `aria-current` on the active one, rendered above
`ReaderControls`. Links rather than a form, since scope is navigation, not a
preference; nothing is stored.

### 3.4 Layout (D1)

Recommended rule: `layout = cookie ?? (scope === 'collective' ? 'board' :
hostDefault ?? 'cards')`. The scope sets the default, and the reader's
explicit Layout choice (added 2026-09-25 for readers with poor eyesight) still
wins. The alternatives are in D1.

### 3.5 Writing in collective scope

No new write path. Feed pages under `/forum/o/<org>/<feed>` render New topic
only when `canPostToFeed` allows it for the viewer; the action posts to the
org site's own `actionBase` (`/api/forum`), and `forum-write.ts` re-checks
`canViewFeed`/`canPostToFeed` (`:273-274`) whatever the UI showed. The board
page keeps its "New topics are made on {board}" note (`pages.tsx:319`).

### 3.6 Styling

Scope adds `data-forum-scope` on `.gf-root` for any collective-only tweaks
(org names on rows are already rendered when `scope.kind === 'network'`,
`showOrg`). Cards and size come from the 2026-09-25 CSS. Hosts map tokens in
their own `globals.css` as today; no host CSS change is expected.

## 4. Decisions for the developer

**D1 — Layout: follow scope, or let the reader choose?** The 2026-09-18
decision says scope only; the 2026-09-25 reader controls add a Layout choice
and IFAC defaults to cards.

| Option | Effect | Cost |
|---|---|---|
| a. Scope sets the default; reader cookie overrides (recommended) | Keeps the accessibility control and IFAC's default; collective opens as board unless the reader chose otherwise | The cookie is per site, not per scope: a reader who picks Cards gets cards in both |
| b. Scope decides; remove the Layout button | Matches 2026-09-18 exactly | Reverts part of today's reader-controls work; IFAC's cards default applies to org scope only |
| c. Reader decides; scope does not affect layout | Simplest | Contradicts the 2026-09-18 decision |

**D2 — Where collective links go.**

| Option | Effect | Cost |
|---|---|---|
| a. In-process `/forum/o/…` on the org site (recommended) | Session, header and palette stay; works when `apps/forum` is down (it was down 2026-09-25) | Adds the `/o/` routes to org hosts; reserves feed slug `o` |
| b. Link out to forum.arts-collective.com | No routing change; the network SSO proxy (2026-09-25, uncommitted) now signs the reader in on arrival | Reader leaves the org site; depends on `apps/forum` uptime and on the SSO work landing |

**D3 — Hosts.** Enable collective on all five org mounts, or only the three
the brief named (ifac, amrit-canada, innergathering)? Recommended: flag it per
host and enable the three named; sunjay and hidden-enneagram when asked.

## 5. Scale and reliability

- Load: collective scope runs the same queries as `apps/forum`'s network
  scope, per request, with no cache. Thread volume is small (row counts
  **unknown**, not queried; the 2026-09-23 data-model doc lists tens of rows
  per kind). No index or cache work is proposed; revisit if `listTopics`'
  `COUNT(*)` over `threads` without an org filter shows in response times.
- Failure: in-process rendering has no dependency on `apps/forum`; a Nextcloud
  stall is already bounded by `syncOrgNcForumIfStale` (org scope only, and
  only for the host org).
- Deploy: ifac, amrit-canada, innergathering, sunjay and hidden-enneagram are
  production builds; each needs a rebuild (back up `.next`, read `git status`
  first; the build ships every session's uncommitted `forum-ui` edits).

## 6. Verification (closes the brief)

1. Render `/forum` and `/forum?scope=collective` on ifac (dark),
   amrit-canada and innergathering (light), signed in and signed out, phone
   and desktop widths; screenshots via `/verify-ui`. Measure card contrast on
   all three.
2. Leak probe: as a member of org A only, collective scope and
   `/forum/o/<B>` must not list an ORGANIZATION or INVITE_ONLY topic of org B;
   `/forum/t/<id>` for it must 404. Repeat signed out.
3. Feed gate probe: a PUBLIC topic in a `min_role = member` feed of org B,
   viewed by a non-member (see Open questions).
4. New topic on `/forum/o/<B>/<feed>` appears only when `canPostToFeed`
   allows; a forged POST from a non-member is refused by `forum-write.ts`.
5. `OFF_FEED_KINDS` rows absent from both scopes' lists and search.
6. Log line on `SPRINT_2026-09-18_onboarding.md`.

## 7. Open questions

- Feed `min_role` on read: `listTopics`, `listLatest` and `getForumThread`
  do not reference `org_feeds.min_role` (grep, 2026-09-25), so a PUBLIC topic
  in a gated feed may be listed and readable by URL. **Unknown** whether any
  such row exists or whether the feed page hides it elsewhere. This affects
  `apps/forum` today, not only this design; check before building and fix in
  `visibleTo` if confirmed.
- Global admins see every published row in collective scope on an org site.
  Consistent with `apps/forum`; confirm that is acceptable on org sites.
- Coordination: the reader-controls edits in `forum-ui` are uncommitted and
  owned by another session. Build B on top of them after they land, or agree
  ownership of `routes.tsx`/`parts.tsx` first.

## 8. Revisit as the network grows

- A per-scope layout cookie if readers want different layouts per scope.
- A shared cache for network-scope lists if the thread count or org count
  makes the unfiltered `COUNT(*)` noticeable.
- A `view` param, which the brief already allows for later.
