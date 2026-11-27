import 'server-only';

// The Channel hub card's server half and its data route (Content cornerstone Step 4, 2026-11-26).
//
// An app supplies a loader and a door and nothing else (~20 lines; MOUNTING.md):
//
//   const door: ChannelHubDoor = {
//     viewer: async () => getApiEditor(),                       // owner or guide of THIS site's org, else null
//     load: (v) => loadHubChannel(v),                           // channelHubData(await loadSiteChannel(v), links, orgName)
//   };
//   export const channelServer = channelHubServer((site, v) => loadHubChannel(v));   // HubViewer has no email: the app looks it up
//   export const { GET } = channelHubRoutes(door);            // app/api/hub/channel/route.ts
//
// The write door stays a host server action (it must be 'use server'); the mount's `act` is bound to it.

import { defineHubCardServer, type HubCardServerDef, type HubSite, type HubViewer } from '@elkdonis/hub/contract';
import type { ChannelHubData } from './data';

export type ChannelHubLoader = (site: HubSite, viewer: HubViewer) => Promise<ChannelHubData>;

/** The card's server half: the face and the detail carry the same ChannelHubData. */
export function channelHubServer(load: ChannelHubLoader): HubCardServerDef<ChannelHubData, ChannelHubData> {
  return defineHubCardServer<ChannelHubData, ChannelHubData>({
    id: 'channel',
    load,
    loadDetail: (site, viewer) => load(site, viewer),
  });
}

export interface ChannelHubDoor<V = { userId: string; email: string }> {
  /** The signed-in owner or guide of this site's org (the same gate as /channel), else null. Never reads the org from the request. */
  viewer(req: Request): Promise<V | null>;
  load(viewer: V): Promise<ChannelHubData>;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/hub/channel for a site, as sunjay's route answers it: 403 for anyone but an owner or guide,
 * 500 with a plain message when the read fails, `no-store` always. Export `dynamic = "force-dynamic"` in the route file.
 */
export function channelHubRoutes<V>(door: ChannelHubDoor<V>) {
  return {
    async GET(req: Request): Promise<Response> {
      const viewer = await door.viewer(req);
      if (!viewer) return Response.json({ error: 'Owners and guides only' }, { status: 403, headers: NO_STORE });
      try {
        return Response.json(await door.load(viewer), { headers: NO_STORE });
      } catch (err) {
        console.error('[api/hub/channel]', err);
        return Response.json({ error: 'Channel could not be read' }, { status: 500, headers: NO_STORE });
      }
    },
  };
}

/** The name CONTRACT section 8 uses: channelServer(load) returns the card server half. */
export const channelServer = channelHubServer;
