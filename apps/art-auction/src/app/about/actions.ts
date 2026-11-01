"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { canEditAbout, saveAbout, type AboutContent } from "@/lib/about-content";

type Result = { ok: boolean; error?: string };

/** Save the whole About page (owners of the marketplace org, network admins). */
export async function saveAboutAction(content: AboutContent): Promise<Result> {
  const userId = await getCurrentUserId();
  if (!(await canEditAbout(userId))) return { ok: false, error: "Only the site's owners can edit this page." };
  try {
    await saveAbout(content);
    revalidatePath("/about");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save." };
  }
}
