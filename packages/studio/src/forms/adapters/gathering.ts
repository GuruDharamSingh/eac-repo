// ============================================================================
// Gathering → the Studio's Meetings actions (pass 1, the bone's).
//
// The answers ARE cms-ui content-fields' meeting answers (scheduled_at as a
// wall clock, meeting_url, is_rsvp_enabled, …), converted by the same
// meeting/convert.ts the Meetings tab uses, so the two can never disagree.
// The form adds three design keys, resolved here before the conversion:
//
//   where_mode   'place' | 'link' | 'talk' (the Where seg) → format, location,
//                meeting_url, create_talk_room. 'place' with a link = hybrid.
//   start_time   "18:30" from a preset; joined to the date when scheduled_at
//                has a date and no time yet.
//   forms.*      design-only values the server can't store yet (PLAN §3). They
//                are dropped from the save and reported as a warning.
// ============================================================================

import type { MeetingActions, MeetingContextView, MeetingInputView, MeetingRecordView } from '../../meeting/types';
import { fieldContext, toAnswers, toInput, type Answers } from '../../meeting/convert';
import type { FormActions, FormPreset } from '../contract';
import { presetFromAnswers } from '../presets';

export type WhereMode = 'place' | 'link' | 'talk';

/** The Where seg's value read from saved answers. */
export function whereModeOf(a: Answers): WhereMode {
  const m = a.where_mode;
  if (m === 'place' || m === 'link' || m === 'talk') return m;
  if (a.create_talk_room === true) return 'talk';
  if (a.format === 'online' && a.meeting_url) return 'link';
  if (a.format === 'online') return 'talk';
  return 'place';
}

/** Resolve the design keys into the content-fields answers the conversion reads. */
export function resolveGatheringAnswers(a: Answers): { answers: Answers; dropped: string[] } {
  const out: Answers = { ...a };
  const mode = whereModeOf(a);
  if (mode === 'place') {
    out.format = typeof a.meeting_url === 'string' && a.meeting_url.trim() ? 'hybrid' : 'in_person';
    out.create_talk_room = false;
  } else if (mode === 'link') {
    out.format = 'online';
    out.create_talk_room = false;
    out.location = '';
  } else {
    out.format = 'online';
    out.create_talk_room = true;
    out.meeting_url = '';
    out.location = '';
  }
  if (typeof a.start_time === 'string' && /^\d{2}:\d{2}$/.test(a.start_time) && typeof a.scheduled_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.scheduled_at)) {
    out.scheduled_at = `${a.scheduled_at}T${a.start_time}`;
  }
  const formKeys = Object.keys(out).filter((k) => k === 'forms' || k.startsWith('forms.'));
  for (const k of ['where_mode', 'start_time', ...formKeys]) delete out[k];
  // Keys that are UI state already translated into stored columns are not "lost": no warning.
  const dropped = formKeys.filter((k) => !DERIVED_FORM_KEYS.includes(k));
  return { answers: out, dropped };
}

/**
 * forms.* keys the kind translates into real columns before saving, so dropping them loses nothing:
 *   forms.repeat_count      "8 sessions" → the kind also patches recurrence_until; on load it is derived back.
 *   forms.repeat_as_series  pass 2 seam: codeKind reads it; the series adapter consumes it.
 *   forms.loaded_start      the stored scheduled_at, set on load; the past-date rule compares against it.
 */
export const DERIVED_FORM_KEYS = ['forms.repeat_count', 'forms.repeat_as_series', 'forms.loaded_start'];

/** Saved record → form answers, with the Where seg set from what was stored. */
export function gatheringAnswers(record: MeetingRecordView, ctx: MeetingContextView | null): Answers {
  const a = toAnswers(record, fieldContext(ctx));
  // The stored start, so the past-date rule fires only when the date is CHANGED to a past one:
  // editing a past one-off (adding its recording) or an old standing meeting stays possible.
  return { ...a, where_mode: whereModeOf(a), 'forms.loaded_start': a.scheduled_at ?? '' };
}

export interface GatheringAdapterOptions {
  /** Ask for host fields only when the org has a rota (as MeetingKind does). */
  askHosts?: (ctx: MeetingContextView | null) => boolean;
}

export function gatheringActions(actions: MeetingActions, opts: GatheringAdapterOptions = {}): FormActions<MeetingRecordView> {
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
      return { ...fieldContext(c), canEdit: c.canEdit, reason: c.reason };
    },
    async load(id) {
      const record = await actions.loadMeeting(id);
      if (!record) return null;
      const c = await context(record.orgId).catch(() => null);
      return { answers: gatheringAnswers(record, c), record };
    },
    async save(orgId, answers, intent, id) {
      const c = await context(orgId).catch(() => null);
      const { answers: resolved, dropped } = resolveGatheringAnswers(answers);
      const input: MeetingInputView = toInput(resolved, 'meeting', askHosts(c));
      const res = await actions.saveMeeting(orgId, input, intent, id);
      if (!res.ok) return res;
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
      return presetFromAnswers('gathering', gatheringAnswers(record, c), 'Your last gathering’s settings');
    },
  };
}
