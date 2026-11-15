import { db } from '@elkdonis/db';
import { createThread } from './posts';
import { ensureOrgCalendar, getOrgCalendarUri, pushThreadToCalendar } from './org-calendar';
import { SERIES_KIND } from './thread-kinds';
import {
  SERIES_CUSTOM_PATTERN,
  SeriesError,
  addSeriesSession,
  saveSeriesSchedule,
  saveSeriesSettings,
  seriesLocalToInstant,
  validTimeZone,
} from './meeting-series';

// ============================================================================
// Start a series (2026-11-14): the create behind the planner's "+ New series" (series-site
// hubNewSeries) and the shared series form's create (apps' `lib/forms/series-actions.ts`).
// Moved out of hubNewSeries unchanged in behaviour: a published, UNLISTED `series` thread, its
// weekly schedule or its chosen dates (recurrence_pattern CUSTOM), its settings, and a calendar
// mirror. The caller checks that the viewer may organise the org; `viewerId` becomes the author.
// ============================================================================

export interface CreateSiteSeriesInput {
  title: string;
  lede?: string | null;
  timeZone: string;
  durationMinutes?: number;
  /** Weekly: "YYYY-MM-DD" and "HH:MM". Ignored when `dates` is an array. */
  firstDate?: string;
  time?: string;
  /** 0-6; default the first date's weekday. */
  weekday?: number | null;
  /** 1-4, default 1. */
  intervalWeeks?: number;
  monthly?: boolean;
  lastDate?: string | null;
  /** Chosen dates: local "YYYY-MM-DDTHH:MM" in `timeZone`, 1-60. Set, the weekly keys are ignored. */
  dates?: string[];
  /** Extra zones its times print in; default `defaultAlsoZones`. */
  alsoZones?: string[] | null;
}

export type CreateSiteSeriesResult =
  | { ok: true; value: { id: string; slug: string; warnings: string[] } }
  | { ok: false; error: string; status: 400 | 500 };

const bad = (error: string): CreateSiteSeriesResult => ({ ok: false, error, status: 400 });

export async function createSiteSeries(
  viewerId: string,
  orgId: string,
  input: CreateSiteSeriesInput,
  defaultAlsoZones: string[] = []
): Promise<CreateSiteSeriesResult> {
  const title = (input.title ?? '').trim().slice(0, 200);
  if (title.length < 2) return bad('Give the series a name.');
  const lede = typeof input.lede === 'string' ? input.lede.trim().slice(0, 1000) || null : null;
  const zone = validTimeZone(input.timeZone);
  if (!zone) return bad('Pick a time zone from the list.');
  const custom = Array.isArray(input.dates);
  const firstDate = typeof input.firstDate === 'string' ? input.firstDate : '';
  const time = typeof input.time === 'string' ? input.time : '';
  if (!custom && !/^\d{4}-\d{2}-\d{2}$/.test(firstDate)) return bad('Pick the date of the first session.');
  if (!custom && !/^\d{1,2}:\d{2}$/.test(time)) return bad('Pick the time it starts.');
  const duration = Math.round(Number(input.durationMinutes ?? 60));
  if (!Number.isFinite(duration) || duration < 15 || duration > 600) return bad('A session lasts between 15 minutes and 10 hours.');

  // Chosen dates: each is a local "YYYY-MM-DDTHH:MM" in the series' zone.
  const customDates: Date[] = [];
  if (custom) {
    for (const raw of input.dates as unknown[]) {
      const at = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw.trim()) ? seriesLocalToInstant(raw.trim(), zone) : null;
      if (!at) return bad('One of the dates is not a date and time.');
      if (!customDates.some((x) => x.getTime() === at.getTime())) customDates.push(at);
    }
    if (customDates.length < 1) return bad('Add at least one date.');
    if (customDates.length > 60) return bad('A series can start with up to 60 dates. Add the rest in the planner.');
    customDates.sort((x, y) => x.getTime() - y.getTime());
  }

  const hhmm = time.padStart(5, '0');
  const [y, m, d] = firstDate.split('-').map(Number);
  const dateWeekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const asked = input.weekday === undefined || input.weekday === null ? dateWeekday : Number(input.weekday);
  if (!custom && (!Number.isInteger(asked) || asked < 0 || asked > 6)) return bad('Pick a day of the week.');
  const weekday = asked;
  // The first session is the first `weekday` on or after the date given, as saveSeriesSchedule anchors it.
  const shifted = custom ? '' : new Date(Date.UTC(y, m - 1, d + ((weekday - dateWeekday + 7) % 7))).toISOString().slice(0, 10);
  const first = custom ? customDates[0] : seriesLocalToInstant(`${shifted}T${hhmm}`, zone);
  if (!first) return bad('That date and time are not valid.');
  const intervalWeeks = Math.max(1, Math.min(4, Math.round(Number(input.intervalWeeks ?? 1)) || 1));
  const lastDate = !custom && typeof input.lastDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.lastDate) ? input.lastDate : null;
  if (lastDate && lastDate < shifted) return bad('The last date is before the first session.');
  const alsoZones = Array.isArray(input.alsoZones)
    ? Array.from(new Set(input.alsoZones.map((z) => validTimeZone(typeof z === 'string' ? z : null)).filter((z): z is string => Boolean(z)))).slice(0, 6)
    : defaultAlsoZones;

  try {
    const thread = await createThread({
      kind: SERIES_KIND,
      orgId,
      authorId: viewerId,
      title,
      excerpt: lede ?? undefined,
      status: 'published',
      visibility: 'PUBLIC',
      section: null,
      scheduledAt: first.toISOString(),
      durationMinutes: duration,
      format: 'online',
      isRsvpEnabled: true,
      metadata: {
        timeZone: zone,
        series: { lede, alsoZones, reminderDays: 2, listed: false, landing: false },
        joinDetails: { url: null, meetingId: null, passcode: null, other: null },
      },
    });
    await db`
      UPDATE threads SET recurrence_pattern = ${custom ? SERIES_CUSTOM_PATTERN : input.monthly === true ? 'MONTHLY' : 'WEEKLY'}
      WHERE id = ${thread.id} AND org_id = ${orgId}
    `;

    const warnings: string[] = [];
    try {
      if (custom) {
        // Earliest first, so the week numbers follow the dates as given.
        for (const at of customDates) {
          await addSeriesSession({ orgId, threadId: thread.id, startsAt: at.toISOString(), actorUserId: viewerId });
        }
      } else {
        await saveSeriesSchedule({
          orgId,
          threadId: thread.id,
          schedule: { weekday, time: hhmm, timeZone: zone, firstDate, lastDate, durationMinutes: duration, alsoZones, intervalWeeks },
        });
      }
    } catch (err) {
      console.error('[series] new series: schedule:', err);
      warnings.push(
        err instanceof SeriesError
          ? `Its ${custom ? 'dates were' : 'schedule was'} not confirmed: ${err.message} Check it in the planner.`
          : `Its ${custom ? 'dates were' : 'schedule was'} not confirmed. Check it in the planner.`
      );
    }
    try {
      await saveSeriesSettings({ orgId, threadId: thread.id, lede, listed: false, landing: false, reminderDays: 2 });
    } catch (err) {
      console.error('[series] new series: saveSeriesSettings:', err);
      warnings.push('Its description was not saved. Set it in the planner.');
    }
    // Best effort, as Compose does: the org calendar carries the series.
    try {
      if (!(await getOrgCalendarUri(orgId))) await ensureOrgCalendar(orgId);
      await pushThreadToCalendar(orgId, thread.id);
    } catch (err) {
      console.error('[series] new series: calendar mirror:', err);
    }
    return { ok: true, value: { id: thread.id, slug: thread.slug, warnings } };
  } catch (err) {
    console.error('[series] new series:', err);
    return { ok: false, error: 'Could not start the series.', status: 500 };
  }
}
