import { contentServer } from "@elkdonis/content/hub/server";
import { contentHost } from "@/lib/content-host";

/**
 * The keepers' two mounts of the one Content card. Artworks asks for hidden pieces too (keepers only; the server
 * checks it), so a hidden piece shows its Hidden badge and a Show button.
 */
export const artworksServer = contentServer({
  host: contentHost,
  // Round 2 (Justin, 2026-11-26): one card. Opens on the market's own works, toggles to the collective's; the Kind
  // select (Artwork first) replaces a fixed type list; large tiles, no grouping (Sort offers "By store").
  preset: {
    id: "artworks",
    title: "Artworks",
    scope: { kind: "site" },
    includeHidden: true,
    scopes: { site: "Collect Art", network: "The collective" },
    kinds: [
      { label: "Artwork", types: ["artwork", "product"] },
      { label: "Writing", types: ["writing"] },
      { label: "Everything" },
    ],
  },
});
export const libraryServer = contentServer({
  host: contentHost,
  preset: { id: "library", title: "Content library", scope: { kind: "site" } },
});

export const CONTENT_SERVERS = { artworks: artworksServer, library: libraryServer } as const;
export type ContentPresetId = keyof typeof CONTENT_SERVERS;
