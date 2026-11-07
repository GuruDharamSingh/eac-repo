import { createHash, randomBytes } from "node:crypto";
import { db } from "@elkdonis/db";

// ============================================================================
// The owner hand-over: a one-time CLAIM link (migration 247, org_claim_tokens).
//
// Pure server functions with no Next imports, so they can move to a shared
// package as they are. Authorisation of WHO may create a link is the caller's
// (lib/claim-actions.ts); redeeming is authorised by holding the token while
// signed in.
//
// Redeeming, in ONE transaction:
//   1. the token row is locked and checked (unused, unrevoked, unexpired);
//   2. the claimant becomes `owner` of the org (user_organizations);
//   3. the site's pinned store on the marketplace (site_config `shop:store`;
//      owned by the account being handed over) moves to the claimant:
//      store.owner_user_id (the store id, and so the pin, never change), a store_member
//      `owner` row for them, and the previous owner's store_member row is
//      removed so the placeholder keeps no control;
//   4. the store's pieces credit the claimant as maker (artwork.artist_user_id);
//   5. the previous owner's org role drops to `viewer` (the account itself is
//      left alone: never deleted here);
//   6. the token is consumed, and what moved is written to its `result`.
// Past order lines and ledger entries are history and stay with whoever sold
// them. There is no shared commerce function that moves a store's ownership
// (store-team.ts only seats members), so step 3 is SQL here, written with the
// store's invariants in mind: owner_user_id XOR owner_org_id (a person's store
// keeps owner_org_id NULL), owner_kind is generated and never written, and one
// person-owned store per marketplace (store_user_owner_per_org).
// ============================================================================

export const CLAIM_TTL_DAYS = 7;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

type Row = Record<string, unknown>;

/** Create a link token for the org, revoking its earlier unused ones. Returns the raw token (shown once). */
export async function createClaimToken(orgId: string, createdBy: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CLAIM_TTL_DAYS * 86400_000);
  await db.begin(async (tx) => {
    await tx`UPDATE org_claim_tokens SET revoked_at = now() WHERE org_id = ${orgId} AND consumed_at IS NULL AND revoked_at IS NULL`;
    await tx`
      INSERT INTO org_claim_tokens (org_id, token_hash, created_by, expires_at)
      VALUES (${orgId}, ${hash(token)}, ${createdBy}, ${expiresAt.toISOString()})
    `;
  });
  return { token, expiresAt };
}

/** Revoke every unused link for the org. */
export async function revokeClaimTokens(orgId: string): Promise<number> {
  const rows = await db`UPDATE org_claim_tokens SET revoked_at = now() WHERE org_id = ${orgId} AND consumed_at IS NULL AND revoked_at IS NULL RETURNING id`;
  return rows.length;
}

export interface ClaimLinkInfo {
  createdAt: string;
  expiresAt: string;
  createdByEmail: string | null;
}

/** The org's live (unused, unexpired) link, if any, without the token itself. */
export async function activeClaimLink(orgId: string): Promise<ClaimLinkInfo | null> {
  const [r] = await db<Row[]>`
    SELECT t.created_at, t.expires_at, u.email AS created_by_email
    FROM org_claim_tokens t LEFT JOIN users u ON u.id = t.created_by
    WHERE t.org_id = ${orgId} AND t.consumed_at IS NULL AND t.revoked_at IS NULL AND t.expires_at > now()
    ORDER BY t.created_at DESC LIMIT 1
  `;
  return r ? { createdAt: String(r.created_at), expiresAt: String(r.expires_at), createdByEmail: (r.created_by_email as string | null) ?? null } : null;
}

export type ClaimState =
  | { state: "valid"; orgId: string; expiresAt: string }
  | { state: "used" | "expired" | "revoked" | "unknown" };

/** What a token is, without changing anything. */
export async function peekClaim(token: string): Promise<ClaimState> {
  if (!TOKEN_RE.test(token)) return { state: "unknown" };
  const [r] = await db<Row[]>`SELECT org_id, expires_at, consumed_at, revoked_at FROM org_claim_tokens WHERE token_hash = ${hash(token)} LIMIT 1`;
  if (!r) return { state: "unknown" };
  if (r.consumed_at) return { state: "used" };
  if (r.revoked_at) return { state: "revoked" };
  if (new Date(String(r.expires_at)).getTime() <= Date.now()) return { state: "expired" };
  return { state: "valid", orgId: r.org_id as string, expiresAt: String(r.expires_at) };
}

export interface ClaimResult {
  orgId: string;
  previousOwnerId: string | null;
  storeId: string | null;
  artworksMoved: number;
}

export class ClaimRefused extends Error {}

/**
 * Redeem a token for `claimantId`. `marketOrgId` is the marketplace whose
 * store moves (market). Throws ClaimRefused with a message for the claimant.
 */
export async function redeemClaim(token: string, claimantId: string, marketOrgId = "market"): Promise<ClaimResult> {
  if (!TOKEN_RE.test(token)) throw new ClaimRefused("This link isn't valid.");
  return db.begin(async (tx) => {
    const [t] = (await tx`
      SELECT id, org_id, expires_at, consumed_at, revoked_at FROM org_claim_tokens
      WHERE token_hash = ${hash(token)} FOR UPDATE
    `) as unknown as Row[];
    if (!t) throw new ClaimRefused("This link isn't valid.");
    if (t.consumed_at) throw new ClaimRefused("This link has already been used.");
    if (t.revoked_at) throw new ClaimRefused("This link was replaced by a newer one. Ask for the latest link.");
    if (new Date(String(t.expires_at)).getTime() <= Date.now()) throw new ClaimRefused("This link has expired. Ask for a new one.");
    const orgId = t.org_id as string;

    // The store being handed over is the site's PINNED store (site_config
    // `shop:store`, lib/site-store.ts) and the account handing it over is
    // whoever owns that store now. Fixed 2026-11-06: this used to be "an org
    // owner that holds a store", which a second owner (a helper) could muddle.
    // The store id never changes in a claim, so the pin stays valid; only its
    // owner moves. Before a pin exists, the old rule finds it and pins it.
    let storeId: string | null = null;
    let previousOwnerId: string | null = null;
    const [pin] = (await tx`
      SELECT value->>'storeId' AS store_id FROM site_config WHERE org_id = ${orgId} AND key = 'shop:store'
    `) as unknown as Row[];
    if (pin?.store_id) {
      const [s] = (await tx`
        SELECT id, owner_user_id FROM store WHERE id = ${pin.store_id as string} AND org_id = ${marketOrgId} FOR UPDATE
      `) as unknown as Row[];
      if (s) {
        storeId = s.id as string;
        previousOwnerId = (s.owner_user_id as string | null) ?? null;
      }
    }
    if (!storeId) {
      const owners = (await tx`
        SELECT uo.user_id, s.id AS store_id
        FROM user_organizations uo
        LEFT JOIN store s ON s.owner_user_id = uo.user_id AND s.org_id = ${marketOrgId}
        WHERE uo.org_id = ${orgId} AND uo.role = 'owner' AND uo.user_id <> ${claimantId}
        ORDER BY (s.id IS NOT NULL) DESC, uo.joined_at ASC
      `) as unknown as Row[];
      previousOwnerId = (owners[0]?.user_id as string | undefined) ?? null;
      storeId = (owners[0]?.store_id as string | undefined) ?? null;
      if (storeId) {
        await tx`
          INSERT INTO site_config (org_id, key, value)
          VALUES (${orgId}, 'shop:store', ${tx.json({ storeId, pinnedAt: new Date().toISOString() })})
          ON CONFLICT (org_id, key) DO NOTHING
        `;
      }
    }
    if (previousOwnerId && previousOwnerId === claimantId) {
      throw new ClaimRefused("This account already owns the shop's store. Nothing needs handing over.");
    }

    if (storeId) {
      const [own] = (await tx`SELECT id FROM store WHERE owner_user_id = ${claimantId} AND org_id = ${marketOrgId} LIMIT 1`) as unknown as Row[];
      if (own) {
        throw new ClaimRefused("You already have your own store on Collect Art, and a person can hold one. Ask an admin of the collective to merge the two.");
      }
    }

    // 2. owner of the org
    await tx`
      INSERT INTO user_organizations (user_id, org_id, role)
      VALUES (${claimantId}, ${orgId}, 'owner')
      ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'owner'
    `;

    let artworksMoved = 0;
    if (storeId && previousOwnerId) {
      // 3. the store: a person's store, so owner_org_id stays NULL; owner_kind is generated.
      await tx`UPDATE store SET owner_user_id = ${claimantId}, updated_at = now() WHERE id = ${storeId} AND owner_user_id = ${previousOwnerId} AND owner_org_id IS NULL`;
      await tx`
        INSERT INTO store_member (store_id, user_id, role, added_by)
        VALUES (${storeId}, ${claimantId}, 'owner', ${claimantId})
        ON CONFLICT (store_id, user_id) DO UPDATE SET role = 'owner'
      `;
      await tx`DELETE FROM store_member WHERE store_id = ${storeId} AND user_id = ${previousOwnerId}`;
      // 4. the pieces' maker
      const moved = (await tx`UPDATE artwork SET artist_user_id = ${claimantId} WHERE store_id = ${storeId} AND artist_user_id = ${previousOwnerId} RETURNING id`) as unknown as Row[];
      artworksMoved = moved.length;
    }
    // 5. the handed-over account stays, as a follower of the org
    if (previousOwnerId) {
      await tx`UPDATE user_organizations SET role = 'viewer' WHERE org_id = ${orgId} AND user_id = ${previousOwnerId}`;
    }
    // 6. consumed, with the record
    const result = { orgId, previousOwnerId, storeId, artworksMoved };
    await tx`
      UPDATE org_claim_tokens SET consumed_at = now(), consumed_by = ${claimantId}, result = ${tx.json(result)}
      WHERE id = ${t.id as string}
    `;
    return result;
  });
}

/** People with a role in the org, for the People page. */
export async function listOrgPeople(orgId: string): Promise<Array<{ userId: string; email: string | null; name: string | null; role: string; joinedAt: string }>> {
  const rows = await db<Row[]>`
    SELECT uo.user_id, u.email, u.display_name, uo.role, uo.joined_at
    FROM user_organizations uo LEFT JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${orgId}
    ORDER BY CASE uo.role WHEN 'owner' THEN 0 WHEN 'guide' THEN 1 WHEN 'member' THEN 2 ELSE 3 END, uo.joined_at ASC
    LIMIT 200
  `;
  return rows.map((r) => ({
    userId: r.user_id as string,
    email: (r.email as string | null) ?? null,
    name: (r.display_name as string | null) ?? null,
    role: r.role as string,
    joinedAt: String(r.joined_at),
  }));
}
