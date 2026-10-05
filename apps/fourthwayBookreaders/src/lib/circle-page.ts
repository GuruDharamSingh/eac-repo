import { db } from "@elkdonis/db";
import { sanitizeRichText } from "@elkdonis/utils";
import {
  circleMeta,
  circleOccurrenceNumber,
  CIRCLE_RECORDINGS,
  countConfirmedRsvps,
  formatCirclePosition,
  getRoleHolder,
  getRsvpStatus,
  listCircleSessions,
  listCircleSessionTopics,
  listCircleUnits,
  listOrgFiles,
  listOrgMembers,
  listReplies,
  occurrencesOf,
  type CircleSession,
  type CircleSessionTopic,
  type CircleUnit,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { withBase } from "@/lib/base-path";
import type { Thread } from "@/lib/types";
import type { Viewer } from "@/lib/auth";
import { getForumViewer } from "@/lib/forum";

/**
 * Everything the circle page renders — the page IS the circle's workspace.
 *
 * Sittings, not chapters, divide the page. Each sitting is an occurrence of the
 * circle's thread; its topic thread (reading-circle.ts, "Sessions") carries the
 * RSVP, comments and document; the occurrence row carries the host's notes,
 * the plan line and where it stopped. Each sitting starts where the previous
 * one stopped, and covers `pace` units of material from there.
 *
 * The public (non-member) render only reads the head of this: cover, group
 * box, reading structure, progress. Everything below is members-only and is
 * not loaded for anyone else.
 */

const ORG = siteConfig.orgId;
const TALK_BASE = process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? process.env.NEXTCLOUD_PUBLIC_URL ?? null;
const FORUM_ORIGIN = process.env.NEXT_PUBLIC_FORUM_URL ?? "https://forum.arts-collective.com";
/** A sitting stays "this session" until this long after it starts. */
const CURRENT_GRACE_MS = 3 * 60 * 60 * 1000;

export type SessionSlot = "previous" | "current" | "next";

export interface SessionMaterial {
  unitId: string;
  label: string;
  title: string;
  /** Private media URL with basePath, or null when the unit has no file. */
  href: string | null;
  /** Page to open the reader at (1 = from the start). */
  startPage: number;
  length: number | null;
  lengthUnit: "pages" | "seconds";
  status: CircleUnit["status"];
}

export interface SessionView {
  slot: SessionSlot;
  occurrenceAt: string;
  number: number;
  topic: { id: string; href: string; title: string } | null;
  /** Editable Nextcloud share link. Members only, never rendered to others. */
  documentUrl: string | null;
  host: { userId: string; name: string } | null;
  rsvp: { count: number; going: boolean };
  notes: string | null;
  plan: string | null;
  /** "TOTM 12, p. 4" or "the start of TOTM 13". */
  startsAt: string | null;
  stoppedAt: string | null;
  material: SessionMaterial[];
  comments: Array<{ id: string; author: string; html: string; at: string }>;
  threads: Array<{ id: string; title: string; author: string | null; at: string }>;
}

export interface CirclePageData {
  isMember: boolean;
  canEdit: boolean;
  hasSpace: boolean;
  folder: string | null;
  feedSlug: string | null;
  /** The circle's forum category name (org_feeds.name). */
  feedName: string | null;
  structureHtml: string | null;
  readers: number;
  scheduled: boolean;
  sessions: Record<SessionSlot, SessionView | null>;
  archive: Array<{ occurrenceAt: string; number: number; href: string | null; stoppedAt: string | null }>;
  progress: {
    held: number;
    unitsDone: number;
    unitsTotal: number;
    unitsLeft: number;
    pace: number;
    sessionsLeft: number;
    projectedFinish: string | null;
  };
  talkUrl: string | null;
  forumUrl: string | null;
  recordings: Array<{ folder: string; files: Array<{ name: string; href: string; size: number }> }>;
  /** Owners/guides: who can be made host. */
  hostCandidates: Array<{ userId: string; name: string }>;
  /** For the "where we stopped" form: open units first. */
  units: Array<{ id: string; name: string; lengthUnit: "pages" | "seconds"; status: CircleUnit["status"] }>;
  /** Owners/guides: the next sittings to stage. */
  stage: Array<{ occurrenceAt: string; number: number; hostId: string | null; plan: string | null; notes: string | null; staged: boolean; hasDocument: boolean }>;
  /** Owners/guides: recent sittings a stop can be recorded against, newest first. */
  stopSittings: Array<{ occurrenceAt: string; number: number; stoppedAt: string | null }>;
  /** Owners/guides: the plan in full. */
  planUnits: Array<{ id: string; label: string | null; title: string; length: number | null; lengthUnit: "pages" | "seconds"; status: CircleUnit["status"]; hasFile: boolean }>;
  schedule: { startLocal: string; recurrence: string | null; durationMinutes: number | null; untilLocal: string };
  structureRaw: string;
  coverUrl: string;
  excerpt: { text: string; where: string | null; page: number | null; at: string } | null;
}

/** metadata.circle.excerpt, the passage posted for the home page, if well-formed. */
export function readExcerpt(metadata: Record<string, unknown> | null): CirclePageData["excerpt"] {
  const e = (metadata?.circle as Record<string, unknown> | undefined)?.excerpt as Record<string, unknown> | undefined;
  if (!e || typeof e.text !== "string" || !e.text.trim()) return null;
  return {
    text: e.text,
    where: typeof e.where === "string" ? e.where : null,
    page: typeof e.page === "number" ? e.page : null,
    at: typeof e.at === "string" ? e.at : "",
  };
}

/** A Date as a datetime-local value in the circle's zone ("2026-10-01T19:30"). */
function localInput(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: siteConfig.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

function encodeMediaUrl(url: string): string {
  return url.split("/").map((seg) => encodeURIComponent(seg)).join("/");
}
const unitName = (u: { label: string | null; title: string }) => u.label ?? u.title;
const isOpen = (u: CircleUnit) => u.status !== "done" && u.status !== "skipped";

interface Point {
  index: number;
  position: number;
}

/** Where a sitting at `at` starts: after the latest stop recorded before it. */
function startBefore(at: number, stops: CircleSession[], units: CircleUnit[]): Point | null {
  if (units.length === 0) return null;
  const prior = stops.filter((s) => new Date(s.occurrenceAt).getTime() < at && s.stopUnitId).at(-1);
  if (!prior) {
    const first = units.findIndex(isOpen);
    return { index: first >= 0 && at > Date.now() ? first : 0, position: 1 };
  }
  const i = units.findIndex((u) => u.id === prior.stopUnitId);
  if (i < 0) return { index: 0, position: 1 };
  const u = units[i];
  const finished = u.status === "done" || (u.length != null && (prior.stopPosition ?? 0) >= u.length);
  if (finished) return i + 1 < units.length ? { index: i + 1, position: 1 } : null;
  return { index: i, position: prior.stopPosition ?? 1 };
}

function said(units: CircleUnit[], p: Point | null): string | null {
  if (!p) return null;
  const u = units[p.index];
  const first = u.lengthUnit === "seconds" ? 0 : 1;
  return p.position > first ? `${unitName(u)}, ${formatCirclePosition(p.position, u.lengthUnit)}` : `the start of ${unitName(u)}`;
}

function materialFrom(units: CircleUnit[], start: Point | null, count: number, stopId: string | null): SessionMaterial[] {
  if (!start) return [];
  let end = Math.min(units.length, start.index + count);
  if (stopId) {
    const s = units.findIndex((u) => u.id === stopId);
    if (s >= start.index) end = s + 1;
  }
  return units.slice(start.index, end).map((u, i) => ({
    unitId: u.id,
    label: unitName(u),
    title: u.title,
    // Circle material under Private/Circles/ goes through /api/circle-file,
    // which admits viewers; anything else through the member-only /api/media.
    href: u.sourcePath
      ? withBase(encodeMediaUrl(`/api/${u.sourcePath.startsWith("Private/Circles/") ? "circle-file" : "media"}/EAC_Network/${ORG}/${u.sourcePath}`))
      : null,
    startPage: i === 0 && u.lengthUnit === "pages" ? Math.max(1, start.position) : 1,
    length: u.length,
    lengthUnit: u.lengthUnit,
    status: u.status,
  }));
}

export async function getCirclePage(circle: Thread, viewer: Viewer | null): Promise<CirclePageData> {
  // "Member" of the circle's space: anyone with a role in the org, viewers
  // included (owner's call, 2026-09-26). Editing stays with owners/guides.
  const isMember = Boolean(viewer?.isAffiliate);
  const canEdit = Boolean(viewer?.canEdit);

  const [row] = await db<Array<{ metadata: Record<string, unknown> | null; recurrence_until: Date | null; org_slug: string | null }>>`
    SELECT t.metadata, t.recurrence_until, o.slug AS org_slug
    FROM threads t JOIN organizations o ON o.id = t.org_id
    WHERE t.id = ${circle.id} AND t.org_id = ${ORG}
  `.catch(() => []);
  const meta = circleMeta(row?.metadata ?? null);
  const rawStructure = (row?.metadata?.circle as Record<string, unknown> | undefined)?.structure;
  const structureHtml = typeof rawStructure === "string" && rawStructure.trim() ? sanitizeRichText(rawStructure) : null;
  const pace = Math.max(1, meta.pace ?? 1);
  const meeting = {
    scheduledAt: circle.scheduledAt,
    recurrencePattern: circle.recurrencePattern,
    recurrenceUntil: row?.recurrence_until ?? null,
  };

  const [units, notes, readers] = await Promise.all([
    listCircleUnits(ORG, circle.id).catch(() => [] as CircleUnit[]),
    listCircleSessions(ORG, circle.id, 400).catch(() => [] as CircleSession[]),
    countConfirmedRsvps(circle.id).catch(() => 0),
  ]);
  const stops = [...notes].reverse(); // oldest first
  const unitsDone = units.filter((u) => !isOpen(u)).length;
  const unitsLeft = units.length - unitsDone;
  const sessionsLeft = Math.ceil(unitsLeft / pace);
  const ahead = circle.scheduledAt && sessionsLeft > 0
    ? occurrencesOf(meeting, { from: new Date(Date.now() - CURRENT_GRACE_MS), count: Math.min(sessionsLeft, 52) })
    : [];
  // Held = a past sitting that left a stop or notes (notes can be written ahead of time).
  const heldSet = new Set(
    notes.filter((n) => (n.stopUnitId || n.note) && new Date(n.occurrenceAt).getTime() < Date.now()).map((n) => n.occurrenceAt)
  );

  const base: CirclePageData = {
    isMember,
    canEdit,
    hasSpace: Boolean(meta.folder && circle.talkToken && meta.feedSlug),
    folder: meta.folder ?? null,
    feedSlug: meta.feedSlug ?? null,
    feedName: meta.feedSlug
      ? (await db<{ name: string }[]>`SELECT name FROM org_feeds WHERE org_id = ${ORG} AND slug = ${meta.feedSlug}`.catch(() => []))[0]?.name ?? null
      : null,
    structureHtml,
    readers,
    scheduled: Boolean(circle.scheduledAt),
    sessions: { previous: null, current: null, next: null },
    archive: [],
    progress: {
      held: heldSet.size,
      unitsDone,
      unitsTotal: units.length,
      unitsLeft,
      pace,
      sessionsLeft,
      projectedFinish: sessionsLeft > 0 && ahead.length >= sessionsLeft ? ahead[sessionsLeft - 1].toISOString() : null,
    },
    talkUrl: circle.talkToken && TALK_BASE ? `${TALK_BASE}/call/${circle.talkToken}` : null,
    forumUrl: meta.feedSlug && row?.org_slug ? `${FORUM_ORIGIN}/o/${row.org_slug}/${meta.feedSlug}` : null,
    recordings: [],
    hostCandidates: [],
    units: units.map((u) => ({ id: u.id, name: unitName(u), lengthUnit: u.lengthUnit, status: u.status })),
    stage: [],
    stopSittings: [],
    planUnits: [],
    schedule: {
      startLocal: circle.scheduledAt ? localInput(circle.scheduledAt) : "",
      recurrence: circle.recurrencePattern,
      durationMinutes: circle.durationMinutes,
      untilLocal: row?.recurrence_until ? localInput(new Date(row.recurrence_until)).slice(0, 10) : "",
    },
    structureRaw: typeof rawStructure === "string" ? rawStructure : "",
    excerpt: readExcerpt(row?.metadata ?? null),
    coverUrl: typeof row?.metadata?.coverImageUrl === "string" ? (row.metadata.coverImageUrl as string) : "",
  };
  if (!isMember) return base;

  // ── The three sittings ──────────────────────────────────────────────────
  const now = Date.now();
  const around = circle.scheduledAt
    ? occurrencesOf(meeting, { from: new Date(now - 400 * 86_400_000), count: 52 })
    : [];
  // occurrencesOf is bounded by count, so for a long-running weekly circle the
  // window above may end before today; fetch forward from today as well.
  const forward = circle.scheduledAt ? occurrencesOf(meeting, { from: new Date(now - 45 * 86_400_000), count: 12 }) : [];
  const all = [...new Map([...around, ...forward].map((d) => [d.getTime(), d])).values()].sort((a, b) => a.getTime() - b.getTime());
  const curIdx = all.findIndex((d) => d.getTime() + CURRENT_GRACE_MS >= now);
  const slots: Record<SessionSlot, Date | null> = {
    previous: curIdx > 0 ? all[curIdx - 1] : curIdx < 0 && all.length ? all[all.length - 1] : null,
    current: curIdx >= 0 ? all[curIdx] : null,
    next: curIdx >= 0 && curIdx + 1 < all.length ? all[curIdx + 1] : null,
  };

  const [topics, forumViewer, members] = await Promise.all([
    listCircleSessionTopics(ORG, circle.id).catch(() => [] as CircleSessionTopic[]),
    getForumViewer().catch(() => null),
    canEdit ? listOrgMembers(ORG).catch(() => []) : Promise.resolve([]),
  ]);
  const topicAt = new Map(topics.map((t) => [t.occurrenceAt, t]));
  const noteAt = new Map(notes.map((n) => [n.occurrenceAt, n]));
  const names = new Map<string, string>();
  const nameOf = async (userId: string | null) => {
    if (!userId) return null;
    if (!names.has(userId)) {
      const [u] = await db<{ display_name: string | null; email: string }[]>`SELECT display_name, email FROM users WHERE id = ${userId}`;
      names.set(userId, u?.display_name ?? u?.email.split("@")[0] ?? "A member");
    }
    return names.get(userId)!;
  };

  // Where "current" starts drives "next" when current has not recorded a stop.
  const currentStart = slots.current ? startBefore(slots.current.getTime(), stops, units) : null;

  async function view(slot: SessionSlot, at: Date | null): Promise<SessionView | null> {
    if (!at) return null;
    const iso = at.toISOString();
    const topic = topicAt.get(iso) ?? null;
    const note = noteAt.get(iso) ?? null;
    let start = startBefore(at.getTime(), stops, units);
    if (slot === "next" && currentStart && !(slots.current && noteAt.get(slots.current.toISOString())?.stopUnitId)) {
      const idx = currentStart.index + pace;
      start = idx < units.length ? { index: idx, position: 1 } : null;
    }
    const stopUnit = note?.stopUnitId ? units.find((u) => u.id === note.stopUnitId) ?? null : null;
    const [hostId, count, going, replies, threads] = await Promise.all([
      getRoleHolder(circle.id, at, "host").catch(() => null),
      topic ? countConfirmedRsvps(topic.id).catch(() => 0) : Promise.resolve(0),
      topic && viewer ? getRsvpStatus(topic.id, viewer.userId).catch(() => null) : Promise.resolve(null),
      topic ? listReplies(topic.id, { limit: 50, viewer: forumViewer ?? undefined }).catch(() => null) : Promise.resolve(null),
      topic
        ? db<Array<{ id: string; title: string; author: string | null; at: Date }>>`
            SELECT t.id, t.title, u.display_name AS author, COALESCE(t.published_at, t.created_at) AS at
            FROM thread_gathers g
            JOIN threads t ON t.id = g.target_thread_id
            LEFT JOIN users u ON u.id = t.author_id
            WHERE g.thread_id = ${topic.id} AND g.relation = 'gathers'
              AND t.org_id = ${ORG} AND t.status = 'published'
            ORDER BY at DESC LIMIT 20
          `.catch(() => [])
        : Promise.resolve([]),
    ]);
    return {
      slot,
      occurrenceAt: iso,
      number: topic?.number ?? circleOccurrenceNumber(meeting, at),
      topic: topic ? { id: topic.id, title: topic.title, href: `/${meta.feedSlug}/${topic.slug ?? topic.id}` } : null,
      documentUrl: topic?.documentUrl ?? null,
      host: hostId ? { userId: hostId, name: (await nameOf(hostId)) ?? "A member" } : null,
      rsvp: { count, going: going === "yes" },
      notes: note?.note ?? null,
      plan: note?.plan ?? null,
      startsAt: said(units, start),
      stoppedAt: stopUnit
        ? note?.stopPosition != null
          ? `${unitName(stopUnit)}, ${formatCirclePosition(note.stopPosition, stopUnit.lengthUnit)}`
          : unitName(stopUnit)
        : null,
      material: materialFrom(units, start, pace, slot === "previous" ? note?.stopUnitId ?? null : null),
      comments: (replies?.rows ?? []).map((r) => ({
        id: r.id,
        author: r.author.name,
        html: sanitizeRichText(r.contentHtml),
        at: new Date(r.createdAt).toISOString(),
      })),
      threads: threads.map((t) => ({ id: t.id, title: t.title, author: t.author, at: new Date(t.at).toISOString() })),
    };
  }

  const [previous, current, next] = await Promise.all([
    view("previous", slots.previous),
    view("current", slots.current),
    view("next", slots.next),
  ]);

  // ── Archive: every recorded sitting older than "previous" ──────────────
  const cutoff = slots.previous?.getTime() ?? slots.current?.getTime() ?? now;
  const archiveAt = new Set<string>([
    ...topics.map((t) => t.occurrenceAt),
    ...notes.filter((n) => n.stopUnitId || n.note).map((n) => n.occurrenceAt),
  ]);
  const archive = [...archiveAt]
    .filter((iso) => new Date(iso).getTime() < cutoff)
    .sort((a, b) => b.localeCompare(a))
    .map((iso) => {
      const t = topicAt.get(iso);
      const n = noteAt.get(iso);
      const u = n?.stopUnitId ? units.find((x) => x.id === n.stopUnitId) : undefined;
      return {
        occurrenceAt: iso,
        number: t?.number ?? circleOccurrenceNumber(meeting, new Date(iso)),
        href: t ? `/${meta.feedSlug}/${t.slug ?? t.id}` : null,
        stoppedAt: u ? (n?.stopPosition != null ? `${unitName(u)}, ${formatCirclePosition(n.stopPosition, u.lengthUnit)}` : unitName(u)) : null,
      };
    });

  // ── Recordings: one folder per sitting under Meeting Recordings ─────────
  const folders = meta.folder ? await listOrgFiles(ORG, `${meta.folder}/${CIRCLE_RECORDINGS}`).catch(() => []) : [];
  const recordings = await Promise.all(
    folders
      .filter((f) => f.isFolder)
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 6)
      .map(async (f) => ({
        folder: f.name,
        files: (await listOrgFiles(ORG, `${meta.folder}/${CIRCLE_RECORDINGS}/${f.name}`).catch(() => []))
          .filter((x) => !x.isFolder)
          // Under Private/Circles/: the viewer-admitting route, like the reading.
          .map((x) => ({ name: x.name, href: withBase(encodeMediaUrl(x.url.replace(/^\/api\/media\//, "/api/circle-file/"))), size: x.size })),
      }))
  );

  // ── Owners/guides: the next sittings to stage, and the plan in full ────
  let stage: CirclePageData["stage"] = [];
  let planUnits: CirclePageData["planUnits"] = [];
  if (canEdit) {
    const upcoming = circle.scheduledAt ? occurrencesOf(meeting, { from: new Date(now - CURRENT_GRACE_MS), count: 6 }) : [];
    stage = await Promise.all(
      upcoming.map(async (d) => {
        const iso = d.toISOString();
        const t = topicAt.get(iso);
        return {
          occurrenceAt: iso,
          number: t?.number ?? circleOccurrenceNumber(meeting, d),
          hostId: await getRoleHolder(circle.id, d, "host").catch(() => null),
          plan: noteAt.get(iso)?.plan ?? null,
          notes: noteAt.get(iso)?.note ?? null,
          staged: Boolean(t),
          hasDocument: Boolean(t?.documentUrl),
        };
      })
    );
    planUnits = units.map((u) => ({
      id: u.id,
      label: u.label,
      title: u.title,
      length: u.length,
      lengthUnit: u.lengthUnit,
      status: u.status,
      hasFile: Boolean(u.sourcePath),
    }));
  }

  const stopSittings = canEdit
    ? [previous, current]
        .filter((v): v is SessionView => Boolean(v) && new Date(v!.occurrenceAt).getTime() <= now + CURRENT_GRACE_MS)
        .reverse()
        .map((v) => ({ occurrenceAt: v.occurrenceAt, number: v.number, stoppedAt: v.stoppedAt }))
    : [];

  return {
    ...base,
    stage,
    stopSittings,
    planUnits,
    sessions: { previous, current, next },
    archive,
    recordings,
    hostCandidates: members
      .filter((m) => m.role !== "viewer")
      .map((m) => ({ userId: m.userId, name: m.displayName ?? m.email.split("@")[0] })),
  };
}
