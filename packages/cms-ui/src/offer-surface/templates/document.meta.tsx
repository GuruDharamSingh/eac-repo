import type { TemplateMeta } from "./meta";

export const meta: TemplateMeta = {
  id: "document",
  component: "DocumentTemplate",
  files: {
    tsx: "packages/cms-ui/src/offer-surface/templates/document.tsx",
    css: "packages/cms-ui/src/offer-surface/templates/document.css",
    route: "apps/development/src/app/offer-templates/t/document",
  },
  packet: "2k",
  reads: [
    { path: "pieces[0].title", required: true },
    { path: "pieces[0].standfirst" },
    { path: "pieces[0].date" },
    { path: "pieces[0].minutes" },
    { path: "pieces[0].series" },
    { path: "owner.name", required: true },
    { path: "site.name" },
    { path: "pieces[0].sections[]", required: true },
    { path: "pieces[0].version" },
    { path: "pieces[0].facts[]" },
    { path: "pieces[0].footnotes[]" },
  ],
  actions: [
    { control: "Profile (top bar)", opens: "link to /profile" },
    { control: "+ Follow", opens: "follow / pf-owner" },
    { control: "Contents entries", opens: "anchor scroll" },
    { control: "Download PDF", opens: "inert" },
  ],
  patterns: [
    { id: "contents-rail", name: "Contents rail", use: "Numbered section list that follows the reader.", rootClass: "ost-doc-rail", packet: "2k" },
    { id: "fact-strip", name: "Facts row", use: "Three ruled label/value cells under the title.", rootClass: "ost-doc-facts", packet: "2k", shared: true },
    { id: "numbered-section", name: "Numbered section", use: "Bronze number beside a heading and text.", rootClass: "ost-doc-sec", packet: "2k" },
    { id: "footnotes", name: "Footnotes", use: "Mono notes at the foot, marked by a sup beside the heading.", rootClass: "ost-doc-notes", packet: "2k" },
  ],
  adapted: [
    "Footnote marker sits beside the section heading, not inside the text (section html is opaque).",
    "Phone: contents become a wrapped strip; the text flows on the page (no inner pane).",
  ],
  phoneHeight: 1292,
  status: "draft",
};
