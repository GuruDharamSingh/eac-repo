"use server";

import { revalidatePath } from "next/cache";
import { isValidSlug } from "@elkdonis/page-builder/server";
import { cleanBoxDoc } from "@elkdonis/direct-edit/block";
import { stripResolvedKeys } from "@elkdonis/blocks/record";
import { getApiEditor } from "@/lib/auth";
import { RESOLVED_KEYS } from "@/blocks/resolved-keys";
import { HOME_SLUG, ROUTE_SLUGS, savePage } from "./store";

/**
 * Publish a page (katie's action). The role check is HERE, not in the editor
 * component: a client component is not an authorisation boundary.
 * Resolver-filled props (the course, the placement) are stripped before the
 * page is stored; the published page resolves them again on every request.
 * cleanBoxDoc keeps each node's look (`morph`) to its known shape.
 */
export async function savePageAction(slug: string, data: unknown): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only the site's editors can publish pages." };
  if (!isValidSlug(slug) || ROUTE_SLUGS.has(slug)) return { ok: false, error: "That address belongs to another part of the site." };

  const result = await savePage(slug, cleanBoxDoc(stripResolvedKeys(data, RESOLVED_KEYS)));
  if (result.ok) revalidatePath(slug === HOME_SLUG ? "/" : `/${slug}`);
  return result;
}
