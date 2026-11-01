/**
 * The Center's API routes as one factory (2026-11-01), so every org app
 * mounts the same set instead of its own drifting copy. Today it carries
 * the connections routes; the other Center routes (profile, presence,
 * post, listings, follow, layout) join as they are unified. A host does:
 *
 *   const { connections } = centerRoutes({ who: async () => (await getViewer())?.userId ?? null });
 *   export const GET = connections.GET;  // in app/api/center/connections/route.ts
 */

import { connectionsHandlers } from './connections';

export function centerRoutes(opts: { who: () => Promise<string | null> }) {
  return {
    connections: connectionsHandlers(opts.who),
  };
}
