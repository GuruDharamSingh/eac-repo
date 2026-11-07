"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { canEditOrgSite, getOrgBySlug } from "@/lib/org";
import { cleanDoc } from "./catalog";
import { saveClassifieds } from "./store";

/**
 * Save an org's classifieds page. The role check lives here, not in the
 * editor (a client component is not an authorisation boundary): owners and
 * guides of the org in the URL (`canEditOrgSite`), the same bar as the page
 * designer. The document is re-validated field by field before it is stored.
 */
export async function saveClassifiedsAction(orgSlug: string, doc: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to save." };
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { ok: false, error: "No such organisation." };
  if (!(await canEditOrgSite(user.id, org.id))) return { ok: false, error: "Only owners and guides can change this page." };
  const clean = cleanDoc(doc);
  if (!clean) return { ok: false, error: "That page could not be read." };
  const result = await saveClassifieds(org.id, clean);
  if (result.ok) revalidatePath(`/sites/${orgSlug}/classifieds`);
  return result;
}
