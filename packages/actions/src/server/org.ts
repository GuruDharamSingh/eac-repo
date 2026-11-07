/**
 * Which organisation an `org` entry acts on, for one person (2026-11-06).
 *
 * One rule for every door — a host's `runAction`, `actionRoutes`, a lesson's
 * task box — so they cannot drift: the requested org is a claim, honoured only
 * when the person is an owner or guide there (`canManageOrgPeople`); otherwise
 * the org they own (`getOwnedOrgId`), or none. An entry's own `allowed` check
 * still runs on the org settled here.
 */
import { actionMeta } from '../catalogue';
import { canManageOrgPeople, getOwnedOrgId } from '@elkdonis/services';

/** The org a person may act on: `requested` (an org id) when they manage it, else the org they own. */
export async function resolveActionOrg(userId: string, requested?: string | null): Promise<string | null> {
  if (!userId) return null;
  const claim = typeof requested === 'string' && requested ? requested : null;
  if (claim && (await canManageOrgPeople(userId, claim))) return claim;
  return getOwnedOrgId(userId);
}

/** As `resolveActionOrg` for an `org`-scoped entry; null for any other entry. */
export async function actionOrgId(id: string, userId: string, requested?: string | null): Promise<string | null> {
  return actionMeta(id)?.scope === 'org' ? resolveActionOrg(userId, requested) : null;
}
