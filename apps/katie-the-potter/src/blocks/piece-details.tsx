import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { artworkProp, kindLabel, pieceHref, statusLabel, type Piece } from "./artwork-data";

// ============================================================================
// ktp-piece-details: a piece's facts, description and its neighbours, for the
// piece-detail template (beside a feature ktp-piece). Bound like ktp-piece:
// `artwork` if set, else the route's piece on /pieces/<slug>, else (editor) a
// labelled sample. Server component; no script.
// ============================================================================

const props = [
  artworkProp("Piece"),
  { name: "showNav", kind: "boolean", label: "Back and previous / next links", default: true },
  { name: "showFacts", kind: "boolean", label: "Facts (year, medium, size, kind, status)", default: true },
  { name: "showDescription", kind: "boolean", label: "Description", default: true },
  { name: "note", kind: "text", label: "A note under it", description: "e.g. how checkout works. Optional.", default: "Pay here by card or Interac eTransfer. Each piece is one of a kind and is held for you once you check out." },
] as const;

interface NavLink {
  title: string;
  href: string;
}

export type PieceDetailsProps = PropsOf<typeof props> & {
  item?: Piece | null;
  nav?: { prev: NavLink | null; next: NavLink | null; back: string } | null;
  sampled?: boolean;
  puck?: { isEditing?: boolean };
};

export function PieceDetails(p: PieceDetailsProps) {
  const piece = p.item ?? null;
  if (!piece) {
    return p.puck?.isEditing ? <p className="ktp-piece-empty"><b>Piece details</b><span>Choose a piece, or use this on the piece-detail template where the page&rsquo;s own piece fills it.</span></p> : null;
  }
  const facts: Array<[string, string]> = [];
  if (piece.year) facts.push(["Year", String(piece.year)]);
  if (piece.medium) facts.push(["Medium", piece.medium]);
  if (piece.dimensions) facts.push(["Size", piece.dimensions]);
  facts.push(["Kind", piece.edition ? `${kindLabel(piece)}, ${piece.edition}` : kindLabel(piece)]);
  facts.push(["Status", statusLabel(piece)]);
  const nav = p.nav;

  return (
    <section className="blk ktp-details" data-status={piece.status}>
      {p.showNav !== false && nav ? (
        <nav className="ktp-piece-nav" aria-label="Pieces">
          <a className="ktp-piece-back" href={nav.back}>
            <span aria-hidden="true">←</span> Back to pieces
          </a>
          <span className="ktp-piece-steps">
            {nav.prev ? (
              <a href={nav.prev.href} rel="prev">
                <span aria-hidden="true">‹</span> {nav.prev.title}
              </a>
            ) : (
              <span className="is-off">‹ Newest</span>
            )}
            <span className="ktp-piece-sep" aria-hidden="true">·</span>
            {nav.next ? (
              <a href={nav.next.href} rel="next">
                {nav.next.title} <span aria-hidden="true">›</span>
              </a>
            ) : (
              <span className="is-off">Oldest ›</span>
            )}
          </span>
        </nav>
      ) : null}
      {p.showFacts !== false ? (
        <dl className="ktp-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {p.showDescription !== false && piece.descriptionHtml ? (
        // Sanitised in lib/artworks.ts (sanitizePageText) before it reaches here; sample text is the app's own.
        <div className="ktp-desc ktp-details-desc" dangerouslySetInnerHTML={{ __html: piece.descriptionHtml }} />
      ) : null}
      {typeof p.note === "string" && p.note.trim() && piece.status === "available" && piece.priceMinor ? <p className="ktp-details-note">{p.note}</p> : null}
      {p.puck?.isEditing && p.sampled ? <p className="ktp-piece-why">Sample piece (the template shows a sample; each page shows its own piece)</p> : null}
    </section>
  );
}

/** Neighbour links for a piece in a list, for the resolver. */
export function navFor(prev: Piece | null, next: Piece | null, base: string, back: string) {
  return {
    prev: prev ? { title: prev.title, href: pieceHref(prev, base) } : null,
    next: next ? { title: next.title, href: pieceHref(next, base) } : null,
    back,
  };
}

export const pieceDetails = defineBlock(
  {
    id: "ktp-piece-details",
    label: "Piece details",
    category: "content",
    description: "A piece's facts, description and previous / next links. On the piece-detail template it shows the page's own piece.",
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
    props,
    parts: {
      root: { label: "Details", sel: "> .ktp-details" },
      nav: { label: "Back and next", sel: ".ktp-piece-nav", prop: "showNav" },
      facts: { label: "Facts", sel: ".ktp-facts", prop: "showFacts" },
      body: { label: "Description", sel: ".ktp-details-desc", prop: "showDescription" },
      aside: { label: "Note", sel: ".ktp-details-note", prop: "note" },
    },
  },
  PieceDetails,
  () => ({ artwork: "", showNav: true, showFacts: true, showDescription: true, note: "" })
);
