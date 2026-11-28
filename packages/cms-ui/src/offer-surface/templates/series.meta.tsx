import type { TemplateMeta } from "./meta";

export const meta: TemplateMeta = {
  id: "series",
  component: "SeriesTemplate",
  files: {
    tsx: "packages/cms-ui/src/offer-surface/templates/series.tsx",
    css: "packages/cms-ui/src/offer-surface/templates/series.css",
    route: "apps/development/src/app/offer-templates/t/series",
  },
  packet: "derived",
  reads: [
    { path: "featured.title", required: true },
    { path: "featured.standfirst" },
    { path: "featured.description" },
    { path: "featured.when", note: "weekday and time for the WHEN / TIME cells" },
    { path: "featured.venue", note: "WHERE cell (Online or name)" },
    { path: "featured.takeUp", note: "subscribe adds the Weekly kicker" },
    { path: "owner.id", required: true },
    { path: "owner.name", required: true },
    { path: "featured.hostId" },
    { path: "featured.coHostIds[]", note: "host names after the first; each a PersonName" },
    { path: "extras.sessions[]", note: "newest first; the one with next:true is the card" },
  ],
  actions: [
    { control: "Subscribe", opens: "ser-sub" },
    { control: "Host names (PersonName)", opens: "profileLayerFor: pf-owner / pf-guest / pf-member; hover card on desktop" },
    { control: "Next session card", opens: "ser-session" },
    { control: "Earlier sessions toggle (expands the list)", opens: "inert" },
    { control: "An earlier session row", opens: "ser-session" },
  ],
  patterns: [
    { id: "fact-strip", name: "Fact strip", use: "Three cells (WHEN / TIME / WHERE) in a row, ruled above and below, divided by hairlines.", rootClass: "ost-series-strip", packet: "ser-offer", shared: true },
    { id: "next-card", name: "Next-session card", use: "Bronze-topped card for the one upcoming session.", rootClass: "ost-series-next", packet: "ser-offer" },
    { id: "session-list", name: "Session list", use: "Collapsible dashed-ruled list of earlier sessions.", rootClass: "ost-series-earlier", packet: "ser-offer" },
    { id: "rail-panel", name: "Rail panel", use: "A raised side column holding the action.", rootClass: "ost-series-rail", packet: "2n", shared: true },
  ],
  adapted: [
    "The packet has no series page: drawn from the ser-offer surface in the language of 2m and 2n.",
    "Page column is 760px. Subscribe pushes ser-sub, which pushes done (flow ser); nothing is sent (no subscribe action exists).",
    "Layers ser-offer, ser-sub and ser-session are in layers-series.tsx; they read a weekly series from featured.when until the offer model carries a session list.",
  ],
  phoneHeight: 844,
  status: "derived",
};
