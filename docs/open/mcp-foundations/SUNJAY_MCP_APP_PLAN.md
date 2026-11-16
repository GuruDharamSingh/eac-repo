# Sunjay as an MCP App: plan (2026-11-16)

Status: **superseded 2026-11-16, not to be built.** Justin: the MCP is the internal dock assistant on arts-collective (LMS trail, server actions, routing), not a sunjay view in Claude. Kept for the CSP and bundling notes only.

## What it is

When someone asks Claude (claude.ai or Claude Desktop) something like "show me Para Theater", Claude
calls a tool on the live MCP (`https://arts-collective.com/api/mcp`). The tool returns
sunjay's public data, and Claude draws it inline as an interactive page (an MCP App: a
`ui://` HTML resource in a sandboxed iframe). The Claude Code terminal shows the text fallback
only. The live paratheater.arts-collective.com site stays as it is apart from the
shared-query refactor in §1.

## Decisions taken (Justin, 2026-11-16)

- App: `apps/sunjay` (org `sunjay`, "Para Theater").
- Approach: rebuilt client view fed by MCP tools. Framing the live site was rejected.
- Home layout: **fixed layout**. The tool returns data and the view draws it; the saved Puck
  `puck:landing` tree is not reproduced in Claude.
- Fonts: **embed Fraunces + Spectral** (woff2, base64) in the HTML. There are no font origins in
  CSP, and the cost is about 150 to 250 KB.

## Scope

In scope: public, read-only screens: home, `[feed]`, `[feed]/[slug]`, `series`,
`series/[slug]`, `series/[slug]/[n]`, `journal/[piece]`, `about`, `about/[slug]`,
`publications`, `community`.

Out of scope: hub, manage, studio, account, login, center, channel, forum interaction,
RSVP, sign-in, comments, the store showcase on person pages, and any write.

## Visibility

The views show only what a signed-out visitor sees. Loaders are called with viewer `null`,
`isMember: false` and the anonymous forum viewer. They never return attendee names, join
links, document URLs, or members-only and INVITE_ONLY threads or series. Reason: tool
results land in the model context and transcript, and PLAN §3.3 rules out contact data and
tokens there. A member tier (an explicit `as: "member"` argument plus a bound key) is a
later decision.

Org lock: new `settlePublicOrg(grant, claim)` in `packages/mcp/src/server/org.ts`. A bound
key must match its org. A `*` key still has to be owner or guide of the org at first (reuse
`settleOrg`'s check). Sunjay is Justin's.

## 1. Shared site queries: new `packages/site-read`

The sunjay loaders live in `apps/sunjay/src/lib/*` with `ORG = siteConfig.orgId` built in,
so arts-collective (where the MCP runs) cannot import them. Move them, taking `orgId` as an
input, and leave thin wrappers in sunjay so the site and the MCP run one query (the SQL has
quirks: the join-link regex and the `metadata->>'coverImageUrl'` cover):

- from `lib/data.ts`: `getThreadsForFeed`, `getThreadBySlug`, `getThreadMaterials`,
  `getCycleStatus`, `getAttendanceCount`, `getSiteSections`, `getGuideBySlug`,
  `eventForViewer`, `standingForViewer`
- from `lib/landing.ts`: `listWritingShelf`, `getImageSpaces`, `mediaSrc` (add an origin
  argument so the MCP can return absolute URLs)
- from `lib/public-site.ts`: `latestThread`, `featuredThread`, `currentSeries`

These are already shared and take an org: `@elkdonis/services` `getOrgFeed`, `listOrgFeeds`,
`getStandingMeeting`, `listOrgEventsInRange`, `listSeriesForPage`, `getMeetingSeries`,
`getMeetingSeriesWeek`, `listOrgWriting`, `getWritingPost`, `getGathering`,
`getProfileBySlug`, `getPersonPage`, `seriesReaderForUser`, `thread-audience`.

To check first: whether `getThreadBySlug` applies the visibility filter itself. The moved
copy must filter to PUBLIC and published either way.

Cost: sunjay code changes, so sunjay needs a rebuild and a smoke test (home, a feed, a
thread, series) before it goes live.

## 2. Tools: `packages/mcp/src/server/site-tools.ts`

All go through the existing `readTool()` (`mcp:read` scope, 60 calls a minute plus 10 a
minute on heavy tools, one `action_events` row per call, `plain()`/`platformHref`, `untrusted`
paths). They are MCP-only reads like `org_summary`, with no registry entry. Each takes `org`
(defaulting to the bound org) and carries `_meta.ui.resourceUri = "ui://eac/site.html"`, plus
a short prose `content` fallback. This needs a small `text` field on `ToolOut` in `readTool`.

| Tool | Input | structuredContent | Loaders |
|---|---|---|---|
| `site_home` (heavy) | `org` | `org{id,name,tagline}`, `hero{title,sub,banner}`, `about`, `series[]`, `standing{title,at,source,location\|null}`, `forum\|null`, `nav[]`, `style` (site-style CSS string) | sections, image spaces, `listSeriesForPage(null)`, `getStandingMeeting(org,null)`, `listOrgFeeds`, forum snapshot (optional), `siteStyleCss` |
| `site_feed` | `org, feed, limit≤30` | `feed{slug,name,tagline,accent}`, `threads[{slug,title,kind,excerpt,cover,scheduledAt,recurrence,rsvpCount,cycleStatus}]` | `getOrgFeed` (refuses when not `isPublic`), `getThreadsForFeed` |
| `site_thread` | `org, feed, slug` | `title, kind, author, bodyHtml (sanitised, untrusted), cover, when, location, isOnline, rsvp{enabled,count,limit}, materials[]` | `getThreadBySlug` (public), counts, cycle, materials, `getGathering(isMember:false)` |
| `site_series` | `org, series?, n?` | the list, or one series plus its `sessions[]`, or one week (no materials, join link or replies) | `listSeriesForPage`, `getMeetingSeries`, `getMeetingSeriesWeek` |
| `site_page` | `org, kind: journal\|about\|person\|publications\|community, slug?` | `{kind, title, ...per kind}` | writing, guide, `getPersonPage(viewerId:null)`, shelf, `listOrgEventsInRange(null)` |

Navigation inside the view calls these tools with `app.callServerTool`. Links leaving the
site open with `app.openLink`.

## 3. The view: new `packages/mcp-ui-site`

- Vite + `@vitejs/plugin-react` + `@tailwindcss/vite` + `vite-plugin-singlefile`, producing one
  `dist/site.html`. The MCP reads it on first use from
  `path.resolve(process.cwd(), "../../packages/mcp-ui-site/dist/site.html")` (the repo is
  bind-mounted into the arts-collective container; the prod Dockerfile copies
  `packages/*/dist`). If `dist/` is gitignored, either commit the built file under
  `packages/mcp/src/ui/` or add the build to the arts-collective build step. Pick one at
  build time.
- `@modelcontextprotocol/ext-apps` 2.0.4 `App` + `PostMessageTransport`. Handlers go in
  before `connect()`. Host theme, fonts and safe-area insets apply through
  `onhostcontextchanged`, and the CSS uses `var(--host-token, site fallback)`.
- Reused as is (plain React, deep imports only, never barrels or `/server`):
  - series-site: `event-stage`, `cover-media`, `session-rows`, `series-carousel`,
    `series-sessions-view`, `lib/stage`, `lib/series-time`
  - cms-ui: `hub/StandingMeetingFace`, `hubsite/HubCalendar`, `surface` `ForumFace`/thread
    rows, `files/coverFrameStyle`, `article/ArticleView`, `writing`, `profile/PersonPage`
  - blocks: main `SectionBanner`, `CycleBadge`
  - sunjay: `blocks/home-blocks`, `blocks/writing-blocks`
- Shims (Vite aliases): `next/link` becomes `<a>` that routes through the tools;
  `next/navigation` gets a no-op `useRouter`/`notFound`; `@elkdonis/auth-client` is stubbed.
  `join-frame`, RSVP, sign-in and comments are left out.
- Rewritten as thin views over tool results: every sunjay page component and the
  series-site `pages/*` (they import services and `next/navigation`).
- CSS: compile `globals.css` minus the hub, compose and editor imports; also `pts.css`,
  series-site `site.css`, `blocks.css`, `primitives.css`, `reading-theme.css`, and
  `@source` for cms-ui, series-site and blocks. No external `url(` found.
- Fonts: Fraunces and Spectral woff2, embedded.

### CSP (`_meta.ui.csp` on the resource)

| Directive | Origin | Why |
|---|---|---|
| resourceDomains | `https://paratheater.arts-collective.com` | `/api/media/...` images (tools return absolute URLs) |
| resourceDomains | `https://cloud.elkdonis-arts.org` | Nextcloud images and URLs (`NEXTCLOUD_PUBLIC_URL`) |
| frameDomains | `https://www.youtube-nocookie.com`, `https://player.vimeo.com` | cover and video embeds (`cms-ui/files/cover-frame.ts`) |
| connectDomains | none | data comes only through `callServerTool`; the analytics beacon is left out |

Later, a per-org origin: when other org sites use this, the resource is generated per org,
or the media origin moves into the tool result and CSP lists the network's media host.

## 4. Dependencies

New: `vite`, `vite-plugin-singlefile`, `@vitejs/plugin-react`, `@tailwindcss/vite` (in
`mcp-ui-site`, dev only) and `@modelcontextprotocol/ext-apps` 2.0.4 (in `packages/mcp`
for `registerAppTool`/`registerAppResource`; peer `@modelcontextprotocol/server` ^2 is
met by 2.4.0; it needs zod ^4.2, which `packages/mcp` already has beside the repo's 3.25). Install
through the documented `docker compose run --rm install`. Nothing in the repo uses Vite
today, so the lockfile grows. Check free disk space first.

## 5. Order and testing

1. **Slice 1: home, feed, thread.** `site-read` move, `site_home`, `site_feed`,
   `site_thread`, the view's three screens. Tests: extend `packages/mcp` `scripts/test.mts`
   (no members-only data, absolute media URLs, refused private feed, a bound key refused for
   another org, one audit row per call); run the view in the ext-apps `basic-host` against
   `scripts/serve.mts`; check sunjay's own pages still render the same.
2. **Slice 2: series, journal, about/person, publications, community.**
3. **Going live** (each step needs Justin's go): sunjay rebuild and smoke test; arts-collective
   rebuild (watch the 9 GB build cap; measure before and after); try it in claude.ai with
   the existing key.

## Open items

- Test one real `/api/media/...` image without a session (expected public; unverified).
- `NEXT_PUBLIC_ART_AUCTION_URL` has no prod value in the repo, so marketplace links fall
  back to `http://localhost:3009`. Set it, or leave marketplace links out.
- `getThreadBySlug` visibility filter (§1).
- Where the built HTML lives (`dist/` vs committed, §3).
- Not yet read: `apps/sunjay/src/blocks/{small,event,service,layout,data}-blocks.tsx`,
  `site-header.tsx`, `site-footer.tsx`. These are probably small `next/link` shims.

## Sources

Read-only surveys on 2026-11-16 of `apps/sunjay/src/{app,lib,blocks,components,config}`,
`packages/{mcp,cms-ui,series-site,blocks,services,direct-edit,fonts}`,
`apps/arts-collective/next.config.ts`, `docker-compose.yml`, `Dockerfile`, this folder's
PLAN/DECISIONS, and the ext-apps 2.0.4 npm metadata.
