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
import { getIfacManager } from "@/lib/manage-auth";
import { siteConfig } from "@/config/site";

// ============================================================================
// IFAC's organisation store, administered from /manage/store (ORG_STORE_BRIEF
// D2, R9). The store trades in the marketplace org; its team is the
// `store_member` roll. All writes go through @elkdonis/commerce, which checks
// the actor; this file only resolves the viewer and the store.
// ============================================================================

import { MARKETPLACE_ORG } from "./marketplace";

type Result = { ok: boolean; error?: string };

async function viewerOrFail(): Promise<{ userId: string } | null> {
  const v = await getIfacManager();
  return v ? { userId: v.userId } : null;
}

export async function openIfacStoreAction(): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!viewer) return { ok: false, error: "Owners and admins only." };
  const r = await openOrgStore({
    ownerOrgId: siteConfig.orgId,
    orgId: MARKETPLACE_ORG,
    actorUserId: viewer.userId,
  });
  revalidatePath("/manage/store");
  return { ok: r.ok, error: r.error };
}

export async function addIfacStoreMemberAction(email: string, role: StoreMemberRole): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!viewer) return { ok: false, error: "Owners and admins only." };
  const store = await getStoreForOrg(siteConfig.orgId, MARKETPLACE_ORG);
  if (!store) return { ok: false, error: "IFAC has no store yet." };
  const r = await addStoreMemberByEmail({ storeId: store.id, email, role, actorUserId: viewer.userId });
  revalidatePath("/manage/store");
  return r;
}

export async function removeIfacStoreMemberAction(userId: string): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!viewer) return { ok: false, error: "Owners and admins only." };
  const store = await getStoreForOrg(siteConfig.orgId, MARKETPLACE_ORG);
  if (!store) return { ok: false, error: "IFAC has no store yet." };
  if (!(await canManageStoreTeam(viewer.userId, store.id))) {
    return { ok: false, error: "Only a store owner or the organisation's owners and admins can edit the team." };
  }
  const r = await removeStoreMember(store.id, userId);
  revalidatePath("/manage/store");
  return r;
}

export async function addIfacCharityAction(input: {
  name: string;
  registrationNo?: string;
  website?: string;
  blurb?: string;
}): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!viewer) return { ok: false, error: "Owners and admins only." };
  const r = await addCharityPayee({ orgId: siteConfig.orgId, actorUserId: viewer.userId, ...input });
  revalidatePath("/manage/store");
  return { ok: r.ok, error: r.error };
}

export async function addIfacOrgBeneficiaryAction(payeeId: string): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!viewer) return { ok: false, error: "Owners and admins only." };
  const r = await addOrgBeneficiary(siteConfig.orgId, payeeId, viewer.userId);
  revalidatePath("/manage/store");
  return r;
}

export async function removeIfacBeneficiaryAction(payeeId: string): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!viewer) return { ok: false, error: "Owners and admins only." };
  const r = await removeOrgBeneficiary(siteConfig.orgId, payeeId, viewer.userId);
  revalidatePath("/manage/store");
  return r;
}

export async function approveIfacPayeeAction(payeeId: string): Promise<Result> {
  const viewer = await viewerOrFail();
  if (!viewer) return { ok: false, error: "Owners and admins only." };
  const r = await approvePayee(payeeId, viewer.userId);
  revalidatePath("/manage/store");
  return r;
}
