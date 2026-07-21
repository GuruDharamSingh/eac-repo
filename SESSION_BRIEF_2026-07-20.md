# Session Brief — 2026-07-20

Handoff doc for the next agent session. Covers: (1) what changed this session, (2) a UI map of `inner-gathering` (port 3004), (3) how it connects to Nextcloud. **Nothing in this session has been committed to git yet** — see the file list at the bottom.

---

## 1. What happened this session (chronological themes)

### Org restructuring
Split the four core early members out of the shared `inner_group` placeholder org into their own orgs, so each can run workshops under their own identity while `inner_group`/3004 stays the aggregated feed + NFP landing page:

| Member | Org |
|---|---|
| Dana McCool | `surrealistwriting` |
| Jason Ford ("fnordj") | `stonebalancing` |
| Stephan Wrede | `saw` |
| Guru Dharam Singh | `amrit_canada` (pre-existing, now his) |

All four keep `inner_group` membership too. Migration: `packages/db/migrations/067_personal_member_orgs.sql`. Each org got a Nextcloud folder tree + a public (type 3, guest-joinable) Talk room.

### Nextcloud provisioning — the big architectural finding
**Admin-API-initiated Nextcloud user creation is structurally blocked, confirmed 3 independent ways** (CLI-minted app password, forcing the token's scope, a genuine browser-confirmed Login Flow v2 credential — all rejected with 403 "Password confirmation is required"). Nextcloud's `PasswordConfirmationMiddleware` only recognizes a live, real-time browser session — no API credential, however obtained, satisfies it. This is deliberate Nextcloud hardening, not a bug. `occ` (server CLI) is the only sanctioned bypass, and it's unreachable from our app containers (Docker isolates `eac-admin`/`eac-inner-gathering` from `nextcloud-aio-nextcloud`'s filesystem/process namespace).

**The working solution: self-service SSO provisioning.**
- `apps/inner-gathering/src/app/api/nextcloud/connect/route.ts` — lets a logged-in member trigger the Elkdonis SSO bridge on demand. Nextcloud creates the account itself during that live login (not gated, since it's the user's own session). Resulting username is `elkdonis-<our-user-uuid>` (not human-readable, functional).
- Account's email gets set automatically too — Nextcloud's `ProviderService::login()` calls `setSystemEMailAddress()` from our `/api/oidc/userinfo` response as a plain internal call, not through the gated API.
- `apps/inner-gathering/src/app/api/oidc/authorize/route.ts` records `nextcloud_synced`/`nextcloud_user_id` the moment this flow completes — never overwrites an already-linked account.
- **Gated on email confirmation** (see below) — the connect route 403s with a redirect to `/account?error=email_not_confirmed` until the user's email is confirmed. Both signup paths auto-trigger this connect flow once confirmed (password path: on clicking the emailed confirm link; Google path: immediately, since Google already verifies email).
- Existing manually-created NC accounts get **linked by email** instead of duplicated — `packages/nextcloud/src/users.ts`'s `provisionUser()` now checks for an existing NC account by email before creating a new one. Dana/Jason/Stephan/Justin's pre-existing manual NC accounts (`dana`, `jason`, `stephan`, `Justin`) are linked this way, both in our DB and in Nextcloud's own `sociallogin_connect` table.
- `eac_intergration` is the shared Nextcloud service/automation account (subadmin of `EAC_Network` + `Elkdonis Arts Collective` groups, not full admin). Its email was found misconfigured to a real person's address (Guru Dharam's) — left as-is per explicit decision, but flagged: don't link any real user's Google login to this account.

### Signup / email confirmation flow (new)
- Password signup: account is usable immediately (per explicit product decision — email confirmation does **not** gate app access). A real GoTrue confirmation link (via `supabase.auth.admin.generateLink`) goes out in the welcome email; clicking it confirms the email **and** silently opens the Nextcloud connect flow in a background tab, landing on `/feed?nc_connect=1`.
- Google signup: was found to have 3 real gaps (no landing-page fix, no welcome email, no org/profile creation) — all fixed in `handleOAuthCallback` (`packages/auth-server/src/api-routes.ts`), mirroring what the password path already does. Google's own email verification means no confirm-gate is needed there.
- **`SENDGRID_API_KEY` was a placeholder value the entire time** (`your-sendgrid-api-key`) — this is why the "[Signup] Welcome email error: Error: Unauthorized" log line kept appearing. A real key was provided and wired in this session; verified working with a live test send.
- Old dead code removed: `handleSignup`'s previous `NEXTCLOUD_AUTO_PROVISION`-gated auto-provision attempt (called the same blocked API path, was already disabled) is deleted, not just disabled.

### Talk room fixes
- Unsynced members **and fully logged-out visitors** now join Talk rooms as guests instead of hitting a login wall or an error page — `apps/inner-gathering/src/app/api/talk/join/route.ts` and the `arts-collective` equivalent.
- Fixed a stale `meetings.elkdonis-arts.org` subdomain baked into the Nextcloud SSO provider config and `.env` — replaced with the real domain `elkdonis-arts.org` everywhere.
- Fixed the "already logged in" dead-end when joining Talk from an existing NC session — routes through Nextcloud's `/login?redirect_url=...` instead of hitting `sociallogin` directly.
- The four new org-level Talk rooms were created as type 2 (private) by default via `packages/nextcloud/src/org-provisioning.ts` — manually flipped to type 3 (public) for the four; **the provisioning script itself still defaults to type 2**, so any future org needs the same manual fix (`POST .../room/{token}/public`) unless the script gets updated.

### Workshop suite
- **Real bug, fixed & verified**: `POST /api/workshops` hardcoded `visibility: 'ORGANIZATION'` instead of `'PUBLIC'` — the feed only shows `PUBLIC` content, so every workshop created via the dedicated Workshop editor (`/workshops/create`) was invisible in the feed regardless of publish status. Also fixed an ID-format inconsistency (bare `nanoid()` → `th_${nanoid(18)}`, matching the rest of the app's convention).
- `/offerings` ("My Offerings") page built — author's dashboard listing their own threads with RSVP counts, payment state, readiness indicators.
- Per-publication RSVP confirmation email — author can customize the email sent on RSVP; persists as a thread-scoped `email_template_settings` row.
- `workshop-owner-editor.tsx`, `workshop-materials.tsx`, banner/hero media slots (migration 068), reminder email scheduler (migration 069, `instrumentation.ts` ticks every 5 min).
- **Not yet built**: Stripe checkout (still an eTransfer-intent placeholder via `workshop_join_requests`), materials-folder auto-share on RSVP/payment confirmation.

### UI fixes
- **Real, codebase-wide bug**: the Mantine color `"ember"` was referenced in 15+ components (badges, buttons, avatars) but never actually registered in the theme (`apps/inner-gathering/src/app/(app)/layout.tsx`) — only `eacSky`, `mutedGold`, `archive`, `moss`, `oxblood` existed. This made things like the welcome-popup's Next/Back buttons effectively invisible. Fixed by registering `ember` as an alias of the existing `mutedGold` ramp (whose `[7]` shade already matched the orphaned `--ig-ember` CSS variable in `globals.css` — clearly the original intent).
- "Join Talk Room" elevated to primary-action prominence on feed cards, added (previously entirely absent) to featured mini-cards and the meeting detail page. Same treatment for the "living document" (`documentUrl`) field. Workshops don't have a document field in their data model at all yet — noted as a gap, not built.
- New shared component `SingleImageField` (`packages/ui/src/components/SingleImageField.tsx`) — upload **and** "choose from library" (browses the org's Nextcloud folder via the existing `FileBrowser`) in one field, replacing raw URL text inputs. Wired into the general create-content form (workshop flyer), the dedicated Workshop editor (cover image), and the workshop owner editor (banner/hero/thumbnail) — replacing a partial local duplicate (`MediaSlotField`) that had upload but no library option.
- Added a "Help" nav item that reopens the welcome-tour popup on demand (`?welcome=1`).

### Other fixes
- `packages/db/migrations/068_workshop_media_slots.sql`, `069_workshop_reminders.sql` — banner/hero image columns on `workshop_pages`, reminder scheduling ledger on `threads`.
- `apps/admin` (port 3000) was missing `NEXTCLOUD_ADMIN_USER`/`PASSWORD`/`DEFAULT_GROUP` in `docker-compose.yml` entirely — added, fixing the Nextcloud Users tab 500 error.
- Editing a published workshop no longer silently reverts its `kind` to "post" (was a real data-loss bug — could wipe `workshop_details`/sessions on save).

---

## 2. UI map — `apps/inner-gathering` (port 3004)

Two route groups, sharing nothing in layout:

### `(marketing)` — public landing, dark theme, no app nav
- `/` — landing page
- `/about`, `/manifest`, `/manifesto`, `/workshops-eac`

### `(app)` — the actual product, light theme, `TopNav` + `WelcomePopup` mounted globally via `LayoutWrapper`
| Route | Purpose |
|---|---|
| `/feed` | Main feed — posts, meetings, workshops, polls merged and sorted |
| `/home` | Guide/owner dashboard (gated) |
| `/offerings` | "My Offerings" — author's own content dashboard |
| `/workshops/create` | Dedicated Workshop editor (`WorkshopEditor` component) — separate from the general content form |
| `/workshops/[id]` | Workshop detail page (`WorkshopPage` component — NOT `GatheringDetails`) |
| `/meetings/[id]` | Meeting/event detail page (`GatheringDetails` component) |
| `/posts/[id]` | Post detail |
| `/forum`, `/forum/[slug]`, `/forum/new`, `/forum/anonymous` | Forum threads |
| `/calendar` | Meeting calendar view |
| `/polls`, `/polls/[id]`, `/polls/new` | Polls |
| `/files` | Nextcloud file browser (guide-only nav item) |
| `/live` | Live-now widget (guide-only) |
| `/email-templates` | Org email template settings (guide-only) |
| `/account` | Self-service account settings, Nextcloud connect fallback button |
| `/profile`, `/profile/[userId]` | Artist profile |
| `/login` | Sign in / sign up (`BaroqueSignup`) |
| `/admin` | Local admin surface (distinct from the separate `apps/admin` on :3000) |

**Nav structure** (`components/top-nav.tsx`): a `Drawer` sidebar, `navItems` array drives most links (several `guideOnly`-gated: Home, Polls, Archive/Files, Workshops, Live, Emails — visible only to guides/owners/site admins), plus a separate bottom section with My Profile (modal), Account, and the new Help item.

**Key shared components**:
- `feed-client.tsx` — feed rendering + create/edit drawer, routes through `ContentForm` (`packages/ui`)
- `meeting-card.tsx` / `featured-row.tsx` — feed card and mini-card variants
- `gathering-details.tsx` — meeting/event detail (workshops use the separate `workshop-page.tsx`)
- `workshop-editor.tsx` — dedicated workshop create/edit form
- `workshop-owner-editor.tsx` — inline owner-only editor for a published workshop's media slots (drawer)
- `workshop-materials.tsx` — enrolled-member materials view
- `welcome-popup.tsx` — onboarding tour + the `nc_connect`/`welcome` query-param side-effect handlers

---

## 3. Nextcloud connection schema

```
                    ┌─────────────────────────┐
                    │  eac_intergration        │  ← shared service account
                    │  (subadmin, not admin)   │     NEXTCLOUD_ADMIN_USER/PASSWORD
                    └───────────┬───────────────┘
                                │ used for:
              ┌─────────────────┼─────────────────────┐
              │                 │                      │
      list/read users   folder provisioning     in-app uploads
      (OCS API, works)  (org folders, works)     (/api/upload, /api/nextcloud/*
                                                   — service account, NOT the
                                                   member's own NC quota)
```

**What's blocked**: `eac_intergration` (or any API credential) creating/editing NC user accounts via the OCS Provisioning API — 403 "Password confirmation is required", confirmed unfixable from the API side (see section 1).

**What works — self-service SSO account creation**:
```
Member clicks "Connect Nextcloud" (or it auto-fires after email confirm)
  → GET /api/nextcloud/connect (checks email_confirmed first)
  → redirects to Nextcloud /login?redirect_url=...
  → (no NC session) sociallogin auto-forwards to our /api/oidc/authorize
  → reads eac_user_jwt cookie, issues auth code
  → Nextcloud's OIDC client exchanges it via /api/oidc/token, /api/oidc/userinfo
  → Nextcloud creates account "elkdonis-<our-user-id>" with real email
    (this step is what's ungated — live session, not an API call)
  → our own /api/oidc/authorize records nextcloud_synced=true in our DB
```

**Talk rooms**: per-thread (`threads.nextcloud_talk_token`) created as public (type 3) by default — guest-joinable, no account needed, via `/api/talk/join?token=...`. Org-level rooms (`organizations.talk_room_token`) default to private (type 2) — needs the manual public-flip mentioned above.

**Media**: two distinct paths —
- *In-app uploads* (`/api/upload`, `/api/nextcloud/upload`) always use the `eac_intergration` service account — never touches a member's personal NC quota/account.
- *Direct-in-Nextcloud uploads* would use the member's own synced NC account — this is the lever for the still-open "limit self-service accounts to read-only in NC's own UI" idea discussed but not yet implemented (proposed: `files.default_quota = 0 B` instance-wide + a tracking group — user said "let me think about it," not yet applied).

---

## 4. Known open items / follow-ups
- Quota/group restriction for self-service NC accounts — designed, not applied (user wants to think about it first).
- Org-level Talk room provisioning script still defaults to private (type 2) — only patched for the 4 existing orgs.
- Workshops have no "living document" field in their data model (meetings do).
- Stripe checkout not built (eTransfer placeholder).
- `justin.gillisb@gmail.com` has two duplicate manual NC accounts (`Justin`, `justingillisb`) — `Justin` was chosen as canonical; `justingillisb` untouched.
- Pre-existing type-drift across the app (Meeting/Post type mismatches, Mantine v8 calendar signatures, forum reply props, etc.) — logged in memory, not part of this session's fixes.

---

## 5. Uncommitted changes
Everything below is local working-tree changes only — **nothing from this session has been committed or pushed**.

**Modified:**
```
NEXTCLOUD_CUSTOM_CHANGES.md, docker-compose.yml
apps/admin/src/app/nextcloud/page.tsx
apps/arts-collective/src/app/api/talk/join/route.ts
apps/inner-gathering/src/app/(app)/account/page.tsx
apps/inner-gathering/src/app/(app)/layout.tsx
apps/inner-gathering/src/app/(app)/login/page.tsx
apps/inner-gathering/src/app/(app)/workshops/[id]/page.tsx
apps/inner-gathering/src/app/api/content/[id]/route.ts
apps/inner-gathering/src/app/api/content/route.ts
apps/inner-gathering/src/app/api/meetings/[id]/rsvp/route.ts
apps/inner-gathering/src/app/api/nextcloud/redirect/route.ts
apps/inner-gathering/src/app/api/oidc/authorize/route.ts
apps/inner-gathering/src/app/api/talk/join/route.ts
apps/inner-gathering/src/app/api/workshops/[id]/route.ts
apps/inner-gathering/src/app/api/workshops/route.ts
apps/inner-gathering/src/components/comment-composer.tsx
apps/inner-gathering/src/components/comment-item.tsx
apps/inner-gathering/src/components/comment-section.tsx
apps/inner-gathering/src/components/featured-row.tsx
apps/inner-gathering/src/components/feed-client.tsx
apps/inner-gathering/src/components/gathering-details.tsx
apps/inner-gathering/src/components/meeting-card.tsx
apps/inner-gathering/src/components/top-nav.tsx
apps/inner-gathering/src/components/welcome-popup.tsx
apps/inner-gathering/src/components/workshop-editor.tsx
apps/inner-gathering/src/components/workshop-page.tsx
apps/inner-gathering/src/lib/email-template-settings.ts
packages/auth-server/src/api-routes.ts
packages/email/src/index.ts
packages/email/src/templates/rsvp-guest.tsx
packages/hooks/src/useContentDraft.ts
packages/nextcloud/src/index.ts
packages/nextcloud/src/users.ts
packages/types/src/content-form-config.ts
packages/ui/src/components/content-form/ContentForm.tsx
packages/ui/src/components/content-form/types.ts
packages/ui/src/index.ts
```

**New files:**
```
apps/inner-gathering/src/app/(app)/offerings/
apps/inner-gathering/src/app/api/nextcloud/connect/
apps/inner-gathering/src/app/api/workshops/[id]/materials/
apps/inner-gathering/src/components/workshop-materials.tsx
apps/inner-gathering/src/components/workshop-owner-editor.tsx
apps/inner-gathering/src/instrumentation.ts
apps/inner-gathering/src/lib/reminders.ts
packages/db/migrations/067_personal_member_orgs.sql
packages/db/migrations/068_workshop_media_slots.sql
packages/db/migrations/069_workshop_reminders.sql
packages/email/src/templates/reminder.tsx
packages/nextcloud/src/workshop-materials.ts
packages/ui/src/components/SingleImageField.tsx
scripts/provision-org-talk-rooms.mjs
```

Migrations 067–069 **are applied to the live DB** even though the `.sql` files aren't committed — if you reset the DB from scratch, re-run them.
