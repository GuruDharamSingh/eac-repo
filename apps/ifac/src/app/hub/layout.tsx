import { listOrgFeeds } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getHubViewer } from "@/lib/hub-auth";
import { getHubSkin } from "@/lib/hub-skin-store";
import { HubSurfaces } from "@/components/hub/HubSurfaces";

/**
 * The surface provider, scoped to the members' area.
 *
 * Mounted HERE rather than in the root layout, unlike amrit-canada. Resolving
 * a viewer needs cookies, and doing that in IFAC's root layout would make
 * every public page on the site dynamic — this app is mostly a public roster,
 * so that is a real cost for a capability only the hub uses. Widening it
 * later is moving one component up a level.
 *
 * The consequence, stated plainly: a card on a public IFAC page cannot open a
 * surface. Nothing outside /hub asks to today.
 */
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getHubViewer();

  // The org's sections, for the compose surface's "Section" field. Private
  // ones included: an owner composing needs to be able to file something into
  // a members-only section. Read here rather than on each page because the
  // provider is what needs them, and the provider is mounted here.
  const feeds = viewer
    ? await listOrgFeeds(siteConfig.orgId, { includePrivate: true }).catch(() => [])
    : [];

  // Which look the hub wears. Read HERE rather than on the page because the
  // single <dialog> every surface opens in is rendered by the provider below,
  // outside the page — a skin set on the page would restyle the tiles and
  // miss every popup they open, which is the exact trap `.ifac-hub-scope`
  // itself exists to avoid.
  const skin = await getHubSkin(siteConfig.orgId);

  // The wrapper carries the hub's surface palette. It has to sit OUTSIDE
  // HubSurfaces, because that is where the single <dialog> is rendered — a
  // class on `.hub` would reach the faces and miss every popup they open.
  return (
    <div className="ifac-hub-scope" data-hub-skin={skin}>
      <HubSurfaces
        signedIn={Boolean(viewer)}
        canEdit={Boolean(viewer?.canEdit)}
        displayName={viewer?.email ?? null}
        feeds={feeds.map((feed) => ({ slug: feed.slug, name: feed.name }))}
      >
        {children}
      </HubSurfaces>
    </div>
  );
}
