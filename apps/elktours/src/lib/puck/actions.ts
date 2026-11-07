"use server";

import { revalidatePath } from "next/cache";
import { cleanBoxDoc } from "@elkdonis/direct-edit/block";
import { isValidSlug } from "@elkdonis/page-builder/server";
import { listOrgFeeds } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { deletePage, savePage } from "./store";
import { LANDING_SLUG } from "./landing";
import { RESERVED_SLUGS } from "./reserved";
import { stripResolvedKeys } from "@elkdonis/blocks/record";
import { RESOLVED_KEYS } from "./resolved";

/** Save the landing page. The check is here because a client component is not an authorisation boundary. */
export async function saveLandingAction(data: unknown): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only owners and guides can change this page." };
  return savePage(LANDING_SLUG, cleanBoxDoc(stripResolvedKeys(data, RESOLVED_KEYS)));
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

/** Publish a page from /studio/<slug> (2026-11-06). Owners and guides; checked here, not in the editor. */
export async function savePageAction(slug: string, data: unknown): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only owners and guides can publish pages." };
  const problem = await slugProblem(slug);
  if (problem) return { ok: false, error: problem };
  const result = await savePage(slug, cleanBoxDoc(stripResolvedKeys(data, RESOLVED_KEYS)));
  if (result.ok) revalidatePath(`/${slug}`);
  return result;
}

/** "New page" on /manage/builder: checks the name, then the form opens the editor. */
export async function checkNewPageAction(slug: string): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only owners and guides can create pages." };
  const clean = slug.trim().toLowerCase();
  const problem = await slugProblem(clean);
  return problem ? { ok: false, error: problem } : { ok: true, slug: clean };
}
