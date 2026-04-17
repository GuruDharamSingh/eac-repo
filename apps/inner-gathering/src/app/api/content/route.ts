import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";
import { createNextcloudClient } from "@elkdonis/nextcloud";

// ============================================================================
// Unified content publish endpoint (content-form backend).
// Writes threads + workshop_details + workshop_sessions + thread_orgs +
// thread_references in one transaction. On kind transition of an existing
// thread, writes a thread_revisions snapshot.
//
// Field mapping notes (ContentDraft → schema):
//   pitch      → workshop_details.materials   (no dedicated pitch column yet)
//   price      → workshop_details.pricing     (JSONB: { amount, currency })
//   flyerUrl   → workshop_details.cover_image_url
//   sessions[].title       → workshop_sessions.topic
//   sessions[].description → workshop_sessions.notes (JSONB: { description })
//   sessions[].orderIndex  → workshop_sessions.session_number
// ============================================================================

type ThreadKind = "post" | "meeting" | "event" | "workshop";

interface Payload {
  threadId?: string;
  kind: ThreadKind;
  userId: string;

  title: string;
  body: string;
  publishAt?: string | null;

  isMeeting: boolean;
  meetingTimeLabel?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  isOnline?: boolean;

  isRsvpEnabled?: boolean;
  attendeeLimit?: number | null;
  rsvpDeadline?: string | null;
  minAttendees?: number | null;

  pitch?: string | null;
  price?: number | null;
  flyerUrl?: string | null;
  sessions?: Array<{
    id: string;
    title: string;
    description?: string;
    scheduledAt?: string;
    durationMinutes?: number;
    orderIndex: number;
  }>;

  primaryOrgId: string;
  additionalOrgIds?: string[];
  referencedThreadIds?: string[];

  createTalkRoom?: boolean;
  documentUrl?: string;
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
    const now = new Date();
    const publishedAt = payload.publishAt ? new Date(payload.publishAt) : now;
    const isScheduledPost =
      payload.kind === "post" && payload.publishAt && new Date(payload.publishAt) > now;
    const status = isScheduledPost ? "scheduled" : "published";

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
        body: payload.body ?? "",
        status,
        visibility: "PUBLIC",
        scheduled_at: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
        duration_minutes: payload.durationMinutes ?? null,
        location: payload.location ?? null,
        is_online: payload.isOnline ?? false,
        is_meeting: payload.isMeeting ?? false,
        is_rsvp_enabled: payload.isRsvpEnabled ?? false,
        attendee_limit: payload.attendeeLimit ?? null,
        rsvp_deadline: payload.rsvpDeadline ? new Date(payload.rsvpDeadline) : null,
        min_attendees: payload.minAttendees ?? null,
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

      // workshop_details (1:1)
      if (payload.kind === "workshop") {
        const pricing = payload.price != null ? { amount: payload.price, currency: "USD" } : null;
        const detailFields = {
          thread_id: threadId,
          materials: payload.pitch ?? null,
          pricing: pricing ? JSON.stringify(pricing) : null,
          cover_image_url: payload.flyerUrl ?? null,
        };
        await tx`
          INSERT INTO workshop_details ${tx(detailFields)}
          ON CONFLICT (thread_id) DO UPDATE SET
            materials = EXCLUDED.materials,
            pricing = EXCLUDED.pricing,
            cover_image_url = EXCLUDED.cover_image_url,
            updated_at = NOW()
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
              notes: JSON.stringify({ description: s.description ?? "" }),
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

    // Talk room creation (after transaction so thread exists)
    let talkRoomCreated = false;
    if (payload.createTalkRoom) {
      try {
        if (
          session.user.nextcloud_user_id &&
          session.user.nextcloud_app_password
        ) {
          const nextcloudClient = createNextcloudClient({
            baseUrl: process.env.NEXTCLOUD_URL || "http://nextcloud-nginx:80",
            username: session.user.nextcloud_user_id,
            password: session.user.nextcloud_app_password,
          });

          const { createTalkRoom } = await import("@elkdonis/nextcloud/talk");
          const room = await createTalkRoom(nextcloudClient, {
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
        } else {
          console.warn("⚠ Talk room skipped: no Nextcloud credentials");
        }
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
