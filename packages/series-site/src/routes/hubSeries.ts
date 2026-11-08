import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import {
  SeriesError,
  assignSeriesRole,
  cancelSeriesSession,
  clearSeriesRole,
  ensureSeriesTalkRoom,
  getMeetingSeries,
  getRoleHolder,
  listRotaCandidates,
  moveSeriesSession,
  publishSeriesSession,
  restoreSeriesSession,
  saveSeriesSchedule,
  saveSeriesSession,
  saveSeriesSettings,
  saveSeriesPageSettings,
  getSeriesPageSettings,
  SERIES_ACCENTS,
  coverFrameOf,
  type SeriesCoverMedia,
  type SeriesScheduleInput,
} from "@elkdonis/services";
import { sanitizeRichText } from "@elkdonis/utils";
import { DEFAULT_SERIES_ZONE } from "../lib/series-time";
import { createSeriesMail } from "../lib/series-mail";
import { readerOf } from "../lib/series";
import type { SeriesSite } from "../config";
import { apiMember } from "../config";

export function hubSeriesRoutes(site: SeriesSite) {
  const { sendHostAssignedEmail } = createSeriesMail(site);

/**
 * The Series planner's endpoint: the weeks of a recurring gathering with
 * each week's host, title, write-up and materials, and the series' own
 * settings.
 *
 * Who may do what (2026-10-10):
 *   - members (member, guide, owner) read;
 *   - organisers (guide, owner) change the series settings and schedule,
 *     and assign hosts and co-hosts; only members of the org can be assigned
 *     (`assignSeriesRole`), and the assignee is emailed a link to the week;
 *   - an organiser, or that week's host or co-host, writes the week and
 *     publishes or unpublishes it; a host or co-host may step down;
 *   - organisers cancel or restore a week (`cancel: true|false`) and move it
 *     (`moveTo`: "YYYY-MM-DDTHH:MM" in the series' zone, or an ISO instant).
 *     Nobody is emailed about either (2026-10-10, migration 203).
 * Week fields (2026-10-13, migration 205): `subtitle`, `bodyHtml` (rich
 * write-up; the service sanitises it and derives `summary`), `coverFrame`
 * ({fx, fy, zoom}). Series settings add `cover` (picture, video or
 * YouTube/Vimeo link) and `bodyHtml` ("About the series", `threads.body`).
 * Every write is scoped to this org in the service, which 404s a thread of
 * another org.
 */

const TALK_BASE = (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "");

function fail(e: unknown) {
  if (e instanceof SeriesError) return NextResponse.json({ error: e.message }, { status: e.status });
  return NextResponse.json({ error: (e as Error).message ?? "Something went wrong." }, { status: 400 });
}

async function GET(request: NextRequest) {
  const viewer = await apiMember(site);
  if (!viewer) return NextResponse.json({ error: "Members only" }, { status: 403 });
  const threadId = request.nextUrl.searchParams.get("threadId");
  if (!threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });

  const [series, candidates, page] = await Promise.all([
    getMeetingSeries(site.orgId, { threadId }, { count: 10, pastCount: 1, viewer: await readerOf(site) }),
    listRotaCandidates(site.orgId),
    getSeriesPageSettings(site.orgId).catch(() => null),
  ]);
  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const talkUrl = series.talkToken && TALK_BASE ? `${TALK_BASE}/call/${series.talkToken}` : null;
  return NextResponse.json({
    id: series.id,
    slug: series.slug,
    title: series.title,
    timeZone: series.timeZone,
    href: `/series/${series.slug}`,
    // Series-level settings. The joining instructions and the schedule form
    // go only to organisers, who edit them; other members get the link by
    // saying they are coming, like everyone.
    settings: {
      title: series.title,
      lede: series.presentation.lede ?? null,
      excerpt: series.excerpt,
      // The card and the top of the series page (2026-10-13).
      cover: series.cover,
      bodyHtml: series.body ? sanitizeRichText(series.body) : null,
      // Where the series shows (2026-10-18): its colour, listed on /series
      // and in the landing slides, featured (first on both).
      accent: (series.presentation as { accent?: string | null }).accent ?? null,
      listed: (series.presentation as { listed?: boolean | null }).listed !== false,
      landing: ((p) => (typeof p.landing === "boolean" ? p.landing : p.listed !== false))(series.presentation as { listed?: boolean | null; landing?: boolean | null }),
      featured: page?.featuredId === series.id,
      accents: SERIES_ACCENTS.map((a) => ({ id: a.id, label: a.label, color: a.mark, text: a.text })),
      // How the card reads (2026-10-18): its own rhythm line, the status label.
      rhythm: (series.presentation as { rhythm?: string | null }).rhythm ?? null,
      statusChip: (series.presentation as { statusChip?: string | null }).statusChip === "hide" ? "hide" : "auto",
      recurrencePattern: series.recurrencePattern,
      ...(viewer.canEdit
        ? {
            joinMode: series.joinDetails.url ? "link" : series.talkToken ? "talk" : "link",
            joinUrl: series.joinDetails.url ?? null,
            meetingId: series.joinDetails.meetingId ?? null,
            passcode: series.joinDetails.passcode ?? null,
            otherWaysToJoin: series.joinDetails.other ?? null,
            talkUrl,
            reminderDays: series.reminderDays,
            // Read in the series' own zone (UTC when it names none). The
            // display zones default to the ones the public pages print.
            schedule: series.schedule
              ? { ...series.schedule, alsoZones: series.schedule.alsoZones ?? site.alsoZones }
              : null,
            defaultTimeZone: DEFAULT_SERIES_ZONE,
          }
        : {}),
    },
    weeks: series.sessions.map((s) => ({
      at: s.at,
      number: s.number,
      isPast: s.isPast,
      isNext: s.isNext,
      title: s.title,
      subtitle: s.subtitle,
      summary: s.summary,
      bodyHtml: s.bodyHtml,
      coverImageUrl: s.coverImageUrl,
      coverFrame: s.coverFrame,
      coverKind: s.coverKind,
      coverPosterUrl: s.coverPosterUrl,
      materials: s.materials,
      host: s.host ? { userId: s.host.userId, displayName: s.host.displayName } : null,
      coHost: s.coHost ? { userId: s.coHost.userId, displayName: s.coHost.displayName } : null,
      rsvpCount: s.rsvpCount,
      isPublished: s.isPublished,
      publishedAt: s.publishedAt,
      slotAt: s.slotAt,
      isCancelled: s.isCancelled,
      isMoved: s.isMoved,
      isOffSchedule: s.isOffSchedule,
      href: `/series/${series.slug}/${s.number}`,
    })),
    candidates,
    canPlan: viewer.canEdit,
    viewerId: viewer.userId,
  });
}

async function POST(request: NextRequest) {
  const viewer = await apiMember(site);
  if (!viewer) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    threadId?: string;
    occurrenceAt?: string;
    role?: string;
    userId?: string | null;
    title?: string | null;
    subtitle?: string | null;
    summary?: string | null;
    bodyHtml?: string | null;
    coverImageUrl?: string | null;
    coverFrame?: unknown;
    coverKind?: string | null;
    coverPosterUrl?: string | null;
    materials?: unknown;
    publish?: boolean;
    cancel?: boolean;
    moveTo?: string;
    createTalkRoom?: boolean;
    schedule?: Partial<SeriesScheduleInput>;
    dryRun?: boolean;
    settings?: {
      title?: string | null;
      lede?: string | null;
      joinMode?: "link" | "talk";
      joinUrl?: string | null;
      meetingId?: string | null;
      passcode?: string | null;
      otherWaysToJoin?: string | null;
      reminderDays?: number | null;
      cover?: unknown;
      bodyHtml?: string | null;
      accent?: string | null;
      listed?: boolean;
      landing?: boolean;
      featured?: boolean;
      rhythm?: string | null;
      statusChip?: "auto" | "hide";
    };
  };
  if (!body.threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });
  const threadId = body.threadId;
  const organiserOnly = (what: string) =>
    NextResponse.json({ error: `Only an organiser can ${what}.` }, { status: 403 });

  // A Talk room for the series, made on demand.
  if (body.createTalkRoom) {
    if (!viewer.canEdit) return organiserOnly("make the series' Talk room");
    try {
      const room = await ensureSeriesTalkRoom({ orgId: site.orgId, threadId, actorUserId: viewer.userId });
      return NextResponse.json({ ok: true, created: room.created, talkUrl: TALK_BASE ? `${TALK_BASE}/call/${room.token}` : null });
    } catch (e) {
      return fail(e);
    }
  }

  // When the series meets. `dryRun` reports which planned weeks would move.
  if (body.schedule !== undefined) {
    if (!viewer.canEdit) return organiserOnly("change when the series meets");
    const s = body.schedule ?? {};
    try {
      const result = await saveSeriesSchedule({
        orgId: site.orgId,
        threadId,
        dryRun: Boolean(body.dryRun),
        schedule: {
          weekday: Number(s.weekday),
          time: String(s.time ?? ""),
          timeZone: String(s.timeZone ?? ""),
          firstDate: String(s.firstDate ?? ""),
          lastDate: typeof s.lastDate === "string" && s.lastDate ? s.lastDate : null,
          durationMinutes: typeof s.durationMinutes === "number" ? s.durationMinutes : null,
          alsoZones: Array.isArray(s.alsoZones) ? s.alsoZones.map(String) : null,
          intervalWeeks: typeof s.intervalWeeks === "number" ? s.intervalWeeks : null,
          monthly: typeof s.monthly === "boolean" ? s.monthly : null,
        },
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      return fail(e);
    }
  }

  // Series-level settings (name, lede, joining, subscriber reminders): organisers only.
  if (body.settings !== undefined) {
    if (!viewer.canEdit) return organiserOnly("change the series settings");
    const s = body.settings ?? {};
    const str = (v: unknown) => (v === undefined ? undefined : typeof v === "string" ? v : null);
    const talk = s.joinMode === "talk";
    try {
      if (talk) await ensureSeriesTalkRoom({ orgId: site.orgId, threadId, actorUserId: viewer.userId });
      await saveSeriesSettings({
        orgId: site.orgId,
        threadId,
        title: str(s.title),
        lede: str(s.lede),
        // Joining by Talk: the pasted link and its meeting ID and passcode are
        // cleared, so `seriesJoinUrl` falls through to the room.
        joinUrl: talk ? null : str(s.joinUrl),
        meetingId: talk ? null : str(s.meetingId),
        passcode: talk ? null : str(s.passcode),
        otherWaysToJoin: str(s.otherWaysToJoin),
        reminderDays: typeof s.reminderDays === "number" ? s.reminderDays : undefined,
        cover: s.cover === undefined ? undefined : s.cover === null ? null : (s.cover as SeriesCoverMedia),
        bodyHtml: str(s.bodyHtml),
        accent: s.accent === undefined ? undefined : typeof s.accent === "string" ? s.accent : null,
        listed: typeof s.listed === "boolean" ? s.listed : undefined,
        landing: typeof s.landing === "boolean" ? s.landing : undefined,
        rhythm: s.rhythm === undefined ? undefined : typeof s.rhythm === "string" ? s.rhythm : null,
        statusChip: s.statusChip === "hide" || s.statusChip === "auto" ? s.statusChip : undefined,
      });
      if (typeof s.featured === "boolean") {
        const page = await getSeriesPageSettings(site.orgId);
        if (s.featured && page.featuredId !== threadId) await saveSeriesPageSettings({ orgId: site.orgId, featuredId: threadId });
        if (!s.featured && page.featuredId === threadId) await saveSeriesPageSettings({ orgId: site.orgId, featuredId: null });
      }
    } catch (e) {
      return fail(e);
    }
    return NextResponse.json({ ok: true });
  }

  const { occurrenceAt } = body;
  if (!occurrenceAt) return NextResponse.json({ error: "occurrenceAt required" }, { status: 400 });
  if (Number.isNaN(new Date(occurrenceAt).getTime()))
    return NextResponse.json({ error: "Bad occurrenceAt" }, { status: 400 });

  // Cancel / restore and move a week: organisers only.
  if (typeof body.cancel === "boolean") {
    if (!viewer.canEdit) return organiserOnly(body.cancel ? "cancel a week" : "restore a week");
    try {
      const week = body.cancel
        ? await cancelSeriesSession({ orgId: site.orgId, threadId, occurrenceAt, actorUserId: viewer.userId })
        : await restoreSeriesSession({ orgId: site.orgId, threadId, occurrenceAt });
      return NextResponse.json({ ok: true, status: week.status, at: week.startsAt });
    } catch (e) {
      return fail(e);
    }
  }
  if (typeof body.moveTo === "string") {
    if (!viewer.canEdit) return organiserOnly("move a week");
    try {
      const week = await moveSeriesSession({ orgId: site.orgId, threadId, occurrenceAt, to: body.moveTo, actorUserId: viewer.userId });
      return NextResponse.json({ ok: true, at: week.startsAt, slotAt: week.slotAt, number: week.number });
    } catch (e) {
      return fail(e);
    }
  }

  const isHostOrEditor = async () => {
    if (viewer.canEdit) return true;
    const [host, coHost] = await Promise.all([
      getRoleHolder(threadId, occurrenceAt, "host"),
      getRoleHolder(threadId, occurrenceAt, "co-host"),
    ]);
    return host === viewer.userId || coHost === viewer.userId;
  };

  // A role change: `role` present, no week fields.
  if (body.role !== undefined) {
    const role = body.role === "co-host" ? "co-host" : "host";
    if (body.userId) {
      if (!viewer.canEdit) return organiserOnly("assign a host");
      const userId = body.userId;
      try {
        const { changed } = await assignSeriesRole({
          orgId: site.orgId,
          threadId,
          occurrenceAt,
          role,
          userId,
          actorUserId: viewer.userId,
        });
        if (changed && userId !== viewer.userId) void mailAssignee(threadId, occurrenceAt, role, userId);
      } catch (e) {
        return fail(e);
      }
      return NextResponse.json({ ok: true });
    }
    if (!viewer.canEdit) {
      const holder = await getRoleHolder(threadId, occurrenceAt, role);
      if (holder !== viewer.userId)
        return NextResponse.json({ error: "Only an organiser can clear somebody else's spot." }, { status: 403 });
    }
    try {
      await clearSeriesRole({ orgId: site.orgId, threadId, occurrenceAt, role });
    } catch (e) {
      return fail(e);
    }
    return NextResponse.json({ ok: true });
  }

  if (!(await isHostOrEditor()))
    return NextResponse.json({ error: "Only an organiser, or that week's host, can write the week." }, { status: 403 });

  // Publish or unpublish the week (it needs a title to publish).
  if (typeof body.publish === "boolean") {
    try {
      const result = await publishSeriesSession({
        orgId: site.orgId,
        threadId,
        occurrenceAt,
        published: body.publish,
        actorUserId: viewer.userId,
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      return fail(e);
    }
  }

  try {
    await saveSeriesSession({
      orgId: site.orgId,
      threadId,
      occurrenceAt,
      title: body.title,
      subtitle: body.subtitle,
      // A rich write-up rewrites the plain summary; the plain field is
      // honoured only from a client that sends no rich text.
      summary: body.bodyHtml !== undefined ? undefined : body.summary,
      bodyHtml: body.bodyHtml,
      coverImageUrl: body.coverImageUrl,
      coverFrame: body.coverFrame === undefined ? undefined : coverFrameOf(body.coverFrame),
      coverKind: body.coverKind === "video" || body.coverKind === "embed" ? body.coverKind : body.coverKind === undefined ? undefined : "image",
      coverPosterUrl: body.coverPosterUrl,
      materials: Array.isArray(body.materials) ? (body.materials as never) : undefined,
      actorUserId: viewer.userId,
    });
  } catch (e) {
    return fail(e);
  }
  return NextResponse.json({ ok: true });
}

/** Detached: a failed letter reaches the log and the email ledger, not the response. */
async function mailAssignee(threadId: string, occurrenceAt: string, role: "host" | "co-host", userId: string) {
  try {
    const [series, [person]] = await Promise.all([
      getMeetingSeries(site.orgId, { threadId }, { count: 24, pastCount: 0, viewer: "internal" }),
      db<Array<{ email: string | null; display_name: string | null }>>`SELECT email, display_name FROM users WHERE id = ${userId}`,
    ]);
    const at = new Date(occurrenceAt).toISOString();
    const week = series?.sessions.find((s) => s.at === at);
    if (!series || !week || !person?.email) return;
    await sendHostAssignedEmail({
      series,
      week,
      role,
      to: { email: person.email, name: person.display_name?.trim() || person.email.split("@")[0] },
    });
  } catch (err) {
    console.error("[series] host assignment email failed:", err);
  }
}

  return { GET, POST };
}
