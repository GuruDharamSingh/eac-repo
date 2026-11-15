"use server";

import { revalidatePath } from "next/cache";
import { createSiteSeries } from "@elkdonis/services";
import type { SeriesCreateInputView, SeriesCreateRecordView } from "@elkdonis/studio-forms";
import { WRONG_ORG, siteOrg } from "@elkdonis/site-forms/server";
import { getHubViewer } from "@/lib/hub-auth";
import { siteConfig } from "@/config/site";

/**
 * The series form's server side on IFAC (2026-11-14): create only, through services' createSiteSeries
 * (the planner's "+ New series" path). The form then opens `/hub/series/<id>`, where a series is edited.
 * Owners and guides only, as with saveContentAction's dated kinds.
 */

// The zones a series shows its times in besides its own: the same list as lib/series-site.ts.
const ALSO_ZONES = ["America/Los_Angeles", "America/New_York", "Europe/Paris"];

export async function siteSeriesContextAction(orgId: string): Promise<{ canEdit: boolean; reason?: string | null }> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { canEdit: false, reason: WRONG_ORG };
  const viewer = await getHubViewer();
  if (!viewer) return { canEdit: false, reason: "Sign in as a member of this site." };
  if (!viewer.canEdit) return { canEdit: false, reason: "Only an owner or guide of this site can start a series." };
  return { canEdit: true, reason: null };
}

export async function siteSeriesCreateAction(
  orgId: string,
  input: SeriesCreateInputView
): Promise<{ ok: true; value: { record: SeriesCreateRecordView; warnings: string[] } } | { ok: false; error: string }> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { ok: false, error: WRONG_ORG };
  const viewer = await getHubViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only an owner or guide of this site can start a series." };
  const r = await createSiteSeries(viewer.userId, siteConfig.orgId, { ...input, lede: input.lede ?? null }, ALSO_ZONES);
  if (r.ok === false) return { ok: false, error: r.error };
  revalidatePath("/hub");
  revalidatePath("/hub/series");
  revalidatePath("/");
  return {
    ok: true,
    value: {
      record: { id: r.value.id, title: input.title.trim(), status: "published", plannerHref: `/hub/series/${r.value.id}`, href: null },
      warnings: r.value.warnings,
    },
  };
}
