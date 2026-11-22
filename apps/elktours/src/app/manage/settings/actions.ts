"use server";

import { revalidatePath } from "next/cache";
import { saveSiteSettings, type SiteSettings } from "@/lib/site-settings";

/** Save the site settings (owner only: saveSiteSettings checks the role itself). */
export async function saveSettingsAction(patch: Partial<SiteSettings>): Promise<{ ok: true; settings: SiteSettings } | { ok: false; error: string }> {
  const r = await saveSiteSettings(patch);
  if (r.ok === true) {
    revalidatePath("/manage/settings");
    revalidatePath("/manage");
  }
  return r;
}
