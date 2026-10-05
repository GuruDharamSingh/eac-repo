"use server";

import { revalidatePath } from "next/cache";
import { isValidSlug } from "@elkdonis/page-builder";
import { stripResolved } from "@/blocks/resolved-keys";
import { getPagesEditor } from "./auth";
import { savePage } from "./store";
import { RESERVED_SLUGS, TEMPLATE_SLUGS } from "./reserved";

/** Why a page may not be saved at this slug, or null when it may. */
export async function slugProblem(slug: string, opts: { allowTemplate?: boolean } = {}): Promise<string | null> {
  if (!isValidSlug(slug)) return "A page name uses lowercase letters, numbers and hyphens.";
  if (opts.allowTemplate && TEMPLATE_SLUGS.has(slug)) return null;
  if (RESERVED_SLUGS.has(slug)) return `/${slug} already belongs to the site.`;
  return null;
}

/** Publish a page. The role check is here, not in the editor component. */
export async function savePageAction(slug: string, data: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!(await getPagesEditor())) return { ok: false, error: "Only page editors can publish." };
  const problem = await slugProblem(slug, { allowTemplate: true });
  if (problem) return { ok: false, error: problem };

  const result = await savePage(slug, stripResolved(data));
  if (result.ok) {
    if (TEMPLATE_SLUGS.has(slug)) revalidatePath("/read", "layout");
    else revalidatePath(`/${slug}`);
  }
  return result;
}

/** "New page": check the name, then the form opens the editor on it. */
export async function checkNewPageAction(
  slug: string
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  if (!(await getPagesEditor())) return { ok: false, error: "Only page editors can create pages." };
  const clean = slug.trim().toLowerCase();
  const problem = await slugProblem(clean);
  return problem ? { ok: false, error: problem } : { ok: true, slug: clean };
}
