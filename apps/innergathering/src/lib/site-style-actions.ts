"use server";

import { revalidatePath } from "next/cache";
import { getApiEditor } from "@/lib/auth";
import { saveSiteStyle } from "./site-style";

/**
 * Save the site's style. The role check is here because a client component is
 * not an authorisation boundary: an owner or guide of this org (the same gate
 * as the page editors).
 */
export async function saveSiteStyleAction(style: unknown): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only the site's owners and guides can change its style." };
  const res = await saveSiteStyle(style, editor.userId);
  // Drawn by the root layout on every page, so revalidate the layout, not just "/".
  if (res.ok) revalidatePath("/", "layout");
  return res;
}
