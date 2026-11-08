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
import type { MeetingContextView, MeetingInputView, MeetingRecordView, MeetingSummaryView } from "@elkdonis/studio/meeting";
import { db } from "@elkdonis/db";
import { getCurrentUser } from "@/lib/session";
import { resolveOrgHomeUrl } from "@/lib/org-url.server";

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
  const home = await resolveOrgHomeUrl(org?.slug ?? r.orgId).catch(() => null);
  return { ...r, href: home ? `${home}/${r.slug}` : null };
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
  return { ok: true, value: { record: await withHref(r.value), warnings: r.warnings ?? [] } };
}

export async function removeMeetingAction(id: string): Promise<StudioResult> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const r = await removeMeetingContent(viewer, id);
  if (r.ok === false) return { ok: false, error: r.error };
  return { ok: true };
}
