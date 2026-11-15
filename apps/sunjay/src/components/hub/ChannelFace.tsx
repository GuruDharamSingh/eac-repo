"use client";

import { SurfaceCard } from "@elkdonis/cms-ui/surface";
import { ChannelHubFace, type ChannelHubData } from "@elkdonis/channel/hub";

/**
 * The hub's Channel tile (2026-11-15): a SurfaceCard whose preview is the mini matrix and whose click opens the
 * custom surface "channel" (components/hub/ChannelSurface.tsx, registered in HubSurfaces.tsx). The descriptor
 * carries no data (it is serialised into the URL); the surface reads /api/hub/channel when it opens.
 */
export function ChannelFace({ data }: { data: ChannelHubData }) {
  return (
    <SurfaceCard
      kind="board"
      glyph="▥"
      title="Channel"
      kicker="Out, planned and waiting"
      layout="header"
      preview={<ChannelHubFace data={data} />}
      surface={{ type: "custom", key: "channel", title: "Channel", kind: "board", size: "full" }}
    />
  );
}
