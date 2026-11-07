"use client";

import { createElement, type ReactNode } from "react";
import type { PropDef } from "@elkdonis/blocks";
import { contractOf } from "@elkdonis/blocks/contract";
import { buildEditorConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { buildPuckConfig } from "@elkdonis/page-builder/config";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { fontVariables } from "@/lib/fonts";
import { CATALOGUE } from "@/lib/puck/catalogue";
import { boundIds } from "@/blocks/binding-ids";
import { samplePieces, type Piece } from "@/blocks/artwork-data";
import { layoutFromPlacement } from "@/blocks/piece-layout";
import { navFor } from "@/blocks/piece-details";
import { ArtworkPickerField } from "@/components/studio/artwork-picker";

// ============================================================================
// The catalogue as the EDITOR sees it. Resolvers run in the browser, inside
// Puck's preview iframe, where there is no database, so they go over HTTP to
// /api/blocks/artworks. Every keyed read (`props.limit`, `metadata.placement`)
// is deliberate: the adapter remembers a resolver's answer until a key it READ
// changes, so a keystroke does not refetch while a MOVE (placement) does.
//
// Samples, labelled, are shown where the real thing is not there yet: the grid
// before the store has listings, and on the piece-detail template (edited at
// /studio/piece-detail), where an unbound piece stands for "the page's own".
// The same resolvers draw the "Edit look" popup (canvasConfig), so a block
// looks the same there as on the canvas.
// ============================================================================

const TEMPLATE = "piece-detail";

async function getJson<T>(url: string, key: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    const body = (await res.json()) as Record<string, unknown>;
    return (body[key] as T) ?? fallback;
  } catch {
    // An editor that cannot reach the data shows the block empty; throwing
    // would leave it stuck in Puck's loading state with no way out.
    return fallback;
  }
}

async function boundPiece(id: string): Promise<Piece | null> {
  if (!id) return null;
  const bound = await getJson<Record<string, Piece>>(`/api/blocks/artworks?ids=${encodeURIComponent(id)}`, "bound", {});
  return bound[id] ?? null;
}

/** On the template, an unbound block stands for the page's own piece: a labelled sample. */
const templateSample = (metadata: Record<string, unknown>) => (metadata.slug === TEMPLATE ? samplePieces()[0]! : null);

const clientResolvers: BlockResolvers = {
  "ktp-artwork-grid": async (props, metadata) => {
    if (props.source === "more") {
      const pieces = metadata.slug === TEMPLATE ? samplePieces().slice(1, 1 + (typeof props.limit === "number" ? props.limit : 4)) : [];
      return { pieces, bound: {}, hrefBase: "/pieces" };
    }
    const ids = boundIds(props);
    const bound = ids.length ? await getJson(`/api/blocks/artworks?ids=${encodeURIComponent(ids.join(","))}`, "bound", {}) : {};
    if (props.source === "chosen") return { pieces: [], bound, hrefBase: "/pieces" };
    const q = new URLSearchParams();
    if (typeof props.limit === "number") q.set("limit", String(props.limit));
    if (typeof props.sort === "string") q.set("sort", props.sort);
    const pieces = await getJson<unknown[]>(`/api/blocks/artworks?${q}`, "pieces", []);
    // Before the store has listings the canvas shows sample pieces (labelled
    // as such by the block), so the design can be judged.
    return { bound, pieces: pieces.length ? pieces : samplePieces(), hrefBase: "/pieces" };
  },
  "ktp-piece": async (props, metadata) => {
    const id = typeof props.artwork === "string" ? props.artwork : "";
    const bound = await boundPiece(id);
    const sample = id ? null : templateSample(metadata);
    return {
      item: bound ?? sample,
      placement: layoutFromPlacement(metadata.placement),
      sampled: Boolean(sample),
      // On the template an unbound piece stands for the page's own (see config.server.ts).
      ownPiece: Boolean(sample),
      // The canvas draws Buy now inert; whether card is on is the published page's business.
      cardOn: true,
      hrefBase: "/pieces",
    };
  },
  "ktp-piece-details": async (props, metadata) => {
    const id = typeof props.artwork === "string" ? props.artwork : "";
    const bound = await boundPiece(id);
    const sample = id ? null : templateSample(metadata);
    const all = samplePieces();
    return {
      item: bound ?? sample,
      nav: sample ? navFor(null, all[1] ?? null, "/pieces", "/#pieces") : null,
      sampled: Boolean(sample),
    };
  },
  "thread-feed": async (props) => ({
    items: await getJson(`/api/blocks/thread-feed?limit=${typeof props.limit === "number" ? props.limit : 10}`, "items", []),
  }),
};

/** The site look the canvas draws with (set by PageEditor from the stored Site style). */
let canvasSiteLook: string | null = null;
export function setCanvasSiteLook(look: string | null) {
  canvasSiteLook = look && look !== "house" ? look : null;
}

/**
 * The canvas is an iframe whose <html> lacks the font-variable classes and the
 * `data-site-look` the root layout sets on the page; its root carries both.
 */
function CanvasFonts({ children }: { settings: Record<string, unknown>; children?: ReactNode }) {
  return createElement("div", { className: fontVariables, "data-site-look": canvasSiteLook ?? undefined }, children);
}

/** What each block declares: its settings, and its parts to click into (the look layer). */
export const canvasContract = contractOf(CATALOGUE);

/**
 * The published-shape config the "Edit look" popup draws a block with (the
 * editor shape's chrome needs Puck's own context). Same resolvers as the
 * editor, so samples appear labelled there too.
 */
export const canvasConfig = buildPuckConfig({ resolvers: clientResolvers, blocks: CATALOGUE, morph: MorphMark, root: { props: [], wrap: CanvasFonts } });

export const puckConfig = buildEditorConfig({
  resolvers: clientResolvers,
  blocks: CATALOGUE,
  morph: MorphMark,
  root: { props: [], wrap: CanvasFonts },
  fields: {
    // A string that BINDS to an artwork gets the picker; every other string
    // keeps Puck's own box (null = leave it alone).
    string: (prop: PropDef) =>
      prop.binds === "artwork"
        ? function ArtworkProp(props: Record<string, unknown>) {
            return createElement(ArtworkPickerField, props as never);
          }
        : null,
  },
  media: {
    uploadEndpoint: "/api/media/upload",
    libraries: [
      { key: "site", label: "Site images", endpoint: "/api/media/library" },
      { key: "mine", label: "Katie's images", endpoint: "/api/media/library/mine" },
    ],
  },
});
