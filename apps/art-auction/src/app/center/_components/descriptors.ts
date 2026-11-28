import type { SurfaceDescriptor } from "@elkdonis/cms-ui/surface";

/**
 * The /center popups, as cms-ui surface descriptors (custom keys registered in surfaces.tsx). A plain module, so
 * the server page can build them for the buttons it draws.
 */
export type StoreTab = "front" | "look" | "profile" | "shipping";

export const storeFrame = (tab: StoreTab = "front"): SurfaceDescriptor => ({
  type: "custom", key: "market-store", title: "Your store", kind: "product", size: "wide", props: { tab },
});
export const artworkFrame = (id?: string | null): SurfaceDescriptor => ({
  type: "custom", key: "market-artwork", title: id ? "Edit artwork" : "Add a work", kind: "gallery", size: "full", props: id ? { id } : {},
});
export const pieceFrame = (id: string, title?: string): SurfaceDescriptor => ({
  type: "custom", key: "market-piece", title: title ?? "Piece", kind: "gallery", size: "wide", props: { id },
});
export const entryFrame = (artworkId?: string | null): SurfaceDescriptor => ({
  type: "custom", key: "market-entry", title: "Enter a series", kind: "series", size: "standard", props: artworkId ? { artworkId } : {},
});
export const moneyFrame = (): SurfaceDescriptor => ({
  type: "custom", key: "market-money", title: "Money", kind: "service", size: "standard",
});
export const salesFrame = (): SurfaceDescriptor => ({
  type: "custom", key: "market-sales", title: "Sales", kind: "product", size: "wide",
});
export const auctionsFrame = (): SurfaceDescriptor => ({
  type: "custom", key: "market-auctions", title: "Auctions", kind: "series", size: "wide",
});
export const installationsFrame = (): SurfaceDescriptor => ({
  type: "custom", key: "market-installations", title: "Installations", kind: "gallery", size: "wide",
});
export const installationFrame = (id: string, title?: string): SurfaceDescriptor => ({
  type: "custom", key: "market-installation", title: title ?? "Installation", kind: "gallery", size: "full", props: { id },
});
export const artistFrame = (handle: string, name?: string | null): SurfaceDescriptor => ({
  type: "custom", key: "market-artist", title: name ?? "Artist", kind: "product", size: "wide", props: { handle },
});
export const artistEditFrame = (handle: string): SurfaceDescriptor => ({
  type: "custom", key: "market-artist-edit", title: "Edit profile", kind: "product", size: "wide", props: { handle },
});
