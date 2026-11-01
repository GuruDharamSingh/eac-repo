"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { canEditHome } from "@/lib/home-hero";
import { saveLoftSettings, saveWelcome, type LoftSpot, type WelcomeContent } from "@/lib/home-sections";

type Result = { ok: boolean; error?: string };

const NOT_ALLOWED = "Only the site's owners can change this.";

/** The welcome letter above the hero (owners of the marketplace org, network admins). */
export async function saveWelcomeAction(content: WelcomeContent): Promise<Result> {
  if (!(await canEditHome(await getCurrentUserId()))) return { ok: false, error: NOT_ALLOWED };
  try {
    await saveWelcome(content);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save." };
  }
}

/** The two spots on the home loft's wall: which work, its frame proportion and crop, in wall order. */
export async function saveHomeLoftAction(spots: LoftSpot[]): Promise<Result> {
  if (!(await canEditHome(await getCurrentUserId()))) return { ok: false, error: NOT_ALLOWED };
  try {
    await saveLoftSettings(spots);
    revalidatePath("/");
    revalidatePath("/admin/pages");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save." };
  }
}
