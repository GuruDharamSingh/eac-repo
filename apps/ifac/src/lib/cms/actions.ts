"use server";

import { revalidatePath } from "next/cache";
import {
  createThread,
  ensureOrgCalendar,
  getOrgCalendarUri,
  pushThreadToCalendar,
  statusForNewThread,
  createTalkRoom,
  createCollaborativeDocument,
  getMeetingRota,
  listRotaCandidates,
  assignMeetingRole,
  clearMeetingRole,
  removeThreadFromCalendar,
} from "@elkdonis/services";
import { db } from "@elkdonis/db";
import { sanitizePostBody } from "@elkdonis/utils";
import { siteConfig } from "@/config/site";
import { getHubViewer } from "@/lib/hub-auth";

/**
 * IFAC's content save path.
 *
 * Before this, the app had exactly one thread writer: /api/manage/events, a raw
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
  | {
      ok: true;
      id: string;
      slug: string;
      status?: "draft" | "pending" | "published";
      /** What could not be attached — a Talk room, a document. The thread saved. */
      warnings?: string[];
    }
  | { ok: false; error: string };

export interface SaveContentInput {
  /**
   * `workshop` joined the list when compose moved into the hub's surface: the
   * shared catalogue offers it in `dialog` mode for a site with no template
   * wizard, and IFAC is such a site. `threads.kind` has no CHECK constraint
   * and six workshop rows already exist network-wide, so this writes a kind
   * the schema and the rest of the platform already understand rather than
   * inventing one. It is dated, like an event and a meeting.
   */
  kind: "post" | "event" | "meeting" | "workshop";
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
  recurrenceUntil?: string | null;
  /** Free text describing an irregular schedule. Never parsed. */
  recurrenceCustomRule?: string | null;
  /** Make the gathering a Nextcloud Talk room (public, joinable by link). */
  createTalkRoom?: boolean;
  /** Make it a collaborative Nextcloud document. */
  createDocument?: boolean;
  /** Host of the NEXT occurrence. undefined = not asked; "" = nobody. */
  hostUserId?: string;
  /** Co-host of the NEXT occurrence, same convention. */
  coHostUserId?: string;
}

/**
 * Give a gathering its Talk room and/or its collaborative document.
 *
 * Modelled on innergathering's `attachRooms` — same two calls, same
 * best-effort posture: whatever fails comes back as a sentence for the author
 * rather than an exception, because the thread is already saved by this point
 * and losing it to a Nextcloud hiccup would be the worse outcome.
 *
 * A Talk room is made PUBLIC (type 3), which is the type a person without a
 * Nextcloud account can join from a link — most people at an IFAC gathering.
 */
async function attachRooms(
  threadId: string,
  title: string,
  input: SaveContentInput
): Promise<string[]> {
  const warnings: string[] = [];
  const wantTalk = Boolean(input.createTalkRoom) && input.kind !== "post";
  const wantDoc = Boolean(input.createDocument);
  if (!wantTalk && !wantDoc) return warnings;

  // What it already has. The switches mean "there should be one", not "make
  // another": re-saving an edited meeting must not spawn a second Talk room,
  // and the edit form now opens with the switch ON for a thread that has one
  // (defaultThreadToAnswers), so this runs on nearly every edit.
  const [current] = await db<
    Array<{ nextcloud_talk_token: string | null; document_url: string | null }>
  >`SELECT nextcloud_talk_token, document_url FROM threads WHERE id = ${threadId}`;

  if (wantTalk && !current?.nextcloud_talk_token) {
    try {
      // Whoever wrote the thread becomes a MODERATOR of its room, and the
      // room is listed for Nextcloud users. Without this the author was a
      // transient link-visitor in their own meeting's room: unable to add
      // people, and gone from their conversation list once they left. The
      // author is read from the thread, which is already saved by now; an
      // author with no linked Nextcloud account just skips promotion.
      const [author] = await db<{ nextcloud_user_id: string | null }[]>`
        SELECT u.nextcloud_user_id FROM threads t
        JOIN users u ON u.id = t.author_id
        WHERE t.id = ${threadId}
      `;
      const token = await createTalkRoom(title, "public", {
        moderator: author?.nextcloud_user_id ?? null,
        listable: 1,
      });
      if (token) {
        await db`UPDATE threads SET nextcloud_talk_token = ${token} WHERE id = ${threadId}`;
      } else {
        warnings.push("The Talk room could not be created.");
      }
    } catch (err) {
      console.error("[ifac] createTalkRoom:", err);
      warnings.push("The Talk room could not be created.");
    }
  }

  if (wantDoc && !current?.document_url) {
    try {
      const doc = await createCollaborativeDocument(siteConfig.orgId, title, threadId);
      if (doc?.url) {
        await db`UPDATE threads SET document_url = ${doc.url} WHERE id = ${threadId}`;
      } else {
        warnings.push("The document could not be created.");
      }
    } catch (err) {
      console.error("[ifac] createCollaborativeDocument:", err);
      warnings.push("The document could not be created.");
    }
  }

  return warnings;
}

/**
 * Put the form's "Who's hosting" onto the rota, for the next occurrence.
 *
 * The rota (meeting_hosts) is the ONE place a host lives — Plan ahead reads
 * and writes the same rows — so the form writes there rather than keeping a
 * second copy on the thread that could drift from it. "Next" is the rota's own
 * idea of the next occurrence, which is right for a one-off (its only date)
 * and for a weekly meeting (the coming week) alike.
 *
 * undefined leaves the rota alone (the form had no hosting fields); "" clears
 * the role; an id assigns it. Only someone in this org's candidate list can be
 * put down, so a crafted request cannot name an outsider as host.
 */
async function assignNextHosts(
  threadId: string,
  input: SaveContentInput,
  actorUserId: string
): Promise<string[]> {
  if (input.hostUserId === undefined && input.coHostUserId === undefined) return [];
  const warnings: string[] = [];
  try {
    const rota = await getMeetingRota(threadId, { from: new Date(), count: 1 });
    const next = rota.occurrences[0];
    if (!next) return warnings; // nothing ahead to host
    const allowed = new Set((await listRotaCandidates(siteConfig.orgId)).map((c) => c.userId));

    for (const [role, userId] of [
      ["host", input.hostUserId],
      ["co-host", input.coHostUserId],
    ] as const) {
      if (userId === undefined) continue;
      if (userId === "") {
        await clearMeetingRole(threadId, next.at, role);
      } else if (allowed.has(userId)) {
        await assignMeetingRole({ threadId, occurrenceAt: next.at, role, userId, actorUserId });
      } else {
        warnings.push(`That ${role} isn't a member here, so they weren't put down.`);
      }
    }
  } catch (err) {
    console.error("[ifac] assignNextHosts:", err);
    warnings.push("The host could not be saved to the rota.");
  }
  return warnings;
}

/**
 * Save an edit onto the thread that already exists.
 *
 * Deliberately narrow: it writes the fields the composer owns and leaves
 * everything else — author, created_at, the slug people may already have
 * linked, published_at — alone. `status` still goes through the review rule,
 * so a member editing their own piece under a queue sends it back for a look
 * rather than republishing it themselves.
 */
async function updateExisting(
  threadId: string,
  input: SaveContentInput,
  title: string,
  dated: boolean,
  status: "draft" | "pending" | "published",
  viewerId: string
): Promise<SaveContentResult> {
  const [existing] = await db<Array<{ id: string; slug: string; author_id: string }>>`
    SELECT id, slug, author_id FROM threads
    WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
    LIMIT 1
  `;
  if (!existing) return { ok: false, error: "That item no longer exists" };

  const viewer = await getHubViewer();
  // Its author, or an editor. A member may not rewrite someone else's piece.
  if (!viewer?.canEdit && existing.author_id !== viewerId) {
    return { ok: false, error: "Only its author or an editor can change this" };
  }

  // Members can edit their own posts, so the body is untrusted. createThread
  // sanitises the create path; this hand-written UPDATE has to do it itself.
  const body = input.body?.trim() ? sanitizePostBody(input.body.trim()) : null;

  await db`
    UPDATE threads SET
      kind             = ${input.kind},
      title            = ${title},
      body             = ${body || null},
      excerpt          = ${input.excerpt?.trim() || null},
      status           = ${status},
      section          = ${input.section || null},
      scheduled_at     = ${dated ? input.scheduledAt : null},
      duration_minutes = ${dated ? (input.durationMinutes ?? 60) : null},
      location         = ${input.location || null},
      format           = ${dated ? (input.format ?? "online") : null},
      meeting_url      = ${input.meetingUrl || null},
      is_rsvp_enabled  = ${dated ? (input.isRsvpEnabled ?? true) : false},
      attendee_limit   = ${input.attendeeLimit ?? null},
      recurrence_pattern     = ${dated ? (input.recurrencePattern ?? null) : null},
      recurrence_until       = ${dated ? (input.recurrenceUntil ?? null) : null},
      recurrence_custom_rule = ${dated ? (input.recurrenceCustomRule ?? null) : null},
      published_at     = CASE
        WHEN ${status} = 'published' AND published_at IS NULL THEN NOW()
        ELSE published_at
      END,
      updated_at       = NOW()
    WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
  `;

  if (input.coverImageUrl !== undefined) {
    await db`
      UPDATE threads
      SET metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object('coverImageUrl', ${input.coverImageUrl ?? null}::text)
      WHERE id = ${threadId}
    `;
  }

  const warnings = [
    ...(await attachRooms(threadId, title, input)),
    ...(dated ? await assignNextHosts(threadId, input, viewerId) : []),
  ];

  if (dated && status === "published") {
    await mirrorToCalendar(threadId);
  } else {
    // Back to a draft, or waiting on a guide: not on anyone's calendar.
    await removeThreadFromCalendar(siteConfig.orgId, threadId).catch(() => {});
  }

  revalidatePath("/hub");
  revalidatePath("/");
  return { ok: true, id: threadId, slug: existing.slug, status, warnings };
}

export async function saveContentAction(
  input: SaveContentInput,
  /**
   * The thread being EDITED. The shared compose surface has always passed it
   * (`connectors.saveThread({ …, threadId })`) and this action used to ignore
   * it, so every edit inserted a second thread — and, before attachRooms
   * became idempotent, a second Talk room with it. Absent means "new".
   */
  threadId?: string
): Promise<SaveContentResult> {
  const viewer = await getHubViewer();
  if (!viewer) return { ok: false, error: "Members only" };
  // Who may write what (owner's call, 2026-09-19): a MEMBER may post in the
  // hub — that is what membership is for — while anything DATED puts a
  // gathering on the collective's calendar and stays with owners and guides.
  // The catalogue mirrors this with `canPublishDated`, so a member is never
  // shown a form this then refuses.
  if (!viewer.canEdit && input.kind !== "post") {
    return { ok: false, error: "Only owners and guides can publish a dated item" };
  }

  const title = (input.title ?? "").trim();
  if (title.length < 2) return { ok: false, error: "Give it a title" };

  const dated = input.kind !== "post";
  if (dated && !input.scheduledAt) {
    return { ok: false, error: "Pick a date and time" };
  }

  // Straight up, or into the submissions queue? The shared rule (services'
  // statusForNewThread): a moderator publishes outright, a member's post
  // waits only if IFAC has asked for a look first — which it has not, by
  // default. Saving a draft stays a draft either way.
  const status = await statusForNewThread(
    viewer.userId,
    siteConfig.orgId,
    input.status === "draft" ? "draft" : "published"
  );

  try {
    if (threadId) return await updateExisting(threadId, input, title, dated, status, viewer.userId);

    const thread = await createThread({
      kind: input.kind,
      orgId: siteConfig.orgId,
      authorId: viewer.userId,
      title,
      body: input.body?.trim() || undefined,
      excerpt: input.excerpt?.trim() || undefined,
      status,
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
    if (dated && (input.recurrencePattern || input.recurrenceCustomRule)) {
      await db`
        UPDATE threads SET
          recurrence_pattern = ${input.recurrencePattern},
          recurrence_until = ${input.recurrenceUntil ?? null},
          recurrence_custom_rule = ${input.recurrenceCustomRule ?? null}
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

    // The rooms a gathering can be given. Both need the thread's id, so they
    // happen after it exists; both are best-effort, because a Nextcloud that
    // is slow or down must not lose the meeting someone just wrote.
    const rooms = [
      ...(await attachRooms(thread.id, title, input)),
      ...(dated ? await assignNextHosts(thread.id, input, viewer.userId) : []),
    ];

    if (dated && (input.status ?? "published") === "published") {
      await mirrorToCalendar(thread.id);
    }

    revalidatePath("/hub");
    revalidatePath("/");
    return { ok: true, id: thread.id, slug: thread.slug, status, warnings: rooms };
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
