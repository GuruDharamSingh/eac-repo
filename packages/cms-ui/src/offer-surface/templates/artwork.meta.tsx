import type { TemplateMeta } from "./meta";

export const meta: TemplateMeta = {
  id: "artwork",
  component: "ArtworkTemplate",
  files: {
    tsx: "packages/cms-ui/src/offer-surface/templates/artwork.tsx",
    css: "packages/cms-ui/src/offer-surface/templates/artwork.css",
    route: "apps/development/src/app/offer-templates/t/artwork",
  },
  packet: "derived",
  reads: [
    { path: "featured.title", required: true },
    { path: "featured.takeUp", required: true, note: "order shows Order · price" },
    { path: "featured.price" },
    { path: "featured.standfirst" },
    { path: "featured.description", note: "artist's note" },
    { path: "featured.images[]", note: "up to three; empty string = placeholder" },
    { path: "featured.poster" },
    { path: "featured.artwork.medium" },
    { path: "featured.artwork.size" },
    { path: "featured.artwork.edition" },
    { path: "featured.artwork.shipping" },
    { path: "featured.artwork.collect" },
    { path: "owner.id", required: true },
    { path: "owner.name", required: true, note: "the artist line" },
    { path: "extras.replyNote" },
  ],
  actions: [
    { control: "Order · price", opens: "art-offer" },
    { control: "Ask about this work (when not orderable)", opens: "pf-owner" },
    { control: "Profile → (host row)", opens: "pf-owner" },
    { control: "Artist name (PersonName)", opens: "pf-owner via profileLayerFor; hover card on desktop" },
    { control: "Thumbnails", opens: "inert" },
  ],
  patterns: [
    { id: "work-stage", name: "Work stage", use: "The work shown large with a row of thumbnails; the selected one has a bronze border.", rootClass: "ost-artwork-stage", packet: "art-offer" },
    { id: "spec-rows", name: "Spec rows", use: "Mono label (80px) and value, divided by dashed lines.", rootClass: "ost-artwork-spec", packet: "art-offer", shared: true },
    { id: "rail-panel", name: "Rail panel", use: "A raised side column holding the facts and the primary action.", rootClass: "ost-artwork-rail", packet: "2n", shared: true },
    { id: "host-row", name: "Host row", use: "Avatar, name, reply note and a Profile button.", rootClass: "ost-artwork-host", packet: "2n", shared: true },
  ],
  adapted: [
    "The packet has no artwork page: drawn from the art-offer surface (work, thumbs, spec rows, Order button) in the layout language of 2m and 2n.",
    "Page column is 860px (picture-forward, no packet width to follow).",
    "Thumbnails are 84x56 beside the work, not the surface's 44px strip.",
  ],
  phoneHeight: 1071,
  status: "derived",
};
