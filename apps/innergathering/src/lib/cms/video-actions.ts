"use server";

import { revalidatePath } from "next/cache";
import {
  approveVideoJob,
  createVideoPipeline,
  requeueVideoJob,
  updateVideoJobReview,
  updateVideoPipeline,
  type VideoEditOverride,
  type VideoPipelineSettings,
} from "@elkdonis/services";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import type { ActionResult } from "@/lib/cms/actions";

/**
 * Video pipelines (migration 147): the review half. The worker container does
 * the rendering; these only record decisions. Each action re-checks the editor
 * gate, and every service call is scoped to this org, so a job id from another
 * org is simply not found.
 */

const ORG = siteConfig.orgId;

function done(ok: boolean, error: string): ActionResult {
  if (ok) revalidatePath("/manage/video");
  return ok ? { ok } : { ok, error };
}

export async function createVideoPipelineAction(name: string): Promise<ActionResult> {
  const viewer = await requireOrgEditor();
  try {
    const res = await createVideoPipeline(ORG, name, viewer.userId);
    if ("error" in res) return { ok: false, error: res.error };
    revalidatePath("/manage/video");
    return { ok: true, id: res.pipeline.id };
  } catch (err) {
    console.error("[innergathering] createVideoPipelineAction:", err);
    return { ok: false, error: "Could not create the pipeline." };
  }
}

export async function updateVideoPipelineAction(
  id: string,
  patch: { settings?: Partial<VideoPipelineSettings>; enabled?: boolean }
): Promise<ActionResult> {
  await requireOrgEditor();
  return done(await updateVideoPipeline(ORG, id, patch), "Pipeline not found.");
}

export async function saveVideoJobAction(
  id: string,
  input: { title?: string; description?: string; override?: VideoEditOverride },
  rerender: boolean
): Promise<ActionResult> {
  await requireOrgEditor();
  const saved = await updateVideoJobReview(ORG, id, input);
  if (!saved) return { ok: false, error: "Could not save — check the start is before the end." };
  if (rerender && !(await requeueVideoJob(ORG, id))) {
    return { ok: false, error: "Saved, but it can't be re-rendered while it is still rendering." };
  }
  revalidatePath("/manage/video");
  return { ok: true };
}

export async function retryVideoJobAction(id: string): Promise<ActionResult> {
  await requireOrgEditor();
  return done(await requeueVideoJob(ORG, id), "Only a finished or failed job can be run again.");
}

export async function approveVideoJobAction(id: string): Promise<ActionResult> {
  const viewer = await requireOrgEditor();
  return done(await approveVideoJob(ORG, id, viewer.userId), "Only a rendered video can be approved.");
}
