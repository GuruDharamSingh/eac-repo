# Person pages: one network profile, presented per org

Design brief, 2026-09-26. Covers how a person's content is owned, which org
sites show it, and how each org site renders the person's page from the
network profile. Decisions below were made by the developer on 2026-09-26.
Work plan steps 1-5 were built and deployed on 2026-09-26; see "Status" at
the end. The "Current state" section describes the code before that work.

## Decisions (dev, 2026-09-26)

1. **Home for personal content is the `oad` org** ("ArtDirect — Online Artist
   Directory"). `oad` is the basic blank org: the individual layer. Orgs,
   including a future Arts Collective community org, are community layers that
   present people and carry their content. There is no `network` org row;
   arts-collective and ArtDirect have no org of their own today.
2. **Control is per section and per post.** A person chooses which sections
   each org shows, and which orgs list each post.
3. **"Only visible in certain orgs" means listing, not audience.** A public post
   listed only on org X is still public: it appears on the ArtDirect page and
   opens from its link. Privacy stays with `threads.visibility` in the home org.
4. **Layout is not final.** IFAC's `/artists/[slug]` is the interim standard for
   org person pages, and ArtDirect's non-Silex layout (`standard`) should
   resemble it.
5. **ArtDirect `/<slug>` is the root page.** An org's person page is that org's
   own page for the person (the "page" in "Where you show" refers to it), not a
   copy that declares ArtDirect canonical. It links to ArtDirect.
6. Org roster sources are left as they are (not needed now; see Open items).
7. (later, 2026-09-26) The "Show on" control is in both places: the writing
   editor and a list in the profile popup. The two existing IFAC writing
   pieces move to `oad` with an `ifac` listing.
8. ArtDirect's standard page takes IFAC's artist-page look ("frame",
   `.eac-person-page--frame` in `packages/cms-ui/src/profile/person-page.css`)
   on person pages only; the directory index and the dossier keep ArtDirect's
   dark Courier style. Standard is the default layout for everyone
   (migration 168).
9. Puck is used only on ArtDirect (the org-agnostic `oad`), not on org sites.
   Each person has two Puck pages there: the profile page (`/<slug>`,
   rearrangeable, starting from the frame page) and a featured page
   (`/<slug>/featured`) promoting one or more offerings, with a "Single
   spotlight" template to start. The editor is on ArtDirect itself; a
   published page goes live immediately.

## Current state

### Identity and publish switches
- One `users` row per person; `users.slug` is the ArtDirect address.
  `org_profiles(org_id, user_id)` holds `is_public`, `role_title`, `tags`,
  `self_hidden`, and unused `bio_override`/`photo_override` (migrations 084,
  149). Detail: `docs/reference/identity-and-tenancy.md` "Profiles".
- `users.profile_sections` (migration 105) is one flat jsonb per person,
  applied on every site. Live keys: `blog`, `store`, `galleries`,
  `elkdonisFeed`, `blogScope` (`'org'|'all'`).
- `presence.ts` ("Where you show") columns: `directory`, `page`, one `org:<id>`
  per member/guide/owner org, `market`. Per-org cells exist only for the
  listing itself and for galleries, and galleries only for orgs in
  `GALLERY_SITES = {'ifac'}` (`packages/services/src/presence.ts:87`).

### Content homing
- `threads.org_id` is NOT NULL and references `organizations`
  (`packages/db/migrations/030_unified_threads_schema.sql:22`); a thread has one home org.
- `thread_orgs(thread_id, org_id, added_at, added_by)` (migration 031) lists
  further orgs. 27 rows, all in `inner_group` and equal to the home org.
  Written only by the retiring `apps/inner-gathering`
  (`src/app/api/content/route.ts:342-351`). Read by `center.ts:188` (carried-by
  names) and `center.ts:214-229` (`loadNetwork`: another org's PUBLIC,
  published, feed-kind thread enters this org's feed when carried here), and by
  the arts-collective colophon (`apps/arts-collective/src/lib/org.ts:546-557`).
- Post to… sends one post to one destination (`center.ts:633-643`, dev
  decision 2026-09-18). The `blog` target creates `kind='writing'` in
  `blogOrgId`, which is the host site's org (`center.ts:707-723`;
  `createWritingPost`, `writing.ts:339`, always `visibility='PUBLIC'`).
- `writing`, `wiki_page`, `document` are `OFF_FEED_KINDS`; they never reach feeds.
- Thread counts by visibility (2026-09-26): PUBLIC 50, ORGANIZATION 17,
  INVITE_ONLY 4. Only two `writing` rows exist, both homed in `ifac`.
- `user_pages(user_id, org_id, key)` (migration 157) is the per-person,
  per-org page store; 3 rows, all `ifac` `store:N` (2026-09-26).

### ArtDirect (`apps/artdirect`)
- `/[slug]` reads only `users` plus `listProfileOrgs`. `loadDossierContent`
  (`apps/artdirect/src/lib/oad.ts:251-386`) aggregates threads from every org
  via `getAuthoredThreads` (`packages/services/src/profiles.ts:1082`), events,
  galleries, store and memberships. Media appears only as a count.
- Layouts: `dossier` (Silex template, server-rendered) and `standard`
  (`StandardProfile` over cms-ui `ProfileView`). On `standard`,
  `DossierActivity` lists thread titles without links
  (`components/oad/DossierActivity.tsx:92-104`).
- `listDossierSlugs` does not check `directory_listed` (`oad.ts:514`).
- Not wired into network SSO (no `NEXT_PUBLIC_NETWORK_HOST`), and the host is
  missing from `ADDITIONAL_REDIRECT_URLS`.

### Org person pages

| App | Person route | Source | Notes |
|---|---|---|---|
| amrit-canada, sunjay | `/about/[slug]` | `getOrgProfileBySlug` | near-identical copies; this org's threads |
| hidden-enneagram | `/about/[slug]` | same | no threads, no store |
| innergathering | `/about/[slug]`, `/artists/[slug]` | org profile / network profile | different gating and thread scope |
| ifac | `/artists/[slug]`, `/dealers/[slug]` | `getOrgProfileBySlug` + tags | only site with inline editing and person theme |
| art-auction | `/artists/[id]` | `store` | store-centred |
| forum | `/members/[slug]` | network profile | activity across orgs |
| danamccool, fourthway | none | – | – |

Shared: `ProfileView` (`packages/cms-ui/src/profile/ProfileView.tsx`, 3
consumers), `ProfileGallery`, `WritingSection`, `StoreShowcase`, `ThemeStyle`.
Each app keeps its own `getGuideBySlug`/`getThreadsByAuthor` in `lib/data.ts`.

## Design

### 1. Ownership
- A post made in an org context stays homed there (`threads.org_id` = that org).
- A personal post (blog/writing, personal note) is homed in `oad`.
- The author is the owner in both cases. ArtDirect lists everything the person
  authored that the viewer may read (current `getAuthoredThreads` behaviour).

`oad` rules, enforced in services:
- `oad` has no members. Creating, editing and listing a post homed in `oad` is
  gated on author (or `resolveActor` identity), not on `user_organizations`.
  `createTopic` and the other role-gated writers need an explicit branch.
- `visibility='ORGANIZATION'` is refused for `oad`-homed posts: the org has no
  members, so the value would mean nothing.
- The display name of `oad` may change; the id may not (foreign keys, Nextcloud
  paths, per-org slug uniqueness).

### 2. Listing (per post)
- "Show on org X" is a `thread_orgs` row. No schema change.
- Who may add a listing: the author, for an org where they hold member, guide
  or owner. Who may remove it: the author, or an owner/guide of X (moderation).
- Effect on org X: the post appears on the author's person page on X. A
  feed-kind post also enters X's feed through `loadNetwork` (existing
  behaviour); an off-feed kind (`writing`) does not.
- Readability is unchanged: a listed PUBLIC post is readable everywhere;
  an ORGANIZATION post stays readable only by its home org's members and is
  therefore not listed elsewhere (refuse the listing).
- Post to… keeps one destination (the home). Listing is a separate control on
  the post, not a multi-destination post: this keeps the 2026-09-18 decision.
- `profile_sections.blogScope` and `listWriting(author, {orgId?})` scoping are
  replaced by the listing rule.

### 3. Sections (per org)
Section keys (existing keys kept, so no data rewrite): `portfolio` (featured
work), `galleries`, `blog` (writing), `posts`, `events`, `store`. Portrait,
name, role, bio and links always show.

Effective rule for section S of person P on org X:

```
org X offers S
AND (org_profiles[X,P].sections[S] ?? users.profile_sections[S] ?? default(S))
AND (S has content OR viewer is P)
```

Schema (one migration, number from `/new-migration`):
- `org_profiles.sections jsonb NOT NULL DEFAULT '{}'`: per-org overrides;
  a missing key inherits the person's default.
- `organizations.person_page jsonb NOT NULL DEFAULT '{}'`: `{ sections: [...],
  order: [...] }` for now; the place later layout choices go (decision 4).
- Drop the `GALLERY_SITES` restriction so `user_galleries.hidden_on` works for
  every org.

Controls: add per-org cells to `presence.ts` for each section, and a per-post
"Show on" control (location open, see below). Both act only on the caller's
own rows, as `presence.ts` does now.

### 4. Rendering
- Service: `getPersonPage(slug, { orgId, viewerId })` in
  `packages/services/src/person-page.ts`. Returns the profile, the org
  profile row, and the resolved sections with their data. Replaces the per-app
  `getGuideBySlug`/`getThreadsByAuthor` copies. For ArtDirect, `orgId = 'oad'`
  resolves to "all authored content the viewer may read".
- Component: `PersonPage` in `@elkdonis/cms-ui/profile`, taken from IFAC's
  `/artists/[slug]` structure: intro (name, role, claim prompt), sidebar
  (portrait, bio, links), featured work, then galleries, writing, posts,
  events, store. Slots for site-specific parts: sidebar extra (IFAC "email for
  pricing"), store panel (Puck `store:1`), trailing extra (IFAC
  `ElkdonisFeed`), editor (IFAC `ProfileEditorPanel`). Tokens only
  (`profile.css`), no Tailwind, so every host can use it.
- Theme: `ThemeStyle` with org precedence on org sites (existing default),
  user precedence on ArtDirect.
- Org page links to ArtDirect ("Full page on ArtDirect"); it does not set
  `rel=canonical` to it (decision 5).

## Work plan

1. Service and migration: `getPersonPage`, the two columns, `oad` rules in
   the writers, listing add/remove functions with their gates.
2. `PersonPage` component extracted from IFAC. First consumers:
   amrit-canada, sunjay, hidden-enneagram, innergathering `/about/[slug]`
   (same shape). Then ArtDirect `standard` layout. IFAC last (`/artists` and
   `/dealers` onto one component with a tag switch).
3. Controls: section cells in "Where you show"; the per-post "Show on" control.
4. Post to… `blog` target homes in `oad` instead of the host org
   (`center.ts:707-723`, the `center/post` routes).
5. ArtDirect fixes: link threads on `standard`, honour `directory_listed`
   in `listDossierSlugs`, SSO proxy and `NEXT_PUBLIC_NETWORK_HOST`, add the
   host to `ADDITIONAL_REDIRECT_URLS` (restart of `supabase-auth` needed).
6. Later: a person-page block for Puck/Silex sites (danamccool,
   hidden-enneagram).

Verification per step: render each migrated route signed out and as the
owner (`/verify-ui`); assert on markup only the new component produces;
exercise listing add/remove inside `BEGIN … ROLLBACK` first.

## Rules and constraints
- Never write a listing (`thread_orgs`) for an ORGANIZATION or INVITE_ONLY
  post into another org: listing must not widen who can read it (decision 3).
- Put section and listing switches in `presence.ts` or a sibling service that
  acts only on the caller's own rows: `getServerSession()` is the only
  source of the acting user.
- Keep `PersonPage` on `--eac-*`/profile tokens: ifac and artdirect do not
  compile Tailwind over packages.
- Rebuild production-mode apps after migration (ifac, innergathering,
  art-auction); back up `.next` and read `git status` first
  (`docs/reference/ops.md`).

## Open items
- Where the per-post "Show on" control lives: on the post's own editor, in a
  list in the profile popup, or both. Not decided.
- Existing `ifac` writing rows (2): leave homed in `ifac`, or move to `oad`
  with an `ifac` listing. Data change on production; needs the developer's
  confirmation.
- Whether a carried feed-kind post entering the org's feed (existing
  `loadNetwork` behaviour) is wanted, or listing should be person-page only.
  Assumed wanted.
- Rosters (decision 6): org people lists still use three rules, which decide
  which people appear, not only labels: `org_profiles.is_public`
  (amrit-canada, sunjay, hidden-enneagram, ifac, innergathering `/about`,
  directory embed), membership (innergathering `/artists`, `/sites/[slug]`,
  hub), network `directory_listed` (arts-collective `/artists`, forum).
- A future Arts Collective community org row, when the network needs its own
  members, moderators or posts. Not needed for this work.

Found during the survey, not fixed:
- `asPortfolio` keeps only url/title/id/x/y/w/h, so an ArtDirect gallery save
  drops `artworkId` (`packages/services/src/profiles.ts:195`).
- `ORG_PROFILE_COLS` omits `bio_override`/`photo_override`
  (`profiles.ts:296`); sunjay and fourthway read them with local SQL.
- The Silex `directory` embed links to `/<slug>`
  (`packages/silex-render/src/embeds.tsx:1065`), which on an org subdomain
  resolves to the thread route. Assumed 404; not requested.
- ArtDirect `isSelf` is a strict id match (`apps/artdirect/src/app/[slug]/page.tsx:86`),
  so admins do not get inline tools, contrary to `ProfileEditorPanel.tsx:38`.

## Status (2026-09-26)

Built and deployed; verified as stated.
- Migration 166 applied (`org_profiles.sections`, `organizations.person_page`,
  `oad` feed closed to posting). Migration 168 applied: every person on
  `standard`, column default `standard`.
- Services: `packages/services/src/thread-listing.ts`,
  `packages/services/src/person-page.ts`; `writing.ts` lists by listing and
  homes new pieces in `oad` (listed on the site they start from when the
  author is a member there). Reads verified by `tsx` probes against live data.
- `PersonPage` (`@elkdonis/cms-ui/profile`) with root class
  `eac-person-page`. The first version used `eac-person`, which cms-ui
  `hub.css` already styles as a flex chip; on ifac, innergathering and sunjay
  the page rendered in columns until it was renamed (found by the developer,
  fixed and screenshotted the same evening).
- Adopted on: sunjay, hidden-enneagram, innergathering `/about/[slug]`;
  ArtDirect standard layout plus `/<slug>/writing` readers; IFAC
  `/artists/[slug]` and `/dealers/[slug]` (source only: IFAC runs the
  pre-change build restored at the developer's request; its shared-look
  version was verified in a preview container, not deployed).
- Controls: per-org section cells and a "Show on" list in the profile popup
  (innergathering, arts-collective); "Show on" in IFAC's writing desk. The
  popup APIs were verified signed in (GET only); no toggle was exercised.
- amrit-canada's writing reader and room (another session's uncommitted work)
  accept listed pieces (`isListedOn`) instead of the home org only.
- Rebuilt: sunjay, hidden-enneagram, innergathering, arts-collective.
  ArtDirect restarted with network SSO (proxy, handoff routes, compose env).
- The two IFAC writing pieces were moved to `oad` with an `ifac` listing.

Open:
- IFAC rebuild with the shared look (developer to confirm).
- Puck profile and featured pages on ArtDirect (decision 9): built
  2026-09-26 (blocks `person-*` and `offering-spotlight`,
  `PROFILE_PAGE_BLOCKS`/`FEATURED_PAGE_BLOCKS`, templates in
  `packages/blocks/src/templates/person.ts`, routes `/<slug>/design`,
  `/<slug>/featured`, `/<slug>/featured/design`; live pages are `user_pages`
  rows `profile`/`featured` under `oad`, drafts `profiledraft`/`featureddraft`,
  published without review via `publishesWithoutReview`). Verified: both
  designers render for the owner (screenshots), signed-out 404s, `/jg`
  unchanged. Not exercised: Save draft, Publish, a published page's render.
  No unpublish or delete yet. ArtDirect dev heap raised to 2048 MB (compose)
  after one out-of-memory restart.
- ArtDirect has no writing desk (pieces cannot be started or edited there).
- Nothing exercised the listing or section toggles through a browser.
