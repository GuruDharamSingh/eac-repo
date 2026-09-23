"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { savePage } from "./store";

/**
 * Publish a page.
 *
 * The role check is HERE rather than in the editor component, because a client
 * component is not an authorisation boundary. A person who can reach the
 * editor UI still cannot write without this passing.
 */
export async function savePageAction(
  slug: string,
  data: unknown
): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only the site owner can publish pages." };

  const result = await savePage(slug, data);
  // Pages are served at their own address ("home" at "/"); the /p/ prefix
  // is what the first version used.
  if (result.ok) revalidatePath(slug === "home" ? "/" : `/${slug}`);
  return result;
}
