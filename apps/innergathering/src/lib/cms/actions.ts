"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import {
  getOrgFeed,
  upsertOrgFeed,
  setOrgRole,
  createCollaborativeDocument,
  createTalkRoom,
  updateProfile,
  upsertOrgProfile,
  ensureUniqueUserSlug,
  setStandingMeeting,
  type OrgRole,
} from "@elkdonis/services";
import { requireOrgEditor } from "@/lib/auth";
import { contentFormSchema, slugifyTitle, type ContentFormValues } from "@/lib/cms/schema";
import { zonedInputToDate } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { deriveExcerpt, sanitizeRichText } from "@elkdonis/utils";
import { ensureUniqueThreadSlug, removeThreadAs } from "@elkdonis/services";

/**
 * Server actions for the editorial surface.
 *
 * Every action re-checks authorisation via requireOrgEditor() rather than
 * trusting the page that rendered the form — a server action is a public
 * endpoint, and the /manage page gate only controls what gets rendered.
 */

const ORG = siteConfig.orgId;

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
  path?: string;
  /** Non-fatal problems worth telling the editor about (e.g. Nextcloud down). */
  warnings?: string[];
}

/**
 * Provision the Nextcloud extras a thread asked for.
 *
 * Deliberately never fails the save: the content is already written, and a
 * Nextcloud outage should not cost someone their post. Failures come back as
 * warnings so the editor knows to retry rather than assuming a room exists.
 *
 * Idempotent — a thread that already has a document or room keeps it, so
 * re-saving doesn't spawn duplicates.
 */
async function provisionNextcloud(
  threadId: string,
  title: string,
  wantDocument: boolean,
  wantTalkRoom: boolean
): Promise<string[]> {
  const warnings: string[] = [];
  if (!wantDocument && !wantTalkRoom) return warnings;

  const [current] = await db<{ document_url: string | null; nextcloud_talk_token: string | null }[]>`
    SELECT document_url, nextcloud_talk_token FROM threads WHERE id = ${threadId}
  `;

  if (wantDocument && !current?.document_url) {
    try {
      const doc = await createCollaborativeDocument(ORG, title, threadId);
      if (doc?.url) {
        await db`
          UPDATE threads SET document_url = ${doc.url}, nextcloud_doc_url = ${doc.editUrl ?? doc.url}
          WHERE id = ${threadId}
        `;
      } else {
        warnings.push("The collaborative document could not be created.");
      }
    } catch (err) {
      console.error("[innergathering] createCollaborativeDocument:", err);
      warnings.push("The collaborative document could not be created.");
    }
  }

  if (wantTalkRoom && !current?.nextcloud_talk_token) {
    try {
      // 'public' maps to Talk room type 3, which is what lets people without
      // a Nextcloud account join by link — most attendees here are guests.
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
      console.error("[innergathering] createTalkRoom:", err);
      warnings.push("The Talk room could not be created.");
    }
  }

  return warnings;
}

/** Per-org unique slug, suffixing until free. Excludes the row being edited. */

/** Strip tags for the list/card preview when the author didn't write an excerpt. */
/**
 * Point the chosen media rows at this thread, and release any that were
 * removed. Uploads land unattached (attached_to_id NULL) and only become the
 * thread's materials here, so an abandoned draft leaves orphans in the folder
 * rather than files wrongly claimed by a post.
 */
async function attachMaterials(threadId: string, materialIds: string[]): Promise<void> {
  await db`
    UPDATE media SET attached_to_type = NULL, attached_to_id = NULL
    WHERE org_id = ${ORG} AND attached_to_id = ${threadId}
      ${materialIds.length ? db`AND id <> ALL(${materialIds})` : db``}
  `;

  if (materialIds.length) {
    await db`
      UPDATE media SET attached_to_type = 'thread', attached_to_id = ${threadId}
      WHERE org_id = ${ORG} AND id = ANY(${materialIds})
    `;
  }
}

function revalidateFeed(feedSlug: string, slug?: string) {
  revalidatePath("/");
  revalidatePath("/manage");
  revalidatePath(`/${feedSlug}`);
  if (slug) revalidatePath(`/${feedSlug}/${slug}`);
}

/**
 * Create or update a piece of content.
 *
 * `threadId` present means update. Both paths write the same columns so a
 * draft that gets published doesn't take a different code path than one
 * published immediately.
 */
export async function saveContentAction(
  input: ContentFormValues,
  threadId?: string
): Promise<ActionResult> {
  const editor = await requireOrgEditor();

  const parsed = contentFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const data = parsed.data;

  // The feed must exist in this org — a section slug is not free text, or a
  // typo would publish content to a page that doesn't render.
  const feed = await getOrgFeed(ORG, data.feedSlug);
  if (!feed) return { ok: false, error: "That page doesn't exist" };

  const isMeeting = data.kind === "meeting";
  const slug = await ensureUniqueThreadSlug(ORG, slugifyTitle(data.title), threadId);
  // Sanitised before either write below: the hosts render `body` with
  // dangerouslySetInnerHTML, and a server action is a public endpoint.
  const body = sanitizeRichText(data.body);
  const excerpt = deriveExcerpt(body, { explicit: data.excerpt });
  const publishedAt = data.status === "published" ? new Date() : null;

  // Cover image rides in metadata — threads has no cover_image_url column
  // (see the note in lib/data.ts).
  const timeZone = isMeeting && data.timeZone ? data.timeZone : null;
  // Record<string, string>, not <string, unknown>: db.json takes a JSONValue,
  // and `unknown` is not assignable to it. Both entries here are strings.
  const metadata: Record<string, string> = {};
  if (data.coverImageUrl) metadata.coverImageUrl = data.coverImageUrl;
  if (timeZone) metadata.timeZone = timeZone;

  // Times are entered as wall-clock in the chosen zone (Toronto by default);
  // convert rather than letting the server's own timezone (UTC in the
  // container) decide what they meant.
  const scheduledAt = isMeeting ? zonedInputToDate(data.scheduledAt, timeZone) : null;
  const recurrenceUntil = isMeeting ? zonedInputToDate(data.recurrenceUntil ?? "", timeZone) : null;
  const rsvpDeadline = isMeeting ? zonedInputToDate(data.rsvpDeadline ?? "", timeZone) : null;

  // The DB CHECK allows DAILY/WEEKLY/MONTHLY/CUSTOM or NULL — "NONE" is the
  // form's way of saying "doesn't repeat" and must be stored as NULL, not
  // written through literally.
  const recurrencePattern =
    isMeeting && data.recurrencePattern !== "NONE" ? data.recurrencePattern : null;

  try {
    if (threadId) {
      const [existing] = await db<{ id: string }[]>`
        SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${ORG} LIMIT 1
      `;
      if (!existing) return { ok: false, error: "Not found" };

      await db`
        UPDATE threads SET
          kind             = ${data.kind},
          section          = ${data.feedSlug},
          title            = ${data.title},
          slug             = ${slug},
          body             = ${body || null},
          excerpt          = ${excerpt},
          status           = ${data.status},
          visibility       = ${data.visibility},
          metadata         = ${db.json(metadata)},
          is_meeting       = ${isMeeting},
          scheduled_at     = ${scheduledAt},
          duration_minutes = ${isMeeting ? (data.durationMinutes ?? null) : null},
          location         = ${isMeeting ? data.location || null : null},
          is_online        = ${isMeeting ? data.isOnline : false},
          meeting_url      = ${isMeeting ? data.meetingUrl || null : null},
          video_link       = ${isMeeting ? data.videoLink || null : null},
          recurrence_pattern = ${recurrencePattern},
          recurrence_until   = ${recurrenceUntil},
          is_rsvp_enabled    = ${isMeeting ? data.isRsvpEnabled : false},
          rsvp_deadline      = ${rsvpDeadline},
          attendee_limit     = ${isMeeting ? (data.attendeeLimit ?? null) : null},
          min_attendees      = ${isMeeting ? (data.minAttendees ?? null) : null},
          notify_on_min_attendees = ${isMeeting ? data.notifyOnMinAttendees : false},
          published_at     = COALESCE(published_at, ${publishedAt}),
          updated_at       = NOW()
        WHERE id = ${threadId} AND org_id = ${ORG}
      `;

      await attachMaterials(threadId, data.materialIds);

      const warnings = await provisionNextcloud(
        threadId,
        data.title,
        data.createDocument,
        data.createTalkRoom
      );

      revalidateFeed(data.feedSlug, slug);
      return { ok: true, id: threadId, path: `/${data.feedSlug}/${slug}`, warnings };
    }

    const id = nanoid(21);
    await db`
      INSERT INTO threads (
        id, org_id, author_id, kind, section, title, slug, body, excerpt,
        status, visibility, metadata, is_meeting,
        scheduled_at, duration_minutes, location, is_online, meeting_url, video_link,
        recurrence_pattern, recurrence_until,
        is_rsvp_enabled, rsvp_deadline, attendee_limit, min_attendees,
        notify_on_min_attendees, published_at
      ) VALUES (
        ${id}, ${ORG}, ${editor.userId}, ${data.kind}, ${data.feedSlug},
        ${data.title}, ${slug}, ${body || null}, ${excerpt},
        ${data.status}, ${data.visibility}, ${db.json(metadata)}, ${isMeeting},
        ${scheduledAt}, ${isMeeting ? (data.durationMinutes ?? null) : null},
        ${isMeeting ? data.location || null : null}, ${isMeeting ? data.isOnline : false},
        ${isMeeting ? data.meetingUrl || null : null}, ${isMeeting ? data.videoLink || null : null},
        ${recurrencePattern}, ${recurrenceUntil},
        ${isMeeting ? data.isRsvpEnabled : false}, ${rsvpDeadline},
        ${isMeeting ? (data.attendeeLimit ?? null) : null},
        ${isMeeting ? (data.minAttendees ?? null) : null},
        ${isMeeting ? data.notifyOnMinAttendees : false},
        ${publishedAt}
      )
    `;

    await attachMaterials(id, data.materialIds);

    const warnings = await provisionNextcloud(
      id,
      data.title,
      data.createDocument,
      data.createTalkRoom
    );

    revalidateFeed(data.feedSlug, slug);
    return { ok: true, id, path: `/${data.feedSlug}/${slug}`, warnings };
  } catch (err) {
    console.error("[innergathering] saveContentAction:", err);
    return { ok: false, error: "Could not save. Try again." };
  }
}

/**
 * Flag (or unflag) a gathering as the one the hub leads with.
 *
 * Without a flag the hub infers: a weekly series if there is one, otherwise
 * whatever is soonest. That inference is wrong on a site whose standing
 * gathering is monthly, and only a person can settle it — hence this.
 *
 * The thread is verified to belong to this org before the flag is written, so
 * a stray id cannot point the hub at another site's content.
 */
export async function setStandingMeetingAction(
  threadId: string | null
): Promise<ActionResult> {
  await requireOrgEditor();

  if (threadId) {
    const [thread] = await db<Array<{ id: string }>>`
      SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${ORG}
    `;
    if (!thread) return { ok: false, error: "Not found" };
  }

  try {
    await setStandingMeeting(ORG, threadId);
  } catch (error) {
    console.error("[innergathering] setStandingMeetingAction:", error);
    return { ok: false, error: "Could not update." };
  }

  revalidatePath("/hub");
  revalidatePath("/manage");
  return { ok: true };
}

/**
 * Take a thread off the site. Archived, not deleted (services' removeThread):
 * RSVPs, replies and gather edges keep their keys, and "Publish" in /manage
 * restores it. The org check comes first because removeThread with
 * `editor: true` trusts the caller's tier for whatever id it is given.
 */
export async function deleteContentAction(threadId: string): Promise<ActionResult> {
  const editor = await requireOrgEditor();

  try {
    const [row] = await db<{ section: string | null }[]>`
      SELECT section FROM threads WHERE id = ${threadId} AND org_id = ${ORG}
    `;
    if (!row) return { ok: false, error: "Not found" };
    const res = await removeThreadAs(editor.userId, threadId, { editor: true });
    if (!res.ok) return { ok: false, error: res.error };
    revalidateFeed(row.section ?? "");
    return { ok: true };
  } catch (err) {
    console.error("[innergathering] deleteContentAction:", err);
    return { ok: false, error: "Could not remove." };
  }
}

/** Publish or unpublish without opening the full form. */
export async function setContentStatusAction(
  threadId: string,
  status: "draft" | "published"
): Promise<ActionResult> {
  await requireOrgEditor();

  try {
    const [row] = await db<{ section: string | null; slug: string }[]>`
      UPDATE threads SET
        status = ${status},
        published_at = CASE
          WHEN ${status} = 'published' THEN COALESCE(published_at, NOW())
          ELSE published_at
        END,
        updated_at = NOW()
      WHERE id = ${threadId} AND org_id = ${ORG}
      RETURNING section, slug
    `;
    if (!row) return { ok: false, error: "Not found" };
    revalidateFeed(row.section ?? "", row.slug);
    return { ok: true };
  } catch (err) {
    console.error("[innergathering] setContentStatusAction:", err);
    return { ok: false, error: "Could not update." };
  }
}

// ---------------------------------------------------------------------------
// Feeds
// ---------------------------------------------------------------------------

export async function saveFeedAction(
  slug: string,
  input: {
    name: string;
    tagline?: string;
    description?: string;
    presenter?: string;
    accent?: string;
    sortOrder?: number;
    isPublic?: boolean;
  }
): Promise<ActionResult> {
  await requireOrgEditor();

  if (!slug.trim() || !input.name.trim()) {
    return { ok: false, error: "A page needs a slug and a name" };
  }

  try {
    await upsertOrgFeed(ORG, slug.trim(), {
      name: input.name.trim(),
      tagline: input.tagline?.trim() || null,
      description: input.description?.trim() || null,
      presenter: input.presenter?.trim() || null,
      accent: input.accent?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      isPublic: input.isPublic ?? true,
    });

    revalidatePath("/", "layout");
    revalidatePath("/manage/feeds");
    return { ok: true };
  } catch (err) {
    console.error("[innergathering] saveFeedAction:", err);
    return { ok: false, error: "Could not save the page." };
  }
}

// ---------------------------------------------------------------------------
// Page copy
// ---------------------------------------------------------------------------

export async function saveSectionAction(
  sectionKey: string,
  content: Record<string, string>
): Promise<ActionResult> {
  const editor = await requireOrgEditor();

  try {
    await db`
      INSERT INTO org_site_sections (org_id, section_key, content, updated_by, updated_at)
      VALUES (${ORG}, ${sectionKey}, ${db.json(content)}, ${editor.userId}, NOW())
      ON CONFLICT (org_id, section_key) DO UPDATE SET
        content = EXCLUDED.content,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `;
    revalidatePath("/", "layout");
    revalidatePath("/manage/pages");
    return { ok: true };
  } catch (err) {
    console.error("[innergathering] saveSectionAction:", err);
    return { ok: false, error: "Could not save." };
  }
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/**
 * Change a member's role in this org.
 *
 * Delegates to setOrgRole in @elkdonis/services, which is org-scoped by
 * construction — there is deliberately no path from here to the global
 * users.is_admin superadmin flag.
 */
export async function setMemberRoleAction(
  userId: string,
  role: OrgRole
): Promise<ActionResult> {
  const editor = await requireOrgEditor();

  // Only an owner reshuffles roles; a guide can publish but not change who
  // else can. And nobody demotes themselves out of the last owner seat.
  if (editor.role !== "owner") {
    return { ok: false, error: "Only the site owner can change roles." };
  }
  if (userId === editor.userId && role !== "owner") {
    return { ok: false, error: "You can't remove your own ownership here." };
  }

  try {
    await setOrgRole(userId, ORG, role);
    revalidatePath("/manage/people");
    return { ok: true };
  } catch (err) {
    console.error("[innergathering] setMemberRoleAction:", err);
    return { ok: false, error: "Could not change the role." };
  }
}

/**
 * Publish or update a teacher/guide page, from the owner console.
 *
 * A draft org_profiles row exists for every member (signup creates one per
 * org they join — see auth-server's post-signup step), so this fills it in
 * and flips is_public. It cannot create a person: a page hangs off a real
 * account, by design — see the brand doc.
 *
 * Writes split across two tables (packages/services/src/profiles.ts):
 * identity (displayName/bio/photo/city/slug) lands on `users` — global, the
 * same fields the profile owner can edit themself from /account; roleTitle/
 * sortOrder/isPublic land on `org_profiles` — this org's publish switch.
 * The owner console can set both; only the org-scoped half is owner-only.
 */
export async function saveGuideProfileAction(input: {
  userId: string;
  slug: string;
  displayName: string;
  roleTitle?: string;
  bio?: string;
  photoUrl?: string;
  city?: string;
  sortOrder?: number;
  isPublic: boolean;
}): Promise<ActionResult> {
  const editor = await requireOrgEditor();
  if (editor.role !== "owner") {
    return { ok: false, error: "Only the site owner can publish profiles." };
  }

  let slug = input.slug.trim();
  if (input.isPublic && !slug) {
    return { ok: false, error: "A published profile needs a URL slug." };
  }

  try {
    if (slug) slug = await ensureUniqueUserSlug(slug, input.userId);

    await updateProfile(input.userId, {
      displayName: input.displayName,
      bio: input.bio?.trim() || null,
      avatarUrl: input.photoUrl?.trim() || null,
      city: input.city?.trim() || null,
      slug: slug || null,
    });

    await upsertOrgProfile(ORG, input.userId, {
      roleTitle: input.roleTitle?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      isPublic: input.isPublic,
    });

    revalidatePath("/about");
    if (slug) revalidatePath(`/about/${slug}`);
    revalidatePath("/manage/people");
    return { ok: true };
  } catch (err) {
    console.error("[innergathering] saveGuideProfileAction:", err);
    return { ok: false, error: "Could not save the profile." };
  }
}
