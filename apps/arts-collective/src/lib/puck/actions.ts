"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { canEditOrgSite, getOrgBySlug } from "@/lib/org";
import { stripResolved } from "./catalogue";
import { deleteOrgHome, saveOrgHome } from "./store";

/**
 * Publish an org's landing page.
 *
 * The role check is here, not in the editor component: the editor is a client
 * component and cannot be what decides who may change a site. The org is the
 * one in the URL the editor was opened from, checked against the session
 * user with `canEditOrgSite` (owner or guide), the same bar as the compose
 * actions and the Silex token.
 */
export async function saveOrgHomeAction(
  orgSlug: string,
  data: unknown
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to publish." };
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { ok: false, error: "No such organisation." };
  if (!(await canEditOrgSite(user.id, org.id))) return { ok: false, error: "Only owners and guides can publish this page." };

  const result = await saveOrgHome(org.id, stripResolved(data));
  if (result.ok) revalidatePath(`/sites/${orgSlug}`);
  return result;
}

/** Remove the designed page: the subdomain root goes back to the offering, or the default page. */
export async function removeOrgHomeAction(orgSlug: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { ok: false, error: "No such organisation." };
  if (!(await canEditOrgSite(user.id, org.id))) return { ok: false, error: "Only owners and guides can change this." };
  const ok = await deleteOrgHome(org.id);
  if (ok) {
    revalidatePath(`/sites/${orgSlug}`);
    revalidatePath("/hub/organization");
  }
  return ok ? { ok: true } : { ok: false, error: "Could not remove the page." };
}
