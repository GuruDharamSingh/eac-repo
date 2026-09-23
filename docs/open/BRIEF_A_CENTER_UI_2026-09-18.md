# Brief A — `/center` UI, and arts-collective `/hub` as its mirror

Sprint board: `SPRINT_2026-09-18_onboarding.md`. The user pairs on this one, so
**stop at the end of each slice and show them** (screenshots) before starting the next.

**You own:** `packages/cms-ui/src/center/**`, `packages/cms-ui/src/surface/surfaces/ProfileSurface.tsx`
(+ any new surface you add for this), the profile/center parts of `packages/cms-ui/src/surface/types.ts`,
`packages/services/src/center.ts` (+ a new `presence.ts` if you need one),
`apps/*/src/app/center/**`, `apps/*/src/app/api/center/**`, and `apps/arts-collective/src/app/hub/(tabs)/**`.
**Not yours:** hub faces/FirstSteps (Brief E), forum (B), IFAC auth/manage/Nextcloud (C).
`surface/types.ts` and `services/src/index.ts` are shared: append, never revert.

## The idea (user, 2026-09-18)
`/hub` is the **org's** gateway. `/center` is the **person's**: you across the network.
The **profile card is the control panel**. Clicking it opens one popup where you can:
1. **Manage where your content shows** (quickly, as switches).
2. **Add content anywhere**: one compose that can post to any place you're allowed to.
3. **Fill in your full profile details** in its own tab.

arts-collective.com/hub is **the same thing plus**: a better org switcher, a bit more
detail per org, and an "Open site" button for orgs that have their own site. Build the
pieces once in `@elkdonis/cms-ui/center` and mount them in both places.

## What exists (checked 2026-09-18)
- `/center` = `CenterPage` (server component, two columns: person left, org right),
  `ProfileFlipCard` (front: portrait; back: action list, some with `surface: true`),
  `CenterComposeBar` (opens `write:post` for **this host's org only**), `OrgStrip`,
  `CenterDesk`, `layout.ts` (`columns: {left,right}`). Data: `loadCenter` in `services/center.ts`.
  Hosts: innergathering, amrit-canada, fourthwayBookreaders, arts-collective `sites/[slug]/center`.
- `ProfileSurface` (491 lines): **one flat form**. displayName, headline, bio, pronouns,
  city/region/country, avatar, social links. Plus an optional `connectors.profile.page`
  (`load` / `setSection` / `startPayouts`): "what your page carries" + payouts.
- `ComposeSurface` gets `feeds` from **one** host org and writes `feed_slug`.
  `ForumSurface`/forum-ui already has a cross-org target, one value `orgId|feedSlug`
  parsed by `pair()` in forum-ui `actions.ts`. **Reuse that shape.**
- `IdentitiesFace` / the **Signed as** picker (pen names, `resolveActor`) exists. Destination
  and author are separate choices; keep them separate.
- arts-collective `/hub` = `(tabs)/organization` (374 lines, `?org=<slug>` switcher),
  `(tabs)/network` (253), `(tabs)/elkdonis` (383). `orgHomeUrl`/`orgHomeUrlMap` in
  `lib/org-url.server.ts` give an org's site URL. arts-collective runs as the compose
  service **`arts-collective`** (container `eac-arts-network`), **dev mode**, so changes are live.
  ⚠ `*.arts-collective.com` subdomains have **no DNS** in prod (memory: *Edge & Domains*).
  "Open site" must only show for an org whose URL actually resolves (a confirmed
  `org_domains` row or a known live host). Otherwise hide it, don't show a dead link.

## Where "where it shows" already lives (no new schema needed for the first pass)
| Switch | Column |
|---|---|
| Listed in the network directory | `users.directory_listed` |
| Shown on org X's public site | `org_profiles.is_public` (org X) |
| Per-org title / bio / photo override | `org_profiles.role_title`, `bio_override`, `photo_override` |
| Blog section on my page (+ its scope) | `users.profile_sections.blog` (+ blogScope, see memory *Member Writing*) |
| Other page sections | `users.profile_sections` |
| Store / what it presents | `store` (`owner_user_id`), `store_presentation` |
⚠ Unlisting: memory *IFAC Manage Console* documents a static-roster fallback that made
"unlist" a no-op on IFAC. Verify each switch **by rendering the public page after flipping it**.
⚠ `org_profiles.is_public` is also what an org admin sets in `/manage`. Decide with the
user whether the person may flip it themselves or only *request* it. Ask; don't assume.

## Slices (stop after each for the user)
1. **Profile popup becomes tabbed.** ProfileSurface keeps its current form as
   **Profile**, and gains **Details** (the comprehensive form: everything on `users` a
   person should own, e.g. headline, pronouns, full location incl. postal code, portfolio
   URL/portfolio, social links, comment colour, slug with a warning that it changes URLs),
   **Where you show** (slice 2), **Page** (the existing `page` connector), **Payouts**
   (existing `startPayouts`). One dialog, tabs inside, `?surface=` deep-link keeps the tab.
   Never ship `claimed_by`/`created_by`/`source_note` to the browser (memory: *Identity & Pseudonyms*).
2. **Where you show.** A matrix: rows = you / blog / store / galleries; columns = the network
   directory, your own page, each org you belong to, the market. Each cell is a switch
   bound to a column above. Service: `loadPresence(userId)` / `setPresence(userId, change)`,
   with every write authorised server-side (self only, org membership checked per org).
3. **Compose anywhere.** The compose bar on `/center` opens compose with a **Post to**
   picker: every `(org, feed)` where the viewer passes `org_feeds.min_role`, plus
   "My blog" (`kind='writing'`). Value shape `orgId|feedSlug` like the forum. The server
   action **re-checks the role for the chosen target**; never trust the select. Keep
   `OFF_FEED_KINDS` semantics: "My blog" writing must never land on an org feed.
4. **arts-collective /hub mirrors /center.** The network tab renders the same center
   pieces (card → popup, compose anywhere, where-you-show), plus an **org switcher**
   (orgs you're in, role badge, tier, current one marked) and per-org **Open site** /
   **Open its hub**. Don't rewrite the organization tab's console in this slice; link to it.

## Don't
- Rebuild the bento / Pokédex / numbered-modules layout (rejected 2026-09-15, memory *Center Console*).
- Show empty-state apologies. A section with nothing returns `null`.
- Put accent colour on body text. Measure every pair (≥4.5:1 text, ≥3:1 control borders),
  on a light host (innergathering) and a dark one.
- Center uses Tailwind on the owner's call. Every host must `@source` `packages/cms-ui/src`
  (innergathering and arts-collective do); check any new host, or it renders unstyled.

## Verify
Render authenticated (memory *Verify UI by rendering*; mint a session, alpine-chrome
screenshots) on innergathering `/center` and arts-collective `/hub/network`, desktop + phone.
For slice 2, flip each switch and render the public page it controls. For slice 3, post to
two different orgs and a blog from one compose, then confirm each landed where chosen and
nowhere else. Clean up test rows. Log each slice on the sprint board.

## Recipe for Brief C (IFAC has `/api/center` but no `/center` page)
Fill this in when slice 1 is done: the one connector file + one route IFAC needs to mount it.
