// The site-bound Channel door (2026-11-14; docs/open/CHANNEL_ON_SITES_2026-11-12.md
// section 5 question 5, developer: yes). An org site's own /channel performs Channel
// entries for that site's org only. A host mounts a 'use server' action:
//
//   'use server';
//   export async function runChannelAction(id: string, input: unknown) {
//     return performSiteChannelAction({ orgId: siteConfig.orgId }, await sessionActor(), id, input, { sources });
//   }
//
// This door:
//   - serves only SITE_CHANNEL_ACTIONS (plans only: nothing here schedules or sends),
//     narrowed further by the host's `allow`;
//   - settles the channel with resolveChannelOrg on the site's org: the person must be an
//     owner or guide there (canManageOrgPeople), and the personal org `oad` never settles;
//   - binds the call to the site (`siteOrgId` + `siteChannel`), so performAction lets a
//     `channel` entry through only when its org IS the site's. The hub door
//     (performHubAction) never sets `siteChannel` and still refuses every channel entry;
//   - records via 'app': the actor is the person, as on arts-collective's Channel pages.
import type { ActionResult } from '../types';
import { actionMeta } from '../catalogue';
import { resolveChannelOrg } from './org';
import { performAction } from './run';
import type { ActionSources } from './status';

/** The Channel entries a site may perform for its own org. */
export const SITE_CHANNEL_ACTIONS: readonly string[] = [
  'channel-suggestion-accept',
  'channel-suggestion-dismiss',
  'channel-slot-fill',
  'channel-plan-step',
  'channel-plan',
  'channel-delivery-save',
];

export interface SiteChannelActor {
  userId: string;
  email: string;
}

export async function performSiteChannelAction(
  site: { orgId: string },
  actor: SiteChannelActor | null,
  id: string,
  input: unknown,
  opts: {
    /** The entries this host's pages offer; within SITE_CHANNEL_ACTIONS. Absent: all of them. */
    allow?: readonly string[];
    /** Host readers (`channel-plan` reads the Queue's suggestion rules through `channelPlanProposals`). */
    sources?: ActionSources;
  } = {},
): Promise<ActionResult> {
  if (!actor?.userId) return { ok: false, error: 'Sign in first.', code: 'auth' };
  const entry = String(id);
  if (!SITE_CHANNEL_ACTIONS.includes(entry) || (opts.allow && !opts.allow.includes(entry)) || actionMeta(entry)?.scope !== 'channel') {
    return { ok: false, error: 'This cannot be done from here.', code: 'unknown' };
  }
  const orgId = await resolveChannelOrg(actor.userId, site.orgId);
  if (!orgId || orgId !== site.orgId) {
    return { ok: false, error: 'Only the organisation’s owners and guides run its channel.', code: 'forbidden' };
  }
  return performAction(
    entry,
    { userId: actor.userId, email: actor.email, orgId, orgClaim: site.orgId, siteOrgId: site.orgId, siteChannel: true, via: 'app', sources: opts.sources },
    input,
  );
}
