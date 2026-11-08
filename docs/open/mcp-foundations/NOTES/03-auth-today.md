# 03 · Identity and tokens today, and the gaps for MCP (2026-11-08)

## What exists

- **GoTrue** (`supabase-auth`) is the identity; apps read the session with
  `getServerSession()` (`packages/auth-server/src/index.ts`). arts-collective is the **SSO
  broker** (`packages/auth-server/src/handoff.ts`; serving doc §1.2).
- **Device tokens** (migration 194, `packages/auth-server/src/device-tokens.ts`):
  `eacd_…`, SHA-256 stored, never expire, revoked by `revoked_at`. `getServerSession()`
  accepts `Authorization: Bearer eacd_…` **on every route of every app that uses it**
  (`index.ts:278`), for any `app` value. One row today (`app = 'jerusalem'`).
- **admin's OIDC provider** (`apps/admin/src/lib/oidc.ts`, `api/oidc/{authorize,token,userinfo}`,
  `.well-known/openid-configuration`):
  - HS256 with the shared `JWT_SECRET`; the id_token doubles as the access token (token route).
  - Clients are a hard-coded map (`CLIENTS`: `nextcloud`, and `openclaw` only when
    `OPENCLAW_OIDC_SECRET` is set, which it is not, per identity doc 2026-09-23). Every client
    is confidential (secret compared in the token route); no public clients.
  - Delegation: `grant_type=urn:ietf:params:oauth:grant-type:token-exchange` with
    `subject_email`, for clients with `allowDelegation`. Token: `sub` = person, `act.sub` =
    courier, `aud` = the courier, `scope` (default `agent.post`), TTL 300 s.
    `verifyDelegatedToken` (`oidc.ts:259`) requires `act`, the courier's flag, aud = courier,
    and the scope. It gates `apps/admin/src/app/api/agent/post/route.ts` (openclaw-bridge).
  - Issuer from `req.nextUrl.origin` (CLAUDE.md: that reports `0.0.0.0:<port>` behind the proxy).
  - No RFC 8707 `resource`, no RFC 9728 metadata, no DCR, no CIMD, no consent screen.
- **innergathering's OIDC provider** (`apps/innergathering/src/lib/oidc.ts`) serves Nextcloud at
  `elkdonis-arts.org/api/oidc/*`. Not relevant beyond "there are two".

## Gaps against the MCP auth spec (NOTES/01)

| Spec needs | admin provider | Verdict |
|---|---|---|
| Token audience = the MCP server (RFC 8707) | aud = client id | missing |
| Public clients with PKCE S256 | confidential only; PKCE optional, `plain` allowed | missing |
| CIMD and/or DCR | hard-coded map | missing |
| RFC 8414 or OIDC discovery | OIDC discovery, issuer from request origin | fragile |
| Consent screen naming the client | none (delegation is consent-less by design) | missing |
| Revocation | HS256 JWT until expiry | weak |

## Conclusions

1. **Do not reuse admin's provider or `JWT_SECRET` for MCP.** A token signed with the key that
   also signs SSO id_tokens is the confusion `verifyDelegatedToken` already has to defend
   against; MCP access tokens should be unforgeable without a database row.
2. **MCP tokens must not be device tokens.** An `eacd_` token is a full session on every
   route; an MCP token must be accepted by `/api/mcp` only (spec: tokens are for this resource
   only). Use a distinct prefix `eacm_` that `deviceTokenUser` ignores, and its own table.
3. The RFC 8693 shape (`sub` person + `act` client) survives as **columns on the grant**
   (`user_id`, `client_id`), and the token-exchange grant stays for couriers (OpenClaw), which
   later exchange for an MCP-audience token instead of calling admin's `/api/agent/post`.
4. The authorization server for the OAuth pass belongs on **arts-collective**: it is the SSO
   broker, it has the login page and session cookie, and it is the MCP's own origin
   (`issuer` = `https://arts-collective.com`).
