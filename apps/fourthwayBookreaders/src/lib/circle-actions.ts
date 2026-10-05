"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import {
  addCircleUnits,
  assignMeetingRole,
  checkRsvpEligibility,
  clearMeetingRole,
  deleteRsvp,
  setRsvpStatus,
  createThread,
  ensureCircleSessionDocument,
  ensureCircleSessionTopic,
  gatherOnto,
  getRoleHolder,
  occurrencesOf,
  postReply,
  setCircleCover,
  setCircleSchedule,
  setCircleSessionNotes,
  setCircleSessionPlan,
  statusForNewThread,
  updateCircleMeta,
  baselineCircleTargets,
  CIRCLE_UNIT_STATUSES,
  ensureCircleSpace,
  listCircleUnits,
  moveCircleUnit,
  parseCirclePosition,
  recordCircleStop,
  removeCircleUnit,
  updateCircleUnit,
  type CircleLengthUnit,
  type CircleUnitKind,
  type CircleUnitStatus,
  type NewCircleUnit,
} from "@elkdonis/services";
import { sanitizeRichText } from "@elkdonis/utils";
import { getApiAffiliate, getApiEditor, getApiMember } from "@/lib/auth";
import { getForumViewer } from "@/lib/forum";
import { zonedInputToDate } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { READING_GROUP_KIND } from "@/lib/types";

/**
 * Reading-circle writes (see packages/services/src/reading-circle.ts).
 *
 * The plan — its units, their order, the baseline — is the editors' (owner or
 * guide). Recording where a sitting stopped is any member's: whoever was
 * keeping the place that evening says where the group got to.
 */

const ORG = siteConfig.orgId;

const text = (form: FormData, key: string, max = 300) => String(form.get(key) ?? "").trim().slice(0, max);

async function ownGroup(groupId: string) {
  const [row] = await db<{ id: string; slug: string | null }[]>`
    SELECT id, slug FROM threads
    WHERE id = ${groupId} AND org_id = ${ORG} AND kind = ${READING_GROUP_KIND}
    LIMIT 1
  `;
  return row ?? null;
}

const backTo = (g: { id: string; slug: string | null }, hash = "") => `/groups/${g.slug ?? g.id}${hash}`;

async function editorGroup(form: FormData) {
  const editor = await getApiEditor();
  if (!editor) redirect("/login");
  const group = await ownGroup(text(form, "groupId", 40));
  if (!group) redirect("/manage");
  return { editor, group };
}

/** Make the circle's folder, Talk room and discussion feed (each only if missing). */
export async function setUpCircleSpace(form: FormData): Promise<void> {
  const { group } = await editorGroup(form);
  const result = await ensureCircleSpace(ORG, group.id);
  revalidatePath("/", "layout");
  redirect(`${backTo(group)}?circle=${result.warnings.length ? "partial" : "ready"}#circle`);
}

/**
 * Add units, one per line:  label | title | length | file
 *
 * Only the title is required. A line with one field is a title; with two,
 * label and title. `length` is pages (or mm:ss for audio). `file` is a name
 * inside the circle's Material folder, or a path from the org root.
 */
export async function addCircleUnitsAction(form: FormData): Promise<void> {
  const { group } = await editorGroup(form);
  const kind = (text(form, "kind", 20) || "document") as CircleUnitKind;
  const lengthUnit: CircleLengthUnit = kind === "audio" || kind === "video" ? "seconds" : "pages";
  const [meta] = await db<{ folder: string | null }[]>`
    SELECT metadata->'circle'->>'folder' AS folder FROM threads WHERE id = ${group.id} AND org_id = ${ORG}
  `;
  const materialDir = meta?.folder ? `${meta.folder}/Material` : null;

  const units: NewCircleUnit[] = String(form.get("lines") ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 500)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      const [label, title] = parts.length >= 2 ? [parts[0] || null, parts[1]] : [null, parts[0]];
      const length = parts[2] ? parseCirclePosition(parts[2], lengthUnit) : null;
      const file = parts[3] || null;
      const sourcePath = file
        ? file.includes("/") || !materialDir
          ? file.replace(/^\/+/, "")
          : `${materialDir}/${file}`
        : null;
      return { title, label, kind, length, lengthUnit, sourcePath };
    })
    .filter((u) => u.title && !u.sourcePath?.includes(".."));

  await addCircleUnits(ORG, group.id, units);
  revalidatePath("/", "layout");
  redirect(backTo(group, "#plan"));
}

export async function setCircleUnitStatus(form: FormData): Promise<void> {
  const { group } = await editorGroup(form);
  const status = text(form, "status", 20) as CircleUnitStatus;
  if (!CIRCLE_UNIT_STATUSES.includes(status)) redirect(backTo(group, "#plan"));
  await updateCircleUnit(ORG, group.id, text(form, "unitId", 40), { status });
  revalidatePath("/", "layout");
  redirect(backTo(group, "#plan"));
}

export async function moveCircleUnitAction(form: FormData): Promise<void> {
  const { group } = await editorGroup(form);
  await moveCircleUnit(ORG, group.id, text(form, "unitId", 40), text(form, "dir", 4) === "up" ? "up" : "down");
  revalidatePath("/", "layout");
  redirect(backTo(group, "#plan"));
}

export async function removeCircleUnitAction(form: FormData): Promise<void> {
  const { group } = await editorGroup(form);
  await removeCircleUnit(ORG, group.id, text(form, "unitId", 40));
  revalidatePath("/", "layout");
  redirect(backTo(group, "#plan"));
}

/** Set target dates for every open unit from today, at `pace` units per sitting. */
export async function baselineCirclePlan(form: FormData): Promise<void> {
  const { group } = await editorGroup(form);
  const pace = Number(text(form, "pace", 3));
  await baselineCircleTargets(ORG, group.id, Number.isFinite(pace) && pace > 0 ? pace : 1);
  revalidatePath("/", "layout");
  redirect(backTo(group, "#plan"));
}

/**
 * "We stopped here." `sitting` is an occurrence ISO timestamp from the form's
 * list, or a YYYY-MM-DD for a circle with no schedule (stored at noon, the
 * circle's zone does not matter for a date-only sitting).
 */
export async function recordCircleStopAction(form: FormData): Promise<void> {
  const group = await ownGroup(text(form, "groupId", 40));
  if (!group) redirect("/");

  const sitting = text(form, "sitting", 40);
  const at = /^\d{4}-\d{2}-\d{2}$/.test(sitting) ? new Date(`${sitting}T12:00:00Z`) : new Date(sitting);
  if (Number.isNaN(at.getTime())) redirect(backTo(group, "?stop=invalid#manage"));
  // Recorded from the manage section: the sitting's host, or an editor.
  const member = await hostOrEditor(group.id, at);
  if (!member) redirect(backTo(group, "#manage"));

  const units = await listCircleUnits(ORG, group.id);
  const unit = units.find((u) => u.id === text(form, "unitId", 40));
  if (!unit) redirect(backTo(group, "?stop=invalid#manage"));

  const raw = text(form, "position", 12);
  const position = raw ? parseCirclePosition(raw, unit.lengthUnit) : null;
  if (raw && position == null) redirect(backTo(group, "?stop=position#manage"));

  await recordCircleStop({
    orgId: ORG,
    threadId: group.id,
    occurrenceAt: at,
    unitId: unit.id,
    position,
    finished: form.get("finished") === "on",
    note: String(form.get("note") ?? "").slice(0, 20000),
    actorUserId: member.userId,
  });

  // The passage for the home page — hosts and editors only, since it is public.
  const passage = excerptFrom(form, unit.label ?? unit.title, unit.lengthUnit === "pages" ? position : null);
  if (passage && (await hostOrEditor(group.id, at))) {
    await updateCircleMeta(ORG, group.id, { excerpt: passage });
  }
  revalidatePath("/", "layout");
  redirect(backTo(group, "?stop=saved#manage"));
}

// ── Sessions ────────────────────────────────────────────────────────────────

/** An occurrence ISO timestamp from a form, or null. */
function occurrence(form: FormData): Date | null {
  const raw = text(form, "occurrenceAt", 40);
  const d = new Date(raw);
  return raw && !Number.isNaN(d.getTime()) ? d : null;
}

/** The circle row with what the session actions need, scoped to this org. */
async function circleRow(groupId: string) {
  const [row] = await db<Array<{ id: string; slug: string | null; scheduled_at: Date | null; recurrence_pattern: string | null; recurrence_until: Date | null; feed: string | null }>>`
    SELECT id, slug, scheduled_at, recurrence_pattern, recurrence_until,
           metadata->'circle'->>'feedSlug' AS feed
    FROM threads
    WHERE id = ${groupId} AND org_id = ${ORG} AND kind = ${READING_GROUP_KIND}
  `;
  return row ?? null;
}

/** The host of that sitting, or an editor. */
async function hostOrEditor(groupId: string, at: Date) {
  const member = await getApiMember();
  if (!member) return null;
  if (member.canEdit) return member;
  const host = await getRoleHolder(groupId, at, "host").catch(() => null);
  return host === member.userId ? member : null;
}

/** Make the sitting's topic ahead of time (editors). */
export async function stageCircleSession(form: FormData): Promise<void> {
  const { editor, group } = await editorGroup(form);
  const at = occurrence(form);
  if (at) await ensureCircleSessionTopic(ORG, group.id, at, editor.userId);
  revalidatePath("/", "layout");
  redirect(backTo(group, "#sessions"));
}

/** Make topics for the next `count` sittings (editors). */
export async function stageNextCircleSessions(form: FormData): Promise<void> {
  const { editor, group } = await editorGroup(form);
  const circle = await circleRow(group.id);
  const count = Math.max(1, Math.min(Number(text(form, "count", 2)) || 4, 12));
  if (circle?.scheduled_at) {
    const dates = occurrencesOf(
      { scheduledAt: circle.scheduled_at, recurrencePattern: circle.recurrence_pattern, recurrenceUntil: circle.recurrence_until },
      { from: new Date(Date.now() - 3 * 3_600_000), count }
    );
    for (const d of dates) await ensureCircleSessionTopic(ORG, group.id, d, editor.userId);
  }
  revalidatePath("/", "layout");
  redirect(backTo(group, "#manage"));
}

/** The sitting's collaborative document (members; made once). */
export async function createSessionDocument(form: FormData): Promise<void> {
  const member = await getApiAffiliate();
  if (!member) redirect("/login");
  const group = await ownGroup(text(form, "groupId", 40));
  const at = occurrence(form);
  if (!group || !at) redirect("/");
  const topic = await ensureCircleSessionTopic(ORG, group.id, at, member.userId);
  await ensureCircleSessionDocument(ORG, topic.id, siteConfig.timeZone);
  revalidatePath("/", "layout");
  redirect(backTo(group, "#sessions"));
}

/** The host's notes for a sitting (host or editor). */
export async function saveSessionNotes(form: FormData): Promise<void> {
  const group = await ownGroup(text(form, "groupId", 40));
  const at = occurrence(form);
  if (!group || !at) redirect("/");
  const actor = await hostOrEditor(group.id, at);
  if (!actor) redirect(backTo(group, "#sessions"));
  await setCircleSessionNotes({ orgId: ORG, circleId: group.id, occurrenceAt: at, notes: String(form.get("notes") ?? ""), actorUserId: actor.userId });
  revalidatePath("/", "layout");
  redirect(backTo(group, "#sessions"));
}

/** What a sitting is for — the plan line (host or editor). */
export async function saveSessionPlan(form: FormData): Promise<void> {
  const group = await ownGroup(text(form, "groupId", 40));
  const at = occurrence(form);
  if (!group || !at) redirect("/");
  const actor = await hostOrEditor(group.id, at);
  if (!actor) redirect(backTo(group, "#sessions"));
  await setCircleSessionPlan({ orgId: ORG, circleId: group.id, occurrenceAt: at, plan: text(form, "plan", 2000), actorUserId: actor.userId });
  revalidatePath("/", "layout");
  redirect(backTo(group, "#manage"));
}

/** Who hosts a sitting (editors). An empty choice clears it. */
export async function setSessionHost(form: FormData): Promise<void> {
  const { editor, group } = await editorGroup(form);
  const at = occurrence(form);
  if (!at) redirect(backTo(group, "#manage"));
  const userId = text(form, "userId", 40);
  if (userId) {
    await assignMeetingRole({ threadId: group.id, occurrenceAt: at, role: "host", userId, actorUserId: editor.userId });
  } else {
    await clearMeetingRole(group.id, at, "host");
  }
  revalidatePath("/", "layout");
  redirect(backTo(group, "#manage"));
}

/** A comment on the sitting's topic (members) — a forum reply. */
export async function postSessionComment(form: FormData): Promise<void> {
  const member = await getApiAffiliate();
  if (!member) redirect("/login");
  const group = await ownGroup(text(form, "groupId", 40));
  const at = occurrence(form);
  const body = String(form.get("text") ?? "").trim().slice(0, 10000);
  if (!group || !at) redirect("/");
  if (!body) redirect(backTo(group, "#sessions"));
  const topic = await ensureCircleSessionTopic(ORG, group.id, at, member.userId);
  const result = await postReply(await getForumViewer(), { threadId: topic.id, text: body });
  revalidatePath("/", "layout");
  redirect(backTo(group, result.ok ? "#sessions" : "?comment=failed#sessions"));
}

/**
 * A new thread started from a sitting (the compose pop-up's save). Filed in the
 * circle's discussion feed and gathered onto the sitting's topic, so the
 * sitting lists it. Returns rather than redirects: the surface closes itself.
 */
export async function createSessionThread(input: {
  groupId: string;
  occurrenceAt: string;
  title: string;
  body: string;
  /** "Save draft" in the pop-up keeps it a draft; anything else publishes (subject to review). */
  status?: string;
}): Promise<{ ok: true; id: string; href: string | null } | { ok: false; error: string }> {
  const member = await getApiAffiliate();
  if (!member) return { ok: false, error: "Join the group first." };
  const circle = await circleRow(input.groupId);
  const at = new Date(input.occurrenceAt);
  if (!circle || !circle.feed || Number.isNaN(at.getTime())) return { ok: false, error: "That session was not found." };
  const title = input.title.trim().slice(0, 200);
  if (title.length < 2) return { ok: false, error: "Give it a title." };

  const topic = await ensureCircleSessionTopic(ORG, circle.id, at, member.userId);
  const status = await statusForNewThread(member.userId, ORG, input.status === "draft" ? "draft" : "published");
  const thread = await createThread({
    kind: "post",
    orgId: ORG,
    authorId: member.userId,
    title,
    body: sanitizeRichText(input.body ?? ""),
    status,
    // Like the session topics: for anyone with a role here, not the public.
    visibility: "ORGANIZATION",
    section: circle.feed,
  } as never);
  await gatherOnto(topic.id, { targetType: "thread", targetThreadId: thread.id, relation: "gathers", addedBy: member.userId });
  revalidatePath("/", "layout");
  return { ok: true, id: thread.id, href: status === "published" ? `/${circle.feed}/${thread.slug ?? thread.id}` : null };
}

// ── Circle settings (editors) ───────────────────────────────────────────────

export async function saveCircleSchedule(form: FormData): Promise<void> {
  const { group } = await editorGroup(form);
  const start = zonedInputToDate(text(form, "scheduledAt", 16));
  const repeat = text(form, "recurrence", 10);
  const recurrence = repeat === "WEEKLY" || repeat === "MONTHLY" || repeat === "DAILY" ? repeat : null;
  const duration = Number(text(form, "durationMinutes", 4)) || null;
  const until = zonedInputToDate(text(form, "until", 10));
  await setCircleSchedule(ORG, group.id, { scheduledAt: start, recurrence, durationMinutes: duration, until });
  revalidatePath("/", "layout");
  redirect(backTo(group, "#manage"));
}

export async function saveCircleStructure(form: FormData): Promise<void> {
  const { group } = await editorGroup(form);
  const pace = Number(text(form, "pace", 3));
  await updateCircleMeta(ORG, group.id, {
    structure: sanitizeRichText(String(form.get("structure") ?? "")) || null,
    ...(Number.isFinite(pace) && pace > 0 ? { pace: Math.min(20, Math.round(pace)) } : {}),
  });
  revalidatePath("/", "layout");
  redirect(backTo(group, "#manage"));
}

/** Cover: a canonical /api/media/… path in this org's tree, or empty to clear. */
export async function saveCircleCover(form: FormData): Promise<void> {
  const { group } = await editorGroup(form);
  const url = text(form, "coverUrl", 500);
  const ok = url === "" || url.startsWith(`/api/media/EAC_Network/${ORG}/`);
  if (ok) await setCircleCover(ORG, group.id, url || null);
  revalidatePath("/", "layout");
  redirect(backTo(group, "#manage"));
}

/**
 * RSVP for one sitting (members). The topic carries the RSVP — the platform's
 * RSVP is per thread — so it is made here if the sitting has none yet.
 */
export async function rsvpSession(form: FormData): Promise<void> {
  const member = await getApiAffiliate();
  if (!member) redirect("/login");
  const group = await ownGroup(text(form, "groupId", 40));
  const at = occurrence(form);
  if (!group || !at) redirect("/");
  const topic = await ensureCircleSessionTopic(ORG, group.id, at, member.userId);
  if (text(form, "going", 3) === "yes") {
    const eligible = await checkRsvpEligibility(topic.id);
    if (eligible.ok) await setRsvpStatus(topic.id, member.userId, "yes");
  } else {
    await deleteRsvp(topic.id, member.userId);
  }
  revalidatePath("/", "layout");
  redirect(backTo(group, "#sessions"));
}

/** Feature a group on the home page, or clear it (empty groupId). Editors. */
export async function setFeaturedGroup(form: FormData): Promise<void> {
  const editor = await getApiEditor();
  if (!editor) redirect("/login");
  const id = text(form, "groupId", 40);
  if (id) {
    const group = await ownGroup(id);
    if (!group) redirect("/manage/groups");
    await db`
      INSERT INTO org_site_sections (org_id, section_key, content, updated_by)
      VALUES (${ORG}, 'featured_group', ${db.json({ threadId: group.id })}, ${editor.userId})
      ON CONFLICT (org_id, section_key) DO UPDATE
        SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `;
  } else {
    await db`DELETE FROM org_site_sections WHERE org_id = ${ORG} AND section_key = 'featured_group'`;
  }
  revalidatePath("/", "layout");
  redirect("/manage/groups");
}

/** A pasted passage from a form: text (plain, paragraphs kept), where it is from, the page. */
function excerptFrom(form: FormData, defaultWhere: string | null, defaultPage: number | null) {
  const body = String(form.get("excerpt") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 6000);
  if (!body) return null;
  const where = text(form, "excerptWhere", 200) || defaultWhere;
  const page = Number(text(form, "excerptPage", 5)) || defaultPage;
  return { text: body, where: where || null, page: page && page > 0 ? page : null, at: new Date().toISOString() };
}

/** Post or clear the home-page passage from the manage section (editors). */
export async function saveCircleExcerpt(form: FormData): Promise<void> {
  const { group } = await editorGroup(form);
  const passage = excerptFrom(form, null, null);
  await updateCircleMeta(ORG, group.id, { excerpt: passage });
  revalidatePath("/", "layout");
  redirect(backTo(group, "#manage"));
}
