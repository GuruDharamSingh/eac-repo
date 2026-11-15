// Channel on an org's own site (2026-11-14; docs/open/CHANNEL_ON_SITES_2026-11-12.md). A site mounts:
//   app/channel/page.tsx   its auth gate, then <ChannelSitePage org viewer origin networkUrl searchParams run loadModel editHere? />
//   lib/channel-model.ts   siteChannelLoader({ orgId })  (server)
//   lib/channel-door.ts    "use server": performSiteChannelAction(..., { allow: SITE_DOOR_ALLOW, sources: { channelPlanProposals } })
// and sets the site's fonts on `.kch` (--kch-font-display, --kch-font-body) if its tokens differ.
// The pure helpers (SITE_DOOR_ALLOW, Board columns, Out rows) are also at "@elkdonis/channel/site/view".
export { ChannelSitePage, type ChannelSitePageProps, type EditHere, type SiteChannelParams } from "./page";
export { BoardTab, OutTab, PieceSummary, QueueTab, MakeIntoMenu, Thumb } from "./tabs";
export { siteChannelLoader } from "./server";
export { buildPieceSummaryView, SUMMARY_STATE } from "./summary-view";
export * from "./view";
