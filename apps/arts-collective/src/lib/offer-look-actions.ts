"use server";

import { revalidatePath } from "next/cache";
import { withOrg } from "@elkdonis/db";
import { canEditOrgIdentity } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { getOrgBySlug } from "@/lib/org";
import { LOOK_KEY, cleanLook } from "@/lib/offer-site";

/**
 * Save an org's single-offer page look (site_config `offer:look`): font
 * template, icon set, phone mark, kind tint, and `enabled` ("use the new page").
 * The role check is here, from the session and the org in the argument: owners
 * and guides (`canEditOrgIdentity` also admits global admins). The value is
 * re-validated field by field; unknown values fall back to the defaults.
 */
export async function saveOfferLookAction(orgSlug: string, input: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to save." };
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { ok: false, error: "No such organisation." };
  if (!(await canEditOrgIdentity(user.id, org.id))) return { ok: false, error: "Only owners and guides can change this page." };
  const look = cleanLook(input);
  if (!look) return { ok: false, error: "That look could not be read." };
  const enabled = (input as Record<string, unknown>).enabled === true;
  try {
    await withOrg(org.id, (sql) => sql`
      INSERT INTO site_config (org_id, key, value)
      VALUES (${org.id}, ${LOOK_KEY}, ${sql.json({ ...look, enabled } as never)})
      ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `);
  } catch (err) {
    console.error("[offer-look] save:", err);
    return { ok: false, error: "Could not save the look." };
  }
  revalidatePath(`/sites/${orgSlug}`);
  return { ok: true };
}
