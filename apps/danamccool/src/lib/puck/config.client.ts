"use client";

import { SHARED_BLOCKS } from "@elkdonis/blocks";
import { createElement } from "react";
import type { PropDef } from "@elkdonis/blocks";
import { buildEditorConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { ArtworkPickerField } from "@/components/studio/artwork-picker";
import { GalleryPickerField } from "@/components/studio/gallery-picker";
import { GalleryPicturesField } from "@/components/studio/gallery-pictures-field";
import { SITE_BLOCKS } from "@/blocks";
import { PAGE_SETTINGS, PageSettingsWrap } from "@/lib/puck/page-settings";
import { boundIds } from "@/blocks/binding-ids";
import { opensIds } from "@/blocks/nested";

// ============================================================================
// The catalogue as Dana sees it while editing.
//
// The feed resolver is what lets the rest of the network put things ON this
// site: a thread composed in the CMS — a post, a service, an offering —
// appears wherever a Feed block is placed, without anybody editing the page
// again. A page becomes a blog or a services listing by holding that block.
//
// It runs in the BROWSER here, inside the editor's iframe, where there is no
// database — so it goes over HTTP. Its twin in config.server.ts reads the
// database directly, because a server rendering its own page has no reason to
// call itself. Same catalogue, two resolver sets; see the note on
// BlockResolvers.
// ============================================================================

/**
 * GET a JSON body and take one key from it. An editor that cannot reach the
 * data shows the block empty; throwing would leave it stuck in Puck's
 * loading state with no way out.
 */
async function getJson<T>(url: string, key: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    const body = (await res.json()) as Record<string, unknown>;
    return (body[key] as T) ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchBound(props: Record<string, unknown>) {
  const ids = boundIds(props);
  if (ids.length === 0) return {};
  return getJson(`/api/blocks/artworks?ids=${encodeURIComponent(ids.join(","))}`, "bound", {});
}

const clientResolvers: BlockResolvers = {
  "thread-feed": async (props) => {
    const params = new URLSearchParams();
    if (typeof props.limit === "number") params.set("limit", String(props.limit));
    try {
      const res = await fetch(`/api/blocks/thread-feed?${params}`);
      if (!res.ok) return { items: [] };
      const body = (await res.json()) as { items?: unknown };
      return { items: Array.isArray(body.items) ? body.items : [] };
    } catch {
      // An editor that cannot reach the feed shows an empty one. Throwing
      // would leave the block stuck in Puck's loading state with no way out.
      return { items: [] };
    }
  },
  // Her artworks, over HTTP for the same reason as the feed: the canvas runs
  // in the browser. Only ids are stored in the page; these read the records.
  "dm-artwork-wall": async (props, metadata) => {
    const bound = await fetchBound(props);
    if (props.source === "chosen") return { items: [], bound };
    const params = new URLSearchParams();
    if (props.source === "gallery") {
      if (typeof props.gallery === "string" && props.gallery) params.set("gallery", props.gallery);
      else if (typeof metadata.slug === "string") params.set("page", metadata.slug);
    }
    if (typeof props.collection === "string") params.set("collection", props.collection);
    if (typeof props.limit === "number") params.set("limit", String(props.limit));
    if (props.includePortfolio === false) params.set("portfolio", "0");
    return { bound, items: await getJson(`/api/blocks/artworks?${params}`, "items", []) };
  },
  "dm-plate": async (props) => ({ bound: await fetchBound(props) }),
  "dm-image-set": async (props) => {
    const ids = opensIds(props);
    const [bound, nested] = await Promise.all([
      fetchBound(props),
      ids.length ? getJson(`/api/blocks/nested?ids=${encodeURIComponent(ids.join(","))}`, "nested", {}) : {},
    ]);
    return { bound, nested };
  },
  "dm-circle-text": async (props) => ({ bound: await fetchBound(props) }),
  // In the editor the grid is never editable: Puck's own drag would fight it.
  "dm-gallery-grid": async (props, metadata) => {
    const params = new URLSearchParams();
    if (typeof props.gallery === "string" && props.gallery) params.set("gallery", props.gallery);
    else if (typeof metadata.slug === "string") params.set("page", metadata.slug);
    const body = await getJson<{ galleryId: string | null; title?: string; items: unknown[]; nested?: unknown }>(
      `/api/blocks/gallery-grid?${params}`,
      "grid",
      { galleryId: null, items: [] }
    );
    return { galleryId: body.galleryId, galleryTitle: body.title ?? "", items: body.items, nested: body.nested ?? {}, editable: false };
  },
  "dm-writing-shelf": async (props) => ({
    items: await getJson(`/api/blocks/writing?limit=${typeof props.limit === "number" ? props.limit : 5}`, "items", []),
  }),
};

export const puckConfig = buildEditorConfig({
  resolvers: clientResolvers,
  // The shared catalogue plus this site's own. The registry has offered this
  // since it was written — `createCatalogue([...SHARED_BLOCKS, ...orgBlocks])`
  // — and nothing had taken it up until there was a block only one site could
  // safely carry.
  blocks: [...SHARED_BLOCKS, ...SITE_BLOCKS],
  // The page's own settings (fonts) — see lib/puck/page-settings.tsx.
  root: { props: PAGE_SETTINGS, wrap: PageSettingsWrap },
  fields: {
    // A string that BINDS to a record gets a picker for that record; every
    // other string keeps Puck's own text box (null = leave it alone).
    string: (prop: PropDef) =>
      prop.binds === "artwork"
        ? function ArtworkProp(props: Record<string, unknown>) {
            return createElement(ArtworkPickerField, props as never);
          }
        : prop.binds === "gallery"
          ? function GalleryProp(props: Record<string, unknown>) {
              return createElement(GalleryPickerField, props as never);
            }
          : prop.binds === "opens-gallery"
            ? function OpensGalleryProp(props: Record<string, unknown>) {
                return createElement(GalleryPickerField, { ...props, emptyLabel: "None — an ordinary picture" } as never);
              }
          : prop.binds === "gallery-pictures"
            ? function GalleryPicturesProp(props: Record<string, unknown>) {
                return createElement(GalleryPicturesField, props as never);
              }
            : null,
  },
  media: {
    // This site's own upload route: images only, stored under the uploader's
    // own folder rather than the org's, matching how her galleries already
    // store work — an artist's pictures follow her.
    uploadEndpoint: "/api/media/upload",
    // Both are folder trees in Nextcloud, browsed and searched in the picker.
    // The site's first: her old Format site's pictures are filed there, one
    // folder per old page.
    libraries: [
      { key: "site", label: "Site images", endpoint: "/api/media/library" },
      { key: "mine", label: "Dana's images", endpoint: "/api/media/library/mine" },
    ],
  },
});
