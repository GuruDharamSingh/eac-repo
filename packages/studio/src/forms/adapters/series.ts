// ============================================================================
// Series in place → services' createSeriesFromForm (pass 2, Ligament).
// PLAN §12. The gathering kind's answers with Repeats WEEKLY and
// forms.repeat_as_series (rules/answers.ts isSeries) are a NEW series.
//
// The answers are the gathering's own (meeting/convert.ts keys, resolved by
// resolveGatheringAnswers for where_mode / start_time), plus the series keys
// read through soft tissue's rules/series.ts, never raw:
//
//   forms.repeat_every_weeks  seriesEveryWeeks → schedule.intervalWeeks
//   forms.repeat_count        seriesEnds 'count': the last listed date is the last session
//   recurrence_until          seriesEnds 'until': its date; 'open': no last date
//   forms.sessions            seriesSessions: only dates on the rule, title / note / skip
//   forms.series_page         seriesPageOf → { listed, slides, featured }
//
// What a series can't keep is dropped with a warning (PLAN §3): minimum
// attendance and its notice, the RSVP deadline, hosts (per week, in the
// planner), the reminder (a series mails subscribers N days before), the
// recording link, the document, RSVPs off, and any other forms.* key.
// Members-only is refused: the series pages never check visibility.
//
// Saves: no autosave (a series draft is saved on Save draft or Publish). A
// save with an id REBUILDS the draft (the server archives it and makes a fresh
// one; the record's id changes). An id that is a published series is refused
// with "change it in its planner". A publish that stopped part-way comes back
// ok with the draft and a fieldError, so the form keeps the draft's id.
//
// Also here: gatheringOrSeriesActions, the router a host registers for the
// gathering kind, so the form switches adapter on isSeries(answers).
// ============================================================================

import { emptyContentAnswers } from '@elkdonis/cms-ui/compose';
import type { StudioResult } from '../../types';
import type { MeetingContextView, MeetingRecordView } from '../../meeting/types';
import { fieldContext, formZone, optNum, optStr } from '../../meeting/convert';
import type { Answers, FormActions } from '../contract';
import { datePart, isSeries, num, repeatPattern, text, timeOf } from '../rules/answers';
import { seriesEnds, seriesEveryWeeks, seriesPageOf, seriesSessions } from '../rules/series';
import { resolveGatheringAnswers, whereModeOf } from './gathering';

// ── the host's side (structurally services' series-form.ts types) ────────────

export type SeriesWhereModeView = 'place' | 'link' | 'talk';

export interface SeriesSessionView {
  date: string;
  title?: string | null;
  note?: string | null;
  skipped?: boolean;
  reason?: string | null;
}

export interface SeriesPageView {
  listed: boolean;
  slides: boolean;
  featured: boolean;
}

export interface SeriesFormInputView {
  intent: 'draft' | 'published';
  /** The draft this form saved before; the server rebuilds it. */
  replaces?: string | null;
  title: string;
  excerpt?: string | null;
  bodyHtml?: string | null;
  coverImageUrl?: string | null;
  schedule: {
    firstDate: string;
    time: string;
    timeZone: string;
    lastDate: string | null;
    durationMinutes: number | null;
    intervalWeeks: number;
  };
  where: { mode: SeriesWhereModeView; location?: string | null; joinUrl?: string | null };
  attendeeLimit?: number | null;
  section?: string | null;
  shareToNetwork?: boolean;
  sessions: SeriesSessionView[];
  page: SeriesPageView;
  repeatCount?: number | null;
}

export interface SeriesRecordView {
  id: string;
  orgId: string;
  kind: 'series';
  isSeries: true;
  slug: string;
  title: string;
  status: 'draft' | 'pending' | 'published' | 'archived';
  authorId: string;
  scheduledAt: string | null;
  recurrenceUntil: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set for a draft this form made; null = the series is edited in its planner. */
  input: SeriesFormInputView | null;
  /** The public page, when the host knows it. */
  href?: string | null;
}

export type SeriesPublishStepView = 'publish' | 'schedule' | 'sessions' | 'go-live';

export interface SeriesActions {
  /** The same gate and field context as a new meeting (owner or guide). */
  context(orgId: string): Promise<MeetingContextView>;
  loadSeries(id: string): Promise<SeriesRecordView | null>;
  saveSeries(
    orgId: string,
    input: SeriesFormInputView
  ): Promise<
    StudioResult<{
      record: SeriesRecordView;
      warnings: string[];
      /** Publish was asked and did not happen; the record is the draft. */
      notPublished: { step: SeriesPublishStepView; message: string } | null;
    }>
  >;
}

// ── answers ⇄ input ──────────────────────────────────────────────────────────

/** forms.* keys this adapter turns into the save; any other forms.* key is reported as not saved. */
const SERIES_FORM_KEYS = [
  'forms.repeat_as_series',
  'forms.repeat_every_weeks',
  'forms.repeat_count',
  'forms.repeat_ends',
  'forms.sessions',
  'forms.series_page',
  'forms.loaded_start',
];

/** Where a stopped publish is shown: the field its step is about. */
const STEP_FIELD: Record<SeriesPublishStepView, string> = {
  publish: 'title',
  schedule: 'scheduled_at',
  sessions: 'forms.sessions',
  'go-live': 'title',
};

/** Gathering answers a series does not keep, with the words for the warning. */
function droppedMeetingFields(a: Answers): string[] {
  const out: string[] = [];
  if ((num(a.min_attendees) ?? 0) > 0) out.push('the minimum number of people');
  if (a.notify_on_min_attendees === true) out.push('the notice when the minimum is reached');
  if (text(a.rsvp_deadline).trim()) out.push('the RSVP deadline');
  if (text(a.host_user_id).trim() || text(a.co_host_user_id).trim()) out.push('the hosts (a series sets them per week, in its planner)');
  if (num(a.reminder_minutes_before) !== null) out.push('the reminder (a series mails its subscribers before each published week)');
  if (text(a.video_link).trim()) out.push('the recording link (recordings go on each week)');
  if (a.create_document === true) out.push('the shared document');
  if (a.is_rsvp_enabled === false) out.push('RSVPs off (every week of a series takes RSVPs)');
  return out;
}

/** The form's answers → services' input, or the reason it cannot be saved as a series. */
export function seriesInputFromAnswers(
  a: Answers,
  intent: 'draft' | 'published',
  replaces: string | null
): { ok: true; input: SeriesFormInputView; warnings: string[] } | { ok: false; error: string } {
  if (!isSeries(a)) return { ok: false, error: 'This gathering is not presented as a series.' };
  if (repeatPattern(a) !== 'WEEKLY') return { ok: false, error: 'A series meets every 1 to 4 weeks: set Repeats to weekly.' };
  const visibility = text(a.visibility).trim();
  if (visibility && visibility !== 'PUBLIC') {
    return { ok: false, error: 'A series is public for now: members-only series are not supported yet.' };
  }

  const { answers: r } = resolveGatheringAnswers(a);
  const zone = formZone(r);
  const firstDate = datePart(r.scheduled_at);
  if (!firstDate) return { ok: false, error: 'Pick the date of the first session.' };
  const time = timeOf(r.scheduled_at);
  if (!time) return { ok: false, error: 'Pick the time the sessions start.' };

  const rows = seriesSessions(a, { timeZone: zone });
  const ends = seriesEnds(a);
  const lastDate = ends === 'count' ? (rows[rows.length - 1]?.date ?? null) : ends === 'until' ? datePart(a.recurrence_until) || null : null;
  const count = ends === 'count' ? num(a['forms.repeat_count']) : null;

  const mode = whereModeOf(a);
  const input: SeriesFormInputView = {
    intent,
    replaces,
    title: text(r.title).trim(),
    excerpt: optStr(r.excerpt),
    bodyHtml: optStr(r.body),
    coverImageUrl: optStr(r.cover_image_url),
    schedule: {
      firstDate,
      time,
      timeZone: zone,
      lastDate,
      durationMinutes: optNum(r.duration_minutes) ?? 60,
      intervalWeeks: seriesEveryWeeks(a),
    },
    where: {
      mode,
      location: mode === 'place' ? optStr(r.location) : null,
      joinUrl: mode === 'talk' ? null : optStr(r.meeting_url),
    },
    attendeeLimit: optNum(r.attendee_limit),
    section: optStr(r.feed_slug),
    shareToNetwork: r.share_to_network === true,
    // Only what was typed: an untouched week is the rule's own. Open-ended: only the listed preview.
    sessions: rows
      .filter((s) => s.title.trim() || s.note.trim() || s.skipped || s.reason.trim())
      .map((s) => ({ date: s.date, title: s.title.trim() || null, note: s.note.trim() || null, skipped: s.skipped, reason: s.reason.trim() || null })),
    page: seriesPageOf(a),
    repeatCount: count !== null && Number.isInteger(count) && count > 0 ? count : null,
  };

  const warnings: string[] = [];
  const dropped = droppedMeetingFields(r);
  if (dropped.length) warnings.push(`A series does not keep ${dropped.join(', ')}, so ${dropped.length === 1 ? 'it was' : 'they were'} not saved.`);
  const otherForms = Object.keys(a).filter((k) => (k === 'forms' || k.startsWith('forms.')) && !SERIES_FORM_KEYS.includes(k) && a[k] !== undefined);
  if (otherForms.length) warnings.push('Some choices are kept in this form but not saved yet: ' + otherForms.join(', ') + '.');
  return { ok: true, input, warnings };
}

/** A draft this form made → the gathering answers the form reopens with. */
export function seriesAnswers(record: SeriesRecordView, ctx: MeetingContextView | null): Answers | null {
  const i = record.input;
  if (!i) return null;
  const start = `${i.schedule.firstDate}T${i.schedule.time}`;
  const counting = typeof i.repeatCount === 'number' && i.repeatCount > 0;
  const mode = i.where.mode;
  return {
    ...emptyContentAnswers('meeting', fieldContext(ctx)),
    kind: 'meeting',
    title: i.title,
    excerpt: i.excerpt ?? '',
    body: i.bodyHtml ?? '',
    cover_image_url: i.coverImageUrl ?? '',
    scheduled_at: start,
    time_zone: i.schedule.timeZone,
    duration_minutes: i.schedule.durationMinutes ?? 60,
    recurrence_pattern: 'WEEKLY',
    recurrence_until: i.schedule.lastDate ? `${i.schedule.lastDate}T23:59` : '',
    where_mode: mode,
    format: mode === 'place' ? (i.where.joinUrl ? 'hybrid' : 'in_person') : 'online',
    location: i.where.location ?? '',
    meeting_url: i.where.joinUrl ?? '',
    create_talk_room: mode === 'talk',
    is_rsvp_enabled: true,
    attendee_limit: i.attendeeLimit ?? undefined,
    feed_slug: i.section ?? ctx?.feeds?.[0]?.slug,
    visibility: 'PUBLIC',
    share_to_network: i.shareToNetwork === true,
    'forms.repeat_as_series': true,
    'forms.repeat_every_weeks': i.schedule.intervalWeeks,
    ...(counting ? { 'forms.repeat_count': i.repeatCount } : {}),
    'forms.sessions': i.sessions.map((s) => ({
      date: s.date,
      ...(s.title ? { title: s.title } : {}),
      ...(s.note ? { note: s.note } : {}),
      ...(s.skipped ? { skipped: true } : {}),
      ...(s.reason ? { reason: s.reason } : {}),
    })),
    'forms.series_page': { ...i.page },
    // The past-date rule fires only when the date is CHANGED to a past one (as gatheringAnswers).
    'forms.loaded_start': start,
  };
}

// ── the adapter ─────────────────────────────────────────────────────────────

export function seriesActions(actions: SeriesActions): FormActions<SeriesRecordView> {
  const ctxCache = new Map<string, MeetingContextView>();
  const context = async (orgId: string) => {
    const hit = ctxCache.get(orgId);
    if (hit) return hit;
    const c = await actions.context(orgId);
    ctxCache.set(orgId, c);
    return c;
  };

  return {
    async context(orgId) {
      const c = await context(orgId);
      return { ...fieldContext(c), canEdit: c.canEdit, reason: c.reason };
    },
    async load(id) {
      const record = await actions.loadSeries(id);
      // A published series (or a draft made elsewhere) is edited in its planner (PLAN §12).
      if (!record || !record.input) return null;
      const c = await context(record.orgId).catch(() => null);
      const answers = seriesAnswers(record, c);
      return answers ? { answers, record } : null;
    },
    async save(orgId, answers, intent, id, saveOpts) {
      if (saveOpts?.autosave) return { ok: false, error: 'A series draft is saved when you press Save draft or Publish.' };
      const built = seriesInputFromAnswers(answers, intent, id);
      if (built.ok === false) return { ok: false, error: built.error };
      const res = await actions.saveSeries(orgId, built.input);
      if (res.ok === false) return res;
      const warnings = [...built.warnings, ...res.value.warnings];
      const stopped = res.value.notPublished;
      return {
        ok: true,
        value: {
          record: res.value.record,
          warnings,
          ...(stopped ? { fieldErrors: { [STEP_FIELD[stopped.step]]: [stopped.message] } } : {}),
        },
      };
    },
  };
}

// ── the gathering kind's router ─────────────────────────────────────────────

/**
 * One FormActions for the gathering kind: a series (isSeries: Repeats WEEKLY +
 * "Present it as a series") saves through the series adapter, everything else
 * through the meeting adapter. Loading an id asks the meeting side first; a row
 * it reports as a series is reopened by the series side, which opens only a
 * draft this form made (null otherwise: the host opens the planner).
 *
 *   formExtension({ id: 'meeting', schema: gatheringKind,
 *     actions: gatheringOrSeriesActions(gatheringActions(meetingActions, opts), seriesActions(seriesHostActions)) })
 */
export function gatheringOrSeriesActions(
  meeting: FormActions<MeetingRecordView>,
  series: FormActions<SeriesRecordView>,
  isSeriesAnswers: (a: Answers) => boolean = isSeries
): FormActions<MeetingRecordView | SeriesRecordView> {
  return {
    context: (orgId) => meeting.context(orgId),
    async load(id) {
      const m = meeting.load ? await meeting.load(id) : null;
      if (m && !m.record.isSeries) return m;
      return series.load ? series.load(id) : null;
    },
    save(orgId, answers, intent, id, opts) {
      const target: FormActions<MeetingRecordView | SeriesRecordView> = isSeriesAnswers(answers) ? series : meeting;
      return target.save(orgId, answers, intent, id, opts);
    },
    ...(meeting.lastSettings ? { lastSettings: meeting.lastSettings.bind(meeting) } : {}),
  };
}
