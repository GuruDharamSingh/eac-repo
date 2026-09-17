# OpenClaw Bridge — the repo side, built 2026-09-14

The stack-side half of connecting an OpenClaw instance to this monorepo. OpenClaw
itself is **not** configured yet; this is what it will connect to when it is.

Written against the decisions: full draft post (not just a link share), no parallel
auth mechanism, bridge lives in its own package.

---

## What it does

An external agent can create **one thing**: a draft `post` thread in an org, on
behalf of a human it has verified, optionally with media attached.

It cannot publish. `status: 'draft'` is hardcoded in
[post.ts](packages/openclaw-bridge/src/post.ts), not a parameter, so no request
shape and no compromise of the agent produces a live page. Promotion to published
happens through the normal human surfaces.

## The pieces

| Where | What |
|---|---|
| [packages/openclaw-bridge/src/types.ts](packages/openclaw-bridge/src/types.ts) | The whole contract. Everything an agent can express is in this one file. |
| [packages/openclaw-bridge/src/post.ts](packages/openclaw-bridge/src/post.ts) | Authorization + draft creation + media attach. No HTTP, no tokens. |
| [packages/openclaw-bridge/src/route.ts](packages/openclaw-bridge/src/route.ts) | Handler factory. Takes a `verify` function; implements none itself. |
| [apps/admin/src/lib/oidc.ts](apps/admin/src/lib/oidc.ts) | `openclaw` client registration, `generateDelegatedToken`, `verifyDelegatedToken`. |
| [apps/admin/src/app/api/oidc/token/route.ts](apps/admin/src/app/api/oidc/token/route.ts) | The delegation grant. |
| [apps/admin/src/app/api/agent/post/route.ts](apps/admin/src/app/api/agent/post/route.ts) | The single mounted write surface. |

## Why it's shaped this way

**Identity stays with the existing provider.** Admin is already an OIDC IdP (it is
what Nextcloud SSO runs on). Rather than invent a bearer-token scheme, the bridge
accepts a token the *same provider* mints with the *same key*. The only addition is
a grant type: RFC 8693's `urn:ietf:params:oauth:grant-type:token-exchange`, which
lets a registered client ask for a token that speaks for a named human who is not
at a browser.

The token carries both halves — `sub` is the human, `act.sub` is the courier — so
`verifyDelegatedToken` can *require* delegation. An ordinary SSO `id_token`, signed
with the same key, is rejected for agent writes.

**The grant is opt-in per client.** `allowDelegation` on the client registry gates
it; `nextcloud` does not have it. Adding a future SSO client never accidentally
adds the power to act as anyone.

**The bridge grants nothing.** Authorization is `getViewerRoles` + `isOrgMember` —
the same `user_organizations` lookup the web UI does. `author_id` is the human, so
the draft lands in their own drafts and revoking their org role revokes this path
with it. Global-admin bypass is deliberately *not* passed through: an admin acting
via the agent still acts as a member of the org they name.

## The protocol

Two calls. Both to admin (port 3000).

**1 — get a delegated token**

```
POST /api/oidc/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
client_id=openclaw
client_secret=<OPENCLAW_OIDC_SECRET>
subject_email=<the DMARC-verified sender>
scope=agent.post
```

Returns `{ access_token, token_type: "Bearer", expires_in: 300 }`. Five minutes —
mint one per action, don't hold it.

`subject_email` must match a `users.email` row (case-insensitively). An unknown
address is `invalid_grant`, which is the right answer: the network has no way to
attribute the request.

**2 — create the draft**

```
POST /api/agent/post
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "orgId": "amrit_canada",
  "title": "...",
  "body": "plain text or HTML",
  "summary": "optional; derived from body if omitted",
  "section": "optional org_feeds.slug",
  "media": [{ "filename": "...", "mimeType": "image/jpeg", "content": "<base64>", "caption": "...", "altText": "..." }],
  "idempotencyKey": "imap-uid-220",
  "source": { "channel": "email", "reference": "220", "verification": "dmarc" }
}
```

`201` with `{ ok: true, threadId, slug, status: "draft", orgId, media, replayed }`,
or a 4xx with `{ ok: false, code, error }`. Codes are enumerated in `types.ts`;
they are written to be read back to a human in a reply, e.g. *"you hold no role in
'ifac'"*.

### Notes for whoever configures the agent

- **`idempotencyKey` is not optional in practice.** IMAP redelivers and agents
  retry. Use the IMAP UID. Without it a redelivered mail becomes a second draft;
  with it the first result is returned again with `replayed: true`.
- **Body** may be plain text or HTML. Both are sanitized (`sanitizeRichText` /
  `textToHtml`) — the model composing them is downstream of untrusted input by
  construction, so nothing is trusted on the way in.
- **`section`** is validated against `org_feeds`; an invented section is a 404
  rather than a thread nothing renders.
- **Media** is capped at 4 items, 12 MB each, and `image/{jpeg,png,gif,webp,avif}`
  or `application/pdf`. Uploads land in the org's Nextcloud `Agent/` folder so
  agent uploads stay separable from members'. A failed attachment does **not**
  fail the draft — losing the text loses the mail; a missing image is visible in
  review.
- **Every write is audited.** `events` rows carry `source: 'openclaw'`, the client
  id, the channel, the channel reference and the idempotency key, so a draft traces
  back to the mail that asked for it.

## Setup still owed

1. **`OPENCLAW_OIDC_SECRET`** in admin's environment. Until it is set, the
   `openclaw` client is not registered at all and the delegation grant does not
   exist — which is the correct default for a box with no agent connected.
   Generate with `openssl rand -hex 32`; store on the OpenClaw side via
   `openclaw secrets store set`, not inline in config.
2. **`pnpm install` + build.** *Not done — blocked.* `node_modules` in this repo is
   root-owned, so the new workspace package could not be linked from this session:

   ```
   EACCES: permission denied, rmdir '/mnt/pool1/home/guru/eac/node_modules/.bin'
   ```

   Needs a `pnpm install` with the right ownership (decline the modules-purge
   prompt — `printf 'n' | pnpm install`), then
   `pnpm --filter @elkdonis/openclaw-bridge build`. There is no admin container
   currently running to do it in.
3. **Admin must be reachable from the OpenClaw VM.** Over Tailscale, per the
   research report's containment design — never a public endpoint.

### Verified so far

`packages/openclaw-bridge/src` and the three touched admin files type-check clean
under `strict` against real workspace sources. Nothing has been exercised at
runtime — the package is not built or linked, and admin is not running.

## Two-tier agent split still applies

The research report's §8 conclusion holds and is not enforced by anything here: the
agents that ingest untrusted input (`mail_reader`, the WhatsApp group logger) must
not hold the tool that calls this endpoint. The bridge limits *what* a call can do;
it cannot stop the wrong agent from making one. That separation lives in OpenClaw's
config.

## Corrections to the research report

The report was written against an older checkout (`~/dev-enviroment/eac-repo`).

- §9.1's `createBlogPost()` in `packages/blog-server` is no longer the write path.
  Writes consolidated onto `@elkdonis/services` — `createThread` in
  [posts.ts](packages/services/src/posts.ts), with `forum-write.ts` as the
  `(viewer, input) => WriteResult` pattern this bridge follows.
- §9.3's "one authenticated HTTP endpoint" is what was built, but the report
  assumed `checkBlogOwner` was the check to preserve. The current check is
  `getViewerRoles` + `isOrgMember`.
- §9's "no service-to-service auth pattern" was correct and still is — which is why
  this uses the OIDC provider rather than adding one.

## Not built, and why

**Text/SMS/WhatsApp as a command channel.** The email path works because DMARC
makes `From:` a cryptographic claim that joins to `users.email`. A phone number
joins to nothing — there is no phone column on `users` and no claim flow. Making
WhatsApp a command channel also means undoing the `sendPolicy: deny` rule that
stopped the outbound leak described in report §5.2. That is a separate piece of
work with its own design: verified-phone storage, a claim flow, and a decision
about whether OpenClaw may speak in a group at all.
