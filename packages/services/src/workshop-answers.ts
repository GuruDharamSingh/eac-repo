// Pure answers ⇄ workshop conversion (2026-11-14). No database or server imports: a site's
// client compose code imports this through `@elkdonis/services/workshop-answers`, and the
// package root would pull @elkdonis/db into the browser bundle.
import type { WorkshopOffering, WorkshopOfferingInput, WorkshopSessionInput } from './workshop-offerings';

// ── The compose surface's vocabulary (2026-11-14) ────────────────────────────
// Shared answers ⇄ workshop. Moved from apps/innergathering/src/lib/cms/
// workshop-adapter.ts so every site's workshop form saves the same way. The
// answers use cms-ui content-fields' `workshop` keys (the database's names:
// `banner_image_url`, `sessions`). Times are wall clock in `time_zone`
// (default America/Toronto) and become instants here. Sessions' resources and
// the materials folder stay with each site's workshop pages.

const WS_DEFAULT_ZONE = 'America/Toronto';

type WsAnswers = Record<string, unknown>;

const wsStr = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const wsOpt = (v: unknown): string | null => {
  const s = wsStr(v).trim();
  return s ? s : null;
};
const wsNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function wsZoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const hour = get('hour') === 24 ? 0 : get('hour');
  return Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second')) - at.getTime();
}

/** "YYYY-MM-DDTHH:mm" (or a date) read in a zone → the instant. Unknown zone: the default zone. */
function wsZonedToDate(value: string, timeZone: string | null): Date | null {
  if (!value) return null;
  const local = value.length === 10 ? `${value}T00:00` : value;
  const asIfUtc = new Date(`${local}:00Z`);
  if (Number.isNaN(asIfUtc.getTime())) return null;
  const tz = timeZone && timeZone.trim() ? timeZone.trim() : WS_DEFAULT_ZONE;
  for (const zone of [tz, WS_DEFAULT_ZONE]) {
    try {
      const shifted = new Date(asIfUtc.getTime() - wsZoneOffsetMs(asIfUtc, zone));
      return new Date(asIfUtc.getTime() - wsZoneOffsetMs(shifted, zone));
    } catch {
      /* try the default zone */
    }
  }
  return asIfUtc;
}

const wsIso = (v: unknown, tz: string | null): string | null => {
  const d = wsZonedToDate(wsStr(v), tz);
  return d ? d.toISOString() : null;
};

/** An instant → "YYYY-MM-DDTHH:mm" in a zone; '' when absent or invalid. */
function wsToWallClock(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(d);
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
    return `${g('year')}-${g('month')}-${g('day')}T${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
  } catch {
    return '';
  }
}

/** Compose answers → the workshop offering to save. */
export function workshopInputFromAnswers(
  answers: WsAnswers,
  status: 'draft' | 'published'
): WorkshopOfferingInput {
  const tz = wsOpt(answers.time_zone);
  const level = wsStr(answers.level);
  const sessions: WorkshopSessionInput[] = Array.isArray(answers.sessions)
    ? (answers.sessions as unknown[])
        .filter((s): s is WsAnswers => Boolean(s) && typeof s === 'object')
        .map((s) => ({
          title: wsStr(s.title).trim() || 'Session',
          description: wsStr(s.description),
          scheduledAt: wsIso(s.scheduledAt, tz),
          durationMinutes: wsNum(s.durationMinutes),
          isOnline: s.isOnline !== false,
          location: wsStr(s.location),
          videoConferenceUrl: wsStr(s.videoConferenceUrl),
          mediaUrl: wsOpt(s.mediaUrl),
          videoUrl: wsOpt(s.videoUrl),
          backgroundColor: wsOpt(s.backgroundColor),
          resources: Array.isArray(s.resources) ? (s.resources as WorkshopSessionInput['resources']) : [],
        }))
    : [];
  const rawVisibility = wsStr(answers.visibility);
  const visibility: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY' =
    rawVisibility === 'ORGANIZATION' || rawVisibility === 'INVITE_ONLY' ? rawVisibility : 'PUBLIC';
  const rawRole = wsStr(answers.min_role);
  const minRole = (['viewer', 'member', 'guide', 'owner'] as const).find((r) => r === rawRole) ?? null;
  return {
    title: wsStr(answers.title).trim(),
    subtitle: wsOpt(answers.subtitle),
    descriptionShort: wsOpt(answers.excerpt),
    body: wsOpt(answers.body),
    format: (wsStr(answers.format) || null) as WorkshopOfferingInput['format'],
    price: wsNum(answers.price),
    currency: wsStr(answers.currency) || 'CAD',
    scheduledAt: wsIso(answers.scheduled_at, tz),
    durationMinutes: wsNum(answers.duration_minutes),
    location: wsOpt(answers.location),
    discipline: wsOpt(answers.discipline),
    level: (level || null) as WorkshopOfferingInput['level'],
    attendeeLimit: answers.is_rsvp_enabled === false ? null : wsNum(answers.attendee_limit),
    rsvpDeadline: wsIso(answers.rsvp_deadline, tz),
    minAttendees: wsNum(answers.min_attendees),
    coverImageUrl: wsOpt(answers.cover_image_url),
    bannerImageUrl: wsOpt(answers.banner_image_url),
    bannerFocalY: wsNum(answers.banner_focal_y) ?? 50,
    heroMediaUrl: wsOpt(answers.hero_media_url),
    heroMediaType: wsOpt(answers.hero_media_url)
      ? /\.(mp4|webm|mov)(\?|$)/i.test(wsStr(answers.hero_media_url))
        ? 'video'
        : 'image'
      : null,
    heroText: wsOpt(answers.hero_text),
    backgroundColor: wsOpt(answers.background_color),
    status,
    visibility: visibility,
    minRole: visibility === 'INVITE_ONLY' ? minRole : null,
    section: wsStr(answers.feed_slug) || 'offerings',
    sessions,
  };
}

/**
 * A saved workshop → compose answers (content-fields `workshop` keys). Instants
 * become wall clock in `timeZone` (default America/Toronto), which is also
 * returned as `time_zone` so a re-save reads the same clock back.
 */
export function workshopAnswersFromOffering(
  o: WorkshopOffering,
  timeZone: string = WS_DEFAULT_ZONE
): Record<string, unknown> {
  const tz = timeZone || WS_DEFAULT_ZONE;
  return {
    title: o.title,
    subtitle: o.subtitle ?? '',
    excerpt: o.descriptionShort ?? '',
    body: o.body ?? '',
    format: o.format ?? '',
    price: o.price ?? undefined,
    currency: o.currency,
    time_zone: tz,
    scheduled_at: wsToWallClock(o.scheduledAt, tz),
    duration_minutes: o.durationMinutes ?? undefined,
    location: o.location ?? '',
    discipline: o.discipline ?? '',
    level: o.level ?? '',
    is_rsvp_enabled: o.attendeeLimit != null,
    attendee_limit: o.attendeeLimit ?? undefined,
    rsvp_deadline: wsToWallClock(o.rsvpDeadline, tz),
    min_attendees: o.minAttendees ?? undefined,
    cover_image_url: o.coverImageUrl ?? '',
    banner_image_url: o.bannerImageUrl ?? '',
    banner_focal_y: o.bannerFocalY,
    hero_media_url: o.heroMediaUrl ?? '',
    hero_text: o.heroText ?? '',
    background_color: o.backgroundColor ?? '',
    visibility: o.visibility,
    min_role: o.visibility === 'INVITE_ONLY' ? o.minRole : null,
    feed_slug: o.section ?? 'offerings',
    sessions: o.sessions.map((s) => ({
      title: s.title,
      description: s.description,
      scheduledAt: wsToWallClock(s.scheduledAt, tz),
      durationMinutes: s.durationMinutes ?? undefined,
      isOnline: s.isOnline,
      location: s.location,
      videoConferenceUrl: s.videoConferenceUrl,
      mediaUrl: s.mediaUrl ?? '',
      videoUrl: s.videoUrl ?? '',
      backgroundColor: s.backgroundColor ?? '',
      resources: s.resources,
    })),
  };
}
