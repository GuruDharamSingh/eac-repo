"use server";

import { canEditOrgIdentity } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { getOrgBySlug, getOfferingThread } from "@/lib/org";
import { hasOrgHome } from "@/lib/puck/store";
import { orgHomeUrl, orgHomeUrlMap } from "@/lib/org-url.server";
import { loadCurrentWork } from "@/lib/offer-card";
import { drawsInsteadOf } from "@/lib/offer-card-words";
import type { CurrentWorkData } from "@/lib/offer-card-types";

/**
 * Re-reads the "Current Work Page" card's data after the surface saved something, so it shows what
 * the site now does. Same gate as offer-look-actions.ts: the session user must be an owner or guide
 * of the org in the argument (admins too). Reads only.
 */
export async function loadCurrentWorkAction(orgSlug: string): Promise<{ ok: true; data: CurrentWorkData } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to see this." };
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { ok: false, error: "No such organisation." };
  if (!(await canEditOrgIdentity(user.id, org.id))) return { ok: false, error: "Only owners and guides can see this." };
  const [designed, offering, homes] = await Promise.all([hasOrgHome(org.id), getOfferingThread(org.id), orgHomeUrlMap()]);
  const instead = drawsInsteadOf({
    silex: org.layout_mode === "silex" && Boolean(org.silex_published_path),
    designed,
    offering: offering ? { pinned: offering.pinned, title: offering.title } : null,
  });
  return { ok: true, data: await loadCurrentWork(org, orgHomeUrl(homes, org.slug), instead) };
}
