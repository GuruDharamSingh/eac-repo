"use server";

import { revalidatePath } from "next/cache";
import { cleanBoxDoc } from "@elkdonis/direct-edit/block";
import { createSavePageAction } from "@elkdonis/house-editor/server";
import { isValidSlug, savePage as savePageFor } from "@elkdonis/page-builder/server";
import { listOrgFeeds, listSitePages } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { deletePage, listPages, savePage } from "./store";
import { LANDING_SLUG } from "./landing";
import { RESERVED_SLUGS, TEMPLATE_SLUGS } from "./reserved";
import { isMobileKey } from "./mobile-keys";
import { stripResolvedKeys } from "@elkdonis/blocks/record";
import { RESOLVED_KEYS } from "./resolved";

/** Save the landing page. The check is here because a client component is not an authorisation boundary. */
export async function saveLandingAction(data: unknown, expectedUpdatedAt?: string): Promise<{ ok: boolean; error?: string; stale?: boolean; updatedAt?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only owners and guides can change this page." };
  // `expectedUpdatedAt`: the landing page's version as the editor read it (then as each save returned it); a changed row is refused, not overwritten. Absent (the page was still drawn by code): unguarded, as before.
  return savePage(LANDING_SLUG, cleanBoxDoc(stripResolvedKeys(data, RESOLVED_KEYS)), expectedUpdatedAt);
}

/** Back to the landing page as it is written in code. Same gate as saving. */
export async function restoreLandingAction(): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only owners and guides can change this page." };
  return deletePage(LANDING_SLUG);
}

/** Why a page may not be saved at this name, or null when it may. Shared by the save and "new page" actions. */
export async function slugProblem(slug: string): Promise<string | null> {
  if (!isValidSlug(slug)) return "A page name uses lowercase letters, numbers and hyphens.";
  if (RESERVED_SLUGS.has(slug)) return `/${slug} already belongs to the site.`;
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true }).catch(() => []);
  if (feeds.some((f) => f.slug === slug)) return `/${slug} is a section of the site.`;
  return null;
}

const publishPage = createSavePageAction({
  orgId: siteConfig.orgId,
  // Owners and guides; checked here, not in the editor.
  gate: getApiEditor,
  denied: "Only owners and guides can publish pages.",
  slugProblem,
  resolvedKeys: RESOLVED_KEYS,
  store: savePageFor,
  revalidate: (slug) => revalidatePath(`/${slug}`),
});

/**
 * Publish a page from /studio/<slug> (2026-11-06). Owners and guides; checked here, not in the editor.
 * `expectedUpdatedAt` is the page's version as the editor loaded it (then as each save returned it): when the row has
 * changed since, nothing is written and the answer has `stale: true`. Absent: unguarded, as before.
 */
export async function savePageAction(slug: string, data: unknown, expectedUpdatedAt?: string): Promise<{ ok: boolean; error?: string; stale?: boolean; updatedAt?: string }> {
  return publishPage(slug, data, expectedUpdatedAt);
}

/** The page switcher in the canvas's name pill: this site's saved pages, minus the landing page and the phone layouts. Gated like a save. */
export async function listEditablePagesAction(): Promise<Array<{ slug: string; title: string; href: string }>> {
  const editor = await getApiEditor();
  if (!editor) return [];
  // Titles from each page's root title (shared services list); layouts and phone docs are not pages.
  const pages = await listSitePages(siteConfig.orgId);
  return pages
    .filter((p) => !TEMPLATE_SLUGS.has(p.slug) && !isMobileKey(p.slug) && !p.slug.startsWith("m-") && isValidSlug(p.slug))
    .map((p) => ({ slug: p.slug, title: p.title, href: `/studio/${p.slug}` }));
}

/** "New page" on /manage/builder: checks the name, then the form opens the editor. */
export async function checkNewPageAction(slug: string): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only owners and guides can create pages." };
  const clean = slug.trim().toLowerCase();
  const problem = await slugProblem(clean);
  return problem ? { ok: false, error: problem } : { ok: true, slug: clean };
}
