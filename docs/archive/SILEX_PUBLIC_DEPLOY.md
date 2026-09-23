# Exposing the Silex editor — silex.arts-collective.com

Written 2026-09-09. Everything on the app side is done; what remains is one
proxy host and a DNS record.

## Why now

Until 2026-09-07 the Silex editor was unusable by anyone: `/api/silex/token`
required a per-user Nextcloud credential, and 0 of 35 people had a working one
(`generateAppPassword()` returns the password it was handed, the single stored
credential 401s, and Nextcloud 33 refuses admin-API user creation outright).

That route now gates on **role** — owner or guide of the org, via
`canEditOrgSite` — and connects to Nextcloud as the service account. Editors
went from 0 people to 15, across 9 orgs. The only thing left between them and
the editor is that it answers on `localhost:6805`.

## Naming

`silex.arts-collective.com`, matching the pattern `artdirect.arts-collective.com`
already sets. The network host is `arts-collective.com`.

## 1. DNS

An A/CNAME for `silex.arts-collective.com` pointing wherever
`artdirect.arts-collective.com` points. They terminate at the same place.

## 2. Nginx Proxy Manager

NPM is the ingress for every live domain here (`ix-nginx-proxy-manager-npm-1`,
admin UI on **:30020**). It is NOT part of this compose project.

Add a Proxy Host:

| Field | Value |
|---|---|
| Domain Names | `silex.arts-collective.com` |
| Scheme | `http` |
| Forward Hostname / IP | the Docker host address NPM already uses for the other EAC apps |
| Forward Port | `6805` |
| Block Common Exploits | on |
| Websockets Support | **not required** — see below |
| SSL | request a certificate, Force SSL on |

### Websockets

Not needed, checked rather than assumed: there are no `ws` / `socket.io` /
`express-ws` dependencies in the Silex install or in our connector, and a real
upgrade handshake against `/` returns **200, not 101** — the server does not
upgrade. Enabling it anyway is harmless if you prefer the insurance.

## 3. Environment (already applied to `.env`)

    SILEX_EDITOR_PUBLIC_URL=https://silex.arts-collective.com
    SILEX_PUBLIC_URL=https://silex.arts-collective.com
    SILEX_SESSION_SECRET=<64-char random, generated 2026-09-09>

The first is where `/edit/{slug}` sends the browser
(`apps/arts-collective/src/app/edit/[slug]/page.tsx:20-22`). The second is what
the container advertises about itself (`SILEX_URL` inside it). **They must
match** — otherwise the editor loads its own assets from an origin the browser
cannot reach.

`SILEX_SESSION_SECRET` was previously unset, so the container fell back to the
dev default committed in `docker-compose.yml`. That session holds redeemed
Nextcloud credentials; a shared-secret cookie is fine on localhost and not on a
public origin. Now a real random value.

`ARTS_INTERNAL_URL` stays `http://arts-collective:3007` — the connector redeems
tokens server-to-server inside the compose network. **Do not make it public.**

Applied and verified: the container reports the new `SILEX_URL`, a 64-char
secret, and the internal redemption path answers.

## 4. What is exposed, exactly

Probed on the running container with no token and no session:

| Path | Status |
|---|---|
| `/` | 200 — the editor shell, unconfigured, no org data |
| `/?t=fake` | **401** — bad token rejected ahead of the static router |
| `/api/website/?websiteId=x` | **401** |
| `/api/connector/user?...` | **401** |
| `/api/connector/?type=STORAGE` | 200 — connector catalogue only, no org data |

So an anonymous visitor gets an empty editor and nothing else. The chain to real
files is: owner/guide → token minted by `/api/silex/token` → redeemed exactly
once → session scoped to `<orgFolder>/silex/project` and `/published`.

Containment is by **path, not credential**: `/api/silex/auth` derives exactly
those two paths from the token, and the connector never browses a root — so a
guide of one org cannot reach another's files even though the underlying service
account could.

## 5. Known behaviour worth not mis-diagnosing

The token is **one-time and short-TTL**. If you see intermittent `410 Token is
invalid or has already been consumed`, the usual cause is a browser prefetching
the redirect and burning the token — not an auth bug.

## 6. First run

The role gate has not yet been exercised by a non-admin. Worth having one org's
guide open the editor before anything depends on it.
