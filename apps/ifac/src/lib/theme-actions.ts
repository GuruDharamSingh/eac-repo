"use server";

import { revalidatePath } from "next/cache";
import { saveSiteTheme, saveUserTheme, hasOrgRole } from "@elkdonis/services";
import type { ThemeVars } from "@elkdonis/services";
import { getServerSession } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";

async function currentUserId(): Promise<string | null> {
  const session = await getServerSession();
  if (!session.user) return null;
  return session.user.db_user_id ?? session.user.id;
}

/** Owners and guides only — a member can be listed without repainting the site. */
export async function saveIfacThemeAction(
  pageKey: string,
  vars: ThemeVars
): Promise<{ ok: boolean; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  if (!(await hasOrgRole(userId, siteConfig.orgId, ["owner", "guide"]))) {
    return { ok: false, error: "Only owners and guides can change the site look" };
  }

  const result = await saveSiteTheme(siteConfig.orgId, pageKey, vars, userId);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** A person's own profile look. No org role consulted — identity is theirs. */
export async function saveMyIfacThemeAction(
  vars: ThemeVars
): Promise<{ ok: boolean; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const result = await saveUserTheme(userId, vars);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
