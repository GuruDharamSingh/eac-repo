// The Channel hub card (2026-11-15; docs/open/channel-convergence-2026-11-15 F): the face and the pop-up body, React only.
// The reducer (ChannelModel -> ChannelHubData) is "@elkdonis/channel/hub/server". Style: "@elkdonis/channel/hub.css"
// (plus "@elkdonis/channel/site.css", "@elkdonis/content/content.css" and "@elkdonis/content/summary.css").
export { ChannelHubFace, dotLabel } from "./Face";
export { ChannelHubPanel, type ChannelHubPanelProps } from "./Panel";
export type { ChannelHubData, ChannelHubMatrix, ChannelHubPiece, ChannelHubMove, HubDot } from "./data";
