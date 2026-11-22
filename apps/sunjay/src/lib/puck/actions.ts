"use server";

import { revalidatePath } from "next/cache";
import { cleanBoxDoc } from "@elkdonis/direct-edit/block";
import { createSavePageAction } from "@elkdonis/house-editor/server";
import { isValidSlug } from "@elkdonis/page-builder";
import { savePage as savePageFor } from "@elkdonis/page-builder/server";
import { listOrgFeeds } from "@elkdonis/services";
import { RESOLVED_KEYS, stripResolved } from "@/blocks/resolved-keys";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { deletePage, HOME_SLUG, savePage } from "./store";
import { LANDING_SLUG } from "./landing";
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

const publishPage = createSavePageAction({
  orgId: siteConfig.orgId,
  // The role check is HERE, not in the editor component: the editor is a client component and cannot be what
  // decides who may change a site.
  gate: getApiEditor,
  denied: "Only editors can publish pages.",
  slugProblem: (slug) => slugProblem(slug, { allowTemplate: true }),
  resolvedKeys: RESOLVED_KEYS,
  store: savePageFor,
  // A template draws every thread's page, so a saved one revalidates the whole layout.
  revalidate: (slug) => (TEMPLATE_SLUGS.has(slug) ? revalidatePath("/", "layout") : revalidatePath(slug === HOME_SLUG ? "/" : `/${slug}`)),
});

/**
 * Publish a page. `expectedUpdatedAt` is the page's version as the editor loaded it (then as each save returned it):
 * when the row has changed since, nothing is written and the answer has `stale: true`. Absent: unguarded.
 */
export async function savePageAction(
  slug: string,
  data: unknown,
  expectedUpdatedAt?: string
): Promise<{ ok: boolean; error?: string; stale?: boolean; updatedAt?: string }> {
  return publishPage(slug, data, expectedUpdatedAt);
}

/** Save the home page as a tree. The check is here because a client component is not an authorisation boundary. */
export async function saveLandingAction(data: unknown): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only editors can change this page." };
  const result = await savePage(LANDING_SLUG, cleanBoxDoc(stripResolved(data)));
  if (result.ok) revalidatePath("/");
  return result;
}

/** Back to the home page as it is written in code. Same gate as saving. */
export async function restoreLandingAction(): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only editors can change this page." };
  const result = await deletePage(LANDING_SLUG);
  if (result.ok) revalidatePath("/");
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
