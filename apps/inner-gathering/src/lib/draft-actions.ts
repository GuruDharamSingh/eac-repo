"use server";

import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";

export interface DraftData {
  id?: string;
  contentType: "post" | "meeting";
  orgId: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  visibility: string;
  meetingData: Record<string, unknown>;
  mediaRefs: unknown[];
  integrationSettings: Record<string, unknown>;
  currentStep: number;
}

export interface SavedDraft {
  id: string;
  userId: string;
  orgId: string;
  contentType: "post" | "meeting";
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  visibility: string;
  meetingData: Record<string, unknown>;
  mediaRefs: unknown[];
  integrationSettings: Record<string, unknown>;
  currentStep: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function saveDraftAction(
  userId: string,
  draft: DraftData
): Promise<{ draftId: string }> {
  const draftId = draft.id || nanoid();

  if (draft.id) {
    // Update existing draft
    await db`
      UPDATE content_drafts SET
        content_type = ${draft.contentType},
        org_id = ${draft.orgId},
        title = ${draft.title},
        slug = ${draft.slug},
        body = ${draft.body},
        excerpt = ${draft.excerpt},
        visibility = ${draft.visibility},
        meeting_data = ${JSON.stringify(draft.meetingData)},
        media_refs = ${JSON.stringify(draft.mediaRefs)},
        integration_settings = ${JSON.stringify(draft.integrationSettings)},
        current_step = ${draft.currentStep},
        updated_at = NOW()
      WHERE id = ${draft.id} AND user_id = ${userId}
    `;
  } else {
    // Create new draft
    await db`
      INSERT INTO content_drafts (
        id, user_id, org_id, content_type,
        title, slug, body, excerpt, visibility,
        meeting_data, media_refs, integration_settings,
        current_step
      ) VALUES (
        ${draftId}, ${userId}, ${draft.orgId}, ${draft.contentType},
        ${draft.title}, ${draft.slug}, ${draft.body}, ${draft.excerpt}, ${draft.visibility},
        ${JSON.stringify(draft.meetingData)}, ${JSON.stringify(draft.mediaRefs)},
        ${JSON.stringify(draft.integrationSettings)},
        ${draft.currentStep}
      )
    `;
  }

  return { draftId };
}

export async function loadDraftsAction(
  userId: string
): Promise<SavedDraft[]> {
  const rows = await db`
    SELECT
      id, user_id, org_id, content_type,
      title, slug, body, excerpt, visibility,
      meeting_data, media_refs, integration_settings,
      current_step, created_at, updated_at
    FROM content_drafts
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 20
  `;

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    orgId: r.org_id,
    contentType: r.content_type as "post" | "meeting",
    title: r.title,
    slug: r.slug,
    body: r.body,
    excerpt: r.excerpt,
    visibility: r.visibility,
    meetingData: r.meeting_data ?? {},
    mediaRefs: r.media_refs ?? [],
    integrationSettings: r.integration_settings ?? {},
    currentStep: r.current_step ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function loadDraftAction(
  userId: string,
  draftId: string
): Promise<SavedDraft | null> {
  const [row] = await db`
    SELECT
      id, user_id, org_id, content_type,
      title, slug, body, excerpt, visibility,
      meeting_data, media_refs, integration_settings,
      current_step, created_at, updated_at
    FROM content_drafts
    WHERE id = ${draftId} AND user_id = ${userId}
  `;

  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    orgId: row.org_id,
    contentType: row.content_type as "post" | "meeting",
    title: row.title,
    slug: row.slug,
    body: row.body,
    excerpt: row.excerpt,
    visibility: row.visibility,
    meetingData: row.meeting_data ?? {},
    mediaRefs: row.media_refs ?? [],
    integrationSettings: row.integration_settings ?? {},
    currentStep: row.current_step ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteDraftAction(
  userId: string,
  draftId: string
): Promise<void> {
  await db`
    DELETE FROM content_drafts
    WHERE id = ${draftId} AND user_id = ${userId}
  `;
}
