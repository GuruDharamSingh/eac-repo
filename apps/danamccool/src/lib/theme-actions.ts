"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { savePalette } from "./theme-store";
import type { Palette } from "./theme";

/**
 * Write the site's palette.
 *
 * The role check is here rather than in the editor component, because a client
 * component is not an authorisation boundary — someone who can open dev tools
 * can call this directly.
 */
export async function savePaletteAction(palette: Palette): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only the site owner can change the colours." };

  const result = await savePalette(palette);
  // The palette is read in the root layout, so every route's cached render is
  // now wrong — not just one page.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
