"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { canEditOrgSite, getOrgBySlug } from "@/lib/org";
import { cleanCards } from "./catalog";
import { saveCards } from "./store";

/**
 * Save an org's feed-card design. The role check lives here, not in the editor
 * (a client component is not an authorisation boundary): owners and guides of
 * the org in the URL (`canEditOrgSite`), the same bar as the classifieds page.
 * The design is re-validated field by field before it is stored.
 */
export async function saveCardsAction(orgSlug: string, doc: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to save." };
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { ok: false, error: "No such organisation." };
  if (!(await canEditOrgSite(user.id, org.id))) return { ok: false, error: "Only owners and guides can change this page." };
  const clean = cleanCards(doc);
  if (!clean) return { ok: false, error: "That design could not be read." };
  const result = await saveCards(org.id, clean);
  if (result.ok) revalidatePath(`/sites/${orgSlug}`);
  return result;
}
