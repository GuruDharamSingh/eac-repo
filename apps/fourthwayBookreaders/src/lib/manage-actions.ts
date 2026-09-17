"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { createThread, gatherOnto, getOrgFeed, upsertOrgFeed } from "@elkdonis/services";
import { sanitizeRichText } from "@elkdonis/utils";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { zonedInputToDate } from "@/lib/format";
import { READING_GROUP_KIND } from "@/lib/types";

const ORG = siteConfig.orgId;
const RECURRENCE = new Set(["DAILY", "WEEKLY", "MONTHLY"]);

const text = (form: FormData, key: string, max = 300) => String(form.get(key) ?? "").trim().slice(0, max);
const int = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? "").trim();
  return /^\d+$/.test(v) ? Number(v) : null;
};

/** Fixed sections of this site. isPublic is only "show in the nav", and both already have a fixed link. */
async function ensureFeed(slug: "groups" | "archive", name: string, sortOrder: number) {
  if (await getOrgFeed(ORG, slug).catch(() => null)) return;
  await upsertOrgFeed(ORG, slug, { name, isPublic: false, sortOrder });
}

/** The group, if it is this org's and really a reading group. Every write below starts here. */
async function ownGroup(groupId: string) {
  const [row] = await db<{ id: string; slug: string | null; title: string }[]>`
    SELECT id, slug, title FROM threads
    WHERE id = ${groupId} AND org_id = ${ORG} AND kind = ${READING_GROUP_KIND}
    LIMIT 1
  `;
  return row ?? null;
}

/**
 * Start a reading group.
 *
 * The thread IS the group — a durable sub-group of the org reading one book
 * over a stretch of time — not one evening of it:
 *
 *   scheduled_at + recurrence_pattern   when it sits (the cadence)
 *   recurrence_until                    when it disbands, if it has an end
 *   metadata.book / metadata.currentPage   what it reads and where it has got to
 *   thread_rsvps 'yes'                  its roster: an RSVP here means JOINING
 *
 * No new table and no org role. It goes through createThread — the one write
 * path — for the slug, excerpt and published_at handling; the two columns that
 * path has no field for are set afterwards, scoped by org.
 */
export async function createReadingGroup(form: FormData): Promise<void> {
  const editor = await getApiEditor();
  if (!editor) redirect("/login?next=/manage/groups/new");

  const title = text(form, "title", 200);
  if (title.length < 3) redirect("/manage/groups/new?error=title");

  const meetingUrl = text(form, "meetingUrl", 500);
  const location = text(form, "location");
  const repeat = text(form, "recurrence", 10);
  const endsOn = zonedInputToDate(text(form, "endsOn", 10));
  const bookTitle = text(form, "bookTitle", 200);

  await ensureFeed("groups", "Groups", 10);

  const thread = await createThread({
    kind: READING_GROUP_KIND,
    orgId: ORG,
    authorId: editor.userId,
    title,
    body: sanitizeRichText(String(form.get("body") ?? "")),
    status: form.get("draft") ? "draft" : "published",
    visibility: "PUBLIC",
    section: "groups",
    scheduledAt: zonedInputToDate(text(form, "scheduledAt", 16)),
    durationMinutes: int(form, "durationMinutes") ?? 90,
    location: location || null,
    format: meetingUrl && location ? "hybrid" : meetingUrl ? "online" : "in_person",
    meetingUrl: /^https?:\/\//i.test(meetingUrl) ? meetingUrl : null,
    // Joining is the point of a group, so this is on unless switched off.
    isRsvpEnabled: form.get("rsvp") === "on",
    attendeeLimit: int(form, "attendeeLimit"),
    metadata: {
      ...(bookTitle ? { book: { title: bookTitle, author: text(form, "bookAuthor", 160) || null } } : {}),
      ...(int(form, "currentPage") != null ? { currentPage: int(form, "currentPage") } : {}),
    },
  });

  // recurrence_pattern accepts DAILY|WEEKLY|MONTHLY|CUSTOM or NULL — never
  // 'NONE' (a 23514 check violation), so "doesn't repeat" stays NULL.
  await db`
    UPDATE threads
    SET recurrence_pattern = ${RECURRENCE.has(repeat) ? repeat : null},
        recurrence_until = ${endsOn}
    WHERE id = ${thread.id} AND org_id = ${ORG}
  `;

  revalidatePath("/");
  redirect("/manage?saved=group");
}

/** Move a group's bookmark. `||` merges, so the book and anything else in metadata survive. */
export async function setGroupPage(form: FormData): Promise<void> {
  const editor = await getApiEditor();
  if (!editor) redirect("/login");
  const group = await ownGroup(text(form, "groupId", 40));
  const page = int(form, "currentPage");
  if (!group || page == null) redirect("/manage");

  await db`
    UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({ currentPage: page })}
    WHERE id = ${group.id} AND org_id = ${ORG}
  `;
  revalidatePath("/");
  redirect(`/groups/${group.slug ?? group.id}`);
}

/**
 * Record a sitting.
 *
 * A session only becomes a row once it holds something. It is an ordinary
 * `post` filed under /archive that the group `produced` — the network's one
 * grouping edge (thread_gathers) — so it is searchable and discussable like
 * any post, and the group's page lists it. If the note says which page the
 * evening ended on, the group's bookmark moves there too: one form, not two.
 */
export async function addSessionNote(form: FormData): Promise<void> {
  const editor = await getApiEditor();
  if (!editor) redirect("/login");
  const group = await ownGroup(text(form, "groupId", 40));
  if (!group) redirect("/manage");
  const back = `/groups/${group.slug ?? group.id}`;

  const heldOn = /^\d{4}-\d{2}-\d{2}$/.test(text(form, "heldOn", 10)) ? text(form, "heldOn", 10) : null;
  const pagesFrom = int(form, "pagesFrom");
  const pagesTo = int(form, "pagesTo");
  const recordingUrl = text(form, "recordingUrl", 500);
  const notes = String(form.get("notes") ?? "").trim().slice(0, 20000);
  if (!notes && pagesTo == null && !recordingUrl) redirect(`${back}?error=empty`);

  await ensureFeed("archive", "Archive", 20);

  const escaped = notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = escaped
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const pages = pagesFrom != null && pagesTo != null ? `pp. ${pagesFrom}–${pagesTo}` : pagesTo != null ? `to p. ${pagesTo}` : null;
  const note = await createThread({
    kind: "post",
    orgId: ORG,
    authorId: editor.userId,
    title: [group.title, heldOn, pages].filter(Boolean).join(" · "),
    // Named, not derived: slugifying "pp. 1–2" drops the dash and reads "pp-12".
    // createThread still de-duplicates it, so two notes for one evening are fine.
    slug: `${group.slug ?? group.id}-${heldOn ?? "sitting"}`,
    body: body || undefined,
    status: "published",
    visibility: "PUBLIC",
    section: "archive",
    metadata: {
      heldOn,
      pagesFrom,
      pagesTo,
      // Same-origin media paths or https only — this becomes an href.
      recordingUrl: /^(\/api\/media\/|https:\/\/)/.test(recordingUrl) ? recordingUrl : null,
    },
  });

  await gatherOnto(group.id, {
    targetType: "thread",
    targetThreadId: note.id,
    relation: "produced",
    addedBy: editor.userId,
  });

  if (pagesTo != null && form.get("moveBookmark") === "on") {
    await db`
      UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({ currentPage: pagesTo })}
      WHERE id = ${group.id} AND org_id = ${ORG}
    `;
  }

  revalidatePath("/");
  redirect(back);
}
