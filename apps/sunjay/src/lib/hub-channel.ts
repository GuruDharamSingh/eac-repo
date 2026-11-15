import { channelHubData } from "@elkdonis/channel/hub/server";
import { handoffUrl } from "@elkdonis/auth-server";
import { setStudioBackParams } from "@elkdonis/utils/studio-back";
import { loadSiteChannel } from "@/lib/channel-model";
import { siteConfig } from "@/config/site";

/**
 * The hub's Channel card data (2026-11-15; docs/open/channel-convergence-2026-11-15/F-hub-card-built.md): the
 * site's own org channel through the shared loader (lib/channel-model.ts, a2's), reduced to plain ChannelHubData.
 * Used by the hub page (the face) and by GET /api/hub/channel (the pop-up). The caller gates on viewer.canEdit.
 */
const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_URL = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;
/** The way back from Studio: this site's own /channel, as app/channel/page.tsx builds it. */
const HERE = `https://${siteConfig.domain}/channel`;

export async function loadHubChannel(viewer: { userId: string; email: string }) {
  const model = await loadSiteChannel({ userId: viewer.userId, email: viewer.email });
  // The links ChannelSitePage builds for its own pop-up (studio, makeInto), and the kinds this site edits in place (app/channel/page.tsx editHere).
  return channelHubData(
    model,
    {
      channel: "/channel",
      quickKinds: ["meeting"],
      studio(o = {}) {
        const q = new URLSearchParams({ org: siteConfig.orgId });
        if (o.kind) q.set("kind", o.kind);
        if (o.id) q.set("id", o.id);
        setStudioBackParams(q, { back: HERE, backLabel: siteConfig.orgName });
        return handoffUrl(`${NETWORK_URL}/studio?${q.toString()}`);
      },
      makeInto(from, to) {
        const q = new URLSearchParams({ from, to, org: siteConfig.orgId });
        setStudioBackParams(q, { back: HERE, backLabel: siteConfig.orgName });
        return handoffUrl(`${NETWORK_URL}/studio/make?${q.toString()}`);
      },
    },
    siteConfig.orgName,
  );
}
