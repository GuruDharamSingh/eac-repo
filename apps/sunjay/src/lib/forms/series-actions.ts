"use server";

import { revalidatePath } from "next/cache";
import { createSiteSeries } from "@elkdonis/services";
import type { SeriesCreateInputView, SeriesCreateRecordView } from "@elkdonis/studio-forms";
import { WRONG_ORG, siteOrg } from "@elkdonis/site-forms/server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The series form's server side on Para Theater (2026-11-14): create only. The create is services'
 * createSiteSeries (the same function behind the planner's "+ New series"); the form then opens
 * `plannerHref`, where a series is edited.
 */

export async function siteSeriesContextAction(orgId: string): Promise<{ canEdit: boolean; reason?: string | null }> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { canEdit: false, reason: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer) return { canEdit: false, reason: "Sign in as an editor of this site." };
  if (!viewer.canEdit) return { canEdit: false, reason: "Only an owner or guide of this site can start a series." };
  return { canEdit: true, reason: null };
}

export async function siteSeriesCreateAction(
  orgId: string,
  input: SeriesCreateInputView
): Promise<{ ok: true; value: { record: SeriesCreateRecordView; warnings: string[] } } | { ok: false; error: string }> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { ok: false, error: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only an owner or guide of this site can start a series." };
  const r = await createSiteSeries(
    viewer.userId,
    siteConfig.orgId,
    { ...input, lede: input.lede ?? null },
    [siteConfig.timeZone]
  );
  if (r.ok === false) return { ok: false, error: r.error };
  revalidatePath("/hub");
  revalidatePath("/hub/series");
  revalidatePath("/manage");
  return {
    ok: true,
    value: {
      record: { id: r.value.id, title: input.title.trim(), status: "published", plannerHref: `/hub/series/${r.value.id}`, href: null },
      warnings: r.value.warnings,
    },
  };
}
