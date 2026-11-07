"use server";

import { revalidatePath } from "next/cache";
import { cleanBoxDoc } from "@elkdonis/direct-edit/block";
import { getApiEditor } from "@/lib/auth";
import { deletePage, savePage } from "./store";
import { LANDING_SLUG } from "./landing";

/**
 * Publish a page.
 *
 * The role check is HERE rather than in the editor component, for the same
 * reason the theme actions put it in the action: the editor is a client
 * component and must never be the thing deciding who may change a site. A
 * person who can reach the editor UI still cannot write without this passing.
 */
export async function savePageAction(
  slug: string,
  data: unknown
): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only editors can publish pages." };

  const result = await savePage(slug, cleanBoxDoc(data));
  if (result.ok) revalidatePath(`/p/${slug}`);
  return result;
}

/** Back to the landing page as it is written in code. Same gate as saving. */
export async function restoreLandingAction(): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only editors can change this page." };
  return deletePage(LANDING_SLUG);
}
