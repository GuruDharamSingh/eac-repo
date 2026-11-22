"use server";

import { revalidatePath } from "next/cache";
import { getPagesEditor } from "@/lib/puck/auth";
import { saveSiteStyle } from "./site-style";

/**
 * Save the site's style. The role check is here because a client component is
 * not an authorisation boundary: a platform admin, or an owner or guide of the
 * marketplace org (the same gate as designed pages).
 */
export async function saveSiteStyleAction(style: unknown): Promise<{ ok: boolean; error?: string }> {
  const editor = await getPagesEditor();
  if (!editor) return { ok: false, error: "Only the marketplace's owners and editors can change the site's style." };
  const res = await saveSiteStyle(style, editor.userId);
  // The style is drawn by the root layout on every page, so revalidate the layout, not just "/".
  if (res.ok) revalidatePath("/", "layout");
  return res;
}
