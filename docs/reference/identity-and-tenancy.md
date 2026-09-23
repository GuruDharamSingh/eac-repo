# Identity, auth, organisations and tenancy

Covers sign-in (Supabase GoTrue), the cross-site session handoff, the `users`
identity table and pseudonyms, organisation roles and tiers, profiles and
"where you show", host-based tenant selection, the Nextcloud OIDC provider and
the OpenClaw bridge, and the authorisation rules that apply across all apps.
Last verified: 2026-09-23 (code read at the cited lines; schema and row counts
queried on `elkdonis_dev`; nothing exercised through a browser).

## Current state

### GoTrue

- One GoTrue container, `supabase-auth` (`supabase/gotrue:v2.151.0`, port 9999),
  shared by every app. Public address is the host in `GOOGLE_REDIRECT_URI`
  (`auth.elkdonis-arts.org`). Config: `docker-compose.yml:28-60`.
- Env mapping (`docker-compose.yml:39-52`):
  - `SITE_URL` → `GOTRUE_SITE_URL`. Currently `https://elkdonis-arts.org`.
    GoTrue falls back to it when a `redirect_to` is not allowed.
  - `ADDITIONAL_REDIRECT_URLS` → `GOTRUE_URI_ALLOW_LIST`. Comma-separated
    `https://<host>/**` entries, one per public host (19 on 2026-09-23).
    `hiddenenneagram.com` and `artdirect.arts-collective.com` are not in it.
  - `GOTRUE_MAILER_AUTOCONFIRM: true`: accounts are confirmed at creation;
    GoTrue sends no mail. The welcome mail carries a `generateLink` action
    link instead (`packages/auth-server/src/api-routes.ts:19-68`).
  - Google is enabled through `GOOGLE_OAUTH_ENABLED`, `GOOGLE_CLIENT_ID`,
    `GOOGLE_REDIRECT_URI` (GoTrue's own `/callback`).
- Changing `ADDITIONAL_REDIRECT_URLS` needs `docker compose restart supabase-auth`;
  GoTrue reads it only at start. The same variable is also passed to
  arts-collective (`docker-compose.yml:765`), where the handoff reads it.

### Session cookie and `getServerSession`

- Storage key `sb-eac-auth` (override: `SUPABASE_AUTH_STORAGE_KEY`),
  `packages/auth-server/src/index.ts:50-52`.
- Cookies are host-only. `deriveCookieDomain` (`index.ts:16-28`) sets a
  Domain only when `EAC_COOKIE_DOMAIN` is set, and it is set nowhere (`.env`
  and compose, 2026-09-23). Each host holds its own session; the handoff below
  carries a sign-in between hosts. `docs/archive/PORTAL_SESSION_HANDOFF.md`
  §2.1 describes a shared cookie domain; that is not the deployed setup.
- `/auth/v1` is stripped from request URLs when GoTrue is addressed directly
  (port 9999 or host `supabase-auth`), `index.ts:54-77`.
- `getServerSession()` (`index.ts:271-379`) reads the session with
  `supabase.auth.getSession()`, loads the `users` row by id, and caches
  `{userId, email, nextcloud_*}` in Redis under `user:<authUserId>` for
  10 minutes. It returns `id`, `auth_user_id`, `db_user_id` (all three equal,
  see the CHECK below), `email`, `nextcloud_user_id`, `nextcloud_app_password`.
  It is imported by 149 files. See Open items 1 for its verification gap.
- Also exported: `isAdmin(userId)`, `checkOrgAccess` (`index.ts:176-238`).

### Server-side auth routes

Handlers live in `packages/auth-server/src/api-routes.ts`; apps mount thin
wrappers under `apps/<app>/src/app/api/auth/`:

| Handler | Line | Route |
|---|---|---|
| `handleLogin` | 116 | `login` (POST email/password) |
| `handleSignup(req, { defaultOrgs })` | 176 | `signup` |
| `handleLogout` | 368 | `logout` |
| `handleGetSession` | 397 | `session` |
| `handleOAuthCallback(req, { defaultOrgs })` | 443 | `callback` (Google PKCE) |
| `handleHandoffStart` / `handleHandoffAccept` | `handoff.ts:157,203` | `handoff`, `handoff/accept` |

- 2026-09-23: 17 apps mount `login`, `signup`, `logout`, `session`; 12 of
  them also mount `callback`, 8 mount `handoff`. `forum` and `sophia` mount
  only `handoff/accept` and get sessions from the network host.
- Signup: optional Cloudflare Turnstile (`TURNSTILE_SECRET_KEY`), signs out
  any existing session, calls `signUp`, then for each `defaultOrgs` entry
  inserts a `user_organizations` row and an `org_profiles` row
  (`api-routes.ts:290-311`). The default is `[{ id: 'inner_group', role: 'viewer' }]`.
  Single-org apps pass `{ id: siteConfig.orgId, role: 'viewer' }`
  (e.g. `apps/ifac/src/app/api/auth/signup/route.ts`). `arts-collective` and
  `danamccool` pass nothing and so enrol signups in `inner_group`.
  The OAuth callback applies the same defaults (`api-routes.ts:543-571`).
- Google sign-in (`packages/auth-client/src/index.ts:98-134`): the browser
  builds a PKCE pair, stores the verifier in cookie `eac_pkce_cv`, and
  navigates to `<NEXT_PUBLIC_SUPABASE_URL>/authorize?provider=google&redirect_to=<origin><basePath>/api/auth/callback`.
  `NEXT_PUBLIC_BASE_PATH` keeps sub-path apps (`/books`) on their own callback.

### Network SSO: the handoff (arts-collective is the broker)

`packages/auth-server/src/handoff.ts`. The network host is
`NEXT_PUBLIC_NETWORK_HOST` (`arts-collective.com`, served by `apps/arts-collective`).

1. `GET /api/auth/handoff?to=<url>&next=<path>` on a host with a session signs
   an HS256 token (`INTER_APP_JWT_SECRET`) with `sub`, `email`, `iss` = this
   origin, `aud` = destination origin, `jti`, and a 60-second expiry
   (`HANDOFF_TTL_SECONDS`, line 33; the header comment at line 16 says 90).
2. `GET <dest>/api/auth/handoff/accept` verifies signature, expiry,
   `aud == here`, and `iss` in the allowed set; records the `jti` in Redis
   (`handoff:jti:<id>`, NX) to refuse replays; then uses the service key to
   `generateLink({ type: 'magiclink' })` and `verifyOtp` server-side, which
   yields a session and this host's cookies.
- Allowed origins (`isAllowedHandoffOrigin`, lines 110-141): localhost, the
  network host and its subdomains, hosts in `ADDITIONAL_REDIRECT_URLS`, and
  `SITE_URL`'s host.
- Login pages call `ssoCheckUrl` (lines 62-67) once, with an `sso=1` marker,
  to pick up an existing network session silently. After a fresh sign-in,
  `mirrorLoginHref` (`packages/auth-client/src/sso.ts`) routes through the
  network host so the session also exists there.
- Every service that takes part needs `INTER_APP_JWT_SECRET`
  (`docker-compose.yml:757-764`).

### `users`: an identity, not an account

- `auth.users` holds logins; `public.users` holds identities. Content tables
  reference the identity (`threads.author_id`, `media.uploaded_by`,
  `store.owner_user_id`, `user_organizations.user_id`). `users` has about 40
  inbound foreign keys; `threads_author_id_fkey` is RESTRICT.
- Trigger `on_auth_user_created` on `auth.users` runs `handle_new_user()`
  (migrations 052, 100): inserts `users(id = auth id, auth_user_id = id,
  email, display_name, slug)` with `ensure_unique_user_slug`, and never
  overwrites an existing slug.
- `CHECK users_auth_user_id_matches_id (auth_user_id = id)`: an account and
  its own identity share one uuid. There is no FK from `users.id` to
  `auth.users`.
- Rows without a login: unclaimed person dossiers (`claim_status='unclaimed'`),
  organisation identity rows (`entity_type='organization'`, migration 099,
  `organizations.profile_user_id`), and pseudonyms.

| entity_type | claim_status | rows | with GoTrue login |
|---|---|---|---|
| organization | claimed | 9 | 0 |
| organization | unclaimed | 7 | 0 |
| person | claimed | 22 | 19 |
| person | unclaimed | 18 | 0 |

(2026-09-23.) 9 `auth.users` rows have no `public.users` row; all use
`example.*` addresses (test accounts whose identity row was purged).
`getServerSession` returns `user: null` for them.

### Pseudonyms (migration 132)

- 2026-09-23: 132 applied at 2026-09-17 15:51 UTC (`app_schema_migrations`).
  The archive brief and memory still say "not applied"; they are out of date.
- `identity_control(identity_id PK, account_id, relation='pseudonym', label,
  created_at, retired_at)`, CHECK `identity_id <> account_id`, trigger
  `identity_control_no_chaining` (a pseudonym cannot control, a controller
  cannot become one). 0 rows on 2026-09-23. Also added `organizations.created_by`.
- `packages/services/src/identities.ts`: `MAX_PSEUDONYMS = 2` (line 44),
  `getIdentityIds` (72, own id plus live pseudonyms, never org identities),
  `listActingIdentities` (82), `resolveActor(accountId, requested)` (141,
  returns self, an owned pseudonym, or an org identity where the account is
  owner/guide), `createPseudonym` (188, writes `directory_listed = FALSE` and
  NULL `created_by`/`claimed_by`/`source_note`), `retirePseudonym`,
  `restorePseudonym`, `accountForIdentity` (289, server-only, no caller).
- `author_id = viewer` is a visibility grant (own drafts, org-only threads).
  It is widened to `= ANY(identityIds)` in `forum.ts`, `forum-search.ts`,
  `forum-people.ts`, `forum-write.ts`, `media-authz.ts`.
  `packages/services/src/gather.ts:191` still uses `t.author_id = uid`
  (under-visibility for pen-name authors, not a leak).
- UI: arts-collective only (`/api/hub/identities`, `IdentitiesFace`, the
  "Signed" picker in compose for new threads; `createThreadAction(input, { actingAs })`
  in `apps/arts-collective/src/lib/cms/actions.ts`). Full design:
  `docs/archive/IDENTITY_MODEL_BRIEF_2026-09-17.md`.

### Roles, tiers and the global admin flag

There are two role/tier vocabularies and one global flag:

| Axis | Column | Values | Meaning |
|---|---|---|---|
| Org access role | `user_organizations.role` | `owner`, `guide`, `member`, `viewer` (CHECK) | Gates everything org-scoped |
| Org business tier | `organizations.tier` | `free`, `supported`, `partner` (CHECK, migration 082) | What the org has with the network |
| Global admin | `users.is_admin` | boolean | Network-wide; 4 rows on 2026-09-23 |
| Entity type | `users.entity_type` | `person`, `organization` (no CHECK) | Display only, grants nothing (migration 093) |

- `users.network_tier` and `questionnaires.gates_tier` were dropped in
  migration 106.
- `user_organizations.role` defaults to `'member'` at the column level; every
  insert must pass the role explicitly.
- `viewer` is a follower or fresh signup. `/api/org/join` in arts-collective is
  ungated and grants `viewer` (`apps/arts-collective/src/app/api/org/join/route.ts:40-63`).
  `member` and above are conferred by an owner. Following an org is a `viewer`
  row (`followOrg`, `org-membership.ts:186`); the `org_followers` table
  (migration 072) has 0 rows and is no longer read or written.
- Role counts 2026-09-23: owner 21, member 16, viewer 3, guide 2.
- Tiers 2026-09-23: `ifac`, `inner_group` partner; `amrit_canada`,
  `hidden-enneagram` supported; the rest free.

### Org membership functions

`packages/services/src/org-membership.ts` (header lines 3-13 state the
boundary): `getOrgRole` (44), `hasOrgRole` (53), `hasAnyOrgRole` (65),
`listOrgMembers` (75), `listUserMemberships` (112), `getOwnedOrgId` (139),
`setOrgRole` (149), `removeOrgMember` (165), `isFollowingOrg` / `followOrg` /
`unfollowOrg` / `listOrgFollowers` / `getOrgFollowerCount` (181-231).
The file contains no function that writes `users.is_admin`.

- `setOrgRole` callers and their gates: `apps/admin/.../users/[userId]/org-role/route.ts:94`
  (global admin), `apps/arts-collective/src/app/api/org/[slug]/members/[userId]/route.ts:37`
  (`isOrgOwner`), `apps/{innergathering,sunjay,amrit-canada}/src/lib/cms/actions.ts:467`
  (owner only, cannot drop own ownership), `apps/ifac/src/lib/manage.ts:185`
  (`guard`; cannot assign `owner`).
- `is_admin` is granted only by `PATCH apps/admin/src/app/api/users/[userId]/route.ts`
  (line 116) and the CLI script `packages/db/scripts/set-admin.js`. Other apps
  read it: `canEditProfile`, `canPublishOrgProfile`, `canEditOrgIdentity`,
  arts-collective `/hub/admin` (network operations), IFAC `canManageIfac`.

### Organisations and owners

Owner-role accounts per org on 2026-09-23: `inner_group` 6; `ifac`,
`hidden-enneagram`, `elastrocal` 2; `amrit_canada`, `danamccool`, `justing`,
`pigeonshoot`, `saw`, `stonebalancing`, `sunjay`, `surrealistwriting`, `tara` 1;
`elkdonis`, `fourth_way_book_readers`, `guru-dharam`, `market`, `oad` 0.
`organizations.created_by` is NULL for those five plus `ifac`, `sunjay`, `tara`.

- `inner_group` is the core member group; private by default; its site is
  `elkdonis-arts.org` (`apps/innergathering`, port 3015).
- IFAC now has owner rows, but `canManageIfac` (`apps/ifac/src/lib/data.ts:120-140`)
  still admits `siteConfig.ownerEmails` first, then global admins, then
  owner/guide. The comment at `apps/ifac/src/lib/cms/questionnaire-actions.ts:22`
  ("zero owners") is out of date.

### Profiles (migrations 084-087, 099)

- `users` holds the global profile (slug, bio, avatar, location,
  `social_links`, `portfolio`, `claim_status`, `claimed_by`, `created_by`,
  `verified`, `theme`, `profile_layout`, `directory_listed`, `profile_sections`).
- `org_profiles(org_id, user_id)` is the per-org publish switch: `is_public`,
  `role_title`, `sort_order`, `tags`, `self_hidden`; `bio_override` and
  `photo_override` are unused.
- `packages/services/src/profiles.ts`: `canEditProfile` (466, self or global
  admin, identity fields), `canPublishOrgProfile` (482, self, or owner/guide of
  that org, or global admin). Claim flow: `requestClaim` (673), `mergeProfile`
  (768), `approveClaim` (903), `adminAssignProfile` (928, no auth check; the
  caller gates it). `ensureUniqueUserSlug` (504) shares the reserved list in
  `packages/utils/src/reserved-slugs.ts` with org slugs and subdomains.
- `artist_profiles` (13 rows) and `directory_profiles` still exist and are
  still read by arts-collective, artdirect, amrit-canada, sunjay,
  innergathering, `packages/cms-bindings`, `packages/silex-*`.
- Org identity: `organizations.profile_user_id` (099) → a `users` row with
  `entity_type='organization'`. `canEditOrgIdentity` (`org-domains.ts:122`) is
  owner/guide or global admin.

### Where you show (migration 149)

- Trigger `trg_user_org_show_members` → `org_profiles_show_new_members()`:
  when a `user_organizations` row becomes member/guide/owner, it upserts
  `org_profiles.is_public = TRUE` unless `self_hidden`. Viewers are never listed.
  Not backfilled for earlier hidden members.
- `org_listing_requests` (one pending per org+user) records a hidden person
  asking to be shown again; owners/guides decide via `decideListingRequest`.
- `packages/services/src/presence.ts`: `loadPresence` (122) and `setPresence`
  (231) act only on the caller's own id; the header (lines 4-35) maps each cell
  to its column. Routes: `apps/{arts-collective,innergathering}/src/app/api/center/presence`.

### Tenancy

- Every content table carries `org_id`. Each single-org app fixes its tenant
  in `siteConfig.orgId` (`apps/<app>/src/config/site.ts`). `apps/danamccool/src/lib/site-org.ts`
  is the seam for a future host-based lookup.
- Host-based selection exists only in `apps/arts-collective/src/middleware.ts`:
  a `<slug>.<network host>` subdomain (lines 39-61) or a custom domain looked up
  in `org_domains` rewrites to `/sites/<slug>/...` and forwards `x-org-domain`
  (lines 113-164). Middleware runs on Edge and fetches the map from
  `/api/domains` with a 60-second module cache. `/api/domains` does not filter
  on `verified_at`.
- `org_domains` (migration 081): `domain` PK, `org_id`, `is_primary` (one per
  org), `verified_at`, normalisation CHECK. 12 rows on 2026-09-23, all verified.
  `elkdonis-arts.org` belongs to `inner_group`.
- Next 16 renamed `middleware.ts` to `proxy.ts`; `art-auction` uses `proxy.ts`,
  `arts-collective` and `danamccool` still use `middleware.ts`.
- Per-org themes (migration 090, `packages/services/src/themes.ts`):
  `resolveTheme` defaults to `precedence: 'org'` (line 85), so org variables
  override a member's; only ArtDirect passes `'user'`. `sanitizeThemeVars`
  (line 35) is the trust boundary for values written into `<style>`.

### Nextcloud OIDC provider and Talk

- The provider Nextcloud's sociallogin uses is `apps/innergathering`
  (`src/lib/oidc.ts`, routes `src/app/api/oidc/{authorize,token,userinfo}`),
  at `elkdonis-arts.org/api/oidc/*` since 2026-09-18. Uids are
  `elkdonis-<users.id>`. It is where `users.nextcloud_user_id` is recorded.
- `authorize` accepts a short-lived HS256 token (`INTER_APP_JWT_SECRET`) from
  cookie `eac_user_jwt`, from `state`, or as `login_hint`, and otherwise falls
  back to the session. `apps/arts-collective/src/app/api/talk/join/route.ts`
  sets that cookie before sending the browser through Nextcloud's login.
- `apps/admin` keeps its own provider (`src/lib/oidc.ts`, `.well-known`); its
  live use is the OpenClaw delegation grant. `docs/archive/JWT_AUTH_FLOW.md`
  and `TALK_ROOM_AUTH_FLOW.md` describe the older inner-gathering → admin path.

### OpenClaw bridge

- `packages/openclaw-bridge` creates one thing: a draft `post` thread; `status:
  'draft'` is hardcoded (`src/post.ts:126,160,265`). Mounted at
  `apps/admin/src/app/api/agent/post/route.ts`. Token: RFC 8693 token exchange
  at `apps/admin/src/app/api/oidc/token/route.ts`, `sub` = human, `act.sub` =
  courier; `verifyDelegatedToken` requires `act`. Authorisation is the
  ordinary org-role lookup, with no global-admin bypass.
- 2026-09-23 state: `OPENCLAW_OIDC_SECRET` is unset, so the `openclaw` client
  is not registered (`apps/admin/src/lib/oidc.ts:50`). The package is linked
  into admin but has no `dist/` while its `package.json` exports `./dist/*`
  (assumed: the agent route fails to resolve until it is built). OpenClaw
  itself is not configured. Protocol: `docs/archive/OPENCLAW_BRIDGE_BRIEF.md`.

## Rules and constraints

- Take the acting user from `getServerSession()` in the route or action,
  never from a request parameter or body: every authorisation check keys on it.
- To act as another identity, pass the requested id through `resolveActor`;
  never write a client-supplied identity id to `author_id`: that function is
  the whole boundary for speaking as someone else.
- Put the authorisation check in the route handler or server action, not in
  a client component, panel, or middleware: middleware runs on Edge without
  Postgres, and client checks are bypassable.
- Use `@elkdonis/services` role helpers (`getOrgRole`, `hasOrgRole`) instead of
  hand-written `SELECT role FROM user_organizations`: roles and their rank
  are defined once.
- Treat `viewer` as a non-member in every new gate: it is handed out ungated by
  signup and `/api/org/join`.
- Grant `users.is_admin` only in `apps/admin`: org roles must never imply
  network-wide admin, and `org-membership.ts` is kept free of any such write.
- Serve media through `serveMedia` / `createMediaGetHandler` or call
  `canReadMedia` first: it is the only place private-path rules live, and it
  returns 404 for both missing and forbidden.
- Seed an owner row before removing any email allow-list (IFAC's
  `ownerEmails`): the allow-list was once an org's only administrator path.
- Wrap `handleSignup` / `handleOAuthCallback` in a function that passes
  `defaultOrgs`; do not bare-export them: a bare export type-checks only by
  coincidence and enrols signups in `inner_group`.
- Add a new public host to `ADDITIONAL_REDIRECT_URLS` and restart
  `supabase-auth` before announcing it: without it Google sign-in lands on
  `SITE_URL` and the handoff refuses the host.
- Do not add Google Cloud Console origins for a new host: the flow is a full
  redirect through GoTrue, and Google only sees GoTrue's `/callback`.
- Treat the `Host` header as a tenant selector only, never as a grant: it is
  client-controlled. An unknown host should 404, not fall back to a default org.
- Widen `author_id = viewer` to `= ANY(getIdentityIds(...))` wherever it grants
  visibility: otherwise a pen-name author loses sight of their own drafts.
- Write `org_profiles.is_public` through `presence.ts`, not `upsertOrgProfile`:
  the latter resets `sort_order` and `is_public` when fields are omitted.
- Delete a `users` row only after a dry-run `DELETE` inside a rolled-back
  transaction: about 40 foreign keys reference it and some are RESTRICT.

## Open items

1. **`getServerSession` trusts the cookie without verifying it.**
   `index.ts:275` calls `getSession()`; in `@supabase/auth-js` 2.75.0
   (`GoTrueClient.js`, `__loadSession`) an unexpired stored session is returned
   as-is, with the library's own warning that it "may not be authentic". The
   user id then selects the `users` row. Verified by reading the library code,
   not exercised. Next step: verify the access token (`getUser()` or JWT
   verification with the GoTrue secret) inside `getServerSession`.
2. A signup's `org_profiles` row satisfies `isOrgAffiliate`
   (`packages/services/src/media-authz.ts:142-165`, second `EXISTS`), so a
   fresh `viewer` from `handleSignup` / `handleOAuthCallback` can read that
   org's private media, which the `role <> 'viewer'` exclusion was meant to
   prevent. 1 such viewer row on 2026-09-23 (`inner_group`). Verified by code
   reading, not exercised.
3. Network routes on org hosts: `PASSTHROUGH_PATHS`
   (`apps/arts-collective/src/middleware.ts:22-37`) still lets `/login`, `/hub`
   (including `/hub/admin`), `/account`, `/artists`, `/directory` render on any
   org subdomain or custom domain routed to arts-collective. Open in code.
   Which hosts the proxy routes to port 3007 was not checked; every current
   `org_domains` domain has its own app (assumed).
4. `TIER_QUOTAS` in `packages/nextcloud/src/org-provisioning.ts:123-135` is
   keyed `free | standard | patron`, which matches neither vocabulary.
5. `packages/services/src/auth.ts` `createUser` inserts `org_id`, `role`,
   `status` into `users`, which has none of those columns. No caller.
6. Pseudonyms: payouts must resolve to the controlling account (not
   enforced); whether moderators may reveal a holder is undecided; Nextcloud
   has no pen-name storage; only arts-collective hosts the picker;
   `gather.ts:191` not widened.
7. `danamccool` and `arts-collective` signups default to `inner_group` viewer;
   whether that is intended for danamccool is unknown.
8. `hiddenenneagram.com` and `artdirect.arts-collective.com` are missing from
   `ADDITIONAL_REDIRECT_URLS` (assumed effect: Google sign-in there returns to
   `SITE_URL`; artdirect still passes the handoff as a network subdomain).
9. OpenClaw: set `OPENCLAW_OIDC_SECRET`, build `@elkdonis/openclaw-bridge`,
   restrict admin to the tailnet, then exercise once.
10. `apps/admin/src/app/api/auth/forward-session/route.ts` redirects to an
    unchecked `return_to` after verifying a JWT.
11. `handoff.ts` header says 90 seconds; the constant is 60.
12. `artist_profiles` / `directory_profiles` still have readers; the plan is to
    drop them after those readers move to `users` + `org_profiles`.

## Sources

Supersedes, for this area, in `docs/archive/`: `IDENTITY_MODEL_BRIEF_2026-09-17.md`,
`HANDOFF_2026-09-17_identity_and_services.md` (section 2), `JWT_AUTH_FLOW.md`
and `TALK_ROOM_AUTH_FLOW.md` (historical flow), `PORTAL_SESSION_HANDOFF.md` §2,
`OPENCLAW_BRIDGE_BRIEF.md` (protocol detail kept there),
`DEBRIEF_2026-09-06_org_presence.md` and `SESSION_BRIEF_2026-07-20.md`
(identity and tenancy parts).
- Memory: `role_tier_vocabulary`, `project_org_membership_standardization`,
  `project_identity_pseudonyms`, `project_profile_unification`,
  `project_associated_organizations`, `project_where_you_show`,
  `project_multitenant_domains_tiers`, `project_openclaw_bridge`,
  `project_consolidation_pass` (IFAC allow-list), `org_structure_core_members`.

Corrections recorded here (2026-09-23):
- Migration 132 is applied (memory and brief said pending).
- `users.entity_type` is migration 093, not 092.
- Google Cloud Console needs no per-host JavaScript origin
  (`project_profile_unification` said it did; `CLAUDE.md` is right).
- `org_followers` is unused; followers are `viewer` rows
  (`project_multitenant_domains_tiers` said the follow button wrote it).
- IFAC has owner rows (the "0 owners" trap is resolved in data; the
  allow-list code remains).
- Sessions are host-only; `EAC_COOKIE_DOMAIN` is not set.
