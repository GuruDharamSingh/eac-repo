import { db } from "@elkdonis/db";

// ============================================================================
// THE SAMPLE-PIECE CARD GUARD — one switch, one place.
//
// The six seeded pieces (artwork.metadata.sample = true) are `available`, so
// without this a stranger could pay for one with a real card. While the guard
// is on:
//   - placeOrder and payOrderByCard (lib/shop-actions.ts) refuse the card
//     rail for any order or cart containing a sample piece,
//   - the checkout and order pages hide the card option for them,
//   - Interac eTransfer stays open, so the whole flow can be tried.
//
// TO REMOVE once real work replaces the samples: set SAMPLE_CARD_GUARD to
// false (or delete this file and its four call sites: shop-actions.ts x2,
// checkout/page.tsx, orders/[id]/page.tsx). Archiving the samples makes it
// moot too — nothing then matches `metadata.sample`.
// ============================================================================

// OFF since 2026-11-07 (owner's call: card checkout is open; Katie signs up
// and takes over). Set back to true to refuse card for sample pieces again.
export const SAMPLE_CARD_GUARD = false;

export const SAMPLE_CARD_REFUSAL =
  "This is a sample piece, not yet for sale by card. You can still reserve it by Interac eTransfer to try the checkout.";

/** Whether any of these artworks is a sample piece (and the guard is on). */
export async function anySampleArtwork(artworkIds: string[]): Promise<boolean> {
  if (!SAMPLE_CARD_GUARD || artworkIds.length === 0) return false;
  const [row] = await db<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM artwork
    WHERE id = ANY(${artworkIds}::uuid[]) AND metadata->>'sample' = 'true'
  `;
  return (row?.n ?? 0) > 0;
}

/** Whether the cart with this token holds a sample piece. */
export async function cartHasSamplePiece(cartToken: string): Promise<boolean> {
  if (!SAMPLE_CARD_GUARD) return false;
  const rows = await db<Array<{ artwork_id: string }>>`
    SELECT av.artwork_id FROM cart_line cl
    JOIN cart c ON c.id = cl.cart_id
    JOIN artwork_variant av ON av.id = cl.artwork_variant_id
    WHERE c.token = ${cartToken}
  `;
  return anySampleArtwork(rows.map((r) => r.artwork_id));
}

/** Whether the order holds a sample piece. */
export async function orderHasSamplePiece(orderId: string): Promise<boolean> {
  if (!SAMPLE_CARD_GUARD) return false;
  const rows = await db<Array<{ artwork_id: string | null }>>`
    SELECT artwork_id FROM commerce_order_line WHERE order_id = ${orderId} AND artwork_id IS NOT NULL
  `;
  return anySampleArtwork(rows.map((r) => r.artwork_id!).filter(Boolean));
}
