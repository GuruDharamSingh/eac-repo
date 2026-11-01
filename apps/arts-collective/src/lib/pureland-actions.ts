"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { removeOrgMember, setOrgRole, type OrgRole } from "@elkdonis/services";
import { ASSIGNABLE_ROLES, PURELAND_GAME, PURELAND_ORG, getPurelandViewer } from "@/lib/pureland";

// ============================================================================
// Pureland's Manage section (owners) and the player's "save to my account"
// switch (anyone who may play). Every action re-checks the role on the server.
// ============================================================================

// One shape, not a union: this app's tsconfig isn't strict, so `ok: false` wouldn't narrow.
type Result = { ok: boolean; message?: string; error?: string };

const ASSIGNABLE = new Set<OrgRole>(ASSIGNABLE_ROLES.map((r) => r.role));

async function requireOwner() {
  const viewer = await getPurelandViewer();
  if (!viewer?.canManage) return null;
  return viewer;
}

export async function addPurelandMember(email: string, role: OrgRole): Promise<Result> {
  const owner = await requireOwner();
  if (!owner) return { ok: false, error: "Only an owner can add members." };
  if (!ASSIGNABLE.has(role)) return { ok: false, error: "Pick a role." };
  const wanted = email.trim().toLowerCase();
  if (!wanted.includes("@")) return { ok: false, error: "Enter an email address." };

  const [user] = await db<{ id: string; display_name: string | null }[]>`
    SELECT id, display_name FROM users WHERE lower(email) = ${wanted} LIMIT 1
  `;
  if (!user) {
    return {
      ok: false,
      error: `No account uses ${wanted} yet. Ask them to sign up at arts-collective.com, then add them here.`,
    };
  }
  await setOrgRole(user.id, PURELAND_ORG, role);
  revalidatePath("/pureland");
  return { ok: true, message: `${user.display_name || wanted} is now ${role === "member" ? "a member" : `a ${role}`}.` };
}

export async function setPurelandRole(userId: string, role: OrgRole): Promise<Result> {
  const owner = await requireOwner();
  if (!owner) return { ok: false, error: "Only an owner can change roles." };
  if (!ASSIGNABLE.has(role)) return { ok: false, error: "Pick a role." };
  if (userId === owner.userId) return { ok: false, error: "Ask another owner to change your own role." };
  await setOrgRole(userId, PURELAND_ORG, role);
  revalidatePath("/pureland");
  return { ok: true };
}

export async function removePurelandMember(userId: string): Promise<Result> {
  const owner = await requireOwner();
  if (!owner) return { ok: false, error: "Only an owner can remove members." };
  if (userId === owner.userId) return { ok: false, error: "Ask another owner to remove you." };
  await removeOrgMember(userId, PURELAND_ORG);
  revalidatePath("/pureland");
  return { ok: true };
}

export async function setPurelandCloudSave(enabled: boolean): Promise<Result> {
  const viewer = await getPurelandViewer();
  if (!viewer?.canPlay) return { ok: false, error: "Not a member." };
  await db`
    INSERT INTO game_saves (user_id, game, org_id, enabled)
    VALUES (${viewer.userId}, ${PURELAND_GAME}, ${PURELAND_ORG}, ${enabled})
    ON CONFLICT (user_id, game) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
  `;
  revalidatePath("/pureland");
  return { ok: true };
}
