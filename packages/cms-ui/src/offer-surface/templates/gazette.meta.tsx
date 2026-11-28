import type { TemplateMeta } from "./meta";

export const meta: TemplateMeta = {
  id: "gazette",
  component: "GazetteTemplate",
  files: {
    tsx: "packages/cms-ui/src/offer-surface/templates/gazette.tsx",
    css: "packages/cms-ui/src/offer-surface/templates/gazette.css",
    route: "apps/development/src/app/offer-templates/t/gazette",
  },
  packet: "2l",
  reads: [
    { path: "pieces[0].title", required: true },
    { path: "pieces[0].standfirst" },
    { path: "pieces[0].date" },
    { path: "pieces[0].minutes" },
    { path: "pieces[0].series" },
    { path: "owner.name", required: true },
    { path: "site.name" },
    { path: "pieces[0].bodyHtml", required: true },
    { path: "pieces[0].picture" },
    { path: "pieces[0].n" },
    { path: "pieces[1..3]", note: "Also in this issue" },
  ],
  actions: [
    { control: "Profile (masthead)", opens: "link to /profile" },
    { control: "Author name", opens: "profile layer (pf-owner) + hover card on desktop" },
    { control: "+ Follow", opens: "follow / pf-owner" },
    { control: "Also in this issue", opens: "wr-read" },
  ],
  patterns: [
    { id: "masthead", name: "Masthead", use: "Replaces the nav bar: date line, double-ruled site name, issue strip, Profile and Follow.", rootClass: "ost-gaz-mast", packet: "2l" },
    { id: "justified-columns", name: "Justified columns with drop cap", use: "Three ruled justified columns.", rootClass: "ost-gaz-cols", packet: "2l", shared: true },
    { id: "also-in-issue", name: "Also in this issue", use: "Three titles under a double rule.", rootClass: "ost-gaz-also", packet: "2l" },
  ],
  adapted: [
    "Phone: columns collapse to one and flow on the page (no inner pane).",
  ],
  phoneHeight: 844,
  status: "draft",
};
