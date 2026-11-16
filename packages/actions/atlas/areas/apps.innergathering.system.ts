import type { Area, Capability, Host, HostKey } from '../types';

// innergathering, system doors: the Nextcloud "Sign in with Elkdonis" OIDC provider, page-view pulse and the forum
// action door. 2026-11-16, round 2 (curator ig). Conventions: atlas/JOURNAL.md.

const APP = 'innergathering';
const SRC = 'apps/innergathering/src/';
const V =
  '2026-11-16 read app/api/oidc/{authorize,token}/route.ts, lib/oidc.ts, app/api/pulse/route.ts, app/api/forum/[action]/route.ts, packages/forum-ui/src/actions.ts (action list only)';
const api = (p: string, m: string): HostKey => `api:${SRC}app/api/${p}/route.ts#${m}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({
  key,
  service,
  address: { app: APP, path, how },
  note,
});

const capabilities: Capability[] = [
  {
    id: 'ig-nextcloud-sign-in',
    area: 'innergathering.system',
    label: 'Sign in to Nextcloud with the network account',
    does: 'Nextcloud’s sociallogin sends a person to /api/oidc/authorize. The route checks the person’s verified session (or a signed inter-app token), records their Nextcloud user id the first time, issues a ten-minute single-use code and redirects back; /api/oidc/token swaps the code for a one-hour signed id token.',
    class: 'system',
    actors: ['system'],
    scope: 'person',
    hosts: [
      {
        key: `sql:${SRC}app/api/oidc/authorize/route.ts#GET` as HostKey,
        service: ['@elkdonis/auth-server#getVerifiedSession', 'lib/oidc#createAuthCode'],
        address: { app: APP, path: '/api/oidc/authorize', how: 'opened by Nextcloud’s Sign in with Elkdonis button, no control here' },
        note: 'GET handler with writes: UPDATE users SET nextcloud_user_id (only if not yet synced) and an INSERT of the auth code. Inventory lists it as an sql host only because a GET is not an api host.',
      },
      host(api('oidc/token', 'POST'), ['lib/oidc#validateAuthCode', 'lib/oidc#generateIdToken'], '/api/oidc/token', 'called server to server by Nextcloud, no control', 'Needs client_id nextcloud and the client secret (timing-safe compare); PKCE checked when a challenge was stored.'),
      { key: `sql:${SRC}lib/oidc.ts#createAuthCode` as HostKey, service: ['(raw SQL INSERT into oidc_codes)'], note: 'writes the code row for oidc/authorize' },
      { key: `sql:${SRC}lib/oidc.ts#validateAuthCode` as HostKey, service: ['(raw SQL DELETE from oidc_codes)'], note: 'single use: the code is deleted as it is read, scoped to client and expiry' },
    ],
    status: 'users.nextcloud_user_id is set for the person (CHECKS cloud)',
    risk: ['none'],
    drift:
      'The same four hosts exist in apps/inner-gathering (legacy, ignored) from which this was ported 2026-09-18 ("ported with the same behaviour", lib/oidc.ts header). No other app in the atlas serves OIDC. Differences from the original: node:crypto HS256 instead of jose, in-memory userinfo cache instead of Redis.',
    canonical: 'this app (innergathering) is the one provider: Nextcloud points at https://elkdonis-arts.org/api/oidc/*; keep it here, delete the inner-gathering copy with the app',
    open:
      'Read and looks sound: redirect_uri must be in the allowlist built from NEXT_PUBLIC_NEXTCLOUD_URL/NEXTCLOUD_URL paths; the code is single-use, bound to client_id and redirect_uri, ten minutes; the session is verified (getVerifiedSession); inter-app tokens are HS256 with a timing-safe signature check, expiry, issuer and audience "admin-oidc". Notes, not defects: (1) /api/oidc/authorize accepts the inter-app JWT from the eac_user_jwt cookie, from `state`, or from login_hint (authorize/route.ts:21-41), so any holder of a valid short-lived token acts as that user at Nextcloud: its strength is INTER_APP_JWT_SECRET. (2) The issuer allow-list still names "inner-gathering" (authorize/route.ts:63), the retired app. (3) No `state` is required on the way in; Nextcloud supplies it.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

const area: Area = { capabilities, ignored };
export default area;
