import { db } from "@elkdonis/db";

// ============================================================================
// Who may act for what. Shared by artwork writes, auctions and order actions.
//
// Authority over a store is its owner (a person's store) or its
// `store_member` roll (an org's store) — deliberately NOT the org's own
// membership: being a member of IFAC should not let you price its work.
// ============================================================================

type Row = Record<string, unknown>;

/**
 * The series desk: whoever may edit an auction series (an editor on its team,
 * an owner of the auction org, a network admin) may act for the store of the
 * org that presents it, in that marketplace. The desk lists work there on the
 * artists' behalf (series workspace "Add a lot"). `s` is the store alias.
 */
export function seriesDeskClause(q: typeof db, actorUserId: string) {
  return q`EXISTS (
    SELECT 1 FROM auction_series ser
    WHERE ser.presenter_org_id = s.owner_org_id AND ser.org_id = s.org_id
      AND (
        EXISTS (SELECT 1 FROM auction_series_member m
                WHERE m.series_id = ser.id AND m.user_id = ${actorUserId} AND m.role = 'editor')
        OR EXISTS (SELECT 1 FROM user_organizations uo
                   WHERE uo.org_id = ser.org_id AND uo.user_id = ${actorUserId} AND uo.role = 'owner')
        OR EXISTS (SELECT 1 FROM users u WHERE u.id = ${actorUserId} AND u.is_admin = true)
      )
  )`;
}

/**
 * Whether this person may write to this artwork, resolved through the store
 * that sells it rather than through `artist_user_id`.
 *
 * The old check was `WHERE artist_user_id = $actor`, which cannot express an
 * org store at all: its artwork has no maker to compare against, and the
 * people entitled to edit it are its store members.
 */
export async function requireArtworkAccess(
  tx: typeof db,
  artworkId: string,
  actorUserId: string
): Promise<{ orgId: string; storeId: string; status: string }> {
  const rows = (await tx`
    SELECT a.id, a.org_id, a.store_id, a.status
    FROM artwork a
    JOIN store s ON s.id = a.store_id
    LEFT JOIN store_member sm ON sm.store_id = s.id AND sm.user_id = ${actorUserId}
    WHERE a.id = ${artworkId}
      AND (s.owner_user_id = ${actorUserId} OR sm.user_id IS NOT NULL OR ${seriesDeskClause(tx, actorUserId)})
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Artwork not found.");
  return {
    orgId: rows[0].org_id as string,
    storeId: rows[0].store_id as string,
    status: rows[0].status as string,
  };
}

/** Store roles, most to least authority. A store's owner counts as `owner`. */
const ROLE_RANK: Record<string, number> = { owner: 3, manager: 2, staff: 1 };

/**
 * Whether this person may act for the store an order was placed through.
 *
 * `minRole` gates what they may do with it: reading a sale needs any seat on
 * the roll, but confirming payment, cancelling or refunding is money and needs
 * `manager` or above. Staff list and edit work; they do not settle it.
 */
export async function canActForOrder(
  userId: string,
  orderId: string,
  opts: { minRole?: "owner" | "manager" | "staff" } = {}
): Promise<boolean> {
  try {
    const [row] = (await db`
      SELECT CASE WHEN s.owner_user_id = ${userId} THEN 'owner' ELSE sm.role END AS role
      FROM commerce_order o
      JOIN store s ON s.id = o.store_id
      LEFT JOIN store_member sm ON sm.store_id = s.id AND sm.user_id = ${userId}
      WHERE o.id = ${orderId}
        AND (s.owner_user_id = ${userId} OR sm.user_id IS NOT NULL)
      LIMIT 1
    `) as unknown as Row[];
    if (!row) return false;
    const need = ROLE_RANK[opts.minRole ?? "staff"] ?? 1;
    return (ROLE_RANK[row.role as string] ?? 0) >= need;
  } catch (err) {
    console.error(`[commerce] canActForOrder(${userId}, ${orderId}):`, err);
    return false;
  }
}

/** Whether this person placed the order (signed-in buyers only). */
export async function isOrderCustomer(
  userId: string,
  orderId: string
): Promise<boolean> {
  const [row] = (await db`
    SELECT 1 FROM commerce_order WHERE id = ${orderId} AND customer_id = ${userId} LIMIT 1
  `) as unknown as Row[];
  return Boolean(row);
}

/**
 * The series desk's access to an artist's own listing: the actor may edit the
 * series, and the piece is a person's listing in the series' marketplace
 * (never an org store's, which has its own team). Used by createLot with
 * `onBehalfOfSeriesId`.
 */
export async function requireArtworkForSeriesDesk(
  tx: typeof db,
  artworkId: string,
  actorUserId: string,
  seriesId: string
): Promise<{ orgId: string; storeId: string; status: string }> {
  const rows = (await tx`
    SELECT a.org_id, a.store_id, a.status
    FROM artwork a
    JOIN store s ON s.id = a.store_id
    JOIN auction_series ser ON ser.id = ${seriesId} AND ser.org_id = a.org_id
    WHERE a.id = ${artworkId} AND s.owner_user_id IS NOT NULL
      AND (
        EXISTS (SELECT 1 FROM auction_series_member m WHERE m.series_id = ser.id AND m.user_id = ${actorUserId} AND m.role = 'editor')
        OR EXISTS (SELECT 1 FROM user_organizations uo WHERE uo.org_id = ser.org_id AND uo.user_id = ${actorUserId} AND uo.role = 'owner')
        OR EXISTS (SELECT 1 FROM users u WHERE u.id = ${actorUserId} AND u.is_admin = true)
      )
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Artwork not found, or not an artist's own listing in this marketplace.");
  return { orgId: rows[0].org_id as string, storeId: rows[0].store_id as string, status: rows[0].status as string };
}
