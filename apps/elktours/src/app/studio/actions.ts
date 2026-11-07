"use server";

import { revalidatePath } from "next/cache";
import { savePage } from "@elkdonis/page-builder/server";
import { readTourLayout } from "@/blocks/tour/layout-data";
import { readExperienceLayout } from "@/blocks/experience/layout-data";
import { getApiEditor } from "@/lib/auth";
import { saveExperienceLayout } from "@/lib/experience-layout";
import { saveExperiencePageAction } from "@/lib/experience-actions";
import { siteConfig } from "@/config/site";

type SaveResult = { ok: boolean; error?: string };

/**
 * Publish targets for the /studio layout editors. Each re-checks the role:
 * a client component is not an authorisation boundary.
 */

/** The shared tour page layout: site_config `puck:tour-detail` (read by lib/tour-layout.ts). */
export async function publishTourLayoutAction(data: unknown): Promise<SaveResult> {
  if (!(await getApiEditor())) return { ok: false, error: "Only editors can change the tour page layout." };
  // Unknown block types are dropped before the write, so the stored document is one readTourLayout accepts.
  const clean = readTourLayout(data);
  if (!clean) return { ok: false, error: "Add at least one block before publishing." };
  // page-builder's store writes site_config `puck:<slug>`: slug "tour-detail" is TOUR_LAYOUT_KEY.
  const res = await savePage(siteConfig.orgId, "tour-detail", clean);
  if (res.ok) revalidatePath("/tours", "layout");
  return res;
}

/** The site default experience layout: site_config `puck:experience-detail` (lib/experience-layout.ts). */
export async function publishExperienceDefaultLayoutAction(data: unknown): Promise<SaveResult> {
  if (!(await getApiEditor())) return { ok: false, error: "Only editors can change the experience page layout." };
  const clean = readExperienceLayout(data);
  if (!clean) return { ok: false, error: "Add at least one block before publishing." };
  try {
    await saveExperienceLayout(clean);
    revalidatePath("/experiences", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the layout." };
  }
}

/** One experience's own layout (`metadata.page`). Editors only in Phase A. */
export async function publishExperiencePageAction(experienceId: string, data: unknown | null): Promise<SaveResult> {
  if (!(await getApiEditor())) return { ok: false, error: "Only editors can change this page's layout." };
  const clean = data === null ? null : readExperienceLayout(data);
  if (data !== null && !clean) return { ok: false, error: "Add at least one block before publishing." };
  const res = await saveExperiencePageAction(experienceId, clean);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/experiences", "layout");
  return { ok: true };
}
