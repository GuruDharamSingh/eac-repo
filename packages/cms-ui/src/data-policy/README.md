# Data policy (`@elkdonis/cms-ui/data-policy`)

Written 2026-10-29 for Meta's app registration (privacy policy URL and user
data deletion). Mounted on innergathering (`elkdonis-arts.org/data`) and
arts-collective (`arts-collective.com/data`).

## Where each statement in DataPolicy.tsx comes from

| Statement | Source |
|---|---|
| Account fields | `users` columns (`\d users`, 2026-10-29); Google via GoTrue (`docs/reference/identity-and-tenancy.md`) |
| Files in Nextcloud, `Private/` visibility | `docs/reference/nextcloud.md`; CLAUDE.md media rule |
| Card payments by Stripe, order records | `docs/reference/commerce.md` |
| One host-only session cookie; SSO arrival cookie ≤ 1 day | `packages/auth-server/src/index.ts` (`sb-eac-auth`), `sso-proxy.ts:161` (`maxAge: 86400`) |
| Cookieless analytics, daily HMAC visitor id, DNT/GPC, private orgs keep no path | `packages/analytics/README.md` |
| SendGrid, one-click unsubscribe | `docs/reference/email.md`; `apps/*/src/app/unsubscribe` |
| Meta: the collective's Page, and members' own Pages/Instagram connected from Studio on arts-collective.com (planned 2026-10-29, not built); no Facebook sign-in | `packages/meta`; developer, 2026-10-29 |
| Backups: 14 dailies + monthly for a year | `docs/reference/ops.md` "Backups" |
| Thirty-day answer | commitment (developer, 2026-10-29) |

Change the text when the platform changes; update `updated` on each host.

## Deletion requests
Meta's callback (`fulfilMetaDeletion`) deletes `user_connections` rows for
providers meta/facebook/instagram whose `account_id` or `oauth_state.user_id`
is the app-scoped user id, then marks the request completed or
nothing_to_delete. The Studio connection flow must store the id in one of
those columns for this to find it.

Table `data_deletion_requests` (migration 216). Service:
`packages/services/src/data-deletion.ts`. Fulfilment is manual: an owner or
admin removes the account, then calls `resolveDeletionRequest(id, 'completed')`
(no admin screen yet; use psql or a script).
