"use server";

import { revalidatePath } from "next/cache";
import {
  createThread,
  ensureOrgCalendar,
  getOrgCalendarUri,
  pushThreadToCalendar,
} from "@elkdonis/services";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getHubViewer } from "@/lib/hub-auth";

/**
 * IFAC's content save path.
 *
 * Before this, the app had exactly one thread writer: /api/admin/events, a raw
 * INSERT with `duration_minutes` hardcoded to 75, no slug-collision handling,
 * no cover image, no recurrence, and `kind = 'event'` — a kind that appears
 * nowhere else in the live data (there are 16 `meeting` rows and zero `event`
 * rows network-wide). That route stays for now; nothing new should use it.
 *
 * This goes through `createThread` in @elkdonis/services, the shared write
 * path. It was `createPost` with `kind` hardcoded to 'post' until this needed
 * events — which is precisely why five apps had hand-rolled their own INSERT
 * and each lost slug-collision handling and excerpt derivation on the way.
 *
 * A dated, published thread is pushed to the org's Nextcloud calendar on the
 * way out. That push is best-effort: an event that saved but didn't mirror is
 * a sync problem, not a lost event, and failing the save would throw away the
 * member's writing over an upstream hiccup.
 */

export type SaveContentResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

export interface SaveContentInput {
  kind: "post" | "event" | "meeting";
  title: string;
  body?: string;
  excerpt?: string;
  status?: "draft" | "published";
  section?: string | null;
  coverImageUrl?: string | null;
  // Dated kinds
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  format?: "in_person" | "online" | "hybrid" | null;
  meetingUrl?: string | null;
  isRsvpEnabled?: boolean;
  attendeeLimit?: number | null;
  recurrencePattern?: "DAILY" | "WEEKLY" | "MONTHLY" | null;
}

export async function saveContentAction(
  input: SaveContentInput
): Promise<SaveContentResult> {
  const viewer = await getHubViewer();
  if (!viewer) return { ok: false, error: "Members only" };
  // Publishing for the org is an owner/guide act. A member proposing something
  // has the ideas queue, which is a deliberately lighter thing.
  if (!viewer.canEdit) {
    return { ok: false, error: "Only owners and guides can publish" };
  }

  const title = (input.title ?? "").trim();
  if (title.length < 2) return { ok: false, error: "Give it a title" };

  const dated = input.kind !== "post";
  if (dated && !input.scheduledAt) {
    return { ok: false, error: "Pick a date and time" };
  }

  try {
    const thread = await createThread({
      kind: input.kind,
      orgId: siteConfig.orgId,
      authorId: viewer.userId,
      title,
      body: input.body?.trim() || undefined,
      excerpt: input.excerpt?.trim() || undefined,
      status: input.status ?? "published",
      visibility: "PUBLIC",
      section: input.section || null,
      scheduledAt: dated ? input.scheduledAt : null,
      durationMinutes: dated ? (input.durationMinutes ?? 60) : null,
      location: input.location || null,
      format: dated ? (input.format ?? "online") : null,
      meetingUrl: input.meetingUrl || null,
      isRsvpEnabled: dated ? (input.isRsvpEnabled ?? true) : null,
      attendeeLimit: input.attendeeLimit ?? null,
    });

    // `createThread` covers the columns every kind shares. Recurrence belongs
    // only to dated kinds, so it is set here rather than widening the shared
    // signature for one app's case. Note 'NONE' is NOT a legal value — the
    // CHECK accepts NULL or one of four patterns.
    if (dated && input.recurrencePattern) {
      await db`
        UPDATE threads SET recurrence_pattern = ${input.recurrencePattern}
        WHERE id = ${thread.id}
      `;
    }
    if (input.coverImageUrl) {
      await db`
        UPDATE threads
        SET metadata = COALESCE(metadata, '{}'::jsonb)
          || jsonb_build_object('coverImageUrl', ${input.coverImageUrl}::text)
        WHERE id = ${thread.id}
      `;
    }

    if (dated && (input.status ?? "published") === "published") {
      await mirrorToCalendar(thread.id);
    }

    revalidatePath("/hub");
    revalidatePath("/");
    return { ok: true, id: thread.id, slug: thread.slug };
  } catch (error) {
    console.error("[ifac] saveContentAction:", error);
    return { ok: false, error: "Could not save that" };
  }
}

/**
 * Best-effort push into the org's calendar, provisioning it on first use.
 *
 * Provisioning at publish rather than at read follows org-deck's rule: a
 * resource is created by an act of publishing, never as a side effect of
 * someone opening a page.
 */
async function mirrorToCalendar(threadId: string): Promise<void> {
  try {
    if (!(await getOrgCalendarUri(siteConfig.orgId))) {
      await ensureOrgCalendar(siteConfig.orgId);
    }
    await pushThreadToCalendar(siteConfig.orgId, threadId);
  } catch (error) {
    console.error("[ifac] calendar mirror failed:", error);
  }
}
