/**
 * Presentation — a front showing pieces it does not sell (migration 112).
 *
 * An organisation's store is a window. It may show its own merchandise, and
 * it may show a member's listed work; in the second case the member's store
 * still sells the piece and the member is still the payee. What the window
 * changes is the *counterparty*: a sale that comes through an org's front is
 * one that org's accepted agreement with the maker applies to. Nothing is
 * copied, and removing a presentation removes a window, never a piece.
 */

import { db } from "@elkdonis/db";

type Row = Record<string, unknown>;

async function requireStoreAuthority(storeId: string, actorUserId: string): Promise<void> {
  const [row] = (await db`
    SELECT CASE WHEN s.owner_user_id = ${actorUserId} THEN 'owner' ELSE sm.role END AS role
    FROM store s
    LEFT JOIN store_member sm ON sm.store_id = s.id AND sm.user_id = ${actorUserId}
    WHERE s.id = ${storeId} AND (s.owner_user_id = ${actorUserId} OR sm.user_id IS NOT NULL)
    LIMIT 1
  `) as unknown as Row[];
  if (!row || row.role === "staff") {
    throw new Error("Only a store owner or manager can change what it presents.");
  }
}

/**
 * Show a listed piece in a store's front. The piece must be listed (or
 * reserved) and sold by a DIFFERENT active store — presenting your own work
 * is a no-op, it is already in your front.
 */
export async function presentArtwork(input: {
  storeId: string;
  artworkId: string;
  actorUserId: string;
}): Promise<void> {
  await requireStoreAuthority(input.storeId, input.actorUserId);
  const [art] = (await db`
    SELECT a.store_id, a.status, s.status AS store_status
    FROM artwork a JOIN store s ON s.id = a.store_id
    WHERE a.id = ${input.artworkId} LIMIT 1
  `) as unknown as Row[];
  if (!art) throw new Error("Artwork not found.");
  if (art.store_id === input.storeId) throw new Error("This piece is already sold by this store.");
  if (art.store_status !== "active") throw new Error("That piece's store is not selling.");
  if (art.status !== "available" && art.status !== "reserved") {
    throw new Error("Only a listed piece can be presented.");
  }
  await db`
    INSERT INTO store_presentation (store_id, artwork_id, added_by)
    VALUES (${input.storeId}, ${input.artworkId}, ${input.actorUserId})
    ON CONFLICT (store_id, artwork_id) DO NOTHING
  `;
}

/** Take a piece out of a store's front. */
export async function unpresentArtwork(input: {
  storeId: string;
  artworkId: string;
  actorUserId: string;
}): Promise<void> {
  await requireStoreAuthority(input.storeId, input.actorUserId);
  await db`
    DELETE FROM store_presentation WHERE store_id = ${input.storeId} AND artwork_id = ${input.artworkId}
  `;
}

/** Whether a store currently presents a piece (its own count as yes). */
export async function isPresentedBy(storeId: string, artworkId: string): Promise<boolean> {
  const [row] = (await db`
    SELECT 1 FROM artwork a
    WHERE a.id = ${artworkId}
      AND (a.store_id = ${storeId}
           OR EXISTS (SELECT 1 FROM store_presentation sp WHERE sp.store_id = ${storeId} AND sp.artwork_id = a.id))
    LIMIT 1
  `) as unknown as Row[];
  return Boolean(row);
}
