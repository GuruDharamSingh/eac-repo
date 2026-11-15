// ============================================================================
// Series → the series planner's create (2026-11-14): the series kind's server side.
//
// A series is made here and edited in its planner (docs/open/STUDIO_FORMS_SPLIT_2026-11-14.md
// §7: series stays as series-site manages it). The input is the shape the planner's own
// "+ New series" takes (packages/series-site/src/routes/hubNewSeries.ts): a weekly rule
// (first date, time, every 1–4 weeks, an optional last date) or up to 60 chosen dates
// (recurrence_pattern CUSTOM). The host binds a server function that creates it the same way
// and returns the planner's address; the form then hands over to the planner. A series is
// never loaded back into this form.
// ============================================================================

import type { StudioResult } from '../../types';
import type { Answers, FormActions } from '../contract';
import { datePart, num, text, timeOf } from '../rules/answers';

/** What the host's create takes (hubNewSeries' body, typed). */
export interface SeriesCreateInputView {
  title: string;
  /** "Why": the series' line under its name (threads.excerpt, metadata.series.lede). */
  lede: string | null;
  timeZone: string;
  durationMinutes: number;
  /** Weekly: "YYYY-MM-DD", "HH:MM", every n weeks, the last date or null. */
  firstDate?: string;
  time?: string;
  intervalWeeks?: number;
  lastDate?: string | null;
  /** Chosen dates: local "YYYY-MM-DDTHH:MM" in `timeZone`, 1–60. Set, the weekly keys are ignored. */
  dates?: string[];
}

export interface SeriesCreateRecordView {
  id: string;
  title: string;
  status: string;
  /** Where the series is planned and edited (the site's /hub/series/<id>). */
  plannerHref: string | null;
  /** Its public page, when it has one. */
  href: string | null;
}

export interface SeriesCreateActions {
  context(orgId: string): Promise<{ canEdit: boolean; reason?: string | null; [key: string]: unknown }>;
  createSeries(orgId: string, input: SeriesCreateInputView): Promise<StudioResult<{ record: SeriesCreateRecordView; warnings?: string[] }>>;
}

export type SeriesMode = 'weekly' | 'dates';

export function seriesModeOf(a: Answers): SeriesMode {
  return a.series_mode === 'dates' ? 'dates' : 'weekly';
}

/** The chosen dates as typed: local "YYYY-MM-DDTHH:MM" strings, empty rows kept for the form. */
export function seriesDatesOf(a: Answers): string[] {
  return Array.isArray(a.series_dates) ? a.series_dates.map((d) => text(d)) : [];
}

/** Form answers → the create's input. */
export function seriesCreateInput(a: Answers, fallbackZone: string): SeriesCreateInputView {
  const base = {
    title: text(a.title).trim(),
    lede: text(a.excerpt).trim() || null,
    timeZone: text(a.time_zone) || fallbackZone,
    durationMinutes: num(a.duration_minutes) ?? 60,
  };
  if (seriesModeOf(a) === 'dates') {
    const dates = seriesDatesOf(a).filter((d) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d));
    return { ...base, dates };
  }
  const when = text(a.scheduled_at);
  return {
    ...base,
    firstDate: datePart(when),
    time: text(a.start_time) || timeOf(when),
    intervalWeeks: Math.max(1, Math.min(4, num(a.series_every_weeks) ?? 1)),
    lastDate: datePart(a.recurrence_until) || null,
  };
}

const PLANNER_NOTE = 'Hosts, session titles and the series page are set in its planner.';

/** The series kind's FormActions: create only; a saved series opens in its planner. */
export function seriesCreateActions(actions: SeriesCreateActions, opts: { timeZone?: string } = {}): FormActions<SeriesCreateRecordView> {
  return {
    context: (orgId) => actions.context(orgId),
    async save(orgId, answers, _intent, id) {
      if (id) return { ok: false, error: 'This series is made. Change it in its planner.' };
      const res = await actions.createSeries(orgId, seriesCreateInput(answers, opts.timeZone ?? 'UTC'));
      if (res.ok === false) return res;
      return { ok: true, value: { record: res.value.record, warnings: [...(res.value.warnings ?? []), PLANNER_NOTE] } };
    },
  };
}
