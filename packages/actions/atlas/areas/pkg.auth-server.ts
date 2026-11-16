import type { Area, Capability, Host, HostKey } from '../types';

// packages/auth-server: sessions, sign-up, the site-to-site handoff and device tokens (the identity door of every app).
// 2026-11-16, round 3. Conventions: atlas/JOURNAL.md. These are the raw SQL writes inside the shared handlers; each is
// an `internal` or `system` row that BACKS a person-facing row elsewhere (named in `drift: "backs <file>:<id>"`).
// The whole package was read: index.ts (isAdmin, getServerSession), api-routes.ts, handoff.ts, arrival.ts,
// device-tokens.ts, sso-state.ts. The handoff GET and the OAuth callback GET are not inventory hosts (GET) but their
// findings are recorded here.

const SRC = 'packages/auth-server/src/';
const V = '2026-11-16 read packages/auth-server/src/{index,api-routes,handoff,arrival,device-tokens,sso-state,verify-session}.ts';
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const hs = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: 'network', path, how }, note });

const capabilities: Capability[] = [
  {
    id: 'pkg-auth-server-signup',
    area: 'pkg.auth-server',
    label: 'Create the account, its memberships and its welcome email',
    does: 'The shared sign-up handler: creates the GoTrue user, adds the new person to the site’s default organisations as a viewer (inner_group when the site names none), creates a draft org profile per organisation, and sends the welcome email with a confirmation link.',
    class: 'internal',
    actors: ['visitor'],
    scope: 'person',
    hosts: [
      hs(sq('api-routes.ts', 'handleSignup'), ['(raw INSERT user_organizations, org_profiles)', '@elkdonis/email#sendWelcomeEmail'], '/api/auth/signup', 'mounted as POST /api/auth/signup in every app; no screen of its own', 'Public by design.'),
    ],
    status: 'a users row, a user_organizations viewer row and an org_profiles draft row exist for the new account',
    risk: ['emails'],
    drift: 'backs arts-collective.network:create-account (and the same signup row in every app that mounts the route)',
    canonical: 'auth-server handleSignup (already shared)',
    open: 'Read carefully (identity door). GOOD: a signup is a viewer, never a member (api-routes.ts:355); org rows use ON CONFLICT DO NOTHING; a signed-in visitor is signed out first; Turnstile is verified when TURNSTILE_SECRET_KEY is set. ' +
      'SECURITY: (1) TURNSTILE_SECRET_KEY is NOT set in ~/eac/.env (compose passes an empty value and warns "variable is not set" on every run, 2026-11-16), so the bot check at api-routes.ts:260-281 is skipped and signup is open to scripts. (2) GoTrue autoconfirm is on (comment at :20-38): a person can create an account for an email address they do not own; the welcome email then goes to the real owner, but the account already exists with that identity. Every downstream "email is the join key" use (admin OIDC delegation, contacts backfill in apps/admin, ifac claim by email) inherits that. (3) No rate limit on signup, and each one sends an email (api-routes.ts:391-405) to a visitor-typed address: a mail-bomb route. (4) the response returns the whole GoTrue session in JSON (:414), not only in cookies. (5) generateConfirmationLink (:48-69) puts the typed password into the GoTrue admin generateLink call (needed for type signup; not logged).',
    verified: V,
  },
  {
    id: 'pkg-auth-server-join-orgs-on-sign-in',
    area: 'pkg.auth-server',
    label: 'Add an organisation membership at sign-in',
    does: 'On a successful password or Google sign-in, a site that names orgs adds the person to them as the given role (never changing an existing role) and creates the draft org profile row.',
    class: 'internal',
    actors: ['person'],
    scope: 'person',
    hosts: [
      hs(sq('api-routes.ts', 'joinOrgsOnSignIn'), ['(raw INSERT user_organizations, org_profiles)'], '/api/auth/login', 'called by createLoginHandler and handleOAuthCallback when the app passes joinOrgs (IFAC); no screen'),
    ],
    status: 'user_organizations has a row for (user, org) after a sign-in on that site',
    risk: ['others'],
    drift: 'backs the IFAC and sunjay login rows (apps.ifac.account.ts, apps.sunjay.center.ts login: sign-in auto-follows the org)',
    canonical: 'auth-server createLoginHandler joinOrgs',
    open: 'The role comes from the app’s own config (never from the request), so a sign-in cannot raise a role. A person is made a follower of the site’s org on every sign-in, silently: see the sunjay question (b) in the round-2 journal.',
    verified: V,
  },
  {
    id: 'pkg-auth-server-oauth-callback',
    area: 'pkg.auth-server',
    label: 'Finish a Google sign-in and create the account',
    does: 'Completes the PKCE sign-in with Google (via GoTrue), installs the session cookies, and for a first-time Google account adds the default organisation memberships, a draft org profile and the welcome email.',
    class: 'internal',
    actors: ['visitor'],
    scope: 'person',
    hosts: [
      hs(sq('api-routes.ts', 'handleOAuthCallback'), ['(raw INSERT user_organizations, org_profiles)', '@elkdonis/email#sendWelcomeEmail'], '/api/auth/callback', 'the redirect target of the Continue with Google button; GET, so the route itself is not an inventory host'),
    ],
    status: 'a session cookie is set and, for a new account, memberships and a draft profile exist',
    risk: ['emails'],
    drift: 'backs arts-collective.network:create-account (the Google path of the same capability)',
    canonical: 'auth-server handleOAuthCallback (already shared)',
    open: 'SECURITY: (1) api-routes.ts:600 logs the first 300 characters of the GoTrue token response body (it begins with the access token) on every Google sign-in; server logs then hold the start of live bearer tokens. (2) :699-705 builds the landing URL from the `eac_pkce_dest` cookie and accepts an absolute http(s) URL as is, so a planted cookie (the cookie is set by the app at login start and is not signed) redirects the signed-in person off-site after sign-in; the other redirect helpers in this file allow only paths. (3) new-account detection compares created_at with last_sign_in_at within 10 s (:628-632), so a second account created at nearly the same time as its first session is treated as new (harmless, it only adds a viewer row and a welcome email).',
    verified: V,
  },
  {
    id: 'pkg-auth-server-arrival-respond',
    area: 'pkg.auth-server',
    label: 'Follow the organisation you arrived from, or dismiss the welcome',
    does: 'The arrival notice’s handler: Follow makes the person a viewer of the site’s organisation and clears the arrival cookie; Dismiss only clears the cookie.',
    class: 'internal',
    actors: ['person'],
    scope: 'person',
    hosts: [
      hs(sq('arrival.ts', 'POST'), ['(raw INSERT user_organizations)'], '/api/network/arrival', 'the Follow and Dismiss buttons of the arrival notice (ArrivalNotice, packages/cms-ui network), posting to createArrivalHandler mounted per app'),
    ],
    status: 'a viewer row for the person in the site org exists after Follow; the eac_arrival cookie is cleared',
    risk: ['others'],
    drift: 'backs arts-collective.hub:welcome-arrival and dismiss-arrival (the same two verbs through the tenant hub door)',
    canonical: 'auth-server createArrivalHandler (already shared)',
    open: 'Safe: the person comes from the session, the org is fixed by the app (options.orgId), the INSERT never changes an existing role. The arrival id in the cookie is not needed for the write.',
    verified: V,
  },
  {
    id: 'pkg-auth-server-handoff-arrival-record',
    area: 'pkg.auth-server',
    label: 'Record where a signed-in person arrived from',
    does: 'When a site-to-site sign-in lands, writes one network_arrivals row (host, path, where from) when it says something, and sets the readable arrival cookie that makes the welcome notice appear.',
    class: 'system',
    actors: ['person'],
    scope: 'person',
    hosts: [
      hs(sq('handoff.ts', 'recordArrival'), ['(raw INSERT network_arrivals)'], '/api/auth/handoff/accept', 'the landing leg of the sign-in hop (GET /api/auth/handoff/accept, createHandoffAcceptHandler); no screen'),
    ],
    status: 'a network_arrivals row for the person, host and path exists',
    risk: ['none'],
    drift: 'backs the handoff accept GET route mounted in every app (the network SSO hop)',
    canonical: 'auth-server createHandoffAcceptHandler (already shared)',
    open: 'Read carefully (identity door, handoff.ts whole). GOOD: tokens are HS256 with a 60 s life, bound to the destination origin (aud) and the issuer origin (allow-listed), single-use through a Redis jti claim, `next` is limited to a same-site path, and the session comes from a one-time GoTrue magic link verified server-side. ' +
      'SECURITY: (1) OPEN REDIRECT: handoff.ts:182-183 answers `NextResponse.redirect(landing)` for a signed-out visitor, an unknown destination or a missing secret, where landing = the destination origin + path taken from the `to` query parameter. GET /api/auth/handoff?to=https://anywhere.example therefore redirects to any site (only the signed-in and allowed-origin branch is checked). The `plain=1` branch (:175) does check the allow-list. (2) The signing secret INTER_APP_JWT_SECRET is shared by every app and by apps/admin (the OIDC authorize route accepts the same secret with issuers inner-gathering and arts-collective): any process holding it can mint a token for any email and get a session on any site, and the same token logs a person into Nextcloud. (3) With Redis down the one-use check is skipped with a warning (:276), so a captured URL is replayable for 60 s. (4) `via` is any origin the request names (:212-222): the arrival notice text "from <site>" can be forged by anyone who can start a handoff. (5) generateLink is called for whatever email the verified token carries, so account takeover reduces to holding the secret.',
    verified: V,
  },
  {
    id: 'pkg-auth-server-device-token-mint',
    area: 'pkg.auth-server',
    label: 'Mint a device token',
    does: 'Creates a long-lived bearer token (eacd_ plus 32 random bytes) for a signed-in person and a named app; only its SHA-256 is stored; the token is returned once.',
    class: 'internal',
    actors: ['person'],
    scope: 'person',
    hosts: [
      hs(sq('device-tokens.ts', 'createDeviceToken'), ['(raw INSERT device_tokens)'], '/link-device', 'the Link button of elastrocal /link-device (app/link-device/actions.ts linkDevice); no screen of its own'),
    ],
    status: 'a device_tokens row for the user, app and label exists with a token_hash',
    risk: ['others'],
    drift: 'backs apps.elastrocal:device-link',
    canonical: 'auth-server createDeviceToken',
    open: 'Read carefully (identity door). GOOD: 256 random bits, hashed at rest, revocable, never accepted as a cookie, never the same prefix as an MCP key (eacm_). ' +
      'SECURITY: (1) device-tokens.ts:10 a token never expires on its own and there is no per-user cap, so a lost phone is valid until the person finds Unlink (no screen lists a person’s devices: listDeviceTokens and revokeDeviceToken have no caller). (2) getServerSession (index.ts:278-281) accepts the token on EVERY route of every app, and the session id it returns is the person’s auth id, so isAdmin() passes for an admin’s device token: a leaked Jerusalem token is a full web session, including the admin app, with no expiry and no second factor. (3) the session object carries nextcloud_app_password for device and cookie sessions alike (device-tokens.ts:132-139, index.ts:315, :371) and getServerSession caches it in Redis for 10 min: the Nextcloud app password is plaintext in the users table (see pkg-nextcloud-credentials-store), in Redis and in every server action’s session. (4) the label is user-chosen (80 chars) with no allow-list on `app` here; elastrocal checks LINK_APPS before calling.',
    verified: V,
  },
  {
    id: 'pkg-auth-server-device-token-use',
    area: 'pkg.auth-server',
    label: 'Note that a device token was used',
    does: 'On each request that carries a device token, updates last_used_at at most once an hour.',
    class: 'system',
    actors: ['system'],
    scope: 'person',
    hosts: [
      hs(sq('device-tokens.ts', 'deviceTokenUser'), ['(raw UPDATE device_tokens)'], '/api/mobile/v1', 'no screen: every authenticated request from the Jerusalem or personal app'),
    ],
    status: 'device_tokens.last_used_at is within the last hour for a token in use',
    risk: ['none'],
    drift: 'backs the whole device-token session path (getServerSession)',
    open: 'Best effort and non-blocking (the catch swallows errors). An unknown or revoked token is null, never a cookie fallback (index.ts:278-281).',
    verified: V,
  },
  {
    id: 'pkg-auth-server-device-token-revoke',
    area: 'pkg.auth-server',
    label: 'Revoke a device token (this app, or by id)',
    does: 'Revokes the token the request carries (the app’s Unlink) or one of the person’s tokens by id, by setting revoked_at.',
    class: 'internal',
    actors: ['person'],
    scope: 'person',
    hosts: [
      hs(sq('device-tokens.ts', 'revokeRequestDeviceToken'), ['(raw UPDATE device_tokens)'], '/link-device', 'the Unlink button inside the Jerusalem app (DELETE /api/mobile/v1/me)'),
      hs(sq('device-tokens.ts', 'revokeDeviceToken'), ['(raw UPDATE device_tokens)'], '/link-device', 'no caller: a web list of linked devices was planned (listDeviceTokens exists too)'),
    ],
    status: 'device_tokens.revoked_at is set for the token',
    risk: ['none'],
    drift: 'revokeRequestDeviceToken backs apps.elastrocal:device-unlink; revokeDeviceToken has no caller',
    open: 'revokeDeviceToken is correctly scoped (id AND user_id) but has no screen, so a person cannot revoke a lost phone from the web. A password change or a global sign-out does not revoke device tokens either (handleLogout only calls GoTrue signOut and markSignedOutEverywhere).',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
