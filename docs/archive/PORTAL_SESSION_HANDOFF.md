# Artist Portal + Auth/SSO — Session Handoff
**Date:** April 27, 2026  
**For:** Next 1M-context session agent  
**Status:** Architecture mapped, doc written. Implementation of portal page and Talk integration is next.

---

## 1. What this doc is for

The product owner wants the arts-collective subdomain (`acme.artscollective.org`) to function as a **web portal** — a single engagement surface where visitors can instantly connect with an artist via email, RSVP, a live/recorded video room, and platform membership. This doc maps the full current state of the auth, SSO, Talk, and thread systems that a portal must build on, and proposes what to implement next.

---

## 2. The full auth architecture — as it actually is

### 2.1 Three auth contexts

| Context | How | Cookie domain |
|---|---|---|
| Arts-collective / inner-gathering / other Next.js apps | Supabase GoTrue via `@elkdonis/auth-server` | Dev: host-only (per subdomain, no sharing). Prod: shared via `EAC_COOKIE_DOMAIN=.artscollective.org` |
| Nextcloud | Nextcloud-internal session (PHP) | Nextcloud domain only |
| Admin OIDC provider | Issues JWT auth codes for Nextcloud Social Login | N/A — stateless |

**In production, platform SSO is already solved**: set `EAC_COOKIE_DOMAIN=.artscollective.org` in `.env` and the Supabase session cookie is shared across all subdomains. A user who signs in on `artscollective.org` is already signed in on `acme.artscollective.org`. No new code needed.

**In dev (localhost), each subdomain needs its own login**. This is a known limitation documented in `packages/auth-server/src/index.ts:deriveCookieDomain()`. Chrome silently drops `Domain=localhost` cookies. Acceptable for dev.

### 2.2 The Nextcloud SSO bridge (the OIDC provider)

The admin app runs a full OIDC provider at `localhost:3000/api/oidc/*`. Its one purpose: let platform users appear as themselves in Nextcloud without a second login.

**Flow for registered users joining a Talk room:**
```
User on subdomain clicks "Join"
  → /api/talk/join?token=X (arts-collective route)
  → checks session + nextcloud_synced
  → signs short-lived JWT (INTER_APP_JWT_SECRET, 5min, iss=arts-collective, aud=admin-oidc)
  → sets cookie eac_user_jwt + eac_nc_oauth_ts
  → redirects to Nextcloud Social Login: /apps/sociallogin/custom_oauth2/elkdonis?login_redirect_url=...
  → Nextcloud hits admin OIDC /api/oidc/authorize
  → OIDC reads JWT from cookie, verifies, issues auth code
  → Nextcloud exchanges code for token
  → userinfo returns { sub, id, email, name, preferred_username }
  → Nextcloud creates/links user, sets NC session cookie
  → Nextcloud redirects to Talk room
  → User enters room as themselves
```

**For guests (not signed in):**
```
Guest clicks "Join as guest"
  → direct link to ${NEXTCLOUD_PUBLIC_URL}/call/${token}
  → Nextcloud Talk allows unauthenticated access to public rooms
  → Guest enters as "Guest [random name]"
```

**Key env vars for the SSO bridge:**
```
JWT_SECRET=...                        # OIDC token signing (admin app)
NEXTCLOUD_OIDC_SECRET=...             # Client secret for Nextcloud
INTER_APP_JWT_SECRET=...              # JWT between apps and admin OIDC
NEXTCLOUD_URL=http://nextcloud-aio-apache:11000  # Internal (custom per NEXTCLOUD_CUSTOM_CHANGES.md)
NEXTCLOUD_PUBLIC_URL=http://localhost:8080        # External (what browser sees)
NEXT_PUBLIC_NEXTCLOUD_URL=http://localhost:8080   # Client-side URL for TalkEmbed
EAC_COOKIE_DOMAIN=.artscollective.org  # SET IN PRODUCTION for cross-subdomain SSO
```

### 2.3 Nextcloud user provisioning

Users get a Nextcloud account when:
1. Admin manually runs "Sync" in the admin panel, OR
2. An app calls `provisionUser()` from `@elkdonis/nextcloud/users`

The custom changes in `NEXTCLOUD_CUSTOM_CHANGES.md` derive the Nextcloud username from email (`justingillisb` from `Justin.GillisB@gmail.com`). The user record stores `nextcloud_user_id`, `nextcloud_app_password`, `nextcloud_synced`.

---

## 3. Nextcloud Talk — how it works

### 3.1 Room types

| Type | Value | Description |
|---|---|---|
| one-to-one | 1 | Private DM |
| group | 2 | Named group, invite-only |
| **public** | **3** | **Shareable link, guests can join** |

All workshop/meeting Talk rooms are created as type `3` (public). The `token` is the join code stored in `threads.nextcloud_talk_token`.

### 3.2 Embedding via iframe

`packages/nextcloud/src/components/TalkEmbed.tsx` renders:
```html
<iframe
  src="${NEXTCLOUD_PUBLIC_URL}/call/${token}"
  allow="camera; microphone; display-capture"
/>
```

**iframe works** because:
- `X-Frame-Options: SAMEORIGIN` in `docker/nginx/conf.d/default.conf` is on the `storage.localhost` block only (internal media storage)
- Main Nextcloud AIO Apache container has its own config
- inner-gathering already uses `TalkEmbed` in `LiveVideoPlayer`
- For production: Nextcloud `config.php` may need `'allow_user_to_change_display_name'` and Talk embed allowed in Nextcloud admin panel → Talk settings → "Allow Talk"

### 3.3 Guest join model

Two UX paths for Talk rooms on the artist portal:
1. **Guest (not signed in)**: direct link to `/call/${token}` — opens in new tab OR as embedded iframe — appears as "Guest"
2. **Member (signed in, Nextcloud synced)**: `/api/talk/join?token=X` → SSO flow → appears as their display name

The `/api/talk/join` SSO flow has a 2-minute OAuth window cookie (`eac_nc_oauth_ts`) — if user recently went through it, direct redirect. Otherwise initiates Social Login.

### 3.4 The gap: Nextcloud provisioning on member join

When a user signs up via `acme.artscollective.org/login?mode=signup&org=acme`, the `login-form.tsx` auto-joins them to the org. But it does **not** provision their Nextcloud account. So they'd hit `/api/talk/join` and get redirected to `/hub?error=nextcloud_not_synced`.

**Fix needed**: provision Nextcloud on signup (best effort, async). The `/api/auth/signup` route or the `login-form.tsx` success handler should trigger provisioning.

---

## 4. The thread model — how content flows through the network

### 4.1 Table structure

```
threads (kind: post | workshop | event | meeting)
  └── org_id → organizations
  └── author_id → users
  └── workshop_pages (sidecar, one-to-one FK)
      artist_profiles (one per org)
```

Every piece of published content is a `thread`. The `kind` field dispatches rendering.

### 4.2 Current routing per kind

| Kind | Public URL | Renderer |
|---|---|---|
| `workshop` | `acme.domain.org/[slug]` | `renderWorkshopTemplate()` via `@elkdonis/cms-bindings` |
| `post` | Not yet routed | — |
| `event` | Not yet routed | — |
| `meeting` | `inner-gathering` only (no arts-collective route) | `GatheringDetails` component |

**All published threads are also visible in forum at `:3003`** via `share_to_network` flag — no copy, direct query across orgs.

### 4.3 Rendering quality gap

The current feed cards on the subdomain (`OrgFeedCards`, `WorkshopCards` in `silex-embeds.tsx`) render plain React HTML — visually distinct from the GrapesJS block templates. Two possible paths:

**Path A — Embed slots become block-template teasers**: Workshop cards use the same CSS token system as the workshop template. The card IS the nav/hero block at small scale. Consistent visual system.

**Path B — Embed slots are minimal hooks, full page is the destination**: The card is deliberately sparse ("Writing as a Practice — Sat Jan 11 — Register →"). The `/[slug]` page does the full template render. The card is just a table of contents entry.

**Recommendation**: Path B. It respects "logistics-first" from the brief, keeps the embed system simple, and the per-slug page is already built and working.

---

## 5. The subdomain page structure — confirmed

**Product owner confirmed architecture (April 28, 2026):**

```
acme.artscollective.org/              → GrapesJS/Silex page (advertising flyer, owner-designed)
acme.artscollective.org/[slug]        → GrapesJS workshop template pages (promotional, exportable)
acme.artscollective.org/community     → Fixed React artist hub (engagement surface, platform-controlled) ← BUILT
```

Talk join: **Approach B confirmed** — new tab, not inline iframe.
Talk iframe (Approach A) is noted in `portal.module.css` for future implementation.

Member dashboard/sidebar: deferred. Described as "2000s-era heavily padded sticky sidebar that slides out" — interesting direction, not in scope yet.

---

## 5b. The artist portal — what it is and what it needs

### 5.1 The vision (product owner intent)

The `/community` page at `acme.artscollective.org/community` is:
- An engagement surface for visitors who land on the artist's page
- Shows: who the artist is, upcoming workshops/meetings, how to connect
- Connects directly to: email, Talk room join, workshop registration, platform membership
- Evolves based on login state: guests see public surface; members see richer interactivity

### 5.2 The current state

```
/ → SilexLayout (if silex_published_path set) OR default React layout
     ↓
     Default layout shows: artist bio, feed list, about section
     No Talk room embed
     No email CTA
     No engagement affordances for guests
     
/[workshop-slug] → Workshop template (newly built ✓)
     Shows: hero, details, about, facilitator, register
     Has: "Stay in touch" nav CTA, registration CTA
     Missing: Talk room embed, live member presence
```

### 5.3 What needs to be built for the portal

**Phase P1 — Portal page at root `/`**

A structured React layout (not Silex-published, owner can't break it accidentally) with:

```
[Artist cover / hero]
  ↓
[Contact CTA row] — Email | Join Talk room | RSVP upcoming
  ↓
[Live room tile] — if a meeting is active: TalkEmbed iframe
                   if upcoming: CountdownWidget + "Join when live"
                   if none: recent recording from Nextcloud (video playlist)
  ↓
[Workshop cards] — upcoming, link to /[slug] pages
  ↓
[Artist bio] — from artist_profiles
  ↓
[Membership CTA] — "Join to comment, RSVP, and participate"
```

When signed in:
- Replace "Join" CTAs with named join buttons
- Show comment/reply sections on content
- Show member-only content if any
- Owner/admin: see SubdomainEditorBar (already built ✓)

**The Silex layout (`layout_mode === "silex"`) still takes over `/` if the owner has published one.** The portal layout is the fallback/default, and can be the permanent layout for orgs that don't use Silex.

**Phase P2 — Talk room on workshop page**

Workshops with a `nextcloud_talk_token` show a "Join live" block in the template:
- Before session: "Talk room opens [N minutes] before start"
- During session: iframe embed or "Open in new tab" button
- After session: link to recording if available

**Phase P3 — Thread interactivity when signed in**

Add to `/[slug]` workshop page:
- Reply/comment section (reuse inner-gathering's CommentSection pattern)
- RSVP confirmation (when `is_rsvp_enabled` + signed in)
- Member presence count

---

## 6. The inner-gathering → arts-collective pattern diff

inner-gathering serves `inner_group` org with full Mantine UI, detailed gathering views (`GatheringDetails`), live video, drawings, polls. It's rich and internal-community-focused.

arts-collective serves MULTIPLE orgs with a lighter touch: Silex-customizable layouts, per-org workshop pages, network-wide forum. The two apps share the DB but serve different purposes.

**Convergence points:**
- `GatheringDetails` in inner-gathering is the richest content view. `renderWorkshopTemplate` in arts-collective is the template-driven equivalent. They're parallel implementations of the same concept.
- inner-gathering's `live-video-player.tsx` (`TalkEmbed` in iframe) is the direct model for what the portal's live room tile should do.
- inner-gathering's comment flow (`comment-section.tsx`) is the model for thread replies on the workshop page.
- `@elkdonis/cms-bindings` is now the shared render layer between both.

---

## 7. OIDC scope — current and future

The admin OIDC currently has **one client**: `nextcloud`. It is purpose-built for Nextcloud Social Login.

**Could expand to:**
- **Forum at 3003**: currently separate auth. Add a second OIDC client `forum` with redirect URIs pointing to the forum login callback. Users sign in once on arts-collective, get SSO to forum.
- **Future external services**: any OAuth2/OIDC-capable service could be added as a client by appending to `CLIENTS` in `apps/admin/src/lib/oidc.ts`.
- **External artists joining the network**: if the platform becomes an identity provider for partner orgs, they register as OIDC clients.

The provider is minimal but functional. The main limitation is that the OIDC secret and clients are hardcoded in `oidc.ts` (not DB-driven). Moving to DB-backed clients would be Phase N.

---

## 8. Current gaps summary

| Gap | File(s) | Priority |
|---|---|---|
| Nextcloud not provisioned on member signup | `login-form.tsx`, `api/auth/signup` | High — blocks Talk join |
| Portal page at `/` doesn't exist | `app/sites/[slug]/page.tsx` — needs portal layout | High — core vision |
| Workshop page missing Talk room block | `workshop-render.ts`, `renderWorkshopTemplate` | High — core vision |
| Feed cards not linked to `/[slug]` — fixed ✓ | — | Done |
| `gallery_image_urls` not in `upsertWorkshopPageAction` INSERT | `cms/actions.ts` | Medium |
| Per-thread route for `post` and `event` kinds | `app/sites/[slug]/[contentSlug]/page.tsx` | Medium |
| Member interactivity (comment, RSVP) on workshop page | New components | Medium |
| `user_organizations.role` missing `member` role | DB migration | Medium |
| `SubdomainEditorBar` quick-post only opens generic dialog | Needs workshop-specific shortcut | Low |
| Preview page mock data doesn't use Talk room data | `preview/workshop/page.tsx` | Low |
| OIDC client config hardcoded in `oidc.ts` | Should move to DB/env | Low |
| Dev SSO across subdomains (.localhost cookie issue) | `auth-server/deriveCookieDomain` | Dev-only limitation |

---

## 9. Recommended implementation order (next session)

### Sprint A — Talk room on the portal

1. **Nextcloud provisioning on signup** — `login-form.tsx` success handler calls `POST /api/auth/provision-nextcloud` (already exists in inner-gathering — port to arts-collective). Async, non-blocking.

2. **Live room tile component** — `components/LiveRoomTile.tsx`. Server component. Props: `talkToken: string | null`, `scheduledAt: string | null`, `isOwner: boolean`. Logic:
   - No token → null (section hidden)
   - Token + active time window → `TalkEmbed` iframe + "Join as guest" link
   - Token + upcoming → countdown + "Opens in X"
   - `isOwner` → "Manage room" link to Nextcloud Talk admin

3. **Wire `LiveRoomTile` into the workshop page** — `sites/[slug]/[contentSlug]/page.tsx` passes `workshopData.nextcloud_talk_token` and `workshopData.scheduled_at` to `LiveRoomTile`. Render it between the register block and the footer.

4. **Wire `LiveRoomTile` into the portal landing page** — new portal layout at `sites/[slug]/page.tsx` (default layout, not Silex). Shows the most recently active or next upcoming meeting with a Talk token.

### Sprint B — Portal page

5. **`OrgPortalPage` component** — replaces the current default layout in `sites/[slug]/page.tsx` when `layout_mode !== "silex"`. Structure per §5.3 above. Server component; reads org, profile, feed, next meeting.

6. **Guest vs member rendering** — `getCurrentUser()` already available in `sites/[slug]/page.tsx`. Pass `user` as prop to sub-components. Guest sees "Join / Sign up" CTAs; member sees "Join as [name]".

### Sprint C — Thread interactivity

7. **Reply section on workshop page** — port `CommentSection` from inner-gathering. Thread replies go into the shared `replies` table with `parent_type='thread'`, `parent_id=threadId`.

8. **RSVP on workshop page** — `POST /api/rsvp` with `thread_id`. Creates `rsvp_responses` row (table exists from migration 021 in amrit-canada — but scoped to meetings. Needs a threads-based variant or re-use the existing one).

---

## 10. Open questions for product owner (unanswered as of this doc)

1. **Q1**: Root `/` as portal — is the intent that `acme.domain.org/` IS the engagement hub (portal layout) even if the owner has a Silex-published page? Or does Silex always take precedence for `/`?

2. **Q2**: Talk iframe vs popup — inline iframe (requires Nextcloud config) or "open in new tab" button (works now)? Inner-gathering already uses the iframe approach so the path is validated.

3. **Q3**: What "comes alive" for signed-in members? Of the following, which are in scope:
   - Commenting on threads
   - RSVP with confirmation
   - Named presence in Talk room
   - Members-only content visibility
   - Quick-posting to the feed (contributor role)
   - Member directory

---

## 11. Key file map for the next agent

```
# Auth/SSO
packages/auth-server/src/index.ts         deriveCookieDomain(), getServerAuth()
apps/admin/src/lib/oidc.ts                CLIENTS, createAuthCode, generateIdToken
apps/admin/src/app/api/oidc/*             authorize, token, userinfo, .well-known
apps/arts-collective/src/app/api/talk/join/route.ts   JWT bridge for Talk SSO
apps/inner-gathering/src/app/api/talk/join/route.ts   Same pattern, inner-gathering

# Nextcloud
packages/nextcloud/src/talk.ts             createTalkRoom()
packages/nextcloud/src/users.ts            provisionUser()
packages/nextcloud/src/components/TalkEmbed.tsx   iframe embed component
apps/inner-gathering/src/components/live-video-player.tsx   Usage example

# Template rendering
packages/cms-bindings/src/workshop/        types, format, render — shared package
apps/arts-collective/src/lib/cms/workshop-render.ts  FS adapter
apps/arts-collective/src/app/sites/[slug]/[contentSlug]/page.tsx  Public workshop URL

# Hub CMS form
apps/arts-collective/src/components/hub/WorkshopForm.tsx  Unified form
apps/arts-collective/src/lib/cms/actions.ts  saveWorkshopAction (create+update)
apps/arts-collective/src/lib/cms/schema.ts   workshopFullSchema

# Subdomain public page
apps/arts-collective/src/app/sites/[slug]/page.tsx  Default layout + Silex switch
apps/arts-collective/src/components/SubdomainEditorBar.tsx  Owner editorial bar
apps/arts-collective/src/middleware.ts  Subdomain → /sites/[slug]/[contentSlug] rewrite

# Inner-gathering reference implementations
apps/inner-gathering/src/app/live/page.tsx         Live video feed (TalkEmbed usage)
apps/inner-gathering/src/components/gathering-details.tsx   Full content view
apps/inner-gathering/src/app/network-mock/amrit-vela/  Best-quality portal mock layout
apps/inner-gathering/src/components/live-feed-widget.tsx  Countdown + live status

# Migrations
packages/db/migrations/038_workshop_pages.sql   workshop_pages sidecar
packages/db/migrations/021_rsvp_responses.sql  (if exists) RSVP table
```

---

## 12. The amrit-vela mock as a design reference

`apps/inner-gathering/src/app/network-mock/amrit-vela/page.tsx` is the clearest implementation of the portal concept in the codebase. It has:
- Dark hero with eyebrow / title / meta pills (matches workshop template aesthetic)
- Sequence / curriculum section
- Upcoming sessions grid with "Reserve a seat" / "Notify me"
- Facilitator card
- FAQ with `<details>` / `<summary>`
- Sticky bottom bar with CTA

This component is currently hardcoded with mock data. It should be treated as the **design spec** for the `OrgPortalPage` component, with DB data replacing the hardcoded values. The CSS module (`page.module.css`) contains the visual system worth preserving.

The main gap vs the portal vision: no Talk room embed, no sign-in aware rendering, no live countdown. Everything else is there.
