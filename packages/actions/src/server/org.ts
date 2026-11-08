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

export interface ActionOrgOptions {
  /**
   * A site-bound door (2026-11-08, hub cards on a custom host): the org IS this
   * site's, honoured only for its owners and guides. A claim for another org is
   * refused (null), and there is no fallback to an owned org. Opt-in: callers
   * that don't pass it behave exactly as before.
   */
  siteOrgId?: string | null;
}

/** The org a person may act on: `requested` (an org id) when they manage it, else the org they own. */
export async function resolveActionOrg(userId: string, requested?: string | null, opts?: ActionOrgOptions): Promise<string | null> {
  if (!userId) return null;
  const claim = typeof requested === 'string' && requested ? requested : null;
  if (opts?.siteOrgId) {
    if (claim && claim !== opts.siteOrgId) return null;
    return (await canManageOrgPeople(userId, opts.siteOrgId)) ? opts.siteOrgId : null;
  }
  if (claim && (await canManageOrgPeople(userId, claim))) return claim;
  return getOwnedOrgId(userId);
}

/**
 * The org channel a `channel` entry acts on (2026-11-07): the claim when the person is
 * an owner or guide there, never the personal org `oad`; otherwise null. No fallback to
 * an owned org: no claim means the person's own channel, and a refused claim is refused
 * by performAction (it sees `orgClaim` without `orgId`), not widened to another channel.
 */
export async function resolveChannelOrg(userId: string, requested?: string | null): Promise<string | null> {
  const claim = typeof requested === 'string' && requested && requested !== 'oad' ? requested : null;
  if (!userId || !claim) return null;
  return (await canManageOrgPeople(userId, claim)) ? claim : null;
}

/** As `resolveActionOrg` for an `org`-scoped entry, `resolveChannelOrg` for a `channel` one; null for any other entry. */
export async function actionOrgId(id: string, userId: string, requested?: string | null, opts?: ActionOrgOptions): Promise<string | null> {
  const scope = actionMeta(id)?.scope;
  if (scope === 'org') return resolveActionOrg(userId, requested, opts);
  // Channel is central (serving doc §4.1): a site-bound door never settles a channel.
  if (scope === 'channel') return opts?.siteOrgId ? null : resolveChannelOrg(userId, requested);
  return null;
}
