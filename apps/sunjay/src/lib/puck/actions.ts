"use server";

import { revalidatePath } from "next/cache";
import { isValidSlug } from "@elkdonis/page-builder";
import { listOrgFeeds } from "@elkdonis/services";
import { stripResolved } from "@/blocks/resolved-keys";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { HOME_SLUG, savePage } from "./store";
import { RESERVED_SLUGS, TEMPLATE_SLUGS } from "./reserved";

/**
 * Why a page may not be saved at this slug, or null when it may.
 *
 * Shared by the save action and the "new page" action so the rule lives once.
 * The home page is the one slug exempt from the feed check: `/` is not a feed.
 */
export async function slugProblem(slug: string, opts: { allowTemplate?: boolean } = {}): Promise<string | null> {
  if (!isValidSlug(slug)) return "A page name uses lowercase letters, numbers and hyphens.";
  if (slug === HOME_SLUG) return null;
  // A template document is saved through the same action but may not be
  // chosen as a new page's name (`opts.allowTemplate` is set only from the
  // editor's own save, where the slug came from a route the editor opened).
  if (opts.allowTemplate && TEMPLATE_SLUGS.has(slug)) return null;
  if (RESERVED_SLUGS.has(slug)) return `/${slug} already belongs to the site.`;
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true }).catch(() => []);
  if (feeds.some((f) => f.slug === slug)) return `/${slug} is a section of the site.`;
  return null;
}

/**
 * Publish a page.
 *
 * The role check is HERE, not in the editor component: the editor is a client
 * component and cannot be what decides who may change a site.
 */
export async function savePageAction(
  slug: string,
  data: unknown
): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only editors can publish pages." };

  const problem = await slugProblem(slug, { allowTemplate: true });
  if (problem) return { ok: false, error: problem };

  const result = await savePage(slug, stripResolved(data));
  if (result.ok) {
    if (TEMPLATE_SLUGS.has(slug)) revalidatePath("/", "layout");
    else revalidatePath(slug === HOME_SLUG ? "/" : `/${slug}`);
  }
  return result;
}

/** Form action for "New page" on /manage/builder: checks the name, then opens the editor. */
export async function checkNewPageAction(
  slug: string
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only editors can create pages." };
  const clean = slug.trim().toLowerCase();
  const problem = await slugProblem(clean);
  return problem ? { ok: false, error: problem } : { ok: true, slug: clean };
}
