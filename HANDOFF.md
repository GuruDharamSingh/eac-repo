# EAC Monorepo — Agent Handoff

**Date:** 2026-05-21  
**Context:** Soft-launch prep session. Summary of all work completed and what still needs doing.

---

## What Was Completed This Session

### 1. Signup auto-provisioning (`packages/auth-server`)

Every new user who signs up now gets, in a single flow:
- `user_organizations` rows for both `elkdonis` and `inner_group` (member role)
- A stub `artist_profiles` row (`is_stub = true`, display_name from signup)
- A welcome email via SendGrid (`packages/email/src/templates/welcome.tsx`)

Relevant files:
- `packages/auth-server/src/api-routes.ts` — post-signup blocks, look for `Block 1` and `Block 2` comments
- `packages/auth-server/tsup.config.ts` — `@elkdonis/email` added to `external`
- `packages/email/src/index.ts` — `sendWelcomeEmail()` export

### 2. Migration 044 — `artist_profiles` multi-user fix

`packages/db/migrations/044_member_signup_defaults.sql`

- Dropped UNIQUE index on `artist_profiles(org_id)` (was preventing multiple users in the same org)
- Added `is_stub BOOLEAN NOT NULL DEFAULT true` column
- **Applied** ✓

### 3. Migration 045 — `site_config` table

`packages/db/migrations/045_site_config.sql`

- Creates `site_config (org_id, key, value JSONB)` with composite PK
- Seeds defaults for `fundraising`, `featured_artist`, `initiative` for `org_id = 'elkdonis'`
- **Applied** ✓

### 4. Artists directory query fix (`apps/arts-collective`)

`apps/arts-collective/src/app/artists/page.tsx`

Old JOIN `ON ap.org_id = o.id` was broken after multi-user per org. Fixed with LATERAL subquery on `user_id` to find each artist's personal org slug. Now only shows profiles where `is_stub = false`.

### 5. inner-gathering artist profile editor

- **New API:** `apps/inner-gathering/src/app/api/profile/route.ts`  
  GET returns artist_profiles row for authenticated user.  
  PATCH upserts the row, sets `is_stub = false`, mirrors display_name to users table.

- **Account page updated:** `apps/inner-gathering/src/app/account/page.tsx`  
  Added "Artist Directory" Paper section: Listed/Stub badge, city, disciplines MultiSelect (15 options), portfolio URL, Save button.

### 6. `elkdonis-arts-collective` (port 3005) — auth routes

`apps/elkdonis-arts-collective/src/app/api/auth/`
- `signup/route.ts`, `login/route.ts`, `logout/route.ts`, `session/route.ts`

All delegate to `@elkdonis/auth-server` (same pattern as all other apps).  
`@elkdonis/auth-server` added to `apps/elkdonis-arts-collective/package.json`.

### 7. `elkdonis-arts-collective` — admin panel

- **API:** `apps/elkdonis-arts-collective/src/app/api/admin/site-config/route.ts`  
  GET (public): returns single config key if `?key=` param is a known public key  
  GET (admin): returns all keys (requires admin auth)  
  PATCH: upserts a config key (admin only)  
  Admin check: `EAC_ADMIN_EMAILS` env var (comma-separated) or `users.is_admin = true`

- **UI:** `apps/elkdonis-arts-collective/src/app/admin/page.tsx`  
  Three editable sections: Fundraising (with progress bar preview), Featured Artist, Current Initiative.  
  Access at `http://localhost:3005/admin`

### 8. `elkdonis-arts-collective` — data-driven landing sections

All three landing sections now fetch live config on mount:

| Component | Endpoint | Fallback |
|-----------|----------|---------|
| `FundraisingGoal.tsx` | `?key=fundraising` | Linktree URL, "Support Our Work" |
| `FeaturedGrantProgram.tsx` | `?key=featured_artist` | Dana McCool / danamccool.jpg |
| `FeatureInitiative.tsx` | `?key=initiative` | Existing static text |

`FundraisingGoal` also renders a live progress bar when `raised > 0`.

### 9. `JoinSection` component

`apps/elkdonis-arts-collective/src/components/JoinSection.tsx`

- Create Account / Sign In tab toggle
- Matches the site's dark gold aesthetic (`contact-form` / `form-input` CSS classes)
- On signup success: shows "Welcome to the Collective" confirmation  
- On login success: shows "Signed in" + link to inner-gathering (localhost:3004)
- Inserted into `page.tsx` between `<Philosophy />` and `<ContactForm />`

---

## Environment Variables Needed

| Var | Where | Purpose |
|-----|-------|---------|
| `SENDGRID_API_KEY` | `.env` | Welcome emails — confirmed present |
| `EMAIL_FROM` | `.env` | `info@em6860.elkdonis-arts.org` — confirmed present |
| `EAC_ADMIN_EMAILS` | `.env` or container env | Comma-separated admin emails for `/admin` page. Falls back to `ADMIN_EMAIL`. |

---

## What Still Needs Doing

### High priority (before soft launch)

1. **Verify container rebuild** — `elkdonis-arts-collective` was rebuilt in this session. If it shows build errors, the most likely cause is pnpm not resolving `@elkdonis/auth-server` workspace symlink inside Docker. Check: `docker compose logs elkdonis-arts-collective`

2. **Inner-gathering link in JoinSection** — `JoinSection.tsx` has the inner-gathering URL hardcoded as `http://localhost:3004`. Before production, replace with the real domain (`NEXT_PUBLIC_INNER_GATHERING_URL` env var).

3. **Test the full signup flow:**
   - Sign up via `/` on port 3005
   - Verify welcome email arrives (check SendGrid activity feed)
   - Sign in to inner-gathering (port 3004), go to `/account`
   - Confirm "Artist Directory" section shows Stub badge
   - Fill in city/disciplines, click Save → badge should change to Listed
   - Verify profile appears on arts-collective artists page (port 3007)

4. **Set `EAC_ADMIN_EMAILS`** in `.env` or in the `elkdonis-arts-collective` service's `environment:` block in `docker-compose.yml`, then test `/admin` at port 3005.

### Medium priority

5. **Workshop console** — No individual workshop detail page exists yet. The intended path is `/workshops/[orgSlug]/[workshopId]` in the arts-collective hub (port 3007), with session list, materials, recordings, and discussion thread. This is the next big build after soft launch.

6. **Artist profile wizard** — There's a wizard in arts-collective (port 3007) but it's incomplete. The new `/api/profile` endpoint in inner-gathering can be the backend; the wizard flow should set `is_stub = false` when the artist submits.

7. **Admin page nav link** — The `/admin` page at 3005 works but has no navigation link. Add a hidden link in `SiteNav` (visible only to logged-in admins) or use the URL directly for now.

---

## Key Architecture Reminders

- **Two "arts" apps exist:**
  - `elkdonis-arts-collective` (port 3005) — public NFP landing page
  - `arts-collective` / `eac-arts-network` (port 3007) — member hub (Silex, artist profiles, workshop portal)

- **`is_stub` controls directory visibility:** Only `artist_profiles` rows where `is_stub = false` appear on the public artists page. Every new signup creates a stub row automatically; it becomes a real listing when the artist saves their profile in inner-gathering or the wizard.

- **Docker only** — never `pnpm dev` in this repo. All changes take effect after `docker compose up -d --build <service>`.

- **Migration runner** — `docker compose exec admin pnpm --filter @elkdonis/db db:migrate`. Migrations are transactional; partial failures roll back.

---

## Reference Files

- Full platform synthesis: `eac-repo/EAC_SYSTEM_SYNTHESIS.md`
- Auth client/server pattern: `packages/auth-server/src/api-routes.ts`, `packages/auth-client/src/hooks.ts`
- DB queries pattern: always filter by `org_id`; see `CLAUDE.md` for examples
