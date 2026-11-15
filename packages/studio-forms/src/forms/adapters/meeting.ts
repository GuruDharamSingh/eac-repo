// ============================================================================
// Meeting → the Studio's Meetings actions (pass 1, the bone's).
//
// The answers ARE cms-ui content-fields' meeting answers (scheduled_at as a
// wall clock, meeting_url, is_rsvp_enabled, …), converted by the same
// meeting/convert.ts (shared with the retired Meetings tab until 2026-11-14).
// The form adds three design keys, resolved here before the conversion:
//
//   where_mode   the Where tick boxes ('place', 'link', 'talk', 'place+link',
//                'place+talk', 'none'; rules/answers.ts whereOf) → format,
//                location, meeting_url, create_talk_room. A place with a link
//                or a Talk room = hybrid.
//   start_time   "18:30" from a preset; joined to the date when scheduled_at
//                has a date and no time yet.
//   forms.*      design-only values the server can't store yet (PLAN §3). They
//                are dropped from the save and reported as a warning.
// ============================================================================

import type { MeetingActions, MeetingContextView, MeetingInputView, MeetingRecordView } from '../../meeting/types';
import { fieldContext, toAnswers, toInput, type Answers } from '../../meeting/convert';
import type { FormActions, FormPreset } from '../contract';
import { presetFromAnswers } from '../presets';
import { whereEncode, whereOf, type WhereMode } from '../rules/answers';

export type { WhereMode } from '../rules/answers';

/** The Where choice as one value (rules/answers.ts whereOf), from the form or the stored columns. */
export function whereModeOf(a: Answers): WhereMode {
  return whereEncode(whereOf(a));
}

/** Resolve the design keys into the content-fields answers the conversion reads. */
export function resolveMeetingAnswers(a: Answers): { answers: Answers; dropped: string[] } {
  const out: Answers = { ...a };
  // Where (2026-11-14): a place with a link or a Talk room is hybrid; a link and a room never
  // both (whereOf keeps the room). What is not ticked is not saved.
  const w = whereOf(a);
  const online = w.talk || (w.link && !w.talk);
  out.create_talk_room = w.talk;
  if (!w.place) out.location = '';
  if (!w.link || w.talk) out.meeting_url = '';
  out.format = w.place ? (online ? 'hybrid' : 'in_person') : online ? 'online' : 'in_person';
  if (typeof a.start_time === 'string' && /^\d{2}:\d{2}$/.test(a.start_time) && typeof a.scheduled_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.scheduled_at)) {
    out.scheduled_at = `${a.scheduled_at}T${a.start_time}`;
  }
  // A "last date" with no time means the end of that day, in the meeting's zone. Read as
  // midnight, it drops that day's own session from the reminders (attendee-reminders.ts:108)
  // and the calendar's UNTIL; convert.ts toAnswers slices a stored until back to a date on
  // load, so an untouched re-save would lose it again without this.
  if (typeof out.recurrence_until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(out.recurrence_until)) {
    out.recurrence_until = `${out.recurrence_until}T23:59`;
  }
  // A key whose value is undefined was never set (or was cleared): not a lost choice.
  const formKeys = Object.keys(out).filter((k) => (k === 'forms' || k.startsWith('forms.')) && out[k] !== undefined);
  for (const k of Object.keys(out)) if ((k === 'forms' || k.startsWith('forms.')) && out[k] === undefined) delete out[k];
  for (const k of ['where_mode', 'start_time', ...formKeys]) delete out[k];
  // Keys that are UI state already translated into stored columns are not "lost": no warning.
  const dropped = formKeys.filter((k) => !DERIVED_FORM_KEYS.includes(k));
  return { answers: out, dropped };
}

/**
 * forms.* keys the kind translates into real columns before saving, so dropping them loses nothing:
 *   forms.repeat_count      "8 sessions" → the kind also patches recurrence_until; on load it is derived back.
 *   forms.loaded_start      the stored scheduled_at, set on load; the past-date rule compares against it.
 * The series keys (forms.repeat_as_series, forms.repeat_every_weeks, forms.sessions,
 * forms.series_page) left with "Present it as a series" on 2026-11-14.
 */
export const DERIVED_FORM_KEYS = ['forms.repeat_count', 'forms.loaded_start'];

/** Saved record → form answers, with the Where seg set from what was stored. */
export function meetingAnswers(record: MeetingRecordView, ctx: MeetingContextView | null): Answers {
  const a = toAnswers(record, fieldContext(ctx));
  // The stored start, so the past-date rule fires only when the date is CHANGED to a past one:
  // editing a past one-off (adding its recording) or an old standing meeting stays possible.
  // body_doc: the Canvas document, when the description was written in blocks (adapters only: the
  // Meetings tab's toolbar editor never sees it, so it cannot send a stale one back).
  const doc = record.input.bodyDoc;
  return {
    ...a,
    body_doc: doc && typeof doc === 'object' ? doc : null,
    min_role: record.input.minRole ?? null,
    // Only when stored (innergathering keeps false): an absent key is never sent, so no host clears it.
    ...(record.input.metadata && 'showCycleBadge' in record.input.metadata ? { show_cycle_badge: record.input.metadata.showCycleBadge !== false } : {}),
    where_mode: whereModeOf(a),
    'forms.loaded_start': a.scheduled_at ?? '',
  };
}

export interface MeetingAdapterOptions {
  /** Ask for host fields only when the org has a rota (as MeetingKind does). */
  askHosts?: (ctx: MeetingContextView | null) => boolean;
  /**
   * Whether attendee reminders actually go out for this org: only sites that run a reminder
   * tick reading threads.reminder_minutes_before do (innergathering lib/reminders.ts:21, sunjay
   * :33, amrit-canada :29, elktours :29; not arts-collective, hidden-enneagram, katie, fourthway,
   * or ifac, whose tick is series-only). Default: no, so the switch is not drawn where nothing
   * would send it (owner ruling 7). The host knows which site serves the org.
   */
  canRemind?: (orgId: string) => boolean;
  /**
   * Whether "Tell me when the minimum is reached" is mailed for this org: only the RSVP routes
   * of amrit-canada (:208), elktours (:208), sunjay (:212) and innergathering (:252) send it;
   * arts-collective sends nothing. Default no, as with canRemind.
   */
  canNotifyMin?: (orgId: string) => boolean;
  /** What the form saves: 'meeting' (default) or 'event' (eventKind; saveMeetingContent takes both). */
  kind?: 'meeting' | 'event';
}

export function meetingActions(actions: MeetingActions, opts: MeetingAdapterOptions = {}): FormActions<MeetingRecordView> {
  const ctxCache = new Map<string, MeetingContextView>();
  const context = async (orgId: string) => {
    const hit = ctxCache.get(orgId);
    if (hit) return hit;
    const c = await actions.context(orgId);
    ctxCache.set(orgId, c);
    return c;
  };
  const askHosts = (c: MeetingContextView | null) => (opts.askHosts ? opts.askHosts(c) : (c?.hostCandidates.length ?? 0) > 0);

  return {
    async context(orgId) {
      const c = await context(orgId);
      return {
        ...fieldContext(c),
        canEdit: c.canEdit,
        reason: c.reason,
        canRemind: opts.canRemind ? opts.canRemind(orgId) : false,
        canNotifyMin: opts.canNotifyMin ? opts.canNotifyMin(orgId) : false,
      };
    },
    async load(id) {
      const record = await actions.loadMeeting(id);
      // A series is edited in its planner, not here (STUDIO_FORMS_SPLIT_2026-11-14 §7).
      if (!record || record.isSeries) return null;
      const c = await context(record.orgId).catch(() => null);
      return { answers: meetingAnswers(record, c), record };
    },
    async save(orgId, answers, intent, id, saveOpts) {
      const c = await context(orgId).catch(() => null);
      const { answers: resolved, dropped } = resolveMeetingAnswers(answers);
      const doc = resolved.body_doc;
      const input: MeetingInputView = { ...toInput(resolved, opts.kind ?? 'meeting', askHosts(c)), bodyDoc: doc && typeof doc === 'object' ? doc : null };
      // The confirmation badge (innergathering): stored only as false; shown again removes the key.
      if ('show_cycle_badge' in resolved && resolved.show_cycle_badge !== undefined) {
        input.metadata = { showCycleBadge: resolved.show_cycle_badge === false ? false : null };
      }
      // Members only is INVITE_ONLY with a minimum role (the Goes on row sets both); anything else has none.
      if ('min_role' in resolved) {
        const role = resolved.min_role;
        input.minRole = input.visibility === 'INVITE_ONLY' && (role === 'member' || role === 'guide' || role === 'owner' || role === 'viewer') ? role : null;
      }
      // The host must forward opts to saveMeetingContent's 6th argument for the server-side refusal.
      const res = await actions.saveMeeting(orgId, input, intent, id, { autosave: saveOpts?.autosave === true });
      if (res.ok === false) return res;
      const warnings = [...res.value.warnings];
      if (dropped.length) warnings.push('Some choices are kept in this form but not saved yet: ' + dropped.join(', ') + '.');
      return { ok: true, value: { record: res.value.record, warnings } };
    },
    async lastSettings(orgId): Promise<FormPreset | null> {
      const list = await actions.listMeetings(orgId);
      const latest = [...list].filter((m) => !m.isSeries).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
      if (!latest) return null;
      const record = await actions.loadMeeting(latest.id);
      if (!record) return null;
      const c = await context(orgId).catch(() => null);
      return presetFromAnswers('meeting', meetingAnswers(record, c), 'Your last meeting’s settings');
    },
  };
}
