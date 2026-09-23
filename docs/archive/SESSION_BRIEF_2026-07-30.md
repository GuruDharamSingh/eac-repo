# Session Brief — 2026-07-30

Handoff for the next agent session. This session ran long and covered one arc: **taking features that existed in exactly one app and making them shared, org-agnostic monorepo infrastructure.** It started as a workshop-suite overhaul on `inner-gathering` (3004) and turned into four consolidation passes plus two new shared packages.

**Nothing here is committed.** File list at the bottom. Migrations `070`, `071`, `072` were created and applied this session (`073`–`077` are from other work — org_feeds, amrit-canada, pigeonshoot — don't attribute them here).

---

## 0. Read these first

**Memory files** (`~/.claude/projects/-mnt-pool1-home-guru-eac/memory/`) — these encode decisions, not just history:

| File | Why it matters |
|---|---|
| `project_thread_kind_expansion.md` | Auction listings + products are coming as new `threads.kind` values. RSVP eligibility must stay kind-agnostic. **Updated this session** with the shared-package layout. |
| `project_org_membership_standardization.md` | Org roles consolidated. **Hard boundary: global `users.is_admin` is grantable only from `apps/admin` (3000), never from the shared package.** Security-relevant, not an oversight to "fix." |
| `project_payments_stripe.md` | One core NFP Stripe account across workshops + art-auction. Art-auction moves *off* per-artist payouts. Blocked on API keys. |
| `feedback_reuse_thread_forms.md` | Check `packages/ui/src/components/content-form/tiers/*` before hand-writing form fields. Several were built and never wired. |
| `feedback_scope_narrowly.md` | Confirm the specific target before bulk-acting once a fix unblocks a whole class of records. |
| `org_feeds_pattern.md` | Migration 073 replaced the hardcoded `threads.section` CHECK with the `org_feeds` table — site sections are data now. |
| `amrit_canada_template.md` | amrit-canada is the reference template for new org sites (shadcn/Tailwind standard). |
| `nextcloud_provisioning.md` | Admin-API user creation is structurally blocked; self-service SSO is the only working path. |

**Repo docs:** `CLAUDE.md` (conventions, ports, commands), `SESSION_BRIEF_2026-07-20.md` (org split + Nextcloud provisioning), `NEXT_AGENT_BRIEF.md`, `THREADS_REFACTOR.md`.

---

## 1. Workshop suite overhaul (inner-gathering, port 3004)

Migrations `070` (hero_text, background_color), `071` (banner_focal_y).

**Bugs fixed — several were silent and long-standing:**

- **`workshop_sessions.notes` was double-JSON-encoded.** The write path called `JSON.stringify()` before handing the object to postgres.js, which already serializes for `jsonb`. The column held a jsonb *string* of JSON text, so every `notes.description` / `.mediaUrl` / `.resources` read back as `undefined`. This is why session images/files/body never appeared. Fixed both write sites, added a defensive `parseSessionNotes()` at all three read sites, and repaired the 4 corrupted rows in the DB. **If you write jsonb anywhere: pass the plain object, or `tx.json(obj)` — never pre-stringify.**
- **Join Workshop 500'd** — the INSERT referenced `thread_rsvps.registered_at`, a column that doesn't exist (table has `created_at`/`updated_at`). Not Stripe-related.
- Session materials never rendered — the page mapper never set `resources` at all.
- `@keyframes pulse` was referenced by live-session badges but **defined nowhere** — silent no-op.
- The sticky site header could cover the Title field on the create page (scroll carryover on client nav).

**Features added:** merged the "Edit page" drawer into the single Edit Content page (deleted `workshop-owner-editor.tsx`); banner/hero/card media slots + hero text + workshop background color; **banner crop slider** (live preview, `object-position`, `banner_focal_y`); per-session video/file/background-color; downloadable materials via a new `/api/workshops/[id]/materials/[filename]` route (was linking to the raw Nextcloud Files app); Archive button; author→profile link; welcome + reminder emails wired to the existing `email_template_settings` mechanism.

**Unblocked reminders:** workshops published with `is_rsvp_enabled = false`, which silently excluded every workshop from `lib/reminders.ts`'s query despite `kind IN (...,'workshop')` already being there. Now forced `true` for workshops.

**Sidebar nav:** replaced the Curriculum tabs with `workshop-sections-nav.tsx` — Overview + one entry per session, plain CSS (`.wsn__*`, ~450 lines in `globals.css` lines ~1500–1943), **deliberately non-Mantine** per request. Desktop sticky sidebar, mobile horizontal scroll.

---

## 2. RSVP consolidation → shared

Three drifted copies of the same fetch logic existed (an unused local hook, plus inline copies in `meeting-card.tsx` and `attendee-modal.tsx`).

- `packages/services/src/thread-rsvp.ts` — `checkRsvpEligibility` (is_rsvp_enabled / rsvp_deadline / attendee_limit), `getRsvpStatus`, `setRsvpStatus`, `deleteRsvp`, `countConfirmedRsvps`. Pure state, no side effects.
- `packages/hooks/src/useThreadRsvp.ts` — the one client hook.
- **Route renamed** `api/meetings/[id]/rsvp` → **`api/threads/[id]/rsvp`** (it already worked for workshops; the name lied). Kind-specific side effects (emails, Nextcloud materials grant/revoke) stay in the route.
- **Fixed: the meeting detail page's RSVP never worked** — `isJoined` was hardcoded `false` and the handler was `console.log('Join clicked')`.

**Scope boundary decided:** core RSVP = commitment record + eligibility. Notification-sending is a *side effect* at the route layer (content is kind-specific). Payment/materials/bids are kind-specific extensions layered on `thread_rsvps`, never replacements.

`amrit-canada`'s own RSVP route already imports these shared primitives — the consolidation is holding as new code lands.

---

## 3. Org membership consolidation → shared

Migration `072` (`org_followers` — new concept, didn't exist anywhere).

- `packages/services/src/org-membership.ts` — `getOrgRole`, `hasOrgRole`, `hasAnyOrgRole`, `listOrgMembers`, `listUserMemberships`, `getOwnedOrgId`, `setOrgRole`, `removeOrgMember`, plus follower primitives.
- **Contains no function that touches `users.is_admin`, by design.** Org roles can never imply platform-wide admin. Keep it that way.
- Migrated ~6 duplicated inline `SELECT role FROM user_organizations` sites across admin / inner-gathering / arts-collective / blog-server.

**Two real bugs fixed, both verified against the live DB first:**
- arts-collective checked for role `'admin'`, which the DB CHECK constraint never allowed (`owner|guide|member|viewer`; zero rows ever had it). Per the user's description of sub-org owners promoting members to an edit/post tier, the fix was `'admin'` → `'guide'`.
- Removed a vestigial `users.auth_user_id` fallback lookup — there's a `CHECK (auth_user_id = id)` constraint, so it could never match anything different.

---

## 4. arts-collective follow-ups

**Re-review after the user's edits** found the same duplication re-propagating in brand-new code: the "does this user own an org" query copy-pasted **6 times** (5 wizard/setup routes + `org/create`), `commitments.ts` re-implementing `listUserMemberships`, and `artists/page.tsx` inlining the exact query `lib/network.ts`'s `getMemberRoster` was written to generalize (its own comment said so). All pointed at the shared functions; `getOwnedOrgId` was added for the repeated case.

**Login/signup** now uses the shared `BaroqueSignup` from `@elkdonis/ui` (was a bespoke shadcn form). Needed: `@elkdonis/ui` dep, `RELIGATH-Demo.otf` copied to `public/fonts/`, `eac-theme.css` import, and `key={initialMode}` so `?mode=signup` client-nav still remounts correctly.

---

## 5. Sharing workshops to other apps (in flight — where to resume)

### Established: the two target apps are *not* like inner-gathering

| | inner-gathering | hidden-enneagram / amrit-canada / arts-collective |
|---|---|---|
| UI | Mantine | shadcn/Tailwind v4 |
| Writes | REST `/api/content` | **server actions** (`src/lib/cms/actions.ts`) |
| Form | `useContentDraft` + ContentForm tiers | own `contentFormSchema` zod discriminated union |

**Do not port the Mantine workshop form into them.** arts-collective already hit this fork and wrote its own 875-line shadcn `WorkshopForm` rather than reuse it.

**The proven pattern is `packages/services/src/service-offerings.ts`** — hidden-enneagram's whole products/booking/checkout feature runs on it. Its header states the intent: org-agnostic, every function takes `orgId`, "the layer a second app reuses unchanged — only its site config and UI differ."

**Key structural fact:** workshops and services are already the same DB shape (`threads` + `workshop_pages`). `service` = paid, no RSVP, the `commerce_order` is the registration. `workshop` = RSVP + `workshop_sessions` + materials folder + Talk room.

### Built this session

**`packages/services/src/workshop-offerings.ts`** — sibling of `service-offerings.ts`. Full CRUD incl. sessions and drafts. Two things it fixes *by construction* vs arts-collective's `saveWorkshopAction`:
- `published_at` is `COALESCE`d (theirs resets it every save and destroys it when flipping to draft).
- Create + sidecar write share one transaction (theirs don't — a thread can exist with no `workshop_pages` row).
- Writes price to **both** `threads.price` and `workshop_pages.price_member` on purpose: inner-gathering reads `COALESCE(wp.price_member, t.price)`, newer apps read `threads.price`. Keeps a workshop authored anywhere readable everywhere.

**`packages/cms-ui`** — new shadcn-side shared package. Cannot live in `@elkdonis/ui` (Mantine; hidden-enneagram deliberately avoids it). Follows `@elkdonis/checkout`'s pattern exactly: **source-exported, no build step**, listed in `transpilePackages`, styled only with `hsl(var(--token))` utilities so each site's palette drives it. Wired into hidden-enneagram (dep + `transpilePackages` + Tailwind `@source` directive — v4 auto-detection skips `node_modules`, so the `@source` is required, not optional). Verified: typechecks, app serves 200.

Contains a **generic wizard** (`WizardProvider` / `WizardNav` / `StepIndicator`) generalizing arts-collective's, which had ~600 lines of byte-identical duplication between the base and `Business*` variants.

### Why arts-collective's wizard "hasn't fully worked" — diagnosed, fixed in the generic version

1. **Mid-step data loss** — `patch` only fired on step *submit*; values sat in each step's own `useForm` until validation passed, so closing the tab lost the current step. → generic version patches on change + debounced autosave.
2. **Stale cache beat the server** — localStorage was spread *after* DB values on resume. → cache carries a timestamp, only wins if genuinely newer; stale entries dropped.
3. **Silent save failures** — save-and-exit fired a fetch with no status check and redirected regardless. → awaits, surfaces error, only navigates on success.
4. **Dead-end last step** — indicator was `aria-hidden`/inert, so "an earlier step is invalid" meant pressing Back 7×. → clickable, invalid steps marked.
5. **Conditional `useWizard()` in try/catch** — illegal hook call, works only by render-order accident. → `useWizardOptional()`.

Also unfixed there and worth knowing: `startOverAction` clears DB columns but not localStorage; the business wizard has no completion gate; Step1 portrait upload is a pasted URL with "coming soon" while `WorkshopForm` already has a working `CoverImageUpload`.

---

## 6. Open decisions — blocking further template work

These came out of the arts-collective deep dive and need a call **before** building workshop wizard steps against the template system:

1. **Nothing reads `manifest.json` at render time.** `lib/cms/workshop-render.ts` hardcodes the ten template filenames and CSS order, and there is **no `workshop_pages.template_id` column**. Adding a second workshop template today means editing that adapter. Sibling template dirs (`portfolio/`, `dossier-classified/`, `enneagram/`) prove the manifest format generalizes — it's just unused. **This is the single biggest blocker for "templates for subdomains."**
2. **`optional_sections` toggles are inert.** `render.ts` renders schedule/gallery whenever data exists regardless of the toggle; testimonials is `disabled: true`; "related" has no renderer. The UI exists and does nothing.
3. **Silex-mode subdomains lose theming and can show the wrong workshop.** `theme_overrides` is absent from `packages/silex-render/src/queries.ts`; `getOrgWorkshopForTemplate` takes `LIMIT 1` of the org's most recent workshop *regardless of URL*, so an org with two workshops renders the same data on both. Also `sites/[slug]/[contentSlug]/page.tsx` never checks `layout_mode` — a Silex org gets its custom homepage then a hardcoded EAC workshop page for every child route.
4. `gallery_image_urls` is in the DB, in `WorkshopPageData`, read and rendered — but has no form field and isn't in `workshopFullSchema`. Write-only by SQL.

---

## 7. Suggested next steps

1. **Resolve #6.1** (template registry + `template_id` column) or explicitly defer it — it determines whether the workshop wizard should target the Silex template path or the React path.
2. Build the **workshop wizard steps** on `packages/cms-ui`'s shell, against `upsertWorkshopOffering` (draft-safe: it accepts partial input with an existing `threadId`, and leaves `sessions` untouched when the field is `undefined`, so a step that doesn't cover sessions won't wipe them).
3. Add a `workshop` arm to hidden-enneagram's `contentFormSchema` union (`src/lib/cms/schema.ts` — it's already `post | service`; amrit's is `post | meeting`).
4. **Product strip on profile** — cheap: `listServiceOfferings(orgId)` already exists and both apps already join `artist_profiles`.
5. Consider migrating arts-collective's two wizards onto the generic provider (deletes ~600 lines and fixes all five bugs at once).
6. Payments/Stripe — see `project_payments_stripe.md`. Also note: **`workshop_join_requests.status` never transitions to `'paid'` anywhere in the codebase** — no webhook, no admin confirm route (art-auction's `commerce_order` has one). Paid workshop enrollment is trust-based today.

---

## 8. Housekeeping

- **`pnpm lint` is broken repo-wide** — ESLint 9 can't find `eslint.config.js` (apps still have flat-config-incompatible setups). Unrelated to this session's work, but it means lint was never run on any of it.
- `packages/ui/src/components/{button,card,dialog,input}.tsx` are **orphaned shadcn files** — not exported, and their deps (`radix`, `cva`, `tailwind-merge`) aren't in that package's `package.json`. They're the source of stray typecheck errors. Either finish or delete them; `packages/cms-ui` is the intended home for shadcn-side shared UI now.
- Pre-existing typecheck errors unrelated to this work: `apps/admin` (~20, mostly stale `Meeting`/`User` type drift), `apps/arts-collective` (1, `api/upload/image/route.ts`), inner-gathering (~10, calendar/forum/poll components).
- `amrit-canada` is in `docker-compose.yml` (3006) but **was not running** this session — start it before testing anything there.

### Files touched this session

**New packages:** `packages/cms-ui/` (package.json, tsconfig.json, src/index.ts, src/wizard/{WizardProvider,WizardNav,StepIndicator,index}).
**New shared modules:** `packages/services/src/{thread-rsvp,org-membership,workshop-offerings}.ts`, `packages/hooks/src/useThreadRsvp.ts`.
**Migrations:** `070_workshop_hero_text_and_bg.sql`, `071_workshop_banner_focal_point.sql`, `072_org_followers.sql` — all applied.
**Modified packages:** `services/src/index.ts`, `hooks/src/index.ts`, `types/src/content-form-config.ts`, `ui/src/{index.ts,components/WorkshopMaterials.tsx,components/workshop-ui.tsx,components/content-form/{index.ts,tiers/RsvpTier.tsx}}`, `blog-server/src/auth.ts`.
**inner-gathering:** `components/{workshop-page,workshop-create-page,workshop-sections-nav,meeting-card,attendee-modal,featured-row,gathering-details,layout-wrapper}.tsx`, `lib/{workshop-session-notes,workshop-session-status}.ts`, `app/(app)/workshops/[id]/{page,edit/page}.tsx`, `app/(app)/meetings/[id]/page.tsx`, `app/(app)/offerings/*`, `app/api/threads/[id]/rsvp/` (new, replaces `api/meetings/[id]/rsvp/`), `app/api/workshops/[id]/{join,materials/[filename]}/route.ts`, `app/api/content/{route.ts,[id]/route.ts}`, `app/api/me/role/route.ts`, `app/api/org/[orgId]/blog-password/route.ts`, `lib/actions.ts`, `app/globals.css`.
**arts-collective:** `lib/{org,commitments}.ts`, `components/login-form.tsx`, `app/artists/page.tsx`, `app/signup/setup/page.tsx`, `app/api/wizard/{submit,save,business/save,business/submit}/route.ts`, `app/api/org/create/route.ts`, `package.json`, `public/fonts/RELIGATH-Demo.otf`.
**admin:** `app/api/users/{by-org,[userId]/org-role}/route.ts`, `package.json`.
**hidden-enneagram:** `package.json`, `next.config.ts`, `src/app/globals.css` (cms-ui wiring only).
