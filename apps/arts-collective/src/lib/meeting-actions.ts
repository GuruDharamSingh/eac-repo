"use server";

import {
  listOrgMeetings,
  loadMeetingContent,
  meetingComposeContext,
  removeMeetingContent,
  saveMeetingContent,
  type MeetingInput,
  type MeetingRecord,
} from "@elkdonis/services";
import type { StudioResult } from "@elkdonis/studio";
import type { MeetingContextView, MeetingInputView, MeetingRecordView, MeetingSummaryView } from "@elkdonis/studio-forms/meeting";
import { db } from "@elkdonis/db";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { networkItemUrl } from "@/lib/org-url";

/**
 * The Studio's Meetings kind, on arts-collective (2026-11-01). Thin: who is
 * asking, and the org's page address. The rules (owner/guide for a new one,
 * author or owner/guide to change one, series left to the planner, the review
 * queue) are services' meeting-content.ts, so any host — or one merged app —
 * gets the same behaviour.
 */

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

async function withHref(r: MeetingRecord): Promise<MeetingRecordView> {
  const [org] = await db<Array<{ slug: string }>>`SELECT slug FROM organizations WHERE id = ${r.orgId}`.catch(
    () => [] as Array<{ slug: string }>
  );
  // The network subdomain: `<custom domain>/<slug>` 404s where an org's own app serves its domain.
  return { ...r, href: org?.slug ? networkItemUrl(org.slug, r.slug) : null };
}

export async function meetingContextAction(orgId: string): Promise<MeetingContextView> {
  const viewer = await viewerId();
  if (!viewer) return NO_CONTEXT;
  return meetingComposeContext(viewer, orgId);
}

export async function listMeetingsAction(orgId: string): Promise<MeetingSummaryView[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  return listOrgMeetings(viewer, orgId).catch((err) => {
    console.error("[studio] listOrgMeetings:", err);
    return [];
  });
}

export async function loadMeetingAction(id: string): Promise<MeetingRecordView | null> {
  const viewer = await viewerId();
  if (!viewer) return null;
  const r = await loadMeetingContent(viewer, id);
  return r ? withHref(r) : null;
}

export async function saveMeetingAction(
  orgId: string,
  input: MeetingInputView,
  intent: "draft" | "published",
  id: string | null,
  opts?: { autosave?: boolean }
): Promise<StudioResult<{ record: MeetingRecordView; warnings: string[] }>> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in first." };
  // `autosave` is refused over a meeting that is no longer a draft (meeting-content.ts).
  const r = await saveMeetingContent(viewer, orgId, input as MeetingInput, intent === "draft" ? "draft" : "published", id, {
    autosave: opts?.autosave === true,
  });
  if (r.ok === false) return { ok: false, error: r.error };
  const record = await withHref(r.value);
  await revalidateOrg(r.value.orgId);
  return { ok: true, value: { record, warnings: r.warnings ?? [] } };
}

/**
 * The org's shell pages under /sites/<slug> (the org host and subdomain rewrite there). They are
 * force-dynamic, so this clears the client router cache rather than a stored page; the org-site
 * copies of saveContentAction do the same for their own paths (2026-11-14).
 */
async function revalidateOrg(orgId: string): Promise<void> {
  const [org] = await db<Array<{ slug: string }>>`SELECT slug FROM organizations WHERE id = ${orgId}`.catch(
    () => [] as Array<{ slug: string }>
  );
  if (org?.slug) revalidatePath(`/sites/${org.slug}`, "layout");
}

export async function removeMeetingAction(id: string): Promise<StudioResult> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const [row] = await db<Array<{ org_id: string }>>`SELECT org_id FROM threads WHERE id = ${id}`.catch(
    () => [] as Array<{ org_id: string }>
  );
  const r = await removeMeetingContent(viewer, id);
  if (r.ok === false) return { ok: false, error: r.error };
  if (row) await revalidateOrg(row.org_id);
  return { ok: true };
}
