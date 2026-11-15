import { db } from "@elkdonis/db";
import type { ChannelPlanProposal } from "@elkdonis/actions";
import { loadChannelModel } from "../load";
import type { ChannelModel } from "../model";

/**
 * A site's own org channel, read through the shared Channel loader (2026-11-14; first in
 * katie-the-potter's lib/channel-model.ts). Always the site's org: the loader admits an org
 * channel only for its owners and guides, and the site's route gates on its own editor roles
 * before it calls `load`. `planProposals` is the registry's reader for `channel-plan` through
 * the site's door (ActionSources.channelPlanProposals).
 */
export function siteChannelLoader(site: {
  orgId: string;
  networkHost?: string;
  /** The site's own rule for where a thread lives (ChannelDeps.threadPath); absent: "/<slug>". */
  threadPath?: (t: { id: string; orgId: string; kind: string; section: string | null; slug: string }) => string | null;
}) {
  const networkHost = site.networkHost ?? process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
  const proto = (host: string) => (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  /** As arts-collective's getOrgHomeUrl: the verified primary domain, else the network subdomain. */
  const getOrgHomeUrl = (org: { slug: string; primaryDomain?: string | null }): string =>
    org.primaryDomain ? `https://${org.primaryDomain}` : `${proto(networkHost)}://${org.slug}.${networkHost}`;

  /** `opts.week` (2026-11-15): the Queue's week view, any day of the week ("YYYY-MM-DD"). */
  const load = (viewer: { userId: string; email: string }, opts: { week?: string } = {}): Promise<ChannelModel> =>
    loadChannelModel({ id: viewer.userId, email: viewer.email }, { org: site.orgId, ...(opts.week ? { week: opts.week } : {}) }, { getOrgHomeUrl, threadPath: site.threadPath });

  const planProposals = async (q: { userId: string; orgId: string | null; pieceKey: string }): Promise<ChannelPlanProposal[] | null> => {
    if (q.orgId !== site.orgId) return null;
    const [u] = await db<Array<{ email: string | null }>>`SELECT email FROM users WHERE id = ${q.userId} LIMIT 1`;
    if (!u) return null;
    const model = await load({ userId: q.userId, email: u.email ?? "" });
    const piece = model.pieces.find((p) => p.key === q.pieceKey);
    if (!piece) return null;
    return piece.suggestions.map((s) => ({ outlet: s.outlet, text: s.text, reason: s.reason, at: s.at }));
  };

  return { load, planProposals };
}
