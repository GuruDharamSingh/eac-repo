"use server";

import { revalidatePath } from "next/cache";
import { getApiEditor } from "@/lib/auth";
import { cleanBoxDoc } from "@elkdonis/direct-edit/block";
import { stripResolvedKeys } from "@elkdonis/blocks/record";
import { RESOLVED_KEYS } from "@/blocks/resolved-keys";
import { HOME_SLUG, PIECE_TEMPLATE, savePage } from "./store";

/**
 * Publish a page. The role check is HERE, not in the editor component: a
 * client component is not an authorisation boundary. Resolver-filled props
 * (the pieces the canvas fetched) are stripped before the page is stored —
 * the published page fetches them again on every request.
 */
export async function savePageAction(slug: string, data: unknown): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only the site's editors can publish pages." };

  // cleanBoxDoc keeps each node's look (`morph`) to its known shape before saving.
  const result = await savePage(slug, cleanBoxDoc(stripResolvedKeys(data, RESOLVED_KEYS)));
  if (result.ok) {
    if (slug === PIECE_TEMPLATE) revalidatePath("/pieces/[slug]", "page");
    else revalidatePath(slug === HOME_SLUG ? "/" : `/${slug}`);
  }
  return result;
}
