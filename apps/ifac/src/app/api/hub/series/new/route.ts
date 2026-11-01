import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import {
  SERIES_KIND,
  SeriesError,
  createThread,
  ensureOrgCalendar,
  getOrgCalendarUri,
  pushThreadToCalendar,
  saveSeriesSchedule,
  saveSeriesSettings,
  validTimeZone,
} from "@elkdonis/services";
import { wallClockToInstant } from "@elkdonis/cms-ui/compose";
import { getApiMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { DEFAULT_ALSO_ZONES } from "@/lib/series-time";

/**
 * Start a new series from the planner's "+ New series" tab.
 *
 * Organisers only (guide, owner), the same people who may publish a dated
 * thing from Compose. What it makes is what Compose › Meeting › Series makes
 * (`createSeries` in lib/cms/actions.ts): a `series` thread, its weekly
 * schedule, its settings and a calendar entry, so the planner opens on it at
 * once. The planner reads PUBLISHED series only, so the thread is published.
 *
 * It is created UNLISTED (`listed: false`, `landing: false`): it does not
 * appear on the public Series page or in the landing slides until an organiser
 * lists it in its own settings. Its weeks are all drafts until written and
 * published, so nothing is public beyond the empty series page. The series is
 * from the form's schedule; the planner's "+ New series" tab then applies the
 * rest of its form (about, cover, colour, listing, joining) to the new id
 * through `/api/hub/series`.
 *
 * POST { title, lede?, firstDate: "YYYY-MM-DD", time: "HH:MM", timeZone,
 *        weekday?: 0-6 (default: the first date's), intervalWeeks?: 1-4,
 *        lastDate?: "YYYY-MM-DD", alsoZones?: string[], durationMinutes? }
 *   → { ok, id, slug, href, warnings }
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const viewer = await getApiMember();
  if (!viewer?.canEdit) return NextResponse.json({ error: "Only organisers can start a series." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (title.length < 2) return NextResponse.json({ error: "Give the series a name." }, { status: 400 });
  const lede = typeof body.lede === "string" ? body.lede.trim().slice(0, 1000) || null : null;
  const zone = validTimeZone(typeof body.timeZone === "string" ? body.timeZone : null);
  if (!zone) return NextResponse.json({ error: "Pick a time zone from the list." }, { status: 400 });
  const firstDate = typeof body.firstDate === "string" ? body.firstDate : "";
  const time = typeof body.time === "string" ? body.time : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDate)) return NextResponse.json({ error: "Pick the date of the first session." }, { status: 400 });
  if (!/^\d{1,2}:\d{2}$/.test(time)) return NextResponse.json({ error: "Pick the time it starts." }, { status: 400 });
  const duration = Math.round(Number(body.durationMinutes ?? 60));
  if (!Number.isFinite(duration) || duration < 15 || duration > 600) {
    return NextResponse.json({ error: "A session lasts between 15 minutes and 10 hours." }, { status: 400 });
  }

  const hhmm = time.padStart(5, "0");
  const [y, m, d] = firstDate.split("-").map(Number);
  const dateWeekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const asked = body.weekday === undefined || body.weekday === null ? dateWeekday : Number(body.weekday);
  if (!Number.isInteger(asked) || asked < 0 || asked > 6) return NextResponse.json({ error: "Pick a day of the week." }, { status: 400 });
  const weekday = asked;
  // The first session is the first `weekday` on or after the date given, as
  // saveSeriesSchedule anchors it.
  const shifted = new Date(Date.UTC(y, m - 1, d + ((weekday - dateWeekday + 7) % 7))).toISOString().slice(0, 10);
  const first = wallClockToInstant(`${shifted}T${hhmm}`, zone);
  if (!first) return NextResponse.json({ error: "That date and time are not valid." }, { status: 400 });
  const intervalWeeks = Math.max(1, Math.min(4, Math.round(Number(body.intervalWeeks ?? 1)) || 1));
  const lastDate = typeof body.lastDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.lastDate) ? body.lastDate : null;
  if (lastDate && lastDate < shifted) return NextResponse.json({ error: "The last date is before the first session." }, { status: 400 });
  const alsoZones = Array.isArray(body.alsoZones)
    ? Array.from(new Set((body.alsoZones as unknown[]).map((z) => validTimeZone(typeof z === "string" ? z : null)).filter((z): z is string => Boolean(z)))).slice(0, 6)
    : DEFAULT_ALSO_ZONES;

  try {
    const thread = await createThread({
      kind: SERIES_KIND,
      orgId: siteConfig.orgId,
      authorId: viewer.userId,
      title,
      excerpt: lede ?? undefined,
      status: "published",
      visibility: "PUBLIC",
      section: null,
      scheduledAt: first.toISOString(),
      durationMinutes: duration,
      format: "online",
      isRsvpEnabled: true,
      metadata: {
        timeZone: zone,
        series: { lede, alsoZones, reminderDays: 2, listed: false, landing: false },
        joinDetails: { url: null, meetingId: null, passcode: null, other: null },
      },
    });
    await db`
      UPDATE threads SET recurrence_pattern = 'WEEKLY'
      WHERE id = ${thread.id} AND org_id = ${siteConfig.orgId}
    `;

    const warnings: string[] = [];
    try {
      await saveSeriesSchedule({
        orgId: siteConfig.orgId,
        threadId: thread.id,
        schedule: { weekday, time: hhmm, timeZone: zone, firstDate, lastDate, durationMinutes: duration, alsoZones, intervalWeeks },
      });
    } catch (err) {
      console.error("[ifac] new series: saveSeriesSchedule:", err);
      warnings.push(
        err instanceof SeriesError
          ? `Its schedule was not confirmed: ${err.message} Check it in the planner.`
          : "Its schedule was not confirmed. Check it in the planner."
      );
    }
    try {
      await saveSeriesSettings({ orgId: siteConfig.orgId, threadId: thread.id, lede, listed: false, landing: false, reminderDays: 2 });
    } catch (err) {
      console.error("[ifac] new series: saveSeriesSettings:", err);
      warnings.push("Its description was not saved. Set it in the planner.");
    }
    // Best effort, as Compose does: the org calendar carries the series.
    try {
      if (!(await getOrgCalendarUri(siteConfig.orgId))) await ensureOrgCalendar(siteConfig.orgId);
      await pushThreadToCalendar(siteConfig.orgId, thread.id);
    } catch (err) {
      console.error("[ifac] new series: calendar mirror:", err);
    }

    return NextResponse.json({ ok: true, id: thread.id, slug: thread.slug, href: `/hub/series/${thread.id}`, warnings });
  } catch (err) {
    console.error("[ifac] new series:", err);
    return NextResponse.json({ error: "Could not start the series." }, { status: 500 });
  }
}
