"use client";

import { useState, useTransition } from "react";
import { buyPieceNow } from "@/lib/shop-actions";
import { AddToCart } from "@/components/add-to-cart";
import type { Piece } from "@/blocks/artwork-data";

export const BUY_NOW_LABEL = "Buy now";
export const BUY_NOW_SECONDARY_LABEL = "Add to cart · continue shopping";
export const BUY_NOW_NOTE =
  "Pay with card, Google Pay or Apple Pay. Shipping is arranged after you buy — you'll choose the carrier and pay for the label.";

/**
 * The buy controls on a piece's own page (ktp-piece, `ctaMode: "buy-now"`):
 *
 *   Buy now                  an order for just this piece, straight to
 *                            Stripe's hosted page (card; Apple Pay / Google
 *                            Pay where the device has them), which collects
 *                            the email and shipping address. The cart is
 *                            left alone (buyPieceNow).
 *   Add to cart · continue   the existing AddToCart, in the secondary style
 *   one line of copy         under the buttons
 *
 * Anything that is not "available and priced" (sold, reserved, price on
 * request, portfolio) is handed to AddToCart unchanged, so those states read
 * exactly as before. Card payments switched off: AddToCart alone.
 */
export function BuyActions({
  piece,
  buyLabel,
  addLabel,
  note,
  preview = false,
  inert = false,
  cardOn = true,
}: {
  piece: Piece;
  buyLabel?: string | null;
  addLabel?: string | null;
  /** null/undefined = the standard line; "" = no line. */
  note?: string | null;
  /** Sample pieces on /preview or in the editor's canvas: drawn, disabled. */
  preview?: boolean;
  /** An editing surface: drawn, nothing acts. */
  inert?: boolean;
  /** Whether card payments are on (server-resolved). */
  cardOn?: boolean;
}) {
  const buy = buyLabel?.trim() || BUY_NOW_LABEL;
  const add = addLabel?.trim() || BUY_NOW_SECONDARY_LABEL;
  const line = note == null ? BUY_NOW_NOTE : note.trim();
  const buyable = piece.status === "available" && Boolean(piece.priceMinor);

  if (!buyable || !cardOn) {
    return <AddToCart piece={piece} label={cardOn ? add : "Add to cart"} preview={preview} inert={inert} />;
  }

  if (preview || inert || piece.id.startsWith("sample-")) {
    // The same markup, nothing live: the editor's canvas, the "Edit look"
    // popup (its own React root), and /preview's sample pieces.
    return (
      <div className="ktp-buy-actions">
        <div className="ktp-buy-row">
          <button type="button" className="ktp-buy ktp-buy--now" tabIndex={inert ? -1 : undefined} aria-disabled="true" disabled={!inert}>
            {buy}
          </button>
          <button type="button" className="ktp-buy ktp-buy--ghost" tabIndex={inert ? -1 : undefined} aria-disabled="true" disabled={!inert}>
            {add}
          </button>
        </div>
        {line ? <p className="ktp-buy-now-note">{line}</p> : null}
        {!inert ? <p className="ktp-buy-status">Preview only</p> : null}
      </div>
    );
  }

  return <LiveBuyActions piece={piece} buy={buy} add={add} line={line} />;
}

function LiveBuyActions({ piece, buy, add, line }: { piece: Piece; buy: string; add: string; line: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onBuy = () =>
    start(async () => {
      setError(null);
      // Success is a redirect to Stripe's page; only a refusal comes back.
      const r = await buyPieceNow(piece.id).catch(() => ({ ok: false as const, message: "We couldn't start the payment. Please try again." }));
      if (r && !r.ok) setError(r.message);
    });

  return (
    <div className="ktp-buy-actions">
      <div className="ktp-buy-row">
        <button type="button" className="ktp-buy ktp-buy--now" onClick={onBuy} disabled={pending} aria-busy={pending}>
          {pending ? "Opening secure checkout…" : buy}
        </button>
        <AddToCart piece={piece} label={add} ghost />
      </div>
      {line ? <p className="ktp-buy-now-note">{line}</p> : null}
      {error ? (
        <p className="ktp-buy-status ktp-buy-status--error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
