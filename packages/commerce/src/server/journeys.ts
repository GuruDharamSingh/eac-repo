import { db } from "@elkdonis/db";
import { applyForStore, canClaimStore } from "./index";

// ============================================================================
// Journeys: where a person stands on a multi-step errand, read as one object.
//
// The first one is "sell your work in the Art Auction" (docs/open/
// AUCTION_SERIES_BRIEF_2026-10-03.md; Center redesign 2026-10-18). Three
// steps, each answered from rows that already exist:
//
//   1. published   — an `artwork` row of theirs that is not a draft
//   2. shown       — their store on the marketplace org is `active`
//   3. payable     — `users.stripe_onboarded_at` is set
//
// Nothing here is a new table: the journey is a view over commerce rows, so
// it can never disagree with what the store and the catalogue actually show.
// Every host that renders /center reads it; the journey surface acts on it.
// ============================================================================

/** The marketplace org a person's store lives in (art-auction). */
const MARKETPLACE_ORG = "market";

/**
 * The collective's cut on a sale made through the auction journey, in whole
 * percent. Written onto the store when this path activates it, so the fee
 * line a person reads before publishing is the fee `resolveSettlement` will
 * charge them (it reads `store.commission_rate` for artwork).
 * Developer's figure, 2026-10-18.
 */
export const AUCTION_COMMISSION_PERCENT = 5;

export interface AuctionJourney {
  store: {
    state: "none" | "pending" | "active" | "paused" | "rejected";
    id: string | null;
    /** The owner's slug — what the marketplace addresses the store by. */
    handle: string | null;
    /** Whole percent the collective keeps; null until a store exists. */
    commissionPercent: number | null;
  };
  artworks: { published: number; sold: number; drafts: number };
  payouts: {
    state: "none" | "pending" | "ready";
    country: string | null;
    /** False when the platform has no Stripe key: the control then says so. */
    available: boolean;
  };
  /** Whether this person may open a store at all (a non-viewer role somewhere). */
  canClaimStore: boolean;
}

interface Row {
  store_id: string | null;
  store_status: string | null;
  commission_rate: string | number | null;
  slug: string | null;
  stripe_account_id: string | null;
  stripe_onboarded_at: Date | string | null;
  country: string | null;
  published: string | number;
  sold: string | number;
  drafts: string | number;
}

export async function loadAuctionJourney(userId: string): Promise<AuctionJourney> {
  const [row] = await db<Row[]>`
    SELECT
      s.id AS store_id, s.status AS store_status, s.commission_rate,
      u.slug, u.stripe_account_id, u.stripe_onboarded_at, u.country,
      COUNT(a.id) FILTER (WHERE a.status IN ('available', 'sold')) AS published,
      COUNT(a.id) FILTER (WHERE a.status = 'sold') AS sold,
      COUNT(a.id) FILTER (WHERE a.status = 'draft') AS drafts
    FROM users u
    LEFT JOIN store s ON s.owner_user_id = u.id AND s.org_id = ${MARKETPLACE_ORG}
    LEFT JOIN artwork a ON a.artist_user_id = u.id AND a.org_id = ${MARKETPLACE_ORG}
    WHERE u.id = ${userId}
    GROUP BY s.id, s.status, s.commission_rate, u.slug, u.stripe_account_id, u.stripe_onboarded_at, u.country
  `;
  const storeState = (row?.store_status ?? "none") as AuctionJourney["store"]["state"];
  return {
    store: {
      state: row?.store_id ? storeState : "none",
      id: row?.store_id ?? null,
      handle: row?.slug ?? null,
      commissionPercent: row?.commission_rate != null ? Number(row.commission_rate) : null,
    },
    artworks: {
      published: Number(row?.published ?? 0),
      sold: Number(row?.sold ?? 0),
      drafts: Number(row?.drafts ?? 0),
    },
    payouts: {
      state: row?.stripe_onboarded_at ? "ready" : row?.stripe_account_id ? "pending" : "none",
      country: row?.country ?? null,
      available: Boolean(process.env.STRIPE_SECRET_KEY),
    },
    canClaimStore: await canClaimStore(userId),
  };
}

/**
 * Step 2 as one click: make sure the person has a store on the marketplace
 * and that it is active, so their published work appears in the catalogue.
 *
 * A store that does not exist is created through `applyForStore` (the one
 * write path; it checks `canClaimStore`) and then activated here rather than
 * left for review: the developer's call for the auction (2026-10-18) is that
 * a member of the collective publishes without a queue, the same network and
 * the same sign-in. A `paused` or `rejected` store is an administrator's
 * decision and is left alone; the caller reads the state back and says so.
 */
export async function publishStoreForAuction(input: {
  userId: string;
  email: string;
  displayName: string;
}): Promise<{ ok: true; state: AuctionJourney["store"]["state"] } | { ok: false; error: string }> {
  const [existing] = await db<Array<{ id: string; status: string }>>`
    SELECT id, status FROM store WHERE owner_user_id = ${input.userId} AND org_id = ${MARKETPLACE_ORG} LIMIT 1
  `;
  if (existing?.status === "active") return { ok: true, state: "active" };
  if (existing?.status === "paused") return { ok: false, error: "Your store is paused. Ask the marketplace team to reopen it." };
  if (existing?.status === "rejected") return { ok: false, error: "Your store application was declined. Ask the marketplace team before trying again." };

  if (!existing) {
    const applied = await applyForStore({
      userId: input.userId,
      orgId: MARKETPLACE_ORG,
      displayName: input.displayName,
      // Payout identity lives on `users` (migration 096); this is the dead
      // store column `applyForStore` still requires. Stripe is set up in
      // step 3, so the email is the only thing we know now.
      payoutEmail: input.email,
    });
    if (!applied.ok) return { ok: false, error: applied.error ?? "Could not open a store." };
  }

  await db`
    UPDATE store
    SET status = 'active', commission_rate = ${AUCTION_COMMISSION_PERCENT},
        reviewed_at = NOW(), reviewed_by = ${input.userId}
    WHERE owner_user_id = ${input.userId} AND org_id = ${MARKETPLACE_ORG} AND status = 'pending'
  `;
  return { ok: true, state: "active" };
}
