// The hub's large type and surface palette: Center is the members' area too.
import "../hub/hub-readable.css";
import { listOrgFeeds } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getHubSkin } from "@/lib/hub-skin-store";
import { HubSurfaces } from "@/components/hub/HubSurfaces";

/**
 * The surface provider around /center.
 *
 * Same floor as hub/layout.tsx (the one <dialog>, the hub palette on
 * `.ifac-hub-scope`), mounted here because Center is reached by any
 * signed-in person — a follower with no IFAC role included — where the hub
 * refuses anyone below member. The page itself decides what the viewer sees;
 * this only gives its faces somewhere to open. (Center redesign, 2026-10-18.)
 */
export default async function CenterLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const feeds = viewer?.isMember
    ? await listOrgFeeds(siteConfig.orgId, { includePrivate: true }).catch(() => [])
    : [];
  const skin = await getHubSkin(siteConfig.orgId);

  return (
    <div className="ifac-hub-scope" data-hub-skin={skin}>
      <HubSurfaces
        signedIn={Boolean(viewer)}
        userId={viewer?.userId ?? null}
        canEdit={Boolean(viewer?.canEdit)}
        isMember={Boolean(viewer?.isMember)}
        displayName={viewer?.email ?? null}
        feeds={feeds.map((feed) => ({ slug: feed.slug, name: feed.name }))}
      >
        {children}
      </HubSurfaces>
    </div>
  );
}
