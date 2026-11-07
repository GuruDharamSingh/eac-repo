"use server";

import { getApiEditor } from "@/lib/auth";
import { saveSiteStyle } from "./site-style";

/** Save the site's style. The role check is here because a client component is not an authorisation boundary. */
export async function saveSiteStyleAction(style: unknown): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only owners and guides can change the site's style." };
  return saveSiteStyle(style, editor.userId);
}
