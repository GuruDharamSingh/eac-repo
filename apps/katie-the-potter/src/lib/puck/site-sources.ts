import { itemsFromEndpoint, type PickerCopy, type PickerArtwork, type SiteSources } from "@elkdonis/page-builder";

// What the editor's pickers choose from on this site: the pieces in the
// store, over the same endpoint the blocks read.
export const katieSources: SiteSources = {
  artworks: itemsFromEndpoint<PickerArtwork>("/api/blocks/artworks?picker=1"),
};

export const katiePickerCopy: PickerCopy = {
  artworkMissing: "This piece is no longer shown on the site.",
  artworkChoose: "Choose a piece…",
  artworkSearch: "Search the pieces",
};
