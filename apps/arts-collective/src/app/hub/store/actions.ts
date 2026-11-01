"use server";

import { revalidatePath } from "next/cache";
import {
  openOrgStore,
  addStoreMemberByEmail,
  removeStoreMember,
  canManageStoreTeam,
  addCharityPayee,
  addOrgBeneficiary,
  removeOrgBeneficiary,
  approvePayee,
} from "@elkdonis/commerce/server";
import { getStoreForOrg } from "@elkdonis/commerce/queries";
import type { StoreMemberRole } from "@elkdonis/commerce/types";
import { getCurrentUser } from "@/lib/session";
import { canEditOrgSite } from "@/lib/org";

// ============================================================================
// /hub/store — an org's store team and beneficiaries, for every org on the
// network (ORG_STORE_BRIEF R9). Same panels as an org site's manage page;
// the commerce layer checks the actor on every write.
// ============================================================================

import { MARKETPLACE_ORG } from "./marketplace";

type Result = { ok: boolean; error?: string };

async function editor(orgId: string): Promise<{ userId: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return (await canEditOrgSite(user.id, orgId)) ? { userId: user.id } : null;
}

export async function openStoreAction(orgId: string): Promise<Result> {
  const v = await editor(orgId);
  if (!v) return { ok: false, error: "Owners and admins only." };
  const r = await openOrgStore({ ownerOrgId: orgId, orgId: MARKETPLACE_ORG, actorUserId: v.userId });
  revalidatePath("/hub/store");
  return { ok: r.ok, error: r.error };
}

export async function addMemberAction(orgId: string, email: string, role: StoreMemberRole): Promise<Result> {
  const v = await editor(orgId);
  if (!v) return { ok: false, error: "Owners and admins only." };
  const store = await getStoreForOrg(orgId, MARKETPLACE_ORG);
  if (!store) return { ok: false, error: "This organisation has no store yet." };
  const r = await addStoreMemberByEmail({ storeId: store.id, email, role, actorUserId: v.userId });
  revalidatePath("/hub/store");
  return r;
}

export async function removeMemberAction(orgId: string, userId: string): Promise<Result> {
  const v = await editor(orgId);
  if (!v) return { ok: false, error: "Owners and admins only." };
  const store = await getStoreForOrg(orgId, MARKETPLACE_ORG);
  if (!store) return { ok: false, error: "This organisation has no store yet." };
  if (!(await canManageStoreTeam(v.userId, store.id))) return { ok: false, error: "Not allowed." };
  const r = await removeStoreMember(store.id, userId);
  revalidatePath("/hub/store");
  return r;
}

export async function addCharityAction(
  orgId: string,
  input: { name: string; registrationNo?: string; website?: string; blurb?: string }
): Promise<Result> {
  const v = await editor(orgId);
  if (!v) return { ok: false, error: "Owners and admins only." };
  const r = await addCharityPayee({ orgId, actorUserId: v.userId, ...input });
  revalidatePath("/hub/store");
  return { ok: r.ok, error: r.error };
}

export async function addOrgBeneficiaryAction(orgId: string, payeeId: string): Promise<Result> {
  const v = await editor(orgId);
  if (!v) return { ok: false, error: "Owners and admins only." };
  const r = await addOrgBeneficiary(orgId, payeeId, v.userId);
  revalidatePath("/hub/store");
  return r;
}

export async function removeBeneficiaryAction(orgId: string, payeeId: string): Promise<Result> {
  const v = await editor(orgId);
  if (!v) return { ok: false, error: "Owners and admins only." };
  const r = await removeOrgBeneficiary(orgId, payeeId, v.userId);
  revalidatePath("/hub/store");
  return r;
}

export async function approvePayeeAction(orgId: string, payeeId: string): Promise<Result> {
  const v = await editor(orgId);
  if (!v) return { ok: false, error: "Owners and admins only." };
  const r = await approvePayee(payeeId, v.userId);
  revalidatePath("/hub/store");
  return r;
}
