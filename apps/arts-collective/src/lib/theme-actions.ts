"use server";

import { revalidatePath } from "next/cache";
import { saveSiteTheme, saveUserTheme, hasOrgRole } from "@elkdonis/services";
import type { ThemeVars } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * Save a site or page theme.
 *
 * Authorisation is here, not in the panel: CssPanel is a generic client
 * component and must not be the thing deciding who may restyle a site.
 * Owners and guides only — a member can be published on a site without being
 * able to repaint it.
 */
export async function saveSiteThemeAction(
  orgId: string,
  pageKey: string,
  vars: ThemeVars
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (!(await hasOrgRole(user.id, orgId, ["owner", "guide"]))) {
    return { ok: false, error: "Only owners and guides can change the site look" };
  }

  const result = await saveSiteTheme(orgId, pageKey, vars, user.id);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/**
 * Save a person's own profile theme.
 *
 * A person always controls their own identity — the same rule profiles.ts
 * enforces for bio and photo. No org role is consulted, and nobody may set
 * someone else's.
 */
export async function saveMyThemeAction(
  vars: ThemeVars
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const result = await saveUserTheme(user.id, vars);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
