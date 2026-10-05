# Artist funnel: visitor → artist → free org (brief, 2026-09-27)

Covers the path from signing in on any site, to gaining a space in the
collective, to creating a free organisation, and what each stage includes.
Records the developer's decisions of 2026-09-27 and what exists in code.
Related: `docs/open/PERSON_PAGES_BRIEF_2026-09-26.md` (ArtDirect person
pages, Puck), `docs/reference/identity-and-tenancy.md` (roles, `oad` rule).

## Decisions (developer, 2026-09-27)

1. Stages. Viewer (signed in; `user_organizations.role = 'viewer'` in the
   orgs they follow) → artist (gained a space = non-viewer row in org `oad`)
   → owner of a free org → supported/partner org.
2. Gaining a space happens on starting any artist onboarding (`/wizard`,
   `/wizard/business`), on the hub band / `/center` button, or on the first
   upload into the person's own folder. Everyone with a `users/<folder>` is an
   `oad` member and listed on ArtDirect. (Built 2026-09-27.)
3. Personal offerings on OAD are payable and carry the platform commission:
   10% on offerings homed in `oad`, about 5% on offerings of subdomain orgs.
4. One featured offering per artist, with its own page (`/<slug>/featured`).
   Other offerings appear only as cards on the profile.
5. The featured offering and the workspace are the same thing: the workshop
   thread's page is the promo for visitors and the workspace for enrolled
   people (as `/workshop/<slug>` already works on org sites).
6. Creating an org does not list or move the person's existing offerings.
7. The free org includes: an organisation home (feed + hub), one featured
   offering (= workspace), and the owner's OAD profile. The community page
   exists but is not something the org controls; out of scope.
8. Free orgs go live without admin confirmation. The intake interview stays
   for supported and partner.
9. ~~Editing: visual editor. Start with Puck on the OAD profile.~~ 2026-09-27
   (later the same day): leave Puck out of this work for now.
10. Who edits a personal offering: the person it belongs to (its author). The
    owner of `oad` may also be able to; that is accepted, not a leak to fix.

## Current state (verified 2026-09-27 unless marked)

- Personal content is homed in `oad` (`PERSONAL_ORG_ID`,
  `packages/services/src/thread-listing.ts:29`); `/center` "blog" posts are
  `kind='writing'` threads there (`writing.ts:347-383`).
- ArtDirect Puck pages exist: `/<slug>/design` (profile) and
  `/<slug>/featured/design` (featured, `offering-spotlight` block). Live pages
  are `user_pages` rows `profile`/`featured` under `oad`; drafts
  `profiledraft`/`featureddraft`. Save draft, Publish and a published page's
  render were not exercised (person-pages brief, Status 2026-09-26).
- ArtDirect has no way to create threads (no writing desk).
- Org sites: the landing page is `OfferingPage`, showing the org's one pinned
  thread (`apps/arts-collective/src/lib/org.ts:284-338`; pinning unpins the
  rest, `lib/cms/actions.ts:184-214`).
- Workshop workspace = the workshop thread at `/workshop/<slug>`, open to the
  author, enrolled people and org editors
  (`sites/[slug]/workshop/[workshopSlug]/page.tsx:52-58`).
- Payment: only innergathering has Stripe checkout for threads
  (`createThreadOrder`, `packages/commerce/src/server/orders.ts`).
  arts-collective refuses priced workshops with 402
  (`api/threads/[id]/rsvp/route.ts:105-111`). No path exists on OAD.
- Org creation: `/api/org/create` inserts the org with
  `subdomain_confirmed = false` on every tier; an admin confirms at
  `/hub/admin`. Until then non-editors see "being set up".
- `organizations.tier` (`free|supported|partner`) gates nothing; display only.
- `JoinTiers.tsx:23-71` promises the free tier three pages (offerings,
  profile archive, about), which no longer matches decision 7.
- artdirect runs (dev mode, edge 200 on 2026-09-27); the "down" note in
  `CLAUDE.md` is stale.

## Built 2026-09-27 ("Manage your space", plan step 2, first cut)

- `packages/services/src/artist-offerings.ts`: `saveOffering`,
  `setOfferingStatus`, `setFeaturedOffering`, `listOfferings`,
  `getFeaturedOffering`, `getOwnOffering`. Kinds meeting and service, homed in
  `oad`, every write matched on `author_id`. Migration 171 adds
  `users.featured_thread_id`.
- ArtDirect: owner-only docked "Manage your space" button
  (`apps/artdirect/src/components/oad/ManageSpace.tsx`) opening a surface
  panel (shared compose form for new/edit; publish, take down, feature,
  writing link, start a group). Server actions
  `apps/artdirect/src/lib/offering-actions.ts`. `/<slug>/featured` renders the
  featured offering when set; the profile links it ("Featured: … →").
- Verified in a headless browser with a test account (removed): create a
  service, publish, feature, featured page and profile link render; the row
  was `org_id='oad'`, author set, `share_to_network=true`.
- Not done: a dedicated "Offerings" card section on the profile (offerings
  show in the existing posts/events lists); RSVP/checkout on the featured
  page; the forum still lists every thread regardless of the network opt-out
  (rule of 2026-09-08, `packages/services/src/forum.ts:10-13`).

### ArtDirect page controls (2026-09-27, later)

- Left drawer (`apps/artdirect/src/components/oad/PersonDrawer.tsx`) on
  every person page: portrait, name, bio, "Message" (mailto from the Email
  link, else "Contact" to the Website; there is no direct messaging). For the
  owner: Write a post / Writing desk (`/<slug>/writing`), Studio
  (`arts-collective.com/studio`), Elkdonis hub (`/hub/elkdonis`), section
  order, page background.
- Section order per person: `users.profile_section_order` (migration 172),
  read by `resolvePersonSections` for `oad`; `setPersonSectionOrder`. The
  featured-work column beside the bio is not a section and is not ordered.
- Background: `--oad-page-bg` merged into `users.theme`; luminance capped at
  0.056 (frame look's light inks keep >= 4.5:1). Light grounds need a dark
  ink set (not built).
- Box borders removed on ArtDirect person pages only
  (`components/oad/person-frame.css`); IFAC keeps them.
- Writing desk on ArtDirect: "Start a piece" on `/<slug>/writing`, and
  `?edit=1` on a piece opens `WritingDesk` (`lib/writing-actions.ts`,
  author-checked).
- Verified with a test account (removed): drawer, order persisted and
  applied, light colour refused, dark colour applied, borders 0, desk opens.
- Not done: "Manage your space → Writing" as a popup (it links to the
  writing page); the Studio brief plans ArtDirect's signed-in landing to be
  Studio, which may replace parts of this.

## Constraints

- Personal offerings homed in `oad` need author-based edit and workspace
  access: `oad` members are plain members, so the org-role checks alone would
  not let an artist edit their own offering. `oad` owner access is accepted
  (decision 10).
- The platform commission is a new concept beside the existing org share.
  Settlement (`packages/commerce/src/server/settlement.ts:14-21`, rules of
  2026-09-05) gives an org a cut only under an accepted agreement, with no
  default rate. The 10%/5% fee is the collective's platform fee on every sale,
  taken as part of Stripe `application_fee_amount` on destination charges
  (`packages/checkout/src/server/stripe.ts:61`) and recorded in the ledger on
  platform charges.
- New panels on ArtDirect go through the surface system
  (`.claude/rules/areas/css-ui.md`): no new dialog primitive.
- Commission applies to every sale; payout goes to the seller (person or org).
  `users.stripe_account_id` / `payout_*` columns exist; the model is in
  `docs/reference/commerce.md`. Do not create Stripe objects while testing:
  the keys are live.

## Work plan

1. ~~Puck on the OAD profile~~ (dropped 2026-09-27, decision 9).
2. "Manage your space" surface on the owner's ArtDirect page: create offering
   (thread homed in `oad`, author = person), choose the featured one (single),
   offerings as cards on the profile, "Start a group" (org setup; offerings not
   carried over).
3. Author-based access for `oad`-homed offerings (edit, workspace).
4. Checkout for personal and org offerings, reusing `packages/commerce`
   (innergathering's path), plus a platform fee in settlement: 10% when the
   thread's `org_id = 'oad'`, 5% otherwise.
5. Free org: skip the confirmation gate for `tier = 'free'`; align
   `JoinTiers` copy with decision 7.

## Open questions

- Does the 5% apply to supported and partner orgs too, or only free?
- Does the platform fee stack with an org's agreement cut, or is it taken out
  of it?
- ~~Is the fee taken from the seller's share or added to the buyer's price?~~
  2026-09-27: the buyer pays the listed price; the fee comes out of the
  seller's share. Checkout (step 4) is deferred; build steps 2, 3, 5 first.
- Where a person's featured offering is edited: Puck featured page only, or
  also a thread form (price, dates, capacity live on the thread).
