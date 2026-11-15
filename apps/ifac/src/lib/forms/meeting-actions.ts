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
import { getHubViewer } from "@/lib/hub-auth";
import { threadHref } from "@/lib/gather";
import { siteConfig } from "@/config/site";

/**
 * The meeting, event and post forms' server side on IFAC (2026-11-14), for the shared popup and the
 * /hub/compose page (@elkdonis/site-forms; `compose:meeting|event|article`).
 *
 * Thin: who is asking, and this site's routes. The rules are services' meeting-content.ts (owner or guide
 * for dated kinds, review rule `statusForNewThread`, org-calendar mirror, rota hosts, Talk room and document)
 * and site-post-content.ts (`membersMayPost`: any member may post, as saveContentAction did).
 * The org is siteConfig.orgId; the `orgId` the client sends is checked against it and otherwise ignored.
 * IFAC never offered "also show on the network" on its compose forms, so `canShareToNetwork` is false.
 */

const NO_CONTEXT: MeetingContextView = {
  canEdit: false,
  reason: "Sign in as a member of this site.",
  feeds: [],
  hostCandidates: [],
  canCreateTalkRoom: false,
  canCreateDocument: false,
  canShareToNetwork: false,
};

/** The members' meeting page. Series sessions never come through here. */
function withHref(r: MeetingRecord): MeetingRecordView {
  return { ...r, href: `/hub/meetings/${r.slug}` };
}

export async function siteMeetingContextAction(orgId: string): Promise<MeetingContextView> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { ...NO_CONTEXT, reason: WRONG_ORG };
  const viewer = await getHubViewer();
  if (!viewer) return NO_CONTEXT;
  const ctx = await meetingComposeContext(viewer.userId, siteConfig.orgId);
  return { ...ctx, canShareToNetwork: false };
}

export async function siteMeetingLoadAction(id: string): Promise<MeetingRecordView | null> {
  const viewer = await getHubViewer();
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
  const viewer = await getHubViewer();
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
  revalidatePath("/hub");
  revalidatePath("/");
  revalidatePath(`/hub/meetings/${record.slug}`);
  return { ok: true, value: { record, warnings: r.warnings ?? [] } };
}

// ── Post (savePostContent / loadPostContent, services site-post-content.ts) ─────────────────────────

const NO_POST_CONTEXT: SitePostContextView = {
  canEdit: false,
  reason: "Sign in as a member of this site.",
  feeds: [],
  canShareToNetwork: false,
  canSetVisibility: false,
};

function postView(r: PostRecord): SitePostRecordView {
  return {
    id: r.id,
    orgId: r.orgId,
    slug: r.slug,
    status: r.status,
    publishedAt: r.publishedAt,
    updatedAt: r.updatedAt,
    href: threadHref({ kind: "post", slug: r.slug, id: r.id }),
    input: r.input as SitePostInputView,
  };
}

export async function sitePostContextAction(orgId: string): Promise<SitePostContextView> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { ...NO_POST_CONTEXT, reason: WRONG_ORG };
  const viewer = await getHubViewer();
  if (!viewer) return NO_POST_CONTEXT;
  // A member may post (owner's call, 2026-09-19); who sees it is the editors' to set.
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: viewer.canEdit }).catch(() => []);
  return {
    canEdit: true,
    reason: null,
    feeds: feeds.map((f) => ({ slug: f.slug, name: f.name })),
    canShareToNetwork: false,
    canSetVisibility: viewer.canEdit,
  };
}

export async function sitePostLoadAction(id: string): Promise<SitePostRecordView | null> {
  const viewer = await getHubViewer();
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
  const viewer = await getHubViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const r = await savePostContent(
    viewer.userId,
    siteConfig.orgId,
    input as PostInput,
    intent === "draft" ? "draft" : "published",
    id,
    { autosave: opts?.autosave === true, membersMayPost: true }
  );
  if (r.ok === false) return { ok: false, error: r.error };
  const record = postView(r.value);
  revalidatePath("/hub");
  revalidatePath("/");
  revalidatePath("/forum");
  return { ok: true, value: { record, warnings: r.warnings ?? [] } };
}

export async function sitePostListAction(orgId: string): Promise<Array<{ id: string; title: string; status: string; updatedAt: string }>> {
  if (!siteOrg(siteConfig.orgId, orgId)) return [];
  const viewer = await getHubViewer();
  if (!viewer) return [];
  // listPostContent: editors see the org's posts, anyone else their own.
  const rows = await listPostContent(viewer.userId, siteConfig.orgId);
  return rows.map((r) => ({ id: r.id, title: r.title, status: r.status, updatedAt: r.updatedAt }));
}
