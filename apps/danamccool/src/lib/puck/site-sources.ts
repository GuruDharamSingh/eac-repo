import { itemsFromEndpoint, type PickerCopy, type PickerArtwork, type SiteSources } from "@elkdonis/page-builder";
import { listGalleriesForHud } from "@/lib/gallery-actions";
import { listPagesForHud } from "@/lib/hud-actions";

// ============================================================================
// What the editor's pickers choose from on this site: her artworks (the same
// endpoint the blocks read), her galleries and her pages (the hub's own
// actions). Read by the Puck fields (config.client.ts) and, once there is a
// canvas, by `recordSourcesFrom(danaSources)`.
// ============================================================================

export const danaSources: SiteSources = {
  artworks: itemsFromEndpoint<PickerArtwork>("/api/blocks/artworks?picker=1"),
  galleries: () => listGalleriesForHud().then((r) => ("error" in r ? [] : r.galleries)),
  pages: () => listPagesForHud().then((r) => ("error" in r ? [] : r.pages)),
};

// Her words: "her pieces", as the hand-written pickers said.
export const danaPickerCopy: PickerCopy = {
  artworkSearch: "Search her artworks",
  pageLinkLoading: "Loading her pages…",
  recordArtwork: "One of her artworks",
  recordGallery: "One of her galleries",
};
