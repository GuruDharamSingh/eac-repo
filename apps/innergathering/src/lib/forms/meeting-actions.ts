"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import {
  ensureWorkshopMaterialsFolder,
  getWorkshopOfferingById,
  listOrgFeeds,
  loadMeetingContent,
  listPostContent,
  loadPostContent,
  meetingComposeContext,
  saveMeetingContent,
  savePostContent,
  upsertWorkshopOffering,
  workshopAnswersFromOffering,
  workshopInputFromAnswers,
  type MeetingInput,
  type MeetingRecord,
  type PostInput,
  type PostRecord,
} from "@elkdonis/services";
import type { MeetingContextView, MeetingInputView, MeetingRecordView } from "@elkdonis/studio-forms/meeting";
import type {
  SitePostContextView,
  SitePostInputView,
  SitePostRecordView,
  WorkshopContextView,
  WorkshopRecordView,
} from "@elkdonis/studio-forms";
import { WRONG_ORG, siteOrg } from "@elkdonis/site-forms/server";
import { getViewer } from "@/lib/auth";
import { shareWorkshopMaterials } from "@/lib/workshop-share";
import { siteConfig } from "@/config/site";

/**
 * The shared forms' server side on innergathering (2026-11-14): meeting and event, post, workshop.
 * Modelled on amrit-canada's lib/forms/meeting-actions.ts. The rules (who may create or change, series left
 * to the planner, autosave only over drafts) live in services; this file adds who is asking, this site's
 * routes. The audience is the person's own answer; the form starts at the site's `defaultAudience`
 * ('members', lib/forms/site.tsx), so a new item is members-only unless they pick otherwise.
 * The org is siteConfig.orgId; the `orgId` a client sends is checked against it and otherwise ignored.
 */

// ── Meeting and event ────────────────────────────────────────────────────────────────────────────

const NO_CONTEXT: MeetingContextView = {
  canEdit: false,
  reason: "Sign in as an editor of this site.",
  feeds: [],
  hostCandidates: [],
  canCreateTalkRoom: false,
  canCreateDocument: false,
  canShareToNetwork: false,
};

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
  // `input.metadata` (the form's showCycleBadge: false stores, null removes, left out keeps) goes to the save as sent;
  // saveMeetingContent keeps only the keys in MEETING_FORM_METADATA.
  const send: MeetingInput = { ...(input as MeetingInput), ...(input.metadata ? { metadata: input.metadata } : {}) };
  const r = await saveMeetingContent(viewer.userId, siteConfig.orgId, send, intent === "draft" ? "draft" : "published", id, {
    autosave: opts?.autosave === true,
  });
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

// ── Post ─────────────────────────────────────────────────────────────────────────────────────────

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
  const send = input as PostInput;
  const r = await savePostContent(viewer.userId, siteConfig.orgId, send, intent === "draft" ? "draft" : "published", id, {
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

// ── Workshop (upsertWorkshopOffering) ────────────────────────────────────────────────────────────

export async function siteWorkshopContextAction(orgId: string): Promise<WorkshopContextView> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { canEdit: false, reason: WRONG_ORG, feeds: [] };
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { canEdit: false, reason: "Sign in as an editor of this site.", feeds: [] };
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true });
  return { canEdit: true, feeds: feeds.map((f) => ({ slug: f.slug, name: f.name })) };
}

function workshopView(o: { id: string; slug: string; title: string; status: string; section: string | null; publishedAt: string | null; updatedAt: string }): WorkshopRecordView {
  return {
    id: o.id,
    orgId: siteConfig.orgId,
    slug: o.slug,
    title: o.title,
    status: o.status,
    publishedAt: o.publishedAt,
    updatedAt: o.updatedAt,
    href: `/${o.section ?? "offerings"}/${o.slug}`,
  };
}

export async function siteWorkshopLoadAction(id: string): Promise<{ record: WorkshopRecordView; answers: Record<string, unknown> } | null> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return null;
  const o = await getWorkshopOfferingById(siteConfig.orgId, id);
  if (!o) return null;
  const answers = workshopAnswersFromOffering(o, siteConfig.timeZone);
  return { record: workshopView(o), answers };
}

export async function siteWorkshopSaveAction(
  orgId: string,
  answers: Record<string, unknown>,
  intent: "draft" | "published",
  id: string | null,
  opts?: { autosave?: boolean }
): Promise<{ ok: true; value: { record: WorkshopRecordView; warnings: string[] } } | { ok: false; error: string }> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { ok: false, error: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Sign in as an editor of this site." };
  const status = intent === "draft" ? "draft" : "published";
  if (opts?.autosave && id) {
    const [row] = await db<Array<{ status: string }>>`SELECT status FROM threads WHERE id = ${id} AND org_id = ${siteConfig.orgId} AND kind = 'workshop'`;
    if (row && row.status !== "draft") return { ok: false, error: "Autosave only saves drafts." };
  }
  const input = workshopInputFromAnswers(answers, status);
  if (!input.title.trim()) return { ok: false, error: "Give it a title." };
  try {
    const saved = await upsertWorkshopOffering(siteConfig.orgId, viewer.userId, input, id ?? undefined);
    void ensureWorkshopMaterialsFolder(siteConfig.orgId, saved.id).then((ok) => {
      if (ok) return shareWorkshopMaterials(saved.id, viewer.userId, "author");
    });
    const section = input.section ?? "offerings";
    revalidatePath("/");
    revalidatePath(`/${section}`);
    revalidatePath(`/${section}/${saved.slug}`);
    revalidatePath("/hub");
    const now = new Date().toISOString();
    return {
      ok: true,
      value: {
        record: workshopView({ id: saved.id, slug: saved.slug, title: input.title, status, section, publishedAt: status === "published" ? now : null, updatedAt: now }),
        warnings: [],
      },
    };
  } catch (err) {
    console.error("[innergathering] siteWorkshopSaveAction:", err);
    return { ok: false, error: "Could not save the workshop." };
  }
}

export async function siteWorkshopListAction(orgId: string): Promise<Array<{ id: string; updatedAt: string }>> {
  if (!siteOrg(siteConfig.orgId, orgId)) return [];
  const viewer = await getViewer();
  if (!viewer?.canEdit) return [];
  const rows = await db<Array<{ id: string; updated_at: Date }>>`
    SELECT id, updated_at FROM threads WHERE org_id = ${siteConfig.orgId} AND kind = 'workshop' AND status <> 'archived'
    ORDER BY updated_at DESC LIMIT 5
  `;
  return rows.map((r) => ({ id: r.id, updatedAt: new Date(r.updated_at).toISOString() }));
}
