"use server";

import { meetingComposeContext } from "@elkdonis/services";
import {
  createSeriesFromForm,
  loadSeriesForForm,
  type SeriesFormInput,
  type SeriesFormRecord,
  type SeriesPublishStep,
} from "@elkdonis/services/series-form";
import type { StudioResult } from "@elkdonis/studio";
import type { MeetingContextView } from "@elkdonis/studio/meeting";
import { db } from "@elkdonis/db";
import { getCurrentUser } from "@/lib/session";
import { networkItemUrl } from "@/lib/org-url";

/**
 * The publication forms' Series in place, on arts-collective (pass 2,
 * 2026-11-08). Thin, like meeting-actions.ts: who is asking, and the org's
 * page address. The rules (owner or guide, everything checked before a
 * write, the hidden publish and its undo, rebuilding a draft) are services'
 * series-form.ts. Bound to studio/forms adapters/series.ts SeriesActions.
 * Not imported anywhere until the PM's go.
 */

type SeriesRecordWithHref = SeriesFormRecord & { href: string | null };

async function viewerId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

const NO_CONTEXT: MeetingContextView = {
  canEdit: false,
  reason: "Sign in first.",
  feeds: [],
  hostCandidates: [],
  canCreateTalkRoom: false,
  canCreateDocument: false,
  canShareToNetwork: false,
};

async function withHref(r: SeriesFormRecord): Promise<SeriesRecordWithHref> {
  if (r.status !== "published") return { ...r, href: null };
  const [org] = await db<Array<{ slug: string }>>`SELECT slug FROM organizations WHERE id = ${r.orgId}`.catch(
    () => [] as Array<{ slug: string }>
  );
  // The network subdomain: `<custom domain>/<slug>` 404s (sunjay, ifac serve series at /series/<slug>).
  return { ...r, href: org?.slug ? networkItemUrl(org.slug, r.slug) : null };
}

/** The same gate and fields as a new meeting: an owner or guide of a real org. */
export async function seriesFormContextAction(orgId: string): Promise<MeetingContextView> {
  const viewer = await viewerId();
  if (!viewer) return NO_CONTEXT;
  return meetingComposeContext(viewer, orgId);
}

/** A series draft this form made (with its input), or a series to open in its planner (input null). */
export async function loadSeriesFormAction(id: string): Promise<SeriesRecordWithHref | null> {
  const viewer = await viewerId();
  if (!viewer) return null;
  const r = await loadSeriesForForm(viewer, id).catch((err) => {
    console.error("[studio] loadSeriesForForm:", err);
    return null;
  });
  return r ? withHref(r) : null;
}

export async function saveSeriesFormAction(
  orgId: string,
  input: SeriesFormInput
): Promise<
  StudioResult<{
    record: SeriesRecordWithHref;
    warnings: string[];
    notPublished: { step: SeriesPublishStep; message: string } | null;
  }>
> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in first." };
  try {
    const r = await createSeriesFromForm(viewer, orgId, input);
    if (r.ok === false) return { ok: false, error: r.error };
    return { ok: true, value: { record: await withHref(r.value), warnings: r.warnings, notPublished: r.notPublished } };
  } catch (err) {
    console.error("[studio] createSeriesFromForm:", err);
    return { ok: false, error: "Could not save the series. Try again." };
  }
}
