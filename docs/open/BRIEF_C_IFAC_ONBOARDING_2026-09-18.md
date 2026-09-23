# Brief C — IFAC onboarding

Sprint board: `SPRINT_2026-09-18_onboarding.md`. You own `apps/ifac/**` (except
`app/forum` → Brief B, `app/center` → mount Brief A's work when it says it's ready)
and a **shared** onboarding/tour component in `packages/cms-ui/src/hub/` (build it
org-agnostic — memory: *Generalize Beyond IFAC*).

## Principle for the copy
Not heavy on platform talk. One reassurance — *this is about artist sovereignty;
it's open source and not-for-profit; your work and your files stay yours* — then just
show them how. Every step is "here's the button, here's what it does".

## Phase 1 — everyone signs in (do this first; nothing else matters until it works)
**State today (checked 2026-09-18):**
- 19 IFAC roster profiles (`org_profiles` org_id='ifac'), **all `claim_status='unclaimed'`**
  sentinel `users` rows; only 2 carry an email.
- `user_organizations` for ifac: **2 rows, both `guide`, no `owner`**. (Seed an owner
  before anything that depends on owner — ask the user who.)
- Sign-in with any email works (`GOTRUE_MAILER_AUTOCONFIRM=true`; Google OAuth on IFAC
  is live). A new account lands as **`viewer`** — not a member, not linked to their roster row.
- Claim machinery exists in `packages/services/src/profiles.ts`: `requestClaim`,
  `approveClaim`, `mergeProfile`; IFAC admin matching in `apps/ifac/src/lib/directory-admin.ts`.

**DECIDED by the user (2026-09-18) — the ladder is manual:**
- Signing in just makes you a user on the database and lands you as **`viewer`**
  (already the behaviour). Nobody becomes a member by signing in.
- An owner/admin **promotes people by hand** in `/manage`: viewer → member → admin → owner.
  UI words: *Visitor* (signed out / no row), *Viewer*, *Member*, *Admin*, *Owner*.
  DB values are `viewer | member | guide | owner` — **"Admin" is the UI label for
  `guide`**; don't add a new role value.
- **Owners: Justin Gillis and Eric Brummel.**
  - Justin = users `fbf699b9-c708-440a-9abd-40f8953978e5` (display name JMANFLEX,
    justin.gillisb@gmail.com), currently `guide` → set `owner`.
  - Eric = users `d4ef2252-f006-479c-8d3a-9c829e4e36fe` is an **unclaimed roster
    sentinel with no email** — he can't sign in as that row. When Eric signs in with
    his real email, merge his new account into this row (`mergeProfile`), then set `owner`.
    Until then, making the sentinel owner grants nothing real.

**The remaining gap:** linking a signed-in viewer to their roster page. Keep it manual
to match the above: in `/manage`, an owner/admin sees new viewers alongside unclaimed
roster rows and can **"This is them" → merge** (existing matching in
`directory-admin.ts` ~L230–247 + `mergeProfile`) and set their role in the same place.
A self-service "Is one of these you?" → `requestClaim` is optional, still admin-approved.
Invite links are **not** needed now.
- On promotion to member: also provision their Nextcloud access (see Phase 3).

## Phase 2 — first actions (the "touch base" list)
1. **Weekly meeting** — create/join the standing meeting, with either a video URL or
   the Talk room. `StandingMeetingFace` + meeting rota exist (memory: *Meeting Rota*);
   IFAC's Talk room token is `r654gtsj` (type 3).
2. **Blog section** on their profile — toggle `profile_sections.blog`; shelf/desk exist
   (memory: *Member Writing*).
3. **Store** — add a store to their profile and put artwork on art-auction
   (market.arts-collective.com); individual stores are supported. Stripe keys are
   absent: say "list your work", never "start selling".

## Phase 3 — their cloud
Show calendar / circle / team folder + their personal Users folder on Nextcloud:
"cloud storage you can use from these sites or directly in Nextcloud."
- `scripts/sync-nextcloud-access.sh` is **not scheduled** — a new member sees nothing
  until it runs. Either cron it or call the reconcile from the claim-approve path. Tell PM which.
- Nextcloud user creation via admin API is blocked (password-confirm gate); self-service
  SSO is the working path (memory: *Nextcloud Provisioning*). Circles can't receive
  calendar shares — share per uid (memory: *Nextcloud Circles & Calendar facts*).
- IFAC files live in `EAC_Network/ifac/`; groupfolder 3 (`IFAC`) is empty — don't point people there.

## Phase 4 — the tour
`/hub` is the gateway: a **starting tour / checklist** (dismissible, progress remembered
server-side per user, not localStorage) walking Phases 2–3. Last step points to
**`/center`**: edit your profile deeper, see your store and directory listing, and
understand that you-on-the-platform stands behind you-in-IFAC — you can keep using it,
or run your own org on the same platform later. `/center` itself is Brief A's; you mount it.

## Before you build
- Email: test one real send (password reset) early. If it fails, onboarding must not
  depend on email and the PM needs to know.
- `/manage` refuses edits to self and owners — keep that.
- Remember `a { color: inherit }` on IFAC — style any prose link or it's invisible.
- IFAC is a prod build: back up `.next`, `NEXT_BUILD_CPUS=2`, rebuild to see changes.

## Done when (per phase)
Walk it as a real test artist end-to-end (new email → invite link → claimed → member →
tour) with screenshots, then clean up the test rows. Log each phase on the sprint board.
