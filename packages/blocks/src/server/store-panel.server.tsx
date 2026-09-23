import { loadProfileGallery, loadProfileStore } from "./profile.server";
import { loadGalleryGridData, loadNestedGalleries } from "./gallery-grid.server";

// Not imported from @elkdonis/page-builder: that package depends on THIS
// one (it adapts @elkdonis/blocks to Puck), so importing it back here would
// be a cycle. Structurally identical to page-builder's own BlockResolvers —
// TypeScript checks the shape, not where it was declared, so a caller
// assigning this to a `BlockResolvers`-typed slot needs nothing more.
type ResolverMap = Record<
  string,
  (props: Record<string, unknown>, metadata: Record<string, unknown>) => Promise<Record<string, unknown>>
>;

// ============================================================================
// Server resolvers for a PUBLISHED store panel — a person's user_pages
// document, rendered on an org's own page.
//
// Unlike the editor (which always resolves the SIGNED-IN person's own work,
// read from the session), a render can be showing anybody's panel — the org
// page decides whose, and hands the id down as `metadata.profileUserId`.
// Every resolver here reads it from there and nowhere else: a block's own
// `artist` prop still takes precedence when set (the existing bind-or-typed
// rule every profile-* block already follows), so a host CAN feature a
// fellow member's panel on someone else's, and usually won't need to.
//
// Direct database reads — this runs on the SERVER, in the app rendering the
// page, not in Puck's editor iframe. See config.client.ts (per app) for the
// HTTP-hop twin this mirrors.
// ============================================================================

export function storePanelServerResolvers(): ResolverMap {
  return {
    "profile-gallery": async (props, metadata) => {
      const userId = (typeof props.artist === "string" && props.artist) || (metadata.profileUserId as string | undefined);
      if (!userId) return { pictures: [] };
      const loaded = await loadProfileGallery(userId, {
        gallery: typeof props.gallery === "string" && props.gallery ? props.gallery : undefined,
        limit: typeof props.limit === "number" ? props.limit : undefined,
        link: typeof props.link === "string" ? props.link : undefined,
      });
      return { galleryTitle: loaded?.title ?? "", pictures: loaded?.pictures ?? [] };
    },
    "profile-store": async (props, metadata) => {
      const userId = (typeof props.artist === "string" && props.artist) || (metadata.profileUserId as string | undefined);
      const marketplaceUrl = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009";
      if (!userId) return { store: null, artworks: [], marketplaceUrl };
      const showcase = await loadProfileStore(userId, {
        limit: typeof props.limit === "number" ? props.limit : undefined,
      });
      return {
        store: showcase?.store ?? null,
        artworks: showcase?.artworks ?? [],
        marketplaceUrl,
        from: metadata.orgId,
      };
    },
    // The designed shelf reads the same store. Asked for limit + skip, so a
    // shelf that starts after a featured piece still has `limit` to show.
    "store-shelf": async (props, metadata) => {
      const userId = (typeof props.artist === "string" && props.artist) || (metadata.profileUserId as string | undefined);
      const marketplaceUrl = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009";
      if (!userId) return { store: null, artworks: [], marketplaceUrl };
      const limit = (typeof props.limit === "number" ? props.limit : 6) + (typeof props.skip === "number" ? props.skip : 0);
      const showcase = await loadProfileStore(userId, { limit });
      return {
        store: showcase?.store ?? null,
        artworks: showcase?.artworks ?? [],
        marketplaceUrl,
        from: metadata.orgId,
      };
    },
    "gallery-grid": async (props, metadata) => {
      const userId = (metadata.profileUserId as string | undefined) ?? undefined;
      if (!userId) return { galleryId: null, galleryTitle: "", items: [], nested: {}, editable: false };
      const grid = await loadGalleryGridData(userId, {
        gallery: typeof props.gallery === "string" && props.gallery ? props.gallery : undefined,
        // Editable only for the panel's OWNER, viewing their own published
        // page — never inside the design editor, where Puck's own drag
        // handles the same gesture. `metadata.viewerId` is the org page's
        // own signed-in visitor, set by the route rendering it.
        editable: Boolean(metadata.viewerId && metadata.viewerId === userId && metadata.canEdit),
      });
      const nested = await loadNestedGalleries(
        userId,
        grid.items.map((i) => i.opens).filter((x): x is string => typeof x === "string")
      );
      return {
        galleryId: grid.galleryId,
        galleryTitle: grid.title,
        items: grid.items,
        nested,
        editable: Boolean(metadata.viewerId && metadata.viewerId === userId && metadata.canEdit),
      };
    },
  };
}
