"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPieceToCart } from "@/lib/shop-actions";
import type { Piece } from "@/blocks/artwork-data";

/**
 * The primary buy control for one piece, in the popup and on the detail page.
 * It decides what to offer from the piece's own state:
 *
 *   available + priced   "Add to cart" (a server action; the header count
 *                        updates through router.refresh())
 *   price on request     "Enquire on Collect Art": the marketplace's page for
 *                        the piece is the only place with a working enquiry
 *                        flow, so that is the path (a mailto would need
 *                        Katie's real address)
 *   reserved / sold      a plain note, no button
 *   preview pieces       a disabled "Preview only"
 *
 * Adding a piece that is already in the cart says so rather than duplicating:
 * every piece is one of a kind.
 */
export function AddToCart({
  piece,
  label = "Add to cart",
  preview = false,
  inert = false,
  ghost = false,
}: {
  piece: Piece;
  label?: string;
  /** The secondary style (beside "Buy now"); once added it also offers "Continue shopping". */
  ghost?: boolean;
  /** Sample pieces on /preview or in the editor's canvas. */
  preview?: boolean;
  /**
   * Drawn for editing (Puck's canvas, the "Edit look" popup): the same markup,
   * no action and no hooks. The popup is its own React root outside Next's
   * app router, where useRouter() throws; and a click there must never buy.
   */
  inert?: boolean;
}) {
  if (piece.status === "portfolio") return null;
  if (piece.status === "sold") return <p className="ktp-buy-note">This piece has sold.</p>;
  if (piece.status === "reserved") return <p className="ktp-buy-note">Reserved: held for another buyer right now. Check back soon.</p>;

  if (preview || piece.id.startsWith("sample-")) {
    return (
      <button type="button" className="ktp-buy" disabled>
        Preview only
      </button>
    );
  }

  if (!piece.priceMinor) {
    return piece.href ? (
      <a className="ktp-buy ktp-buy--ghost" href={piece.href} target="_blank" rel="noopener noreferrer">
        Enquire on Collect Art
        <span className="ktp-sr"> (opens in a new tab)</span>
      </a>
    ) : null;
  }

  if (inert) {
    return (
      <span className="ktp-buy-wrap">
        <button type="button" className={ghost ? "ktp-buy ktp-buy--ghost" : "ktp-buy"} tabIndex={-1} aria-disabled="true">
          {label}
        </button>
      </span>
    );
  }
  return <LiveAddToCart piece={piece} label={label} ghost={ghost} />;
}

/** The working button: drawn only under Next's app router (a visitor's page, the canvas). */
function LiveAddToCart({ piece, label, ghost = false }: { piece: Piece; label: string; ghost?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ kind: "idle" } | { kind: "added"; already: boolean } | { kind: "error"; message: string }>({ kind: "idle" });

  const add = () =>
    start(async () => {
      const r = await addPieceToCart(piece.id).catch(() => null);
      if (!r) return setState({ kind: "error", message: "We couldn't add that to your cart. Please try again." });
      if (!r.ok) return setState({ kind: "error", message: r.message });
      setState({ kind: "added", already: r.already });
      router.refresh();
    });

  const added = state.kind === "added";
  return (
    <span className="ktp-buy-wrap">
      <button type="button" className={ghost ? "ktp-buy ktp-buy--ghost" : "ktp-buy"} onClick={add} disabled={pending || added} aria-busy={pending}>
        {pending ? "Adding…" : added ? "In your cart" : label}
      </button>
      {added ? (
        <span className="ktp-buy-status" role="status">
          {state.already ? "Already in your cart. " : "Added. "}
          <a href="/cart">View cart</a>
          {ghost ? (
            <>
              {" · "}
              <a href="/#pieces">Continue shopping</a>
            </>
          ) : null}
        </span>
      ) : null}
      {state.kind === "error" ? (
        <span className="ktp-buy-status ktp-buy-status--error" role="alert">
          {state.message}
        </span>
      ) : null}
    </span>
  );
}
