import { db } from "@elkdonis/db";
import type { StoreMemberRole } from "../types";

// ============================================================================
// Who may edit a store's team (the `store_member` roll).
//
// For a person's store: the owner. For an org's store: anyone seated as a
// store owner, plus the org's own owners and guides — they opened the store
// and keep its roll from the org's manage page or the hub (ORG_STORE_BRIEF
// D2, R9). Org members are not on the roll by being members.
// ============================================================================

type Row = Record<string, unknown>;

export async function canManageStoreTeam(userId: string, storeId: string): Promise<boolean> {
  try {
    const [row] = (await db`
      SELECT 1 FROM store s
      LEFT JOIN store_member sm ON sm.store_id = s.id AND sm.user_id = ${userId}
      LEFT JOIN user_organizations uo
        ON uo.org_id = s.owner_org_id AND uo.user_id = ${userId} AND uo.role IN ('owner', 'guide')
      WHERE s.id = ${storeId}
        AND (s.owner_user_id = ${userId} OR sm.role = 'owner' OR uo.user_id IS NOT NULL)
      LIMIT 1
    `) as unknown as Row[];
    return Boolean(row);
  } catch (err) {
    console.error(`[commerce] canManageStoreTeam(${userId}, ${storeId}):`, err);
    return false;
  }
}

/**
 * Seat someone on a store's roll by email. Looks the person up by email, as
 * the network does everywhere (display names are not unique).
 */
export async function addStoreMemberByEmail(input: {
  storeId: string;
  email: string;
  role: StoreMemberRole;
  actorUserId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManageStoreTeam(input.actorUserId, input.storeId))) {
    return { ok: false, error: "Only a store owner or the organisation's owners and admins can edit the team." };
  }
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "An email is required." };
  const [person] = (await db`
    SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1
  `) as unknown as Row[];
  if (!person) return { ok: false, error: "No account with that email." };
  const role: StoreMemberRole = (["owner", "manager", "staff"] as const).includes(input.role)
    ? input.role
    : "staff";
  await db`
    INSERT INTO store_member (store_id, user_id, role, added_by)
    VALUES (${input.storeId}, ${person.id as string}, ${role}, ${input.actorUserId})
    ON CONFLICT (store_id, user_id) DO UPDATE SET role = EXCLUDED.role
  `;
  return { ok: true };
}
