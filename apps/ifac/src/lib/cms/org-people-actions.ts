"use server";

/**
 * The org's people, for the Center's "Your organisation" journey. The rules
 * (who may change what, listing tags, the Nextcloud sync) are in
 * @elkdonis/services `org-people.ts`; this file supplies who is asking and
 * refuses anyone who is not an owner or guide of this org.
 */

import { listOrgPeople, setOrgPersonRole, setOrgPersonListed, canManageOrgPeople } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

async function manager() {
  const viewer = await getViewer();
  if (!viewer) return null;
  return (await canManageOrgPeople(viewer.userId, siteConfig.orgId)) ? viewer : null;
}

export async function listOrgPeopleAction(orgId: string) {
  if (orgId !== siteConfig.orgId || !(await manager())) return [];
  return listOrgPeople(orgId);
}

export async function setOrgPersonRoleAction(orgId: string, userId: string, role: "viewer" | "member" | "guide") {
  const viewer = await manager();
  if (orgId !== siteConfig.orgId || !viewer) return { ok: false, error: "Only owners and guides can change this." };
  return setOrgPersonRole(orgId, userId, viewer.userId, role);
}

export async function setOrgPersonListedAction(orgId: string, userId: string, on: boolean) {
  const viewer = await manager();
  if (orgId !== siteConfig.orgId || !viewer) return { ok: false, error: "Only owners and guides can change this." };
  return setOrgPersonListed(orgId, userId, viewer.userId, on);
}
