import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";
import { sanitizeRichText } from "@elkdonis/utils";
import { getAdminClient } from "@elkdonis/nextcloud";
import {
  RSVP_GUEST_TEMPLATE_KEY,
  deleteEmailTemplateSettings,
  getEmailTemplateSettings,
  saveEmailTemplateSettings,
  threadTemplateKey,
} from "@/lib/email-template-settings";

// ============================================================================
// Unified content publish endpoint (content-form backend).
// Writes threads + workshop_pages + workshop_sessions + thread_orgs +
// thread_references in one transaction. On kind transition of an existing
// thread, writes a thread_revisions snapshot.
//
// workshop_pages is the single sidecar table for workshop kind — also used
// by /api/workshops (the deep-edit view) and read by the detail page, so
// fields set here (price, cover image, pitch) show up there too and vice
// versa. workshop_details is a legacy duplicate table, no longer written.
//
// Field mapping notes (ContentDraft → schema):
//   pitch      → workshop_pages.description_short
//   price      → workshop_pages.price_member
//   flyerUrl   → workshop_pages.cover_image_url
//   sessions[].title       → workshop_sessions.topic
//   sessions[].description → workshop_sessions.notes (JSONB: { description })
//   sessions[].orderIndex  → workshop_sessions.session_number
// ============================================================================

type ThreadKind = "post" | "meeting" | "event" | "workshop";

interface Payload {
  threadId?: string;
  kind: ThreadKind;
  userId: string;
  /** "draft" saves without publishing (threads.status='draft'); omitted/"publish" publishes normally. */
  saveStatus?: "draft" | "publish";

  title: string;
  body: string;
  publishAt?: string | null;

  isMeeting: boolean;
  meetingTimeLabel?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  isOnline?: boolean;
  videoLink?: string | null;
  recurrencePattern?: string | null;
  recurrenceCustomRule?: string | null;
  recurrenceUntil?: string | null;

  isRsvpEnabled?: boolean;
  attendeeLimit?: number | null;
  rsvpDeadline?: string | null;
  minAttendees?: number | null;
  rsvpEmailBody?: string | null;
  reminderMinutesBefore?: number | null;
  visibility?: string;

  pitch?: string | null;
  price?: number | null;
  flyerUrl?: string | null;
  sessions?: Array<{
    id: string;
    title: string;
    description?: string;
    scheduledAt?: string;
    durationMinutes?: number;
    isOnline?: boolean;
    location?: string;
    videoConferenceUrl?: string;
    mediaUrl?: string | null;
    orderIndex: number;
  }>;

  primaryOrgId: string;
  additionalOrgIds?: string[];
  referencedThreadIds?: string[];

  createTalkRoom?: boolean;
  documentUrl?: string;

  media?: Array<{
    fileId: string;
    path: string;
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    type: string;
  }>;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
}

async function uniqueSlug(base: string, orgId: string, excludeId?: string): Promise<string> {
  let slug = base;
  for (let i = 0; i < 10; i++) {
    const existing = await db`
      SELECT id FROM threads
      WHERE slug = ${slug} AND org_id = ${orgId}
        ${excludeId ? db`AND id <> ${excludeId}` : db``}
    `;
    if (existing.length === 0) return slug;
    slug = `${base}-${nanoid(6).toLowerCase()}`;
  }
  return `${base}-${nanoid(6).toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Must be logged in" }, { status: 401 });
    }

    const payload = (await request.json()) as Payload;

    if (!payload.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!payload.primaryOrgId) {
      return NextResponse.json({ error: "Primary org is required" }, { status: 400 });
    }

    const authorId = session.user.id;

    // Access control: author must belong to the target org (any role) or be a
    // site admin. Without this, any logged-in user could publish into any org.
    const [membership] = await db`
      SELECT 1 FROM user_organizations
      WHERE user_id = ${authorId} AND org_id = ${payload.primaryOrgId}
      UNION ALL
      SELECT 1 FROM users WHERE id = ${authorId} AND is_admin = true
      LIMIT 1
    `;
    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of that organization" },
        { status: 403 }
      );
    }
    const now = new Date();
    const publishedAt = payload.publishAt ? new Date(payload.publishAt) : now;
    const isScheduledPost =
      payload.kind === "post" && payload.publishAt && new Date(payload.publishAt) > now;
    const status =
      payload.saveStatus === "draft" ? "draft" : isScheduledPost ? "scheduled" : "published";

    const result = await db.begin(async (tx) => {
      const isUpdate = !!payload.threadId;
      let threadId = payload.threadId ?? `th_${nanoid(18)}`;

      // Kind transition → snapshot prior state
      if (isUpdate) {
        const [prior] = await tx`
          SELECT * FROM threads WHERE id = ${threadId}
        `;
        if (!prior) {
          throw new Error("Thread not found");
        }
        if (prior.author_id !== authorId) {
          throw new Error("Not the author");
        }
        if (prior.kind !== payload.kind) {
          await tx`
            INSERT INTO thread_revisions (id, thread_id, prior_kind, snapshot, changed_by)
            VALUES (
              ${`rev_${nanoid(16)}`},
              ${threadId},
              ${prior.kind},
              ${JSON.stringify(prior)},
              ${authorId}
            )
          `;
        }
      }

      const slugBase = slugify(payload.title);
      const slug = await uniqueSlug(slugBase, payload.primaryOrgId, isUpdate ? threadId : undefined);

      const threadFields = {
        org_id: payload.primaryOrgId,
        author_id: authorId,
        kind: payload.kind,
        title: payload.title.trim(),
        slug,
        body: sanitizeRichText(payload.body ?? ""),
        status,
        visibility: (payload.visibility as string) || "PUBLIC",
        scheduled_at: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
        duration_minutes: payload.durationMinutes ?? null,
        location: payload.location ?? null,
        is_online: payload.isOnline ?? false,
        is_meeting: payload.isMeeting ?? false,
        meeting_url: payload.videoLink ?? null,
        video_link: payload.videoLink ?? null,
        recurrence_pattern: (payload.recurrencePattern && payload.recurrencePattern !== 'NONE')
          ? payload.recurrencePattern
          : null,
        recurrence_custom_rule: payload.recurrenceCustomRule ?? null,
        recurrence_until: payload.recurrenceUntil ? new Date(payload.recurrenceUntil) : null,
        is_rsvp_enabled: payload.isRsvpEnabled ?? false,
        attendee_limit: payload.attendeeLimit ?? null,
        rsvp_deadline: payload.rsvpDeadline ? new Date(payload.rsvpDeadline) : null,
        min_attendees: payload.minAttendees ?? null,
        reminder_minutes_before: payload.reminderMinutesBefore ?? 60,
        published_at: status === "published" ? publishedAt : null,
        document_url: payload.documentUrl ?? null,
      };

      if (isUpdate) {
        await tx`
          UPDATE threads SET ${tx(threadFields)}, updated_at = NOW()
          WHERE id = ${threadId}
        `;
      } else {
        await tx`
          INSERT INTO threads ${tx({ id: threadId, ...threadFields })}
        `;
      }

      // workshop_pages (1:1) — shared with /api/workshops and the detail page
      if (payload.kind === "workshop") {
        const pageFields = {
          thread_id: threadId,
          description_short: payload.pitch ?? null,
          price_member: payload.price != null ? String(payload.price) : null,
          cover_image_url: payload.flyerUrl ?? null,
        };
        await tx`
          INSERT INTO workshop_pages ${tx(pageFields)}
          ON CONFLICT (thread_id) DO UPDATE SET
            description_short = EXCLUDED.description_short,
            price_member      = EXCLUDED.price_member,
            cover_image_url   = EXCLUDED.cover_image_url,
            updated_at        = NOW()
        `;

        // Replace sessions wholesale (simpler than diffing for v1)
        await tx`DELETE FROM workshop_sessions WHERE thread_id = ${threadId}`;
        for (const s of payload.sessions ?? []) {
          await tx`
            INSERT INTO workshop_sessions ${tx({
              id: `ws_${nanoid(16)}`,
              thread_id: threadId,
              session_number: s.orderIndex + 1,
              topic: s.title,
              scheduled_at: s.scheduledAt ? new Date(s.scheduledAt) : null,
              duration_minutes: s.durationMinutes ?? null,
              notes: JSON.stringify({
                description: s.description ?? "",
                isOnline: s.isOnline ?? true,
                location: s.location ?? "",
                videoConferenceUrl: s.videoConferenceUrl ?? "",
                mediaUrl: s.mediaUrl ?? null,
              }),
            })}
          `;
        }
      }

      // thread_orgs: primary + cross-post
      await tx`DELETE FROM thread_orgs WHERE thread_id = ${threadId}`;
      const orgIds = Array.from(
        new Set([payload.primaryOrgId, ...(payload.additionalOrgIds ?? [])])
      );
      for (const orgId of orgIds) {
        await tx`
          INSERT INTO thread_orgs (thread_id, org_id, added_by)
          VALUES (${threadId}, ${orgId}, ${authorId})
          ON CONFLICT DO NOTHING
        `;
      }

      // thread_references
      if (payload.referencedThreadIds && payload.referencedThreadIds.length > 0) {
        await tx`DELETE FROM thread_references WHERE thread_id = ${threadId}`;
        for (const refId of payload.referencedThreadIds) {
          await tx`
            INSERT INTO thread_references (id, thread_id, references_thread_id)
            VALUES (${`ref_${nanoid(16)}`}, ${threadId}, ${refId})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      return { id: threadId, kind: payload.kind, slug, status };
    });

    // Link uploaded media to the thread (upload route pre-creates rows with null attached_to_*)
    if (payload.media?.length) {
      for (const m of payload.media) {
        await db`
          UPDATE media
          SET attached_to_type = 'thread', attached_to_id = ${result.id}
          WHERE nextcloud_file_id = ${m.fileId}
            AND attached_to_type IS NULL
        `;
      }
    }

    // Per-publication RSVP confirmation copy. A non-empty body upserts the
    // thread-scoped template (preserving any links/media added on the Email
    // Templates page); an empty body removes the override so the publication
    // reverts to the org default.
    if (payload.isRsvpEnabled !== undefined) {
      const scopedKey = threadTemplateKey(RSVP_GUEST_TEMPLATE_KEY, result.id);
      const bodyText = payload.rsvpEmailBody?.trim();
      try {
        if (payload.isRsvpEnabled && bodyText) {
          const existing = await getEmailTemplateSettings(payload.primaryOrgId, scopedKey);
          await saveEmailTemplateSettings({
            orgId: payload.primaryOrgId,
            templateKey: scopedKey,
            config: { ...(existing?.config ?? {}), bodyText },
            userId: authorId,
          });
        } else if (payload.rsvpEmailBody !== undefined && !bodyText) {
          await deleteEmailTemplateSettings(payload.primaryOrgId, scopedKey);
        }
      } catch (templateErr) {
        // Non-fatal — the publication is live; email falls back to the org default.
        console.error("Failed to save per-publication RSVP email template:", templateErr);
      }
    }

    // Workshop materials folder — service-account folder + RW share to the
    // author. Fire-and-forget: the publication is live either way.
    if (payload.kind === "workshop") {
      void (async () => {
        try {
          const { getAdminClient, ensureWorkshopMaterialsFolder, grantMaterialsAccess } =
            await import("@elkdonis/nextcloud");
          const serviceClient = getAdminClient();
          await ensureWorkshopMaterialsFolder(serviceClient, payload.primaryOrgId, result.id);
          if (session.user.nextcloud_user_id) {
            await grantMaterialsAccess(
              serviceClient,
              payload.primaryOrgId,
              result.id,
              session.user.nextcloud_user_id,
              "author"
            );
          }
        } catch (materialsErr) {
          console.error("Workshop materials folder provisioning failed:", materialsErr);
        }
      })();
    }

    // Talk room creation (after transaction so thread exists). Uses the
    // shared service account (eac_intergration) — same model as workshop
    // materials folders and org folders above. Per-member Nextcloud
    // credentials can't be relied on here: the self-service SSO connect flow
    // (the only working provisioning path — see NC provisioning notes) only
    // ever sets nextcloud_user_id/nextcloud_synced, never
    // nextcloud_app_password, so gating on the member's own credentials
    // silently skipped room creation for every SSO-provisioned user.
    let talkRoomCreated = false;
    if (payload.createTalkRoom) {
      try {
        const serviceClient = getAdminClient();
        const { createTalkRoom } = await import("@elkdonis/nextcloud/talk");
        const room = await createTalkRoom(serviceClient, {
          name: payload.title.trim().slice(0, 80),
          type: "public",
        });

        await db`
          UPDATE threads
          SET nextcloud_talk_token = ${room.token}
          WHERE id = ${result.id}
        `;
        talkRoomCreated = true;
        console.log(`✓ Talk room created for thread ${result.id}: ${room.token}`);
      } catch (talkError) {
        console.error("✗ Failed to create Talk room:", talkError);
        // Non-fatal — thread is already published
      }
    }

    return NextResponse.json({ ...result, talkRoomCreated });
  } catch (error) {
    console.error("Error publishing content:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish" },
      { status: 500 }
    );
  }
}
