import type { TemplateMeta } from "./meta";

export const meta: TemplateMeta = {
  id: "feature",
  component: "FeatureTemplate",
  files: {
    tsx: "packages/cms-ui/src/offer-surface/templates/feature.tsx",
    css: "packages/cms-ui/src/offer-surface/templates/feature.css",
    route: "apps/development/src/app/offer-templates/t/feature",
  },
  packet: "2h",
  reads: [
    { path: "pieces[0].title", required: true },
    { path: "pieces[0].standfirst" },
    { path: "pieces[0].date" },
    { path: "pieces[0].minutes" },
    { path: "pieces[0].series" },
    { path: "owner.name", required: true },
    { path: "site.name" },
    { path: "pieces[0].cover" },
    { path: "pieces[0].bodyHtml", required: true },
    { path: "pieces[0].picture" },
    { path: "pieces[0].caption" },
    { path: "pieces[0].pullQuote" },
    { path: "pieces[0].sections[1]" },
    { path: "pieces[1..3]", note: "More writing strip" },
  ],
  actions: [
    { control: "Profile (top bar)", opens: "link to /profile" },
    { control: "Author name", opens: "profile layer (pf-owner) + hover card on desktop" },
    { control: "+ Follow", opens: "follow / pf-owner" },
    { control: "More writing cards", opens: "wr-read" },
  ],
  patterns: [
    { id: "full-bleed-cover", name: "Full-bleed cover with title", use: "Cover image or placeholder carrying kicker, title and byline.", rootClass: "ost-feature-cover", packet: "2h" },
    { id: "breakout-picture", name: "Breakout picture", use: "Picture running to the edges of the text column, caption under.", rootClass: "ost-feature-break", packet: "2h" },
    { id: "pull-quote-mark", name: "Pull quote with bronze mark", use: "Large quote beside an oversized quote mark.", rootClass: "ost-feature-pull", packet: "2h", shared: true },
    { id: "more-strip", name: "More writing strip", use: "Three small cards for other pieces at the foot.", rootClass: "ost-feature-more", packet: "2h" },
  ],
  adapted: [
    "Page scrolls at the packet height; content is centred in a 980px column on wide screens.",
    "Desktop 1280x800 page height 1259 (packet height, under two screens).",
    "Phone: intro runs in one column; the strip stays three small cards.",
  ],
  phoneHeight: 1445,
  status: "draft",
};
