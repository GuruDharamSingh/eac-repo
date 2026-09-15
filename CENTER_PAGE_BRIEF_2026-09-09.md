# `/center` — the follower's home on every org site

**2026-09-09.** Design brief, grounded in four investigations of this repo and one
round of outside research. Nothing here is built. Decisions taken with the
product owner today are marked **DECIDED**; everything else is a recommendation
or an open question. Follows the verified / assumed / unknown convention of
`DEBRIEF_2026-09-06_org_presence.md`.

## The one sentence

**`/center` is "you, here":** the page a person lands on once they have an
account. In the owner's words it is **equal parts three things**: the org's
digest (what's coming, who's here, what the org has pinned for followers), the
person's own hub (their orgs, activity, files, collection, submissions), and the
Elkdonis network (what's been shared across the collective, the forum). The org
third is themed by the org; the other two look the same on every org's site.

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
| 5 | **DECIDED — org curation is pinned threads for now.** | `threads.pinned` (0 rows anywhere today) is what an org lifts into its digest. No followers feed and no `min_role` change needed yet. **Direction:** an org-editable `site_config` digest block is the seed of a newsletter-digest CMS later; design the digest face so a `site_config` source can replace the pinned query without changing the face. |
| 6 | **DECIDED — followers keep seeing `visibility='ORGANIZATION'` threads.** | The forum's current predicate stands (`forum.ts:209-220`). Private *media* stays member+ via `media-authz.ts`; that asymmetry is accepted: a follower reads the org's internal posts but not its private files. |
| 7 | **DECIDED — one relation; retire `org_followers`.** | Following an org from anywhere writes a `viewer` row. The identity rail lists it, the org counts it, rosters filter it. `org_followers` (0 rows, 2 callers) is removed once the Follow button is moved. |
| 8 | **DECIDED — land on `/center` after signup; header shows Center for followers, Hub for member+.** | Post-signup `?next=/center`. Members still reach `/center` from their own entry in the identity rail. |

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

### One third — the org's digest, themed by the org

| Face | Kind | Data (exists today) | Opens | Empty state |
|---|---|---|---|---|
| **Masthead** — org identity + your relationship chip (Following · Member · Guide · Owner · *Follow*) | neutral | `getOrgIdentity`, `getOrgRole` | Follow → writes a `viewer` row | *Follow {org} to get their updates here.* |
| **Your next event here** | event | `thread_rsvps` ∩ org threads with `scheduled_at > now` (7 RSVPs live) | `thread:<id>` — RSVP + .ics already in `ThreadSurface` | *You haven't reserved a place at anything here yet.* → upcoming |
| **Upcoming at {org}** | calendar | `listOrgEventsInRange` (same as hub); `CalendarFace` verbatim, `listEvents` scoped to this org | `calendar` | *Nothing scheduled this month.* |
| **{org}'s digest** — the org's curation lever (decision 5) | post | `threads.pinned` in this org, published, newest first. Later: an org-editable `site_config` digest block feeding the same face | `thread:<id>` | *{org} hasn't pinned anything for followers yet.* |
| **Artists of {org}** | neutral | `listOrgProfiles(orgId, {onlyPublic})` — tags, `photo_override`, `role_title` (27 public rows live) | `href` → ArtDirect `/<slug>` | *No public roster yet.* |
| **{org}'s store** | product | `StoreShowcase` (`packages/commerce`, presentational, `eac-store-*` classes) over the org-owned store | `href` → art-auction | *No store yet.* |
| **Support {org}** | neutral, `available:false` | **no table** — `donation|fundrais|pledge` matches only `site_config` keys | none | *Giving isn't set up on the collective yet.* |

### One third — you, fixed chrome, identical on every site

| Face | Kind | Data (exists today) | Opens | Empty state |
|---|---|---|---|---|
| **You on the collective** — avatar, name, headline, "how {org} shows you" (`org_profiles.is_public`, `photo_override`) | neutral | `users` row; `org_profiles` row | `href` → ArtDirect page / `/account` | *Add a photo and a line about yourself.* |
| **Your orgs** — the identity rail; current org ticked; "Open hub →" where role ≥ member | neutral, wide | `listUserMemberships` (all roles; viewer displays as *Following*), `orgHomeUrlMap` for each org's own `/hub`, else `/hub/organization?org=` | `href` | *You follow {org} only.* → `/artists`, directory |
| **Your activity** — posts, replies, RSVPs across orgs, org-labelled | post | `listMemberActivity` (`forum-people.ts:96`), `getAuthoredThreads`, `thread_rsvps` join | `thread:<id>` | *Your posts, replies and RSVPs across the collective will show here.* |
| **Your files** — own storage with upload | gallery | `FilesCard` (`@elkdonis/cms-ui/files`, `sources` = own `EAC_Network/users/<slug>/`), `getAuthoredMedia` (35 live) | `gallery` (has the upload tile) | *Nothing uploaded yet.* → upload |
| **Your collection** — favourites, watched, cart, bids, orders | product | `artwork_favorite`, `watches`, `bookmarks`, `cart`/`cart_line`, `bid`, `commerce_order` — all exist, all 0–1 rows | `href` → art-auction | *Favourite artists and artworks show here.* |
| **Your submissions** | questionnaire | `listResponsesForUser` (`questionnaires.ts:103`); `YourSubmissions` component exists on `/hub/elkdonis` | `href` | *No forms submitted.* |

### One third — the Elkdonis network, fixed chrome

| Face | Kind | Data (exists today) | Opens | Empty state |
|---|---|---|---|---|
| **Across the network** — yours-first, "show more from the network" toggle | post, wide | `threads` where `share_to_network OR pinned`, `status='published' AND visibility='PUBLIC'`. **`share_to_network` is written by compose and read by nothing (0 rows true)** — this face makes the flag real | `thread:<id>` | *Nothing has been shared to the network yet.* |
| **Forum** — unread count, last notifications | neutral | `countUnreadNotifications`, `listNotifications` (`forum-write.ts:514,536`; 4 rows live) | `href` → forum app (network scope) | *No notifications.* |
| **Find orgs** — the collective's roster of organisations | neutral | `organizations` + `orgHomeUrlMap`; the `/artists` and directory pages already exist | `href` | never empty |

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
3. `org_feeds.min_role` CHECK is `('member','guide','owner')` (`079:44-45`).
   **Not needed now** (decision 5: curation is pinned threads). If a
   followers-only feed is ever wanted, add `'viewer'` there; `canViewFeed`
   already ranks viewer at 1.
4. `visibility='ORGANIZATION'` for viewers — **DECIDED, keep** (decision 6). The
   forum predicate (`forum.ts:209-220`, duplicated in `forum-people.ts:91` and
   `forum-search.ts:37`) stays as it is; `media-authz.ts` keeps excluding
   viewers from private media. No change.
5. Rosters: `listOrgMembers` feeds `MembersPanel`, `/profile`'s members list and
   `member-row.tsx`. Filter `role <> 'viewer'` for display and show "n followers"
   beside it, or every follower appears as a member on the org's public page.
6. **DECIDED** (decision 7): the `/profile` Follow button writes a `viewer` row
   (`setOrgRole` when no row exists) instead of `org_followers`. `org_followers`
   (0 rows, 2 callers, `listOrgFollowers` never called) is then retired — one
   relation, not two. Substack's follower-vs-subscriber support burden is the
   reason.
8. **DECIDED** (decision 8): signup routes redirect to `/center`; headers show
   *Center* when the viewer's role is `viewer` and *Hub* at member and above.
7. Copy: Follow / Following / follower. The 17 IFAC roster imports that hold an
   `org_profiles` row with no membership are untouched; `isOrgAffiliate` keeps
   treating them as it does now.

## Build order

1. Reserve `center` (one line). No migration: pinned threads already exist.
2. `loadCenter` in services — every section's query, with the counts above as
   the test fixtures. The digest section takes a *source* so `site_config` can
   replace the pinned query later.
3. `@elkdonis/cms-ui/center` — faces, empty states, `center.css`, three groups.
4. arts-collective host (first `SurfaceProvider` there), then the two template
   hosts. Verify the same person on `amritcanada.ca/center` and
   `amrit-canada.arts-collective.com/center` sees the same rows.
5. The role flip checklist, as one deploy, including the post-signup redirect
   and the Center/Hub header switch.
6. Follow button → viewer row; retire `org_followers`.
7. A way for an org to pin from the compose/thread surface — `pinned` has no
   UI writer today (0 rows), and decision 5 makes it the curation lever.

## Resolved in round two (2026-09-11)

All five open questions from the first draft were answered and are now
decisions 5–8 above.

## Round three (2026-09-11) — what kind of page this is, and the composition

**Classification.** In information-architecture terms `/center` is a
**role-personalised portal page** (Nielsen Norman Group's intranet "My Page"):
a card-grid, hub-and-spoke overview whose cards are linked entry points into
org-scoped, personal and network-wide surfaces. It is explicitly **not a
dashboard** (NN/g: dashboards are at-a-glance data with minimal interaction;
portals are gateways to many tasks), not a homepage (which must introduce the
org to strangers), and it *embeds* an account hub, which Baymard's research
says people use task-first and never browse for inspiration. The literature's
three questions for such a page, and the answers taken:

| Question | Source | Decision |
|---|---|---|
| Launcher or reader? | NN/g portal vs dashboard | **9 — DECIDED: everything live.** Every face previews real content. Profile, Files and Forum, which the hubs treat as links or plain cards, become **proper faces with surfaces** in this pass. |
| What is the return trigger? | Baymard; UI-Patterns activity stream | **10 — DECIDED: what's current.** Upcoming, pinned, latest shared. Stateless, no read tracking (`thread_reads` stays at 0). |
| How separable are the scopes? | GitHub's 2023 blended feed | **11 — DECIDED: the owner's composition** below. Scopes are separate *regions*, never one blended stream. |
| What is placed, not posted? | portal "promoted" slots; Bandcamp Friday | **13 — DECIDED (round six): a promotion space** on the left column, org-placed with a network fallback, for a store, a marketplace artist, or an event. See below. |
| Where is the person's one home? | Church Center "Me" page | **12 — DECIDED (corrected in round four): `/center` is always org-scoped.** arts-collective, the network host, does *not* get a `/center`; its `/` and `/hub` are the cross-org home (and the `elkdonis` org's own center, sharing that content). Each org fixes its own center's theme and card proportions, user-agnostic in layout. |

**No user customisation** of the layout (NN/g: customisation is used poorly;
the role-based default is the design). Orgs customise, people don't.

### The composition (decision 11, simplified 2026-09-11 — "keep it straightforward")

Two columns. The person on the left, the org on the right. It could be a large
side drawer, but it is its own page for now.

```
┌─ LEFT · YOU ──────────────┐  ┌─ RIGHT · THE ORG ──────────────────────────────┐
│ profile pic (wallet /     │  │ org card: name · tier · city · follow chip     │
│ digest) + edit abilities  │  │ next event · upcoming count                    │
├───────────────────────────┤  ├────────────────────────────────────────────────┤
│ [ Account ] [ Notif. 3 ]  │  │ FEED · all of this org's threads               │
│ a couple of buttons       │  │ pinned first, then newest, each → thread surface│
├───────────────────────────┤  │                                                │
│ YOUR ENGAGEMENTS /        │  ├────────────────────────────────────────────────┤
│ OTHER ORGS                │  │ FEATURED (optional) · one thread, large        │
│ ✓ Amrit Canada            │  ├────────────────────────────────────────────────┤
│   Inner Gathering · hub → │  │ ◂ ACROSS THE NETWORK · slider of all threads ▸ │
├───────────────────────────┤  └────────────────────────────────────────────────┘
│ PROMOTION SPACE (new)     │
│ a store · a marketplace   │
│ artist · an event         │
└───────────────────────────┘
```

**Left, top to bottom:** the profile picture as a "wallet" or digest card with
the person's editing abilities; a couple of buttons (account, notifications;
messages when it exists); their engagements and other orgs (the identity rail,
current org ticked, "hub →" where role ≥ member); and the **promotion space**.

**Right, top to bottom:** the org's card; a feed of *all* the org's threads,
pinned first; an optional **featured** slot (one thread rendered large); and a
network-wide slider of threads.

On mobile the left column stacks above the right, so the person's card leads
and the promotion space sits between the rail and the org's feed.

**What moved out of the first cut.** The mixed gallery, the compose card, the
files and forum faces, the store nudge and the long engagement trail are not in
this layout. Files and forum are reached from the button row; the store nudge
is now a *kind* of promotion; the engagement trail is folded into the rail as a
count. The faces spec below stays as the second increment.

### The promotion space (decision 13, 2026-09-11)

A new kind of slot: a deliberately *placed* item, distinct from `pinned` (the
org highlighting its own thread) and `share_to_network` (an author opting into
the network feed). It promotes a store, a marketplace artist, or an event or
meeting. It is what an advertisement is on a portal page, but the inventory is
the network's own.

- **Who places it.** The org, for its own `/center`, with a network-level
  fallback so the slot is never empty: org promo → network promo → the org's
  own store or next event.
- **Data, not DDL.** `site_config` key `center_promo` per org, and the same key
  under the `elkdonis` org for the network fallback:
  ```
  { "kind": "store" | "artist" | "thread",
    "ref": "<store id | user slug | thread id>",
    "blurb": "…", "until": "2026-11-15", "placed_by": "<user id>" }
  ```
  Validated in app code; an unknown ref renders the fallback, never a 500.
- **Face.** Kind `product` for a store or artist, the thread's own kind for an
  event; kicker reads "Promoted" so it is never mistaken for the feed. Opens
  the thread surface, or links out to the store or ArtDirect page.
- **Later.** If promotion is ever paid, the ledger from migration 098 is where
  the money goes; nothing about the slot changes.

### Three views of the mechanism (round five, 2026-09-11)

Three well-rounded readings of "a follower's page on one org's site inside a
network", each from a family of products that has run the mechanism at scale.
Sources are in the session research; the claims below are the sourced ones.

**View A — the org as an instance** (Mastodon, Hometown, Lemmy/PieFed,
Bluesky, Bonfire). Each org is a small Hometown-style server and `/center` is
its Home timeline. The org card is the instance About panel (description,
rules with hints, contact). Pinned threads are Mastodon *Announcements*:
local-only, scheduled with a start and end, reactable, sitting above the feed.
The wide feed is the Local timeline. The slider is the federated view, and
honest the way Mastodon's is: not "the network", only what this org has chosen
to surface. The profile card is a portable identity that survives the org.
`/hub` is Explore, kept out of the org's home.
- *Borrow:* announcements as a first-class scheduled, reactable, local-only
  object, not just `pinned=true`; Hometown's per-post federation switch (one
  glyph at compose time, with an org default) for `share_to_network`;
  org-authored starter packs (Bluesky, and Mastodon's consent-aware "Packs")
  so a new follower's center is never empty.
- *Pitfalls:* federated-timeline noise (an ungated `share_to_network` slider
  degrades the same way; gate it on org curation); instance lock-in (posts
  don't migrate, so decide now what a follower *keeps* when they leave an
  org); discovery hidden behind opt-in checkboxes that people never find
  (network discoverability must be one visible choice on `/center`).
- *Asymmetry:* nobody in the fediverse has one account with roles in many
  orgs plus local-only rooms; Bluesky drops the org layer to get portability.
  To envy: Bluesky's third-party feeds and labelers, and Bonfire's per-verb
  boundaries ("public post, replies only from this circle") which our two-value
  visibility cannot express.

**View B — the org as a Page, the network as the Feed** (Facebook Pages and
Groups, LinkedIn, Instagram). PUBLIC threads are Page posts, ORGANIZATION
threads are Group posts, `viewer` is exactly Facebook's "follower: someone who
can receive updates". The wide feed is a Feeds-tab, chronological and org-only,
not a Home-tab. The slider is the one place ranked discovery is allowed, and it
is quarantined to a strip. The profile card is LinkedIn's: a curated *Featured*
above an automatic *Activity*. The store nudge is Instagram-2023 commerce,
inline, never a tab. `/hub` is My Network: graph management, not a feed.
- *Borrow:* chronological org feed by default (Facebook and Instagram both
  shipped "only what I follow" feeds and never dared make them the default; we
  can); the curated-vs-automatic split on the profile; Instagram Broadcast
  channels' consent rule for org notifications (one invite, then only joiners
  are notified) as the per-org notifications toggle.
- *Pitfalls:* Page reach collapse (organic reach fell from ~16% to ~5% once
  the feed ranked; keep `share_to_network` a deterministic flag, never a
  score); feed distrust (if the slider ever looks like it decides what a
  follower sees of *their own org*, the page loses credibility); the Shop tab
  was removed within three years, while Marketplace survived because it grew
  out of existing behaviour (a card showing *this org's* listings, not a tab).
- *Asymmetry:* no platform lets an org put its own chronological feed on its
  own domain with the follower already signed in. To envy: Instagram Collabs,
  one post on several profiles with pooled engagement. `thread_orgs` (27 rows)
  is already that join table; a co-published thread with one comment stream
  would beat a flag that merely re-lists a post.

**View C — the org as a label or channel, the person as a collector** (Are.na,
Bandcamp, Behance, Discogs, Ravelry, Letterboxd). `/center` is the follower's
*shelf* inside this org: what they bought, RSVP'd, saved and connected here,
with an org-specific badge. The org is a label: roster (guides), catalogue
(pinned), current release (next gathering). The slider is Are.na's "connected
to" sidebar, a *trail* of the other orgs carrying the same thread, not a
recommendation. The gallery is Are.na's uniform block grid where images,
profiles, threads and files are equal cells. Compose is "Connect": place
something from your own storage onto the org's shelf. The engagement trail is
a diary, not analytics.
- *Borrow:* Bandcamp's "supported by" avatars on the work itself (with its
  threshold rule: a profile picture required), which makes the store nudge
  earned rather than pushy; the "connected to" trail as the slider; a note
  attached to a pin, delivered on-page and by email, comments supporter-only.
- *Pitfalls:* Are.na's discoverability ceiling (no algorithm at all reads as
  dull; a trail-only slider still needs editorial pull); Bandcamp's ownership
  churn (collection-as-identity is only trustworthy if exportable; our
  per-person Nextcloud tree is that guarantee); Behance's For-You drift
  (followed updates got folded into recommendations; keep the org feed
  strictly chronological after pins).
- *Asymmetry:* in every arts network **the person is never re-rendered inside
  the org**; only their works are. Our profile card inside the org's page is a
  genuine departure, and Discogs' longest-running complaint (collectors want
  to see themselves *on* the label page) says it is the right one. To envy:
  Bandcamp Friday, a calendar-fixed ritual the network owns that every org's
  center can point at.

**Where the three agree** (so these are settled, not taste):
1. The org's feed is chronological after pins. Ranked or network content is a
   separate, labelled region.
2. "Follower" is the word. Every model that also has a heavier tier uses
   "member" for it.
3. The profile splits curated from automatic: a Featured the person chose,
   an Activity the system wrote.
4. The org's voice to followers is a distinct object (announcement, broadcast
   channel, note-on-release), not just a post that happens to be pinned.
5. Commerce lives inline where the content is, never as a destination tab.

**Where they disagree**, and the call: A treats the person as a portable
identity, B as a relationship to the Page, C as a collection. The composition
already chose A's profile card top-left; C's shelf becomes the *engagement
trail* at the bottom rather than replacing the card; B's relationship state
lives in the org card's chip.

**What this changes in the spec:**
- **Pins gain a window and a note.** `pinned` stays the flag (decision 5), but
  the pin control should take an optional note and an until-date. Whether that
  is two columns or a `site_config` digest entry is the later digest-CMS work;
  the face just needs to render "pinned · until Nov 15 · note".
- **The slider is a trail, then a feed.** For each thread, list the other orgs
  carrying it from `thread_orgs`; only then fall back to `share_to_network`
  ordered by recency. Never a score.
- **`share_to_network` becomes one glyph at compose time**, with an org
  default, not a field in a dropdown.
- **Supported-by avatars** on thread surfaces for people who RSVP'd or bought,
  gated on having an avatar, as Bandcamp gates it.
- **Notifications are per-org opt-in**, one invite then only joiners, and the
  settings row shows that state for *this* org.
- **The empty state is a pack.** A new follower's slider and gallery are seeded
  by the org's pins and public roster, so the first visit is never blank.
- **Decide what a follower keeps on leaving an org.** Their trail is
  `org_id`-scoped; the honest default is: the row stays, labelled with the org,
  the org context link goes dead. Write it down before the flip.

### The three new faces (decision 9) — UI continuation

Each needs a first-class descriptor in `SurfaceRouter` (not `custom`, which
is not URL-addressable): `profile`, `files`, `forum`. They follow the existing
rule that a face and its surface are one object at two sizes.

**Profile face → profile surface.** The face is a `SurfaceCard` exactly as
the amrit-canada hub draws its live tiles (kind hairline, glyph, kicker, title,
`preview`, cue), not a new card style. Today that hub's `my_profile` tile is an
`href` card with no preview (`hub-cards.ts:34-40`, link computed in
`hub/page.tsx:96-103`); it becomes this face. The `preview` is the portrait
(3:4) drawn from `ProfileViewPerson` (`@elkdonis/cms-ui/profile`) plus the
`org_profiles` row for the host org (`photo_override`, `role_title`,
`is_public`), with IFAC's alert line (unread, upcoming) beneath it. Surface (`standard`
width) is IFAC's rule made shared: **a quick look plus the door** — the profile
as this org shows it, an `is_public` toggle, the list of other orgs and how each
shows you, and the door to the real public page with the live editor on
(ArtDirect, or `/artists/[slug]`). Editing never happens in the popup.
Descriptor `{ type: "profile", orgId? }`.

**Files face → files surface.** Fills the tile amrit-canada's hub already
lists as `files` with `available: false` (`hub-cards.ts:66-72`). Face shows
the last six image thumbnails from `getAuthoredMedia` with the upload tile. Surface (`wide`) is `FilesCard` with
`sources`: own `EAC_Network/users/<slug>/` (writable) and, for members, the
org's team folder (read-only). Descriptor `{ type: "files", source?, path? }`.
The gallery surface stays for viewing; this is for managing.

**Forum face → forum surface.** Face shows the unread count (`NotificationsBell`
logic) and the last three items from `listLatest` in network scope. Surface
(`wide`) lists latest / mine / notifications as tabs; clicking a row **pushes a
thread surface** using `toSurfaceThread` from `@elkdonis/forum-ui/adapters`,
which already maps a forum thread onto `SurfaceThread`, so a forum post opens in
the same popup as an org post. Descriptor `{ type: "forum", view?: "latest" |
"mine" | "notifications" }`. The **compose** face opens the existing
`{ type: "write", kind: "post" }` surface with a feed picker limited to feeds
the person can post to.

**Messages.** `conversation` / `conversation_participant` / `message`
(migration 059) exist with 0 rows and no UI anywhere. The settings row shows
the count; a messages surface is a later increment, not this pass.

### The org's center layout (decision 12)

Data, not DDL, following `profile_layout` (091) and `org_feeds` (073):

```
site_config (org_id, key='center_layout', value JSONB)
{ "order":  ["profile","org","feed","network","gallery","compose","files","forum","store","engaged"],
  "sizes":  { "feed": "full", "network": "full", "gallery": "wide", "profile": "compact" },
  "hidden": ["store"],
  "voice":  "journal" | "gazette" | "quiet" }
```

Validated in app code against the curated face list (an unknown id is dropped,
never 500s). Theme comes from `site_themes` with `page_key='center'`, precedence
org. An org's `/center` is therefore **user-agnostic in layout** — every visitor
of that org's center sees the same proportions — and personal only in content.

**There is no org-less `/center`** (round four, 2026-09-11). arts-collective
keeps `/` and `/hub` as the person's cross-org home, and those double as the
`elkdonis` org's centre. So `/center` exists only where an org exists: on
every org subdomain via `sites/[slug]/center`, and at `/center` on the apps
that run an org's own domain. The "your orgs" rail on each `/center` is how a
person moves between centres; the arts-collective hub is where they see all
of them at once. No `home_org` column is needed.

### Build order, revised

Steps 1–7 stand. Add, before the hosts (step 4): **3b** — the three new
descriptors and surfaces in `@elkdonis/cms-ui/surface` (`ProfileSurface`,
`FilesSurface`, `ForumSurface`) with their faces; **3c** — `center_layout`
reader + validator in services and the `CenterPage` layout resolver.

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

## Build status (2026-09-12)

**Built and verified over HTTP** on all three hosts, with a real session:

- `packages/utils/src/reserved-slugs.ts` reserves `center`.
- `packages/services/src/center.ts` — `loadCenter()`: person, org card (next
  RSVP'd event, upcoming count, follower count), org rail, org feed (pinned
  first; ORGANIZATION visible to any relation), featured (pinned else next
  scheduled), network slider (`thread_orgs` trail first, then
  `share_to_network`/pinned, yours-first, recency, never a score), promotion
  slot (`site_config.center_promo` for the org, then `elkdonis`, then the org's
  next scheduled event). Every section fail-soft.
- `packages/services/src/org-membership.ts` — **follow = viewer row**
  (decision 7). `followOrg` inserts `viewer` only when no row exists,
  `unfollowOrg` deletes only a viewer row, `isFollowingOrg` is "any relation",
  `getOrgFollowerCount`/`listOrgFollowers` read viewer rows. `org_followers`
  is no longer written; drop it in a later migration.
- `packages/cms-ui/src/center/` — `CenterPage` (server component; two
  columns), `CenterThreadRow` (a row that opens the thread surface when a
  provider is mounted, else navigates), `FollowButton`, `center.css` on the
  surface tokens. Exported as `@elkdonis/cms-ui/center` + `./center.css`.
- Hosts: `apps/amrit-canada/src/app/center/page.tsx`, the innergathering
  twin, and `apps/arts-collective/src/app/sites/[slug]/center/page.tsx`. The
  two template apps got `/api/center/follow`; arts-collective reuses
  `/api/org/[slug]/follow`. Headers show **Center** for a follower and **Hub**
  for member+. Signup forms land a new account on `/center`.
- Role flip (decision 2): the five signup routes and the auth-server fallback
  write `viewer`. `isMember` in amrit-canada/innergathering is now member+;
  `isAffiliate` (any role) gates ORGANIZATION reads in `/api/hub/threads/[id]`.
  The public `/profile` People list hides viewers.

**Verified** (curl against host `next dev` for amrit-canada and innergathering,
and the live dev container for arts-collective, test account
`claude-hub-test-…`): member view (chip Member, header Hub, 4 rows); follower
view after flipping the row to viewer (chip Following, header Center,
ORGANIZATION thread readable, promo face from a seeded `center_promo`, one
slider slide from a seeded `thread_orgs` row); no-relation view (Follow
button, ORGANIZATION hidden, thread read 404); unfollow → follow round trip;
signed-out → 307 to `/login?next=/center`. All seeded data reverted; the test
account is back to `member`.

**Not done / owed:**
- **Deploy.** amrit-canada runs in production mode: it needs
  `docker compose up -d --build amrit-canada` for `/center`, the header, and
  the signup flip to go live. arts-collective and innergathering run `next dev`
  in their containers against the mounted source, so their pages are live
  already — but the rebuilt `@elkdonis/services` and `@elkdonis/auth-server`
  `dist` only take effect for them after a container restart. Until then the
  signup fallback there still writes `member`.
- **IFAC and hidden-enneagram** signups now write `viewer`. IFAC's hub is
  member+, so a fresh IFAC signup has no hub until an owner promotes them.
  hidden-enneagram's hub is signed-in-only, so a viewer enters it (its feeds
  are still gated by `min_role`). Neither has a `/center` host yet.
- `pinned` still has no UI writer (build step 7). No `center_layout` yet
  (decision 12's per-org proportions). Notifications and Files buttons are
  hidden on the template hosts until those routes exist. The network slider
  links out rather than opening a surface, since another org's thread is not
  readable through this org's thread route.
- Nothing is committed.

## Round seven (2026-09-12) — the dashboard direction, first slice

The owner's brief: a social-network dashboard. Profile card in the CodePen
style; the site snapshot at the top, scrollable; the org's card at the same
proportions; post rows that carry the author's avatar; a compose bar; a
running media gallery and a store product slider (example to come); forum-
and wiki-scoped panels later; the profile card's flip side = the network-wide
(ArtDirect) identity editor, with the person's blog and /user folder as doors.
Tailwind on the new parts.

**Built and live on amrit-canada:**
- **Profile surface** — `{ type: "profile", target?: { kind: "org", orgId } }`
  in `@elkdonis/cms-ui/surface` (`surfaces/ProfileSurface.tsx`), URL-addressable
  (`?surface=profile`, `?surface=profile:org:<id>`). Rail = portrait + photo
  control + doors; main = fields (name, headline, pronouns, place, statement,
  links). Reads/writes through `connectors.profile` → `/api/center/profile`
  (GET/PATCH; `?org=` edits the org's identity row for owner/guide/admin,
  read-only for everyone else) and `/api/center/avatar` (any signed-in person,
  into their own `EAC_Network/users/<slug>/Media/Images/`). **This is where an
  org gets its display image** — the ✎ cue on the org card.
- **Cards** — `ProfileCardBody`: image fills the card, details bar at the
  foot, hover lifts the image and reveals the person's links. Person and org
  share it. Both open the profile surface (org target for the org).
- **Site card first**, live and scrollable (the frame is `.eac-face-live`,
  sandbox allows scripts), 4:3; the cue is the door to the site.
- **Post rows** with author avatar/name/date, title, excerpt, cover thumb;
  **compose bar** opening `write:post` for staff, linking to the forum for
  followers.

**Verified:** page structure; own profile read + PATCH round trip; org read
as member (canEdit false) and 403 on write; avatar upload → stored URL.

**Not yet:** media running gallery; store product slider (waiting on the
product-card example); forum/wiki panels; a "Blog" door (the person's own
blog on ArtDirect doesn't exist as a route yet); Files door on template hosts;
innergathering/arts-collective not restarted.

## Round eight (2026-09-12) — the reframing: a console you carry around the network

The owner: *"this center page tends to be the mobile page that a user brings
around the network with them… the dashboard for the network that helps them
manage the multiple groups… whether they're just a visitor or the owner… the
console that users can help post onto the website itself and manage some of
the CMS throughout the network."* Proportions uninspiring; org card too big;
the scrollable snapshot too slow (reverted to inert; org card now a compact
strip).

### How much does it change the logic? Mostly the host, not the model.

Three investigators (spirit of the platform, code, mobile-console precedents).
The code verdict, with evidence:

- **The model already supports it.** `threads` is multi-org (`thread_orgs`),
  roles are per-org and readable in one query (`getViewerRoles`), visibility is
  expressible network-wide (`visibleTo` in `forum.ts`), and every services
  write takes `orgId` first (`createThread`, `uploadOrgFile`,
  `listOrgMediaLibrary`, `upsertWorkshopOffering`, `upsertOrgFeed`). The
  console pattern is already shipped once: arts-collective's
  `/hub/(tabs)/organization` picks the org from `listUserMemberships` + `?org=`
  and re-runs every query against it.
- **What is org-bound** is small: three module constants in the single-org apps
  (`data.ts` `ORG`, `cms/actions.ts` `ORG`, `api/upload` `ORG_ID`) and two
  singular fields in one interface: `SurfaceConnectors.compose: ComposeContext`
  and `saveThread`'s input lacking `orgId`. The new `profile` connector is
  already the right shape (`?org=` + `canEditOrgIdentity`).
- **The one real gap:** `thread_orgs` (cross-posting) has no writer in the
  current stack — the only writer is the legacy `apps/inner-gathering` content
  route. Porting it into services is a port, not a design.
- **The one hard problem: session across custom domains.** Cookies are
  host-only (`deriveCookieDomain` in auth-server honours `EAC_COOKIE_DOMAIN`,
  which no compose file sets). amritcanada.ca, hiddenenneagram.com and
  arts-collective.com are separate containers; there is no SSO handoff (the
  `eac_pkce_dest` memo is same-host). So a console "carried around" cannot be
  the same page on every org's own domain without a signed handoff per domain
  (precedent: the Nextcloud OIDC bridge, `PORTAL_SESSION_HANDOFF.md` §2.2).
  **Option A (days):** one home, `arts-collective.com/center`, covering every
  subdomain once `EAC_COOKIE_DOMAIN=.arts-collective.com` is set, posting into
  any org through org-parameterised routes. **Option B (the only new system):**
  a short-lived JWT handoff so the same console appears on custom domains.

### The three cheapest steps toward the console
1. Give the connectors an org: `orgId` on `saveThread`'s input and the
   compose/write descriptors; `compose` becomes a resolver keyed by org;
   `uploadFields: { orgSlug }` so uploads land in the chosen org (the
   arts-collective upload and media-library routes already accept and
   authorise an org).
2. Mount `/center` on the network host: add `center` to `PASSTHROUGH_PATHS`
   (reversing decision 1's routing choice, deliberately), an
   `apps/arts-collective/src/app/center/page.tsx` that reads
   `listUserMemberships` and renders `CenterPage` with an org switcher.
   **This reverses decision 12** ("no org-less center") — the owner's
   reframing asks for exactly that page.
3. Set `EAC_COOKIE_DOMAIN=.arts-collective.com` on the arts-collective
   service so one sign-in covers every subdomain.

### What the platform's own words say the console must feel like
(From the spirit report; full text in the session.) A mutual aid society, not
a marketplace: *"Our works are intended to be experienced, not sold."* Every
org keeps its own corner; one account, many orgs; the maker is the payee; files
belong to the person; custody is a record (`author_id` + `thread_orgs`); media
is never a URL box; resist personalisation; the org wins the paint. Two voices
on one page: serif titles, monospace apparatus. Roles are guide/member/owner/
follower, never "user", "admin" or "viewer" in copy; no relative timestamps.
It must not feel like a dashboard of metrics, a blended feed, a firehose, a
forced interstitial, or corporate paint over an org's site.

### The mobile anatomy the precedents converge on
Identity small and persistent; the org is the content — the reverse of the
current 50/50 columns.
1. **Header, 56dp, sticky:** 40dp avatar (→ profile surface), the current org's
   name + role chip in the centre (→ org switcher sheet), bell right. This is
   "you are here" (Notion, Shopify, Ivory).
2. **Org switcher as a bottom sheet:** 72dp two-line rows, current row ticked
   (Slack's list; never a hamburger — NN/g halves discoverability).
3. **Hero, ~200dp:** the one thing on at this org now (Meetup's "your next
   event").
4. **Action row, 48dp, visible:** Post · Manage · Files · Store.
5. **List:** ≤5 rows of 72dp, then "See all".
6. **Compose FAB, 56dp, persistent,** inheriting the current org, with a
   "posting to: [org] ▾" line at the top of the sheet (WordPress scope-then-
   compose + Mastodon's visible target).
Desktop: the same column as list-detail — left pane 320–360px (header, org
rows, identity), right pane hero + list, max ~720px, centred. A drawer over a
site only when entered from that site.

Mistakes named: Discord 2023 splitting "where I am" from "what I do" into
tabs; hiding the org list behind a hamburger; a full-screen overlay with no
close at narrow widths.

### Incident, same day
The other session's edit to `packages/services/src/forum.ts` put backticks
inside an SQL comment within a template literal, which broke the package's
DTS build; because tsup runs with `clean: true`, the failed build wiped
`dist`, and amrit-canada's production build then failed on 41 unresolved
imports, and its container came up without a build. Fixed by replacing the
backticks with quotes (lines 361–370), rebuilding services, and building
amrit-canada with `docker run --volumes-from eac-amrit-canada` (its `.next`
is an anonymous volume, so a `compose run` build lands nowhere). Downtime
roughly 15 minutes.

## Round nine (2026-09-12) — the network's SSO hop, built

**Decision 14 — DECIDED: `/center` stays per org, defined by the org over a
network default; the console is one component any site can open; and the
sign-in follows the person between sites by a signed handoff.** No org-less
page (decision 12 stands); no strip (the owner set it aside).

**Built:** `packages/auth-server/src/handoff.ts` — `handleHandoffStart`
(`GET /api/auth/handoff?to=<url>&next=<path>`: signed in → 60-second HS256
token bound to the destination origin → redirect to its accept route; signed
out, same site, unknown origin or no secret → plain redirect),
`handleHandoffAccept` (`GET /api/auth/handoff/accept?token&next`: verify
signature, expiry, audience, issuer; claim the token id once in Redis; ask
GoTrue with the service key for a one-time magic-link token for that account;
verify it server-side; set THIS site's cookies; land on `next`), and
`handoffUrl(to, next)`. HS256 via Node crypto, no dependency. Allowed
destinations: `ADDITIONAL_REDIRECT_URLS` origins, the network host and its
subdomains, localhost. Routes added (two files each) to amrit-canada,
innergathering, arts-collective, ifac, hidden-enneagram, inner-gathering.
The three center hosts wrap every cross-site link (other orgs' threads and
centers, ArtDirect, the network account) in `handoffUrl`.

**Compose:** amrit-canada and innergathering gained `INTER_APP_JWT_SECRET`,
`NEXT_PUBLIC_NETWORK_HOST`, `ADDITIONAL_REDIRECT_URLS` (five other services
already had the secret). amrit-canada was recreated with them.

**Verified over HTTP, with two distinct hostnames so cookies could not leak
(127.0.0.1:3006 = the production container, localhost:3116 = a host dev
server):** destination signed out before; hop 1 issues a token; hop 2 sets one
cookie and lands on `/center`; the destination then renders the signed-in
center; the reverse direction lands signed in on `/hub`; a tampered token,
a signed-out start, and an unknown destination all degrade to plain
redirects. Replay within the token's life was possible before the Redis
one-shot claim; verified refused after it.

**Owed:** `EAC_COOKIE_DOMAIN=.arts-collective.com` on the arts-collective
service (subdomain SSO without any hop; the code honours it, no compose file
sets it); restarts of innergathering and arts-collective so their containers
carry the new auth package; hiddenenneagram.com is not in
`ADDITIONAL_REDIRECT_URLS`, so it cannot be a handoff destination until it is.

## Round ten (2026-09-12) — the center's definition as data

**Built:** `packages/services/src/center-layout.ts` — `CenterLayout`
(`columns.left/right` order, `hidden`, `options.{feed,network,pinned}.limit`,
`options.site.ratio`, `voice`), `DEFAULT_CENTER_LAYOUT`, and
`resolveCenterLayout(orgId)`: code default ← network default (`site_config`
under `elkdonis`, key `center_layout`) ← the org's own row, the way themes
resolve. Validated in app code against the curated section ids; unknown ids,
limits and voices are dropped, never a 500. `saveCenterLayout` writes a
cleaned value (caller authorises — no editing UI yet). `CenterPage` now takes
`layout` and draws its ten sections from it; the three hosts resolve it and
pass the limits into `loadCenter`. `@elkdonis/cms-ui/center` exports the
structural twin and default.

**Verified on amrit-canada production** by inserting rows and reading the
rendered DOM order: no rows → default; a network row (4:3 site, gazette
voice, promo hidden) applied; an org row on top reordered the right column,
restored promo, capped the feed at two rows; a junk row (unknown section,
bad voice, non-numeric limit) rendered the layer beneath. Rows reverted.

**Owed:** an editing surface for an org's definition (owner/guide) and for
the network default (admin) — the write path exists, the face does not.

## Round eleven (2026-09-12) — the arranging face

**Built:** `{ type: "centerLayout", orgId }` surface
(`surface/surfaces/CenterLayoutSurface.tsx`, URL `centerLayout:<orgId>`): two
column lists with up/down/hide/remove and an add picker, site ratio, voice,
feed and network limits, Save. Admins get a radio to save as the network
default instead. `connectors.centerLayout` → `/api/center/layout` (GET: the
resolved layout, section labels, `canEdit`, `networkOrgId` for admins;
PATCH: owner/guide/admin for an org row, admin only for `elkdonis`). An
**Arrange center** button sits on the org card for owners and guides, and
only renders where a provider with the connector exists.

**Verified on amrit-canada production:** member reads read-only, is refused
on write, sees no button; promoted to guide the button appears, a PATCH with
a junk section saves the cleaned layout, and the page reflects the new
order, hidden section, voice and feed cap; a guide is refused on the network
default. Role and rows reverted.

## Round twelve (2026-09-13) — automatic SSO, verified on the real domains

The owner asked for the concrete case: signed in on amritcanada.ca, then
visiting ifacgroup.com without logging in again. Built on the handoff from
round nine — no new server mechanism, two new call sites for it.

**Built:**
- `packages/auth-client/src/sso.ts` — client-safe (`"use client"`-importable)
  `networkOrigin()`, `handoffHref()`, `mirrorLoginHref(hereOrigin, finalPath)`.
  The last composes the handoff twice: leave here for the network host
  (which, now signed in there too, immediately hands back) — no new server
  code, just two existing hops chained.
- `packages/auth-server/src/handoff.ts` gained `currentOrigin()` (this
  request's origin, from `next/headers`) and `ssoCheckUrl(hereOrigin,
  loginPath)` — where a `/login` page bounces once, before showing the form,
  to ask the network host if the person is already signed in elsewhere.
- **Every real sign-in now mirrors to the network host.** amrit-canada,
  innergathering and ifac's `login-form.tsx` route their `onSuccess` through
  `mirrorLoginHref` instead of a bare `window.location.href`.
- **Every login page tries the network host silently first.** amrit-canada,
  innergathering and ifac's `/login` pages redirect through `ssoCheckUrl`
  once (marked `?sso=1` so the chain cannot loop) before rendering the form.
- ifac gained the SSO environment (`INTER_APP_JWT_SECRET`,
  `NEXT_PUBLIC_NETWORK_HOST`, `ADDITIONAL_REDIRECT_URLS`) the other two
  already had.

**A real production gap found and fixed:** arts-collective — the network
host every handoff bounces through — had no `ADDITIONAL_REDIRECT_URLS` of
its own, so it refused every incoming token as an "unknown issuer" no matter
how correctly it was signed. This meant the round-nine SSO hop had never
actually been usable between two real custom domains; only the local-port
tests (which don't exercise this check the same way) had passed. Fixed by
adding the same env line arts-collective was missing.

**Verified against the live public domains** (amritcanada.ca,
ifacgroup.com, arts-collective.com — confirmed reachable and proxying to
these containers), with a real login and one cookie jar:
1. Sign in on amritcanada.ca.
2. Before any mirror, ifacgroup.com is correctly signed out.
3. The mirror a real browser's `onSuccess` would trigger, run by hand:
   4 redirects, lands back on amritcanada.ca's own center, and the jar now
   also holds an arts-collective.com cookie.
4. Visiting ifacgroup.com's gated `/hub` with that same jar: no login form
   at any point, 5 silent redirects, ifac's own `/api/auth/session` shows
   the real authenticated user — ifac genuinely signed the person in, not a
   spoof. It lands on IFAC's own "members only" notice rather than the hub,
   because this test account holds no role in `ifac` (confirmed in the
   database) — that is IFAC's org-membership gate working correctly, a
   separate concern from authentication.
5. **Negative control:** a brand-new cookie jar that never touched any EAC
   site hits the same ifac page, bounces once (central correctly finds
   nothing), and lands on the real login form after exactly two redirects —
   no loop, no false positive.

**Not yet wired:** hidden-enneagram and the old inner-gathering have handoff
*routes* from round nine but not this round's login-page/login-form changes.
The mechanism generalises to any app with both once patched the same way.

## Round thirteen (2026-09-13) — the morph: a face grows into its surface

The owner sent shshaw/keyframers' card→view fold transition
(codepen.io/shshaw/pen/QmZYMG) and asked to refine `/center`'s UI and
understand "its movement / reinvention across apps / domains".

**The gap that mattered.** The other session had already ported that exact
CodePen as the `fold-card` pen (its header credits the same pen), but only as
a standalone card for IFAC portraits. The *surface system* — the thing every
hub tile, center card and feed row across every app opens into — still did a
plain rise-and-settle fade. So the system's own claim, "a face and a surface
are the same object at two sizes", was true in the data model and invisible
on screen. That is the one change that propagates to every app and domain at
once, which is exactly the "movement across apps" being asked about.

**Built — in `@elkdonis/cms-ui/surface`, so every host gets it:**
- `morphIn()` in `SurfaceProvider.tsx`: FLIP. The panel is already where it
  belongs, so measure it, put it back onto the clicked face for one frame,
  then let go. Runs immediately after `showModal()` in the same effect, since
  the panel is only measurable where it will actually sit once it is in the
  top layer. Same `data-move="pending" → "moving"` vocabulary as the
  fold-card pen, so the two read as one technique in the codebase.
- `open(descriptor, origin?)` — `SurfaceOrigin` is the face element or a
  rect. Omit it (a deep link, `?surface=` on load, a calendar day) and the
  surface keeps its old plain entry: there is nothing to grow out of.
- `surface.css`: the morph block. While morphing, the dialog's own entry
  transform stands down — two transforms on one box would fight over where it
  lands. Panel children fade in *after* the move rather than riding it, since
  they would squash under the scale. Fully disabled under
  `prefers-reduced-motion`.
- Origins now passed by `SurfaceCard` (the face itself, via
  `closest(".eac-face")`), `CenterThreadRow` (the row is the face),
  `CenterComposeBar` and `ArrangeButton`.

**Also built — the org rail as sliding cards.** Past two orgs, "Where you
are" slides, reusing the same `.eac-center-slider` the network strip already
uses (one slider idiom on the page, not two). Each org is a face with the
current one marked "You are here"; one or two orgs still stack as pills,
where a slider would be ceremony.

**Verified on amrit-canada production:** the morph CSS and the FLIP code are
both in the served stylesheet and client bundle; `/center` renders; with a
third org temporarily added the rail switches to sliding cards with the right
names, "You are here" on the current one and "Following" on the rest; the
temporary rows were removed. The animation itself cannot be seen from here —
there is no browser on this box — so the motion is verified as *shipped and
wired*, not as *looks right*; that last judgement is yours on screen.

**Not done, and why:** the arts-collective `/hub` upgrade (better cards, the
compose card holding a full row). arts-collective has no `SurfaceProvider`
mounted at all — it would be the system's first host there — and its
`hub-cards.ts` is a different, simpler onboarding catalogue with no compose
card and no `wide` concept. That is a real piece of work rather than a tweak.
amrit-canada's own `hub-cards.ts` was being deleted by the other session
mid-round, so its hub was left alone deliberately.

## Round fourteen (2026-09-13) — one strip for "which org am I in"

A person on this network belongs to several organisations at once, and the
question "which one am I standing in, and what am I in the others?" was being
answered twice, differently: a list of pills on `/center`, and a `<select>`
buried in a chip row on arts-collective's Organization tab.

**Built:** `OrgStrip` in `@elkdonis/cms-ui/center` — a server component (these
are links; nothing holds state) that renders the viewer's orgs as sliding
faces past two of them, and as stacked pills below that, where a slider would
be ceremony. The current org is marked "You are here"; the host decides where
each card points and what the note under the name says.

- `/center`'s rail now renders through it (its private `OrgCard`/`OrgPill`
  are gone).
- arts-collective's Organization tab renders it as a row of its own beneath
  the header, replacing the `<select>`. Each card links to
  `?org=<slug>`; the one being shown says "showing", the rest "switch →".
- `OrgSwitcher.tsx` had no other caller and was removed (tracked by git, so
  recoverable).

The strip reuses `.eac-center-slider`, the same slider the network feed and
the compose strip already use — one sliding idiom across the network rather
than three.

**Verified live:** arts-collective's Organization tab shows the three orgs
with the right kickers ("Member", "Following", "You are here") and no
`<select>` left; amrit-canada's `/center` renders the same strip from the same
component; with the account back to one org it correctly falls back to pills.
The temporary memberships used for the multi-org case were removed.

**Note on `PublishSection`** ("the compose card could handle a full row"): it
is *already* a horizontally scrolling strip of compose cards, so the compose
surface already behaves the way the request describes. What it is not yet is
part of the surface system — arts-collective still mounts no
`SurfaceProvider`, so those cards navigate rather than opening in place. That
remains the real next step for that hub, and it is the same step the morph
work makes worth taking.

## Round fifteen (2026-09-14) — making the morph reach the faces the other session built

Between rounds the other session built `@elkdonis/cms-ui/hub` — Calendar,
Compose, Gallery, Documents, Profile, Ideas, Pipeline and StandingMeeting as
live faces — and mounted the surface system on ifac, hidden-enneagram and
elastrocal. None of it morphed, for two reasons worth recording because both
are the kind of thing that fails silently:

1. **The card-level click.** Those faces pass `onClick` and no `surface` —
   they open their own surfaces. `SurfaceCard` only handed the face over on
   the `surface` path, so the `onClick` path passed no origin and the morph
   never ran. `SurfaceCard.onClick` now receives the face element
   (`onClick?: (origin: HTMLElement | null) => void`); a caller that ignores
   the argument is unaffected, which is why no call site had to change.
2. **The live inner regions.** A face's most-clicked targets are often not
   its hit area but what is alive inside it: the day on the calendar, the
   thumbnail in the gallery, an option in the compose picker, "Start another"
   on documents, "Edit" on the profile. Each called `open()` directly with no
   origin. Every one now forwards it, via a small `faceOf()` helper in the hub
   package.

`CalendarFace` is the one exception to the pattern: `MonthGrid`'s `onSelect`
carries no event, and MonthGrid is not mine to change, so the face is found
from a ref on the live region instead. The surface grows from the calendar
card rather than the specific day cell — a smaller truth than it could be,
but still the card it came from.

**Verified:** `cms-ui` and all five apps that mount the surface system
(amrit-canada, ifac, hidden-enneagram, elastrocal, innergathering) typecheck
clean; amrit-canada rebuilt and both `/center` (25 faces) and `/hub` (36
faces) render without error. As before, the animation itself is unverified —
no browser here.
