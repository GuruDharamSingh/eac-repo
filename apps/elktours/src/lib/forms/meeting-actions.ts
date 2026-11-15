"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import {
  listOrgFeeds,
  listPostContent,
  loadPostContent,
  savePostContent,
  type PostInput,
  type PostRecord,
  loadMeetingContent,
  meetingComposeContext,
  saveMeetingContent,
  type MeetingInput,
  type MeetingRecord,
} from "@elkdonis/services";
import type { MeetingContextView, MeetingInputView, MeetingRecordView } from "@elkdonis/studio-forms/meeting";
import type { SitePostContextView, SitePostInputView, SitePostRecordView } from "@elkdonis/studio-forms";
import { WRONG_ORG, siteOrg } from "@elkdonis/site-forms/server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The meeting form's server side on elktours (2026-11-14), for the shared popup
 * (@elkdonis/site-forms, registered as `compose:meeting` in components/hub/HubSurfaces.tsx).
 *
 * Thin: who is asking, and this site's routes. The rules (owner or guide to create, author or owner/guide
 * to change, series left to the planner, autosave only over drafts) are services' meeting-content.ts.
 * The org is siteConfig.orgId; the `orgId` the client sends is checked against it and otherwise ignored.
 */

const NO_CONTEXT: MeetingContextView = {
  canEdit: false,
  reason: "Sign in as an editor of this site.",
  feeds: [],
  hostCandidates: [],
  canCreateTalkRoom: false,
  canCreateDocument: false,
  canShareToNetwork: false,
};

/** This site's page for a meeting or event: `/<feed>/<slug>`. */
function withHref(r: MeetingRecord): MeetingRecordView {
  const section = r.input.section;
  return { ...r, href: section ? `/${section}/${r.slug}` : null };
}

export async function siteMeetingContextAction(orgId: string): Promise<MeetingContextView> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { ...NO_CONTEXT, reason: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer) return NO_CONTEXT;
  return meetingComposeContext(viewer.userId, siteConfig.orgId);
}

export async function siteMeetingLoadAction(id: string): Promise<MeetingRecordView | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const r = await loadMeetingContent(viewer.userId, id);
  // A meeting of another org is not this site's to open.
  return r && r.orgId === siteConfig.orgId ? withHref(r) : null;
}

export async function siteMeetingSaveAction(
  orgId: string,
  input: MeetingInputView,
  intent: "draft" | "published",
  id: string | null,
  opts?: { autosave?: boolean }
): Promise<{ ok: true; value: { record: MeetingRecordView; warnings: string[] } } | { ok: false; error: string }> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { ok: false, error: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const r = await saveMeetingContent(
    viewer.userId,
    siteConfig.orgId,
    input as MeetingInput,
    intent === "draft" ? "draft" : "published",
    id,
    { autosave: opts?.autosave === true }
  );
  if (r.ok === false) return { ok: false, error: r.error };
  const record = withHref(r.value);
  revalidatePath("/");
  revalidatePath("/hub");
  revalidatePath("/manage");
  const section = record.input.section;
  if (section) {
    revalidatePath(`/${section}`);
    revalidatePath(`/${section}/${record.slug}`);
  }
  return { ok: true, value: { record, warnings: r.warnings ?? [] } };
}

// ── Post (savePostContent / loadPostContent, services site-post-content.ts) ─────────────────────────

const NO_POST_CONTEXT: SitePostContextView = {
  canEdit: false,
  reason: "Sign in as an editor of this site.",
  feeds: [],
  canShareToNetwork: false,
  canSetVisibility: true,
};

function postView(r: PostRecord): SitePostRecordView {
  return {
    id: r.id,
    orgId: r.orgId,
    slug: r.slug,
    status: r.status,
    publishedAt: r.publishedAt,
    updatedAt: r.updatedAt,
    href: r.section ? `/${r.section}/${r.slug}` : null,
    input: r.input as SitePostInputView,
  };
}

export async function sitePostContextAction(orgId: string): Promise<SitePostContextView> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { ...NO_POST_CONTEXT, reason: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer?.canEdit) return NO_POST_CONTEXT;
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true });
  return { canEdit: true, feeds: feeds.map((f) => ({ slug: f.slug, name: f.name })), canShareToNetwork: false, canSetVisibility: true };
}

export async function sitePostLoadAction(id: string): Promise<SitePostRecordView | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const r = await loadPostContent(viewer.userId, siteConfig.orgId, id);
  return r ? postView(r) : null;
}

export async function sitePostSaveAction(
  orgId: string,
  input: SitePostInputView,
  intent: "draft" | "published",
  id: string | null,
  opts?: { autosave?: boolean }
): Promise<{ ok: true; value: { record: SitePostRecordView; warnings: string[] } } | { ok: false; error: string }> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { ok: false, error: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const r = await savePostContent(viewer.userId, siteConfig.orgId, input as PostInput, intent === "draft" ? "draft" : "published", id, {
    autosave: opts?.autosave === true,
  });
  if (r.ok === false) return { ok: false, error: r.error };
  const record = postView(r.value);
  revalidatePath("/");
  revalidatePath("/hub");
  revalidatePath("/manage");
  if (record.input.section) {
    revalidatePath(`/${record.input.section}`);
    revalidatePath(`/${record.input.section}/${record.slug}`);
  }
  return { ok: true, value: { record, warnings: r.warnings ?? [] } };
}

export async function sitePostListAction(orgId: string): Promise<Array<{ id: string; title: string; status: string; updatedAt: string }>> {
  if (!siteOrg(siteConfig.orgId, orgId)) return [];
  const viewer = await getViewer();
  if (!viewer?.canEdit) return [];
  const rows = await listPostContent(viewer.userId, siteConfig.orgId);
  return rows.map((r) => ({ id: r.id, title: r.title, status: r.status, updatedAt: r.updatedAt }));
}
