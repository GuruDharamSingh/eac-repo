import { getHubViewer } from "@/lib/hub-auth";
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

  // The wrapper carries the hub's surface palette. It has to sit OUTSIDE
  // HubSurfaces, because that is where the single <dialog> is rendered — a
  // class on `.hub` would reach the faces and miss every popup they open.
  return (
    <div className="ifac-hub-scope">
      <HubSurfaces
        signedIn={Boolean(viewer)}
        canEdit={Boolean(viewer?.canEdit)}
        displayName={viewer?.email ?? null}
      >
        {children}
      </HubSurfaces>
    </div>
  );
}
