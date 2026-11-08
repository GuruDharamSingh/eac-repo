// ============================================================================
// The Meetings kind's answers <-> MeetingInputView conversion, lifted out of
// MeetingKind.tsx (2026-11-08) unchanged, so the publication forms' gathering
// adapter (forms/adapters/gathering.ts) and the Studio's Meetings tab convert
// the same way: the form's wall-clock answers to the instants the save takes.
// ============================================================================

import {
  emptyContentAnswers,
  knownTimeZone,
  localTimeZone,
  wallClockToInstant,
  type ContentFieldContext,
} from '@elkdonis/cms-ui/compose';
import type { MeetingContextView, MeetingInputView, MeetingRecordView } from './types';

export type Answers = Record<string, unknown>;

// ── answers ⇄ input ──────────────────────────────────────────────────────────

export function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
export function optStr(v: unknown): string | null {
  const s = str(v).trim();
  return s === '' ? null : s;
}
export function optNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** `YYYY-MM-DDTHH:mm` as the wall clock in `zone` — the datetime field's format. */
export function toWallClock(isoValue: string | null | undefined, zone: string): string {
  if (!isoValue) return '';
  const d = new Date(isoValue);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

export function formZone(a: Answers): string {
  return knownTimeZone(optStr(a.time_zone)) ?? localTimeZone();
}

export function toInput(a: Answers, kind: MeetingInputView['kind'], askHosts: boolean): MeetingInputView {
  const zone = formZone(a);
  const at = (v: unknown) => wallClockToInstant(optStr(v), zone)?.toISOString() ?? null;
  const pattern = optStr(a.recurrence_pattern);
  return {
    kind,
    title: str(a.title),
    body: str(a.body) || null,
    excerpt: optStr(a.excerpt),
    coverImageUrl: optStr(a.cover_image_url),
    timeZone: zone,
    scheduledAt: at(a.scheduled_at),
    durationMinutes: optNum(a.duration_minutes) ?? 60,
    format: (optStr(a.format) as MeetingInputView['format']) ?? 'in_person',
    location: optStr(a.location),
    recurrencePattern: !pattern || pattern === 'NONE' ? null : (pattern as MeetingInputView['recurrencePattern']),
    recurrenceUntil: at(a.recurrence_until),
    recurrenceCustomRule: optStr(a.recurrence_custom_rule),
    meetingUrl: optStr(a.meeting_url),
    videoLink: optStr(a.video_link),
    isRsvpEnabled: a.is_rsvp_enabled !== false,
    attendeeLimit: optNum(a.attendee_limit),
    rsvpDeadline: at(a.rsvp_deadline),
    minAttendees: optNum(a.min_attendees),
    notifyOnMinAttendees: a.notify_on_min_attendees === true,
    section: optStr(a.feed_slug),
    visibility: (optStr(a.visibility) as MeetingInputView['visibility']) ?? 'PUBLIC',
    shareToNetwork: a.share_to_network === true,
    createTalkRoom: a.create_talk_room === true,
    createDocument: a.create_document === true,
    // undefined = the form had no hosting fields; "" = "Nobody".
    ...(askHosts && a.host_user_id !== undefined ? { hostUserId: str(a.host_user_id) } : {}),
    ...(askHosts && a.co_host_user_id !== undefined ? { coHostUserId: str(a.co_host_user_id) } : {}),
    // undefined = the form has no reminder control, so the stored value is kept.
    ...(a.reminder_minutes_before !== undefined ? { reminderMinutesBefore: optNum(a.reminder_minutes_before) } : {}),
  };
}

export function toAnswers(r: MeetingRecordView, ctx: ContentFieldContext): Answers {
  const i = r.input;
  const zone = knownTimeZone(i.timeZone) ?? localTimeZone();
  const wc = (v: string | null | undefined) => toWallClock(v, zone);
  return {
    ...emptyContentAnswers('meeting', ctx),
    kind: 'meeting',
    title: i.title,
    body: i.body ?? '',
    excerpt: i.excerpt ?? '',
    cover_image_url: i.coverImageUrl ?? '',
    scheduled_at: wc(i.scheduledAt),
    time_zone: i.timeZone ?? '',
    duration_minutes: i.durationMinutes ?? 60,
    format: i.format ?? 'in_person',
    location: i.location ?? '',
    recurrence_pattern: i.recurrencePattern ?? 'NONE',
    recurrence_until: wc(i.recurrenceUntil).slice(0, 10),
    recurrence_custom_rule: i.recurrenceCustomRule ?? '',
    meeting_url: i.meetingUrl ?? '',
    video_link: i.videoLink ?? '',
    is_rsvp_enabled: i.isRsvpEnabled ?? true,
    attendee_limit: i.attendeeLimit ?? undefined,
    rsvp_deadline: wc(i.rsvpDeadline),
    min_attendees: i.minAttendees ?? undefined,
    notify_on_min_attendees: Boolean(i.notifyOnMinAttendees),
    feed_slug: i.section ?? ctx.feeds?.[0]?.slug,
    visibility: i.visibility ?? 'PUBLIC',
    share_to_network: Boolean(i.shareToNetwork),
    create_talk_room: Boolean(i.createTalkRoom),
    create_document: Boolean(i.createDocument),
    ...(i.hostUserId !== undefined ? { host_user_id: i.hostUserId } : {}),
    ...(i.coHostUserId !== undefined ? { co_host_user_id: i.coHostUserId } : {}),
    ...(i.reminderMinutesBefore !== undefined ? { reminder_minutes_before: i.reminderMinutesBefore } : {}),
  };
}

export function fieldContext(c: MeetingContextView | null): ContentFieldContext {
  if (!c) return {};
  return {
    feeds: c.feeds,
    hostCandidates: c.hostCandidates,
    canCreateTalkRoom: c.canCreateTalkRoom,
    canCreateDocument: c.canCreateDocument,
    canShareToNetwork: c.canShareToNetwork,
  };
}

