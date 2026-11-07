import { loadThreadFeed } from "@elkdonis/blocks/server";
// The /config entry, not the package's main: that also exports Puck's editor,
// and a server page importing it sends those scripts to every visitor.
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder/config";
// Server-safe: draws a block's stored look (`morph`); with none set the markup is unchanged.
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { currentOrgId } from "@/lib/site-org";
import { CATALOGUE } from "@/lib/puck/catalogue";
import { boundIds, loadPieceDetail, loadPieces, loadPiecesByIds, type PieceDetail } from "@/lib/artworks";
import { samplePieces, type Piece } from "@/blocks/artwork-data";
import { layoutFromPlacement } from "@/blocks/piece-layout";
import { navFor } from "@/blocks/piece-details";
import { isCardPaymentAvailable } from "@elkdonis/checkout/stripe";

// ============================================================================
// The catalogue as a PUBLISHED page sees it: same blocks, same fields, no
// field controls, and resolvers that read the database directly. `<Render>`
// applies no defaults and runs no resolvers, so every route that draws a page
// calls `resolveAllData` first. Importing this pulls @elkdonis/db in; nothing
// a client component imports may reach it.
//
// Metadata a route may pass:
//   preview      true on /preview: sample pieces instead of the store
//   pieceDetail  the route's piece and its neighbours (/pieces/<slug>, the
//                piece-detail template): an unbound ktp-piece or
//                ktp-piece-details shows it, a "more" grid lists its neighbours
//   hrefBase     where cards link (/pieces or /preview/pieces)
//   placement    added by page-builder for every block (where it sits)
// ============================================================================

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The piece a single-piece block shows: its binding, else the route's piece. */
async function pieceFor(props: Record<string, unknown>, metadata: Record<string, unknown>): Promise<Piece | null> {
  const id = str(props.artwork);
  const route = (metadata.pieceDetail as PieceDetail | undefined)?.piece ?? null;
  if (!id) return route;
  if (metadata.preview === true) return samplePieces().find((p) => p.id === id) ?? null;
  return (await loadPiecesByIds([id]))[id] ?? null;
}

const serverResolvers: BlockResolvers = {
  // Her pieces: the store, in the chosen order, or the records behind
  // hand-picked rows, or (on a piece's page) its neighbours.
  "ktp-artwork-grid": async (props, metadata) => {
    const hrefBase = str(metadata.hrefBase) || (metadata.preview === true ? "/preview/pieces" : "/pieces");
    if (props.source === "more") {
      const more = (metadata.pieceDetail as PieceDetail | undefined)?.more ?? [];
      return { pieces: more.slice(0, typeof props.limit === "number" ? props.limit : 4), bound: {}, hrefBase };
    }
    // /preview draws the six sample pieces instead of the store.
    if (metadata.preview === true) return { pieces: samplePieces(), bound: {}, hrefBase: "/preview/pieces" };
    const bound = await loadPiecesByIds(boundIds(props));
    if (props.source === "chosen") return { pieces: [], bound, hrefBase };
    return {
      bound,
      hrefBase,
      pieces: await loadPieces({ limit: typeof props.limit === "number" ? props.limit : 24, sort: props.sort }),
    };
  },
  // A smart piece: its record, and what "auto" chooses from where it sits.
  "ktp-piece": async (props, metadata) => ({
    item: await pieceFor(props, metadata),
    placement: layoutFromPlacement(metadata.placement),
    sampled: false,
    // Unbound on a piece's page = that page's own piece (its card opens the popup, never itself).
    ownPiece: !str(props.artwork) && Boolean(metadata.pieceDetail),
    // Buy now is offered only while card payments are on.
    cardOn: isCardPaymentAvailable(),
    hrefBase: str(metadata.hrefBase) || (metadata.preview === true ? "/preview/pieces" : "/pieces"),
  }),
  "ktp-piece-details": async (props, metadata) => {
    const base = str(metadata.hrefBase) || (metadata.preview === true ? "/preview/pieces" : "/pieces");
    const back = metadata.preview === true ? "/preview#pieces" : "/#pieces";
    const id = str(props.artwork);
    const detail = id ? (metadata.preview === true ? null : await loadPieceDetail(id)) : ((metadata.pieceDetail as PieceDetail | undefined) ?? null);
    const item = detail?.piece ?? (await pieceFor(props, metadata));
    return { item, nav: detail ? navFor(detail.prev, detail.next, base, back) : null, sampled: false };
  },
  "thread-feed": async (props) => ({
    items: await loadThreadFeed(currentOrgId(), {
      limit: typeof props.limit === "number" ? props.limit : 10,
      upcomingOnly: true,
    }),
  }),
};

export const serverPuckConfig = buildPuckConfig({
  resolvers: serverResolvers,
  blocks: CATALOGUE,
  morph: MorphMark,
});
