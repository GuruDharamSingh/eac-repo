"use client";

import { STORE_PANEL_BLOCKS } from "@elkdonis/blocks";
import { buildEditorConfig, type BlockResolvers } from "@elkdonis/page-builder";

// ============================================================================
// The store panel's catalogue, as its OWNER sees it while designing.
//
// A restricted palette (STORE_PANEL_BLOCKS — see @elkdonis/blocks' own
// comment on it), not the shared catalogue every org page gets: the panel
// renders inside a fixed, bounded section of someone ELSE's page, so no hero
// banners, no thread feeds, nothing that assumes it owns the whole page.
//
// Resolvers run in the BROWSER, inside Puck's iframe, where there is no
// database — so they go over HTTP to this app's own /api/store-panel/*
// routes, mirroring danamccool's config.client.ts exactly. Every route reads
// the signed-in user from the session, never from a request parameter: this
// editor can only ever be designing the SIGNED-IN person's own panel.
//
// `gallery-grid` reads /api/store-panel/gallery-grid, which resolves both the
// grid itself and every gallery its tiles open (loadGalleryGridData +
// loadNestedGalleries, @elkdonis/blocks/server — the generalised form of
// danamccool's own query). Never editable in the editor, whoever's it is:
// Puck's own drag would fight the grid's.
// ============================================================================

async function getJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

const resolvers: BlockResolvers = {
  "profile-gallery": async (props) => {
    const params = new URLSearchParams();
    if (typeof props.gallery === "string" && props.gallery) params.set("gallery", props.gallery);
    if (typeof props.limit === "number") params.set("limit", String(props.limit));
    const body = await getJson<{ title: string; pictures: unknown[] }>(
      `/api/store-panel/gallery?${params}`,
      { title: "", pictures: [] }
    );
    return { galleryTitle: body.title, pictures: body.pictures };
  },
  "profile-store": async (props) => {
    const params = new URLSearchParams();
    if (typeof props.limit === "number") params.set("limit", String(props.limit));
    const body = await getJson<{ store: unknown; artworks: unknown[] }>(
      `/api/store-panel/store?${params}`,
      { store: null, artworks: [] }
    );
    return { store: body.store, artworks: body.artworks, marketplaceUrl: window.location.origin };
  },
  // Same store as profile-store; limit + skip so a shelf starting after a
  // featured piece still has `limit` to show.
  "store-shelf": async (props) => {
    const limit = (typeof props.limit === "number" ? props.limit : 6) + (typeof props.skip === "number" ? props.skip : 0);
    const body = await getJson<{ store: unknown; artworks: unknown[] }>(
      `/api/store-panel/store?limit=${limit}`,
      { store: null, artworks: [] }
    );
    return { store: body.store, artworks: body.artworks, marketplaceUrl: window.location.origin };
  },
  "gallery-grid": async (props, metadata) => {
    const params = new URLSearchParams();
    if (typeof props.gallery === "string" && props.gallery) params.set("gallery", props.gallery);
    const body = await getJson<{ galleryId: string | null; title?: string; items: unknown[]; nested?: unknown }>(
      `/api/store-panel/gallery-grid?${params}`,
      { galleryId: null, items: [] }
    );
    return {
      galleryId: body.galleryId,
      galleryTitle: body.title ?? "",
      items: body.items,
      nested: body.nested ?? {},
      editable: false,
    };
  },
};

export const storePanelConfig = buildEditorConfig({
  resolvers,
  blocks: STORE_PANEL_BLOCKS,
  media: {
    uploadEndpoint: "/api/upload",
  },
});
