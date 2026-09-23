# Debrief — org presence, the three-page subdomain, and the workshop workspace

**2026-09-05 → 2026-09-06.** Written as the note accompanying the large commit
that closes this work. Structured as *verified / assumed / unknown* at the end,
following `DEBRIEF_2026-09-01_workshop_wizard.md`'s precedent.

## What this was

arts-collective became the network's main site at the newly bought
**arts-collective.com**, and every org got real presence on it: a hub keyed to
that org, a three-page public subdomain, and — for workshops — a private
workspace behind an enrolment gate.

## The three bugs worth remembering

**1. An arbitrary member was being rendered as the organisation.**
`getOrgBySlug` did `SELECT * FROM artist_profiles WHERE org_id = X LIMIT 1`.
`artist_profiles`' primary key is `(user_id)` — it is one row per *person*,
merely tagged with an org — so that query returned whichever member Postgres
felt like, and the org's public subdomain rendered their photo, city and bio as
the organisation's own. On `elkdonis` (10 such rows, no `ORDER BY`) the answer
was nondeterministic. Fixed by migration 099: every org now has its own `users`
row (`entity_type='organization'`), seeded from `organizations.name`/
`description` — deliberately *not* from `artist_profiles`, since that bio
belongs to a member.

**2. The network roster was showing 3 people instead of 22.**
`getMemberRoster` also read `artist_profiles` (3 non-stub rows) while ArtDirect
read `users` (22 with slugs). That one function feeds `/artists`, two hub
rosters *and* the public newsroom landing page, so the platform's front door
advertised a near-empty network. Now reads `users`, filtered to
`entity_type='person'` so orgs don't appear as their own members.

**3. A free RSVP admitted you to a paid workshop.**
Found by a security review of this session's own new code, and the reason that
review was worth running. `upsertWorkshopOffering` sets `is_rsvp_enabled = TRUE`
on *every* workshop including paid ones, and `isEnrolledInWorkshop` counts an
RSVP of `'yes'` as enrolment. So any signed-in person could POST a workshop's
thread id to `/api/threads/[id]/rsvp` and receive the gated workspace, the
materials download, and a real Nextcloud share — for free, in any org.
inner-gathering had always avoided this by writing a `'maybe'` shell for paid
joins and honouring only `workshop_join_requests.status='paid'`.
`/api/threads/[id]/rsvp` now refuses a priced workshop with 402.

## What shipped

- **Domains and tiers as data.** ifac + inner_group `partner`, amrit_canada +
  hidden-enneagram `supported`; 9 `org_domains` rows (the table was empty).
  `elkdonis-arts.org` belongs to **inner_group**, not the platform.
- **Network host is env-driven** (`NEXT_PUBLIC_NETWORK_HOST`), replacing the
  placeholder `artscollective.com` that never had DNS, and 11 hardcoded
  `{slug}.localhost:3007` links.
- **The subdomain is never a redirect.** Every org has one whatever its tier;
  an org with its own domain gets a condensed view plus a link out. There is no
  copying — one database, so the subdomain and the org's own site render the
  same live rows at different depth.
- **Three pages**: `/offering` (the one featured thread as a full page —
  pinned, else most recent, because nothing was pinned anywhere), `/profile`
  (org identity, follow, upcoming), `/community` (network newsroom; replaced an
  850-line private duplicate of the shared template).
- **Workshop workspace** at `/workshop/<slug>`, fully gated, with session tabs,
  materials, and the Talk room. Layout mirrors inner-gathering's so a
  participant meets the same workshop in both apps; only the data layer is
  shared, because that app is Mantine and this one is not.
- **One hub per org.** The Organization tab is keyed on membership with a
  switcher; its "Website editor" section used to list every org the viewer
  could edit, which made the page read as a personal dashboard. Now scoped to
  the selected org, with direct links to its three pages.
- **Org identity editor** — migration 099 created the storage and
  `canEditOrgIdentity` the authority, but nothing wrote until now.
- **`org_followers` got its first caller** since it was written.
- `docs/news-aggregation-groundwork.md` — researched design, nothing built.

## Still open

- **`artist_profiles` is not dead.** arts-collective's signup wizard and
  `lib/profile.ts` (the Elkdonis tab's "profile complete?" logic) still write
  and read it, as does inner-gathering's `/api/profile`. The org-identity and
  roster reads are off it; those three are not.
- **Paid workshops have no join path at all** now that RSVP correctly refuses
  them. `workshop_join_requests.status` has still never reached `'paid'`
  anywhere and Stripe is unbuilt.
- **Org field/discipline has no home.** Location now does (on the org's
  identity row), which is what a per-org "what's on near us" view needs; the
  field half does not, and `docs/news-aggregation-groundwork.md` names it as
  the prerequisite.
- **Nextcloud per-user app passwords are fake.** `generateAppPassword()`
  returns the account password it just set; the account tested returned 401.
  `/api/silex/layout` was 502ing because of it and now uses the service
  account. `/api/silex/token` still depends on user credentials — Silex itself
  needs them — so it will keep failing for users whose stored password is
  stale.
- **Two low-severity items from the security review**, left as noted rather
  than fixed: `silex/layout` runs admin against legacy personal-account paths
  for orgs whose `nextcloud_folder_path` predates `EAC_Network/` (not
  attacker-steerable), and `x-org-domain` is client-spoofable but only affects
  which "visit our main site" link renders.
- **`@elkdonis/services` has 14 typecheck errors**, all pre-existing `lib: dom`
  gaps in `packages/nextcloud/src/components/*` and `packages/utils/sanitize*`.
  The three apps are at zero.
- **DNS/proxy is owed**: `arts-collective.com` → 3007 and
  `artdirect.arts-collective.com` → 3013, plus Google OAuth origins, plus a
  `supabase-auth` restart for the new redirect URLs. Until then those links
  point at hosts that don't resolve. A **wildcard** `*.arts-collective.com`
  record would make free-tier subdomain onboarding fully hands-off.

## Verified / assumed / unknown

**Verified** (exercised against the running stack): migration 099 applied, all
14 orgs linked; the roster going 3 → "22 & growing"; all three subdomain pages
for several orgs; the Silex org's root still rendering Silex; `/sites/*`
link-out behaviour including the arrived-on-own-domain case; RSVP and follow
round-trips with their 401s; the workshop gate refusing anonymous and
non-enrolled and admitting after joining; materials 401/404 and traversal
rejection; the paid-workshop RSVP refusal (402) and the free one still working;
the silex 502 becoming a meaningful 404; the org toolkit grid and one-org hub;
`/api/org/create` now creating an identity row.

**Assumed, not exercised**: the org identity *form* — the data path
(`updateProfile` → `/profile`) was verified, but not a literal browser
submission of the client form. The reserved-thread-slug guard is
compile-verified only; the identical `ensureUniqueUserSlug` path was proven
behaviourally.

**Unknown**: anything requiring a real browser. This host is a locked-down
TrueNAS appliance — `apt` is disabled and there is no sudo, so headless
Chromium cannot run and every check above was made at the HTTP and database
layer. Visual regressions, client-side JS errors, and drag-and-drop behaviour
(the pipeline board, the profile gallery) are unverified by this session.
