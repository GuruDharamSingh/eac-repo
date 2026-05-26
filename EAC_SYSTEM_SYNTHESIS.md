# Elkdonis Arts Collective — System Synthesis
**Written: May 21, 2026 | Status: Soft Launch Preparation | Author: Claude (chief analyst)**

---

## 1. What This Is — Three Sentences

Elkdonis Arts Collective is a Toronto-based nonprofit providing shared digital infrastructure, mutual aid, and a program of creative and contemplative practice to artists, healers, and small operators. It runs its own self-hosted platform — authentication, file storage, publishing, commerce — and offers this to partner artists in exchange for a revenue share that funds the collective's work. The ten-year goal is 500,000 CAD in annual flows, 10,000 people reached, a physical bookstore and arts center, and an open-source model anyone can replicate.

---

## 2. The Six Founders and Their Orbits

The core six operate as the board of the NFP and as the first Tier 3 "co-creator" members of the platform. Each brings their own workshops, community, and audience. The platform is built to serve them first — and is generalized outward from their specific needs.

| Person | App | Org ID | Type |
|--------|-----|--------|------|
| Sunjay | blog-sunjay (3001) | `sunjay` | Teaching blog |
| Guru Dharam | blog-guru-dharam (3002) | `guru-dharam` | Practice group |
| Amrit Canada org | amrit-canada (3006) | `amrit_canada` | Three-section sadhana hub |
| EAC collective | elkdonis-arts-collective (3005) | `elkdonis` | Public NFP landing + directory |
| Inner group | inner-gathering (3004) | `inner_group` | Social network / beta app |
| (Two more founders implied) | TBD | TBD | TBD |

The six founders are simultaneously the board, the first users, the content producers, and the infrastructure maintainers. This is both the strength (real needs drive real features) and the main risk (bus factor, scope creep).

---

## 3. The Three Surfaces

The entire platform resolves into three distinct user surfaces, each with a different job:

### Surface 1 — Inner Gathering (port 3004, `inner_group`)
**What it is:** A private social network. The closest analogy is a spiritual Discord crossed with a co-op event calendar.
**What it does:** Real-time feed of meetings, posts, and polls. Calendar. Live video. Nextcloud file sharing. Comment threads. RSVP tracking. Excalidraw drawings. Recurring meetings.
**Who it's for:** Core members — the six founders and their inner circles. The "early beta" experience for new members.
**Current state:** The most complete and most used app. Full Mantine UI, Supabase real-time subscriptions, Nextcloud Talk integration. Working.

### Surface 2 — Arts Collective Hub (port 3007, `arts-collective` / `eac-arts-network`)
**What it is:** The member dashboard and org builder. Where partners create their corner of the network.
**What it does:** Org onboarding wizard (8-step artist profile), Silex editor launch (custom site design), workshop management, community feed, artist directory, hub cards showing each member's status.
**Who it's for:** Artists and organizers onboarding as Tier 2 partners.
**Current state:** Substantially built. Wizard complete, Silex publish pipeline working, live-editor inline editing working, artists page exists. Gaps: profile edit form (wizard is entry-only, not edit), stub profiles from new signup not fully visible.

### Surface 3 — Custom Sites (`/sites/[slug]` inside arts-collective)
**What it is:** Each partner's public-facing web portal. Rendered from Silex-published HTML stored in Nextcloud.
**What it does:** Artist profile page, workshop flyer page, community newspaper page. All three use GrapeJS blocks designed in the Silex editor. Embeds (`<eac-embed>`) pull live data (workshops, RSVP, polls, feed) into the static HTML.
**Who it's for:** The public — visitors discovering an artist, signing up for a workshop, exploring a community.
**Current state:** The pipeline works end-to-end. Block library exists with 5 categories (Layout, Content, Templates, Workshop Sections, Live Slots). Artist Profile and Workshop templates exist. The Community template exists but the newspaper layout needs more block variety.

---

## 4. The Publishing Mechanic (Unique Architecture)

This deserves its own section because it's the most distinctive technical feature of the entire platform and also the most likely to be misunderstood.

```
Artist uses Silex editor (GrapeJS, port 6805)
  → designs page using EAC blocks
  → hits "Publish"
  → Silex connector writes HTML to artist's Nextcloud folder
    (/User/{ncUserId}/{orgSlug}/silex/published/index.html)
  
Next.js serves the page at /sites/{slug}:
  → fetches HTML from Nextcloud (cached 60s)
  → strips scripts (security)
  → rewrites asset URLs through /api/silex/assets/ proxy
  → replaces <eac-embed> tags with live React components
  → applies data-trait values from DB (live workshop data)
  → serves to visitor
  
LiveEditor overlay (owner only):
  → scans DOM for data-trait attributes
  → renders floating edit pins
  → artist edits field inline → saves to DB → page updates
  → no need to re-open Silex for content changes
```

**This is the three-way editing:** Silex for layout/design, live-editor for text/field content, Nextcloud as the durable file store. An artist can design once and update content forever without touching the editor.

**The block tier vision (not yet implemented):**
- Free blocks: basic layout + content
- Member blocks: Live Slots (eac-embed components), workshop sections
- Partner blocks: premium layout templates, advanced community blocks
- This tiering maps directly to the membership model

---

## 5. User Journey Flows

### Flow A: New Member (Soft Launch)
```
1. Arrives at elkdonis-arts-collective (3005)
   → reads about the collective, manifesto, workshops
   → clicks "Join" / "Create account"

2. Signup (any app's /api/auth/signup)
   → Supabase user created
   → public.users row auto-created via DB trigger
   → Nextcloud account provisioned
   → user_organizations rows created: elkdonis (member) + inner_group (member)
   → artist_profiles stub row created: is_stub=true
   → Welcome email fired via SendGrid ✅ (BUILT May 21, 2026)

3. Lands in inner-gathering (/feed)
   → sees the community feed
   → can RSVP to meetings, comment, post

4. Prompted to "Complete your profile"
   → navigates to /account (inner-gathering) — sees basic fields ⚠️ (PARTIAL)
   → no artist_profiles edit form yet ← GAP

5. (Later) Navigates to arts-collective hub
   → sees wizard prompt
   → completes 8-step artist profile
   → gets their corner at /sites/{slug}
```

**Gap:** Step 4 — inner-gathering's `/account` page edits `users` fields (display_name, bio, avatar, comment color) but has NO connection to `artist_profiles`. The stub profile exists in the DB but is invisible in inner-gathering. A "Profile" section needs to be added to inner-gathering's account page that reads/writes `artist_profiles` basic fields (name, city, bio, photo, disciplines, portfolio URL), and sets `is_stub=false` on save.

### Flow B: Artist Partner Onboarding (Tier 2)
```
1. Member completes inner-gathering for a while, gets invited as partner

2. Navigates to arts-collective hub (/hub)
   → sees hub card: "Artist Profile — Resume" (wizard 0/8 complete)

3. Completes wizard:
   Step 1: Identity (name, pronouns, city, bio, photo)
   Step 2: Practice (disciplines, experience level)
   Step 3: Audience (portfolio URL, audience types, client base)
   Step 4: Goals (what they seek, what they offer, mutual aid)
   Step 5: Your View (personal philosophy, aesthetic keywords)
   Step 6: Needs (what they need from the collective)
   Step 7: Features (what platform features they want)
   Step 8: Template choice (article / event / radio / business)

4. Org is created with their slug
   → user_organizations updated to 'owner' role
   → Silex token minted
   → Silex editor opens with Artist Profile template

5. Artist designs their page in Silex
   → publishes to Nextcloud
   → page live at /sites/{slug}

6. Appears in artist directory (/artists)
   → profile card with name, city, disciplines, bio excerpt
   → "Visit site" button
```

**Gap:** The artists page (`/artists`) currently JOINs `artist_profiles ON ap.org_id = o.id`. With stub profiles all having `org_id='elkdonis'`, the directory would show everyone under the `elkdonis` org, not under their personal org slug. The query needs updating: join on `ap.user_id` → find their personal org slug separately.

### Flow C: Institutional Partner (IFAC model)
```
1. IFAC or similar partner approached by EAC
2. Admin creates org manually: INSERT INTO organizations
3. IFAC staff sign up → get user_organizations role='guide' in ifac org
4. They use ifac app (3008): gallery, RSVP, admin dashboard, auction prep
5. commerce + checkout packages provide standardized purchase flow
6. Revenue share tracked; flows to EAC mutual aid fund
```

**IFAC status:** App exists (port 3008). Gallery page, admin dashboard, RSVP form. Auth via 3-tier check (email / superadmin / org role). Commerce package has `BidWidget`, `AuctionStatusBadge`, `BuyNowButton`, `ArtworkCard`. Not yet integrated end-to-end for auction.

### Flow D: The Workshop (any org)
```
1. Guide creates workshop in hub or inner-gathering
   → threads table row, kind='workshop'
   → workshop_details sidecar row (subtitle, discipline, pricing, etc.)
   → workshop_sessions rows (individual session schedule)

2. Workshop appears:
   → in inner-gathering feed (if inner_group org)
   → in hub workshop management panel
   → as <eac-embed data-eac-component="workshop-cards"> on custom site

3. Participant RSVPs:
   → thread_rsvps row (auth'd) OR rsvp_responses row (guest, no login)
   → SendGrid RSVP confirmation email to guest
   → SendGrid RSVP notification email to owner

4. Workshop console (NOT YET BUILT):
   → session-by-session module layout
   → course materials, links, recordings, notes
   → participant roster, attendance tracking
   → Nextcloud folder auto-created per workshop
```

---

## 6. Technical Stack — What's Built vs. What's Needed

### Built and Working
| Feature | Location | Notes |
|---------|----------|-------|
| Auth / SSO | `@elkdonis/auth-server` | Supabase GoTrue, cookie-domain SSO prod |
| Multi-tenant DB | `@elkdonis/db`, migrations 001-044 | 44 migrations, unified threads schema |
| Inner-gathering feed | `apps/inner-gathering` | Real-time, polls, meetings, calendar |
| Silex publish pipeline | `apps/arts-collective` + connector | Nextcloud → Next.js render |
| Live-editor inline | `packages/live-editor` | data-trait pins, CSS vars |
| EAC block library | `silex-nextcloud-connector` | 5 categories, workshop + artist templates |
| Email via SendGrid | `packages/email` | RSVP, contact, order, welcome |
| Auto-signup provisioning | `packages/auth-server` | Nextcloud + org membership + stub profile |
| Commerce primitives | `packages/commerce`, `packages/checkout` | BidWidget, CheckoutForm, CartSummary |
| Nextcloud integration | `packages/nextcloud`, `packages/services` | Files, Talk, Calendar, provisioning |
| Blog apps | `blog-sunjay`, `blog-guru-dharam` | Working, `@elkdonis/blog-*` packages |
| Amrit Canada sections | `apps/amrit-canada` | Sadhana/yoga/gurdwara sections with RSVP |
| Reading circles | migration 043 | Full schema for `fourth-way-book-readers` |
| CMS bindings | `packages/cms-bindings` | WorkshopPageData, field registry, render |

### Built but Incomplete
| Feature | Gap |
|---------|-----|
| Artist profile edit | Wizard = entry only. No edit form. Stub profiles not surfaced in inner-gathering. |
| Artists directory | JOIN is org-centric; breaks with multiple users in same org. |
| Commerce integration | Packages built, not wired to any live checkout flow end-to-end. |
| IFAC auction | `art-auction` app exists (3009), BidWidget exists, no DB auction tables yet. |
| Tier membership | `user_organizations.role` exists, no tier UI, no gating logic. |
| Workshop console | Thread+sessions schema exists, no module/course layout UI. |
| arts-collective public site | `elkdonis-arts-collective` (3005) has no signup CTA — just contact form and manifesto. |

### Not Yet Built
| Feature | Priority |
|---------|----------|
| Profile edit form in inner-gathering | **HIGH — blocks soft launch** |
| Signup CTA on public landing (3005) | **HIGH — blocks soft launch** |
| Workshop console (course modules) | MEDIUM — needed for partner use |
| Offboarding flow | LOW — needed pre-production |
| Tier gating (block library tiers) | LOW — nice to have |
| OpenClaw / AI layer | LOW — strategic, not urgent |
| API console (developer portal) | LOW — future tier |

---

## 7. The Workshop Console — Vision for What Doesn't Exist Yet

Every other platform has some version of this. Teachable calls it a "course page." Notion calls it a "wiki." You're describing something in between: a structured course outline with session modules, where each module has materials, a recording slot, a discussion thread, and attendance.

**The data model is already there:** `threads` (kind='workshop') + `workshop_details` + `workshop_sessions`. What's missing is the UI.

**Vision:**
```
/workshops/{orgSlug}/{workshopId}
  ├── Hero: cover image, title, facilitator, date range, price
  ├── Session list (accordion or vertical timeline):
  │     Session 1: [title] [date] [duration]
  │       → Materials: [Nextcloud files]
  │       → Recording: [video_url]
  │       → Notes: [body field]
  │       → Discussion: [replies thread]
  ├── Participant roster (admin only)
  ├── RSVP / Register button (if open)
  └── Related workshops
```

This is the "individual workshop console" you described. It's one new page in either `inner-gathering` or `arts-collective`, consuming data already in the DB. Probably a 2-3 day build.

**GrapeJS angle:** The public-facing version (the flyer/landing page) is already in Silex. The console is the *internal* view — after someone RSVPs. Keep Silex for the marketing page, build the console in React.

---

## 8. Commerce and the Checkout Standard

The ambition is a single checkout flow covering: workshops, events, art sales, auctions, donations. The packages exist:

- `packages/commerce`: `ArtworkCard`, `BidWidget`, `AuctionStatusBadge`, `BuyNowButton`, `CountdownTimer`, `PriceBlock`
- `packages/checkout`: `CheckoutForm`, `CartSummary`, `CartLineItem`, `PaymentInstructionsCard`
- `packages/payments`: (exists, not fully explored)
- `packages/commerce/src/etransfer/`: e-Transfer support (Canadian-specific, smart)

**What's missing:** A complete purchase flow wired to Stripe (or e-Transfer) with order creation, confirmation email, and the revenue split back to EAC. Migration 042 adds commerce/auction DB tables — the schema is there.

**The revenue share model:** Partners give EAC 5-10% of platform-facilitated transactions. This requires tracking which transactions happened through EAC infrastructure. The order tables in migration 042 presumably have an `org_id` + EAC fee column. This is the commercial core of the NFP's sustainability.

---

## 9. The Artist Incubator Model — What You're Actually Building

Strip away the technical complexity and the core service is:

> "We give you a professional digital presence, an audience network, a payment processor, and a community — and we teach you enough business literacy to run yourself. When you outgrow us, we help you leave cleanly."

This is rare. Most platforms (Patreon, Squarespace, Teachable) have strong onboarding but no offboarding. They're designed to retain. EAC's model of building in an exit process is genuinely unusual and maps to the Fourth Way philosophy of non-attachment.

**Practical offboarding would mean:**
- Export of all their Silex-published pages (already in Nextcloud — they own the files)
- Export of their member list / RSVP data
- Redirect instructions for their custom domain
- Transition period where EAC embeds still work on their new host

This isn't built yet, but the architecture makes it easy because **Nextcloud is the file store they already own.** The artist's published HTML and assets are in their Nextcloud folder, not locked in EAC's database. This is the sovereignty advantage.

---

## 10. Outside Comparisons and Honest Critique

### Comparisons

**Are.na** — Social network for visual thinkers, blocks-based, minimal. 80,000 users. No commerce, no workshops, no scheduling. Extreme simplicity. You're building 10x more, targeting 10x fewer people initially. Risk: they found PMF by being radically small. Lesson: the minimal viable version of EAC might just be inner-gathering + one Silex template + Stripe.

**The Creative Independent** — Editorial platform for artist interviews. No user accounts, pure content. 200,000 monthly readers. They do one thing beautifully. Lesson: don't underestimate the power of a publication.

**Mighty Networks** — Community + courses + membership. $33-$99/month. No self-hosting. No file sovereignty. Used by 8,000+ communities. Their course module (what you're calling the workshop console) is mature. Worth studying their UX. Lesson: the course/module UI is a known, solved pattern — don't over-engineer it.

**Squarespace for Artists** — EAC's custom site offering competes with this for ease of use. Squarespace wins on polish, you win on community integration, sovereignty, and etransfer support. Lesson: the embedding story ("embed your Elkdonis event calendar into any existing site") is an underused differentiator.

**Hylo** — Open-source community platform for regenerative organizations. Similar ethos to EAC. Lesson: there is an audience for values-aligned infrastructure. They've found it. Study their onboarding.

**CoopCycle** — Worker co-op delivery network with shared software. The structural precedent for what you're doing: a shared platform owned and governed by its users. Lesson: the governance model needs to be as well-designed as the software.

### Honest Critiques

**1. Stack complexity vs. team size.** You have 44 migrations, 12+ apps, 20+ packages, and a stack that requires Postgres + Redis + Supabase + Nextcloud + Silex + Docker Compose all running to develop. For a 6-person founding team of artists who are also the clients, this is an enormous operational burden. The answer is not to simplify the stack — it's already built — but to document the runbook ruthlessly and consider a managed Postgres/Redis layer before production.

**2. The two arts-collective apps are confusing.** `elkdonis-arts-collective` (3005) is the public NFP site. `arts-collective` (3007) is the member hub. These serve completely different audiences and purposes but have similar names and live in the same repo. Rename `arts-collective` to `member-hub` or `eac-hub` in docker-compose to reduce cognitive load.

**3. The wizard is the wrong first impression.** The 8-step artist onboarding wizard is comprehensive and well-built, but it asks a lot of someone who just signed up to see what the platform does. Consider a "quick profile" path (3 fields: name, city, what you make) that unlocks the community, with the full wizard available as "go deeper."

**4. Inner-gathering and the hub have overlapping workshop creation.** Both can create workshops. The data model is the same (`threads` table). But the UIs are different and there's no clear "this workshop was created in inner-gathering, let me publish it to my public site" button. The thread should flow naturally: create in inner-gathering → promote to public site via hub. That flow doesn't exist yet.

**5. Silex is powerful but high-friction for non-technical artists.** GrapeJS is genuinely great. But the experience of "here's a visual editor that talks to your Nextcloud" may be too much for a ceramicist or a yoga teacher. The live-editor inline editing solves the day-to-day case. Consider making Silex opt-in rather than the default, with a curated set of "locked templates" that members can populate via live-editor alone.

**6. Commerce is the critical path.** Everything else can grow slowly. Revenue share only works if there are transactions. IFAC's auction is the first real test. Prioritize getting one complete purchase → confirmation email → EAC fee extraction flow working before anything else in the commerce layer. One working transaction beats fifty half-built components.

**7. The Fourth Way philosophy is both asset and risk.** It gives EAC a genuine center of gravity and a reason to exist beyond "another arts platform." It will also be invisible to most potential members unless surfaced well. The `elkdonis-arts-collective` manifesto page is doing this work. Make sure every new member encounter has one moment of "oh, there's something real here" — whether that's the welcome email tone, the inner-gathering welcome popup, or the hub's copy.

---

## 11. What "Artist Profile Reaches Inner-Gathering" Actually Means

Right now, when a member signs up:
- `users` table: `display_name`, `bio`, `avatar_url`, `comment_color` — editable in inner-gathering `/account`
- `artist_profiles` table: `stub` row with name, org_id='elkdonis', `is_stub=true` — **not visible anywhere in inner-gathering**

These are two separate data models serving two different purposes:
- `users` = your identity everywhere in the network (how others see you in comments, meetings, etc.)
- `artist_profiles` = your public artist corner (how the directory sees you, what the Silex page renders)

**The connection that needs to be made:**
When a new member fills in their inner-gathering account page, the `display_name` and `bio` they set on `users` should also sync to `artist_profiles.display_name` and populate a few more fields. Or: add an "Artist Profile" section to the inner-gathering account page that edits `artist_profiles` directly.

The second approach is cleaner because it keeps the data models distinct and makes the artist profile feel like a deliberate choice ("yes, I want to be in the directory") rather than an automatic mirror.

**Recommended addition to inner-gathering `/account` page:**
```
[Basic Info section — existing, edits users table]
  Display name, Bio, Avatar, Comment color

[Artist Directory section — NEW, edits artist_profiles]
  "Your entry in the public artist directory"
  City, Disciplines (multi-select tags), Portfolio URL
  [Save to directory] button
  → PATCH /api/profile → upserts artist_profiles, sets is_stub=false
```

---

## 12. Dated Next Steps (The 90-Day Roadmap)

### Week 1 (by May 28, 2026) — Soft Launch Readiness
- [ ] Add artist_profiles PATCH endpoint `/api/profile` in inner-gathering
- [ ] Add "Artist Directory" section to inner-gathering account page (city, disciplines, portfolio)
- [ ] Update `/artists` directory query to JOIN on `user_id` not `org_id`
- [ ] Add signup CTA on `elkdonis-arts-collective` (3005) public landing
- [ ] Verify welcome emails firing in production (check SendGrid dashboard)
- [ ] Smoke test: sign up → org memberships → stub profile → welcome email

### Weeks 2-3 (by June 11, 2026) — Workshop Console Alpha
- [ ] New page: `/workshops/[orgSlug]/[workshopId]` in arts-collective or inner-gathering
- [ ] Session list (accordion), materials slot (Nextcloud links), recording slot (video_url)
- [ ] Replies thread per session (already in schema)
- [ ] Participant roster (admin only, queries thread_rsvps)

### Month 2 (June 2026) — Commerce First Transaction
- [ ] Wire checkout package to one real product (IFAC artwork or EAC workshop)
- [ ] Stripe integration in payments package (or e-Transfer flow for CA)
- [ ] Order confirmation email (template exists in `order-invoice.tsx`)
- [ ] Revenue split recorded in DB

### Month 3 (July 2026) — Public Artist Directory
- [ ] Fix artists directory JOIN (user_id based)
- [ ] Filter: show only `is_stub=false` profiles
- [ ] Add profile completion prompt in inner-gathering for stub users
- [ ] Artist profile public page at `/sites/[slug]` for all registered artists (even without Silex)
- [ ] Simple default template (CSS only, no Silex needed) that renders from artist_profiles data

### Ongoing
- [ ] Grow Silex block library (one new section template per month)
- [ ] Workshop console iteration based on actual usage
- [ ] IFAC auction flow (commerce + art-auction app)
- [ ] Offboarding document: write the spec before any partner needs it

---

## 13. The Strategic Core (What to Say to Anyone Who Asks)

**To a potential member:** "We give you a professional presence, an event calendar, a checkout, and a community — self-hosted, owned by artists, no corporate middleman. You pay a small share of what you earn through the platform. Everything else is yours."

**To a grant committee:** "Elkdonis Arts Collective is building the digital infrastructure layer that small arts organizations currently lack access to. We're a nonprofit that builds and maintains this infrastructure collectively, using a revenue-sharing model that keeps resources circulating within the artist community rather than extracting them."

**To a developer:** "Multi-tenant Next.js 15 monorepo, Supabase auth, Postgres, Nextcloud for file sovereignty, GrapeJS/Silex for visual editing. 44 migrations, 12 apps, 20+ packages. All Docker, self-hosted. The block library maps to the membership tier model."

**To a skeptic:** "You're right that it's complex. We built it complex because our needs are complex. We have a real community, real workshops, real transactions. Every feature exists because someone needed it."

---

*This document reflects the state of the system as of May 21, 2026. Update after each major milestone.*
