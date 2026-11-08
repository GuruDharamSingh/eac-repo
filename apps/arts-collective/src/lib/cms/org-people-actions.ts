"use server";

/**
 * An org's people, for the Center's "Your organisation" journey. The rules
 * (who may change what, listing tags, the Nextcloud sync) are in
 * @elkdonis/services `org-people.ts`; this file supplies who is asking. The
 * network host serves every org, so the gate is per org: owners and guides
 * of THAT org (canManageOrgPeople). Ported from ifac (2026-10-29).
 */

import { listOrgPeople, setOrgPersonRole, setOrgPersonListed, canManageOrgPeople, canChangeOrgPeople } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

async function manager(orgId: string) {
  const user = await getCurrentUser();
  if (!user || !orgId) return null;
  return (await canManageOrgPeople(user.id, orgId)) ? user : null;
}

export async function listOrgPeopleAction(orgId: string) {
  if (!(await manager(orgId))) return [];
  return listOrgPeople(orgId);
}

export async function setOrgPersonRoleAction(orgId: string, userId: string, role: "viewer" | "member" | "guide") {
  const user = await manager(orgId);
  if (!user) return { ok: false, error: "Only owners and guides can change this." };
  return setOrgPersonRole(orgId, userId, user.id, role);
}

export async function setOrgPersonListedAction(orgId: string, userId: string, on: boolean) {
  const user = await manager(orgId);
  if (!user) return { ok: false, error: "Only owners and guides can change this." };
  return setOrgPersonListed(orgId, userId, user.id, on);
}

/** Owners change roles and listing (services canChangeOrgPeople); the Center table asks first. */
export async function canChangeOrgPeopleAction(orgId: string) {
  const user = await getCurrentUser();
  if (!user || !orgId) return false;
  return canChangeOrgPeople(user.id, orgId);
}
