# `/center` — the follower's home on every org site

**2026-09-09.** Design brief, grounded in four investigations of this repo and one
round of outside research. Nothing here is built. Decisions taken with the
product owner today are marked **DECIDED**; everything else is a recommendation
or an open question. Follows the verified / assumed / unknown convention of
`DEBRIEF_2026-09-06_org_presence.md`.

## The one sentence

**`/center` is "you, here":** the page a person lands on once they have an
account, showing their relationship to *this* org (what's coming, who's here,
what the org wants followers to see) above a fixed set of network sections that
look the same on every org's site (your orgs, your activity, what's been shared
to the network, the forum, your files, your collection, your submissions).

It is **not** the newsroom. `/community` stays the public "scene" page that
`COMMUNITY_ARCHITECTURE.md` and `docs/news-aggregation-groundwork.md` describe:
the pull-back from the org to the collective, with no login and no personal
content. `/center` is the pull-*in*: the org and the person, face to face.
Patreon has both (creator page vs. the Memberships feed); Discord has both
(Server Home vs. your Home); Church Center has both (the church's tabs vs. the
"Me" page with "My churches"). The precedents say to keep them apart, and we are.

## Decisions taken today

| # | Decision | Consequence |
|---|---|---|
| 1 | **DECIDED — two routes.** `/community` remains the public scene. The new page is **`/center`**. | `center` joins `RESERVED_SLUGS` (`packages/utils/src/reserved-slugs.ts`). Not added to `PASSTHROUGH_PATHS`, so `acme.arts-collective.com/center` already rewrites to `/sites/acme/center`. No org, person, thread or feed uses the slug today (checked live). |
| 2 | **DECIDED — signup writes `viewer`, shown as "follower".** | Five signup routes and the auth-server fallback flip `member → viewer`. `member` becomes an org-granted promotion. Hub gates tighten to `member+`. See "The role flip". |
| 3 | **DECIDED — one shared package, two kinds of host.** | Data in `@elkdonis/services`, page in `@elkdonis/cms-ui/center`, mounted by arts-collective at `sites/[slug]/center` (every org's subdomain) and by amrit-canada / innergathering at `/center` (orgs on their own domain). Same rows, one database, no copying. |
| 4 | **DECIDED — every section ships, with honest empty states.** | Sections whose tables are empty (collection, cart, bids) render a real "nothing here yet" line. Giving, which has **no table**, renders as an *unavailable* face (muted, no target), the way `hub-cards.ts` already handles cards that are listed but not live. |

## Vocabulary — credentials, roles, relations

You asked to double-check this. Three layers, and the codebase already keeps
them apart; the mistake to avoid is inventing a fourth word (migration 106
dropped `users.network_tier` for exactly that).

| Layer | Where | Values | What it means |
|---|---|---|---|
| **Credential** | GoTrue account; `users.is_admin` | signed out · signed in · global admin | Who you are to the platform. Global admin is grantable only from `apps/admin`; no org role may ever imply it (`packages/services/src/org-membership.ts:5-13`). |
| **Role** | `user_organizations.role` (`packages/db/src/schemas.ts:58`) | `viewer 1 · member 2 · guide 3 · owner 4` (`org-feeds.ts:25-31`) | Your standing *in one org*. Gates everything inside it. |
| **Relation** | `org_followers` (072); `org_profiles` (084-087) | follow row · roster entry | No access. "Notify me" and "how this org presents you". |

**What is true today (live counts):** owner 14, member 13, guide 1, **viewer 0**,
`org_followers` 0 rows. Every org-site signup writes `member`
(`apps/amrit-canada/src/app/api/auth/signup/route.ts:20` and four siblings;
fallback `inner_group` at `packages/auth-server/src/api-routes.ts:296`). So the
state "signed up here but not a member" cannot currently arise — which is why
the page you described had no audience in the data.

**Why `viewer` and not a new word:** it already exists, it was designed as
"affiliated, but not let in" (`apps/arts-collective/src/app/api/org/join/route.ts:41-63`
names the three things `member` grants that `viewer` does not: private media,
`min_role` feeds, store claiming), it is already in every admin role dropdown,
and it costs no migration. The UI word is **follower** — the term Substack,
Eventbrite, Bandcamp, Kickstarter and Etsy all use for the lightweight relation,
and the one Patreon regrets not using ("free member" vs "paid member").
Never show the word "viewer" to a person.

**Ladder, as a follower will experience it:**

```
guest        → signed out; sees the org site and /community
follower     → has an account; role viewer in this org; /center is their page
member       → promoted by the org; /hub, private media, member feeds, chat
guide        → can publish and moderate
owner        → everything, including identity and theme
(admin)      → orthogonal; platform staff, never an org rank
```

## What the precedents settle

Full research in the session transcript; the parts that changed the design:

- **Follower is the word.** Substack (follower < free subscriber < paid), Eventbrite ("Organizers you follow"), Bandcamp (fan / "supported by"), Etsy ("Follow shop"), Kickstarter (backer, following). Patreon overloading "member" is the cautionary tale; Discourse sites rename their "Member" trust level for the same collision.
- **Yours-first, then the network, with a switch.** Patreon Home ranks creators you're already a member of first; Meetup hides "Suggested events" behind a toggle that is off by default; Discord's Server Home steps aside if you were in the room recently. Network content on `/center` is a labelled block with a toggle, never mixed into the org's lead sections, and `/center` is never a forced interstitial.
- **One account, an org-shaped face.** Discord per-server profiles, Church Center's "My churches" with the current one ticked. `org_profiles` already *is* the per-org profile; `/center` is where a person finally sees and edits "how {org} shows you".
- **Ownership is identity in an arts network.** Bandcamp's "supported by" strip on the artist page, mirrored as "Collection" on the fan page. That is the collection / giving pair here, once the tables fill.
- **Theme tokens on top, fixed chrome below.** Every precedent renders the creator's colours on the creator surfaces and platform chrome on the personal ones. Migration 090's `site_themes` + `resolveTheme({precedence:'org'})` gives us exactly this: `<ThemeStyle orgId pageKey="center" />` themes the org half; the network half re-declares the `--sf-*` tokens from platform constants so it looks identical everywhere.

## The page

Built in the surface idiom (`@elkdonis/cms-ui/surface`): each section is a
**face** in one `SurfaceCardGrid`; a face opens a **surface** (same object at
full size, one native `<dialog>`, stacked, mirrored to `?surface=`) or links
out. Faces use *existing* descriptors only — `thread`, `calendar`, `gallery`,
`write` — plus `href`. No `custom` descriptors: they are not URL-addressable
(`surface/url.ts:35-36`), so they can't be shared or restored by Back.

### Org-scoped half — themed by the org

| Face | Kind | Data (exists today) | Opens | Empty state |
|---|---|---|---|---|
| **Masthead** — org identity + your relationship chip (Following · Member · Guide · Owner · *Follow*) | neutral | `getOrgIdentity`, `getOrgRole` | Follow → writes a `viewer` row | *Follow {org} to get their updates here.* |
| **Your next event here** | event | `thread_rsvps` ∩ org threads with `scheduled_at > now` (7 RSVPs live) | `thread:<id>` — RSVP + .ics already in `ThreadSurface` | *You haven't reserved a place at anything here yet.* → upcoming |
| **Upcoming at {org}** | calendar | `listOrgEventsInRange` (same as hub); `CalendarFace` verbatim, `listEvents` scoped to this org | `calendar` | *Nothing scheduled this month.* |
| **For followers, from {org}** — the org's curation lever | post | an `org_feeds` row `slug='center'` with `min_role='viewer'` (needs the CHECK widened, see below) + `threads.pinned` first | `thread:<id>` | *{org} hasn't posted to followers yet.* |
| **Artists of {org}** | neutral | `listOrgProfiles(orgId, {onlyPublic})` — tags, `photo_override`, `role_title` (27 public rows live) | `href` → ArtDirect `/<slug>` | *No public roster yet.* |
| **{org}'s store** | product | `StoreShowcase` (`packages/commerce`, presentational, `eac-store-*` classes) over the org-owned store | `href` → art-auction | *No store yet.* |
| **Support {org}** | neutral, `available:false` | **no table** — `donation|fundrais|pledge` matches only `site_config` keys | none | *Giving isn't set up on the collective yet.* |

### Network half — fixed chrome, identical on every site

| Face | Kind | Data (exists today) | Opens | Empty state |
|---|---|---|---|---|
| **You on the collective** — avatar, name, headline, "how {org} shows you" (`org_profiles.is_public`, `photo_override`) | neutral | `users` row; `org_profiles` row | `href` → ArtDirect page / `/account` | *Add a photo and a line about yourself.* |
| **Your orgs** — the identity rail; current org ticked; "Open hub →" where role ≥ member | neutral, wide | `listUserMemberships` (all roles; viewer displays as *Following*), `orgHomeUrlMap` for each org's own `/hub`, else `/hub/organization?org=` | `href` | *You follow {org} only.* → `/artists`, directory |
| **Your activity** — posts, replies, RSVPs across orgs, org-labelled | post | `listMemberActivity` (`forum-people.ts:96`), `getAuthoredThreads`, `thread_rsvps` join | `thread:<id>` | *Your posts, replies and RSVPs across the collective will show here.* |
| **Across the network** — yours-first, "show more from the network" toggle | post, wide | `threads` where `share_to_network OR pinned`, `status='published' AND visibility='PUBLIC'`. **`share_to_network` is written by compose and read by nothing (0 rows true)** — this face makes the flag real | `thread:<id>` | *Nothing has been shared to the network yet.* |
| **Forum** — unread count, last notifications | neutral | `countUnreadNotifications`, `listNotifications` (`forum-write.ts:514,536`; 4 rows live) | `href` → forum app (network scope) | *No notifications.* |
| **Your files** — own storage with upload | gallery | `FilesCard` (`@elkdonis/cms-ui/files`, `sources` = own `EAC_Network/users/<slug>/`), `getAuthoredMedia` (35 live) | `gallery` (has the upload tile) | *Nothing uploaded yet.* → upload |
| **Your collection** — favourites, watched, cart, bids, orders | product | `artwork_favorite`, `watches`, `bookmarks`, `cart`/`cart_line`, `bid`, `commerce_order` — all exist, all 0–1 rows | `href` → art-auction | *Favourite artists and artworks show here.* |
| **Your submissions** | questionnaire | `listResponsesForUser` (`questionnaires.ts:103`); `YourSubmissions` component exists on `/hub/elkdonis` | `href` | *No forms submitted.* |

Order follows the precedents (Meetup: next event → feed → your groups; Patreon:
recently visited rail → mine-first feed). Mobile: the rail-first rule already in
`surface.css:471-491` puts "Your orgs" above the feed under 760px.

## Architecture

**Services** — `packages/services/src/center.ts`: one `loadCenter({ orgId,
userId })` returning a `CenterData` object, every query in parallel and
fail-soft (`.catch(() => null)` per section, the way the hub treats a Deck
outage: a broken section costs the face, not the page).

**Page** — `packages/cms-ui/src/center/`: `CenterPage` (server-renderable,
takes `CenterData` + `CenterLinks`), one component per face, `center.css` on the
`--eac-surface-*` / `--eac-kind-*` tokens with a `.eac-center-network` scope
that pins the network half to platform defaults. Exported as
`@elkdonis/cms-ui/center` and `./center.css`, next to `./surface`.

`CenterLinks` is the only thing hosts differ on:

```ts
interface CenterLinks {
  hubUrl(org: { slug: string; homeUrl?: string }): string; // own /hub or arts-collective ?org=
  forumUrl: string; artdirectUrl: string; marketplaceUrl: string;
  accountUrl: string; loginUrl: string; uploadEndpoint: string;
}
```

**Hosts**
- `apps/arts-collective/src/app/sites/[slug]/center/page.tsx` — org from the
  route param (middleware already rewrote it). This makes arts-collective the
  **third `SurfaceProvider` host**, and its first; it needs `surface.css` +
  `gallery.css` imported and a `HubSurfaces`-shaped connector file.
- `apps/amrit-canada/src/app/center/page.tsx` and the innergathering twin —
  `SurfaceProvider` is already mounted in their root layouts.
- While here: `HubSurfaces.tsx` is byte-identical between amrit-canada and
  innergathering except the workshop save branch. Lift it into cms-ui as
  `createHubConnectors({ saveWorkshop?, hasWorkshops })` so `/center` is the
  first page that doesn't copy it.

**Gate** — signed in, any relation or none. A signed-in person with no row for
this org sees the Follow state; never redirect to `/`. Signed out → `/login?next=/center`.

**Nav** — `/center` is not a `SiteNav` tab (that nav is deliberately three
public pages). It is reached from: the signed-in identity element in every
header; the newsroom's "Signed in as … — your hub" member bar (for followers
this should point at `/center`, for members at the hub); and post-signup
`?next=/center`.

**Theme** — `<ThemeStyle orgId={org.id} pageKey="center" />`, precedence `org`
(the settled rule: a member cannot repaint a site they are merely published on).

## The role flip (decision 2), as a checklist

Ship as one change, because amrit-canada is production and the gate and the
signup must move together.

1. `role: "member"` → `"viewer"` in the five signup routes (amrit-canada,
   innergathering, ifac, hidden-enneagram, pigeonshoot) and the auth-server
   fallback (`api-routes.ts:296`, `:538`). The Google path reads the same options
   object, so that is one edit per app.
2. `getViewer().isMember` in amrit-canada and innergathering is `role !== null`
   (`lib/auth.ts:46`) — change to rank ≥ member, or a viewer walks into `/hub`.
   ifac already requires owner/guide/member (`hub-auth.ts:26-37`). hidden-enneagram's
   `/hub` only checks signed-in; verify what a viewer would see there.
3. `org_feeds.min_role` CHECK is `('member','guide','owner')`
   (`079:44-45`) — add `'viewer'` so an org can have a followers-only feed.
   `canViewFeed` already ranks viewer at 1, so no code change beyond the CHECK.
4. Decide `visibility='ORGANIZATION'` for viewers. Today the forum lets a viewer
   see ORGANIZATION threads (`forum.ts:209-220`, duplicated in `forum-people.ts:91`
   and `forum-search.ts:37`) while media-authz excludes viewers. Recommendation:
   tighten the forum to member+ and give orgs the `center` feed as the
   followers channel instead. Open question below.
5. Rosters: `listOrgMembers` feeds `MembersPanel`, `/profile`'s members list and
   `member-row.tsx`. Filter `role <> 'viewer'` for display and show "n followers"
   beside it, or every follower appears as a member on the org's public page.
6. The `/profile` Follow button writes a `viewer` row (`setOrgRole` when no row
   exists) instead of `org_followers`. `org_followers` (0 rows, 2 callers,
   `listOrgFollowers` never called) can then be retired — one relation, not two.
   Substack's follower-vs-subscriber support burden is the reason.
7. Copy: Follow / Following / follower. The 17 IFAC roster imports that hold an
   `org_profiles` row with no membership are untouched; `isOrgAffiliate` keeps
   treating them as it does now.

## Build order

1. Reserve `center` (one line). Widen `min_role` (one migration).
2. `loadCenter` in services — every section's query, with the counts above as
   the test fixtures.
3. `@elkdonis/cms-ui/center` — faces, empty states, `center.css`.
4. arts-collective host (first `SurfaceProvider` there), then the two template
   hosts. Verify the same person on `amritcanada.ca/center` and
   `amrit-canada.arts-collective.com/center` sees the same rows.
5. The role flip checklist, as one deploy.
6. Follow button → viewer row; retire `org_followers`.

## Open questions — for the next round

- **Curation lever.** Is "For followers, from {org}" a `center` feed the org
  posts into, the org's pinned threads, or both? Both is cheap; the feed is the
  only one that gives an org a *channel* rather than a highlight.
- **ORGANIZATION visibility for followers** — keep the forum's current
  behaviour or tighten to member+ (recommended)?
- **Retire `org_followers` now**, or keep it for following orgs you never
  signed up with? Recommendation: retire; a follow *is* a viewer row.
- **Post-signup landing** — `/center` or the org's home? Precedents (Discord,
  Circle) let the org choose; that could be a `site_config` key later.
- **Header placement** on amrit-canada / innergathering: does "Center" replace
  "Hub" for followers, or sit beside it?

## Verified / assumed / unknown

**Verified** (read in source or queried live this session): surface package
exports and the descriptor/connector types; the two hosts and their duplicated
connector files; every `/hub` gate quoted above; `/community`'s data being
cross-org and ungated; the role CHECK and live role counts; signup writing
`member` in five apps plus the fallback; `org_followers` 0 rows and its callers;
`share_to_network` having no reader and 0 true rows; no donations table; the
`min_role` CHECK; `isMember: role !== null`; no `center` slug anywhere.

**Assumed, not exercised:** that `setOrgRole` can create a row where none
exists (it is described as an upsert); that `ThemeStyle` works outside
`sites/[slug]/profile` where it is currently used; that arts-collective's root
layout can take a `SurfaceProvider` without fighting its existing sheets.

**Unknown:** anything requiring a browser — this host cannot run headless
Chromium (see the org-presence debrief). Motion, the bottom sheet and the
rail-first order are verified only for the two existing hosts, on 2026-09-07.
