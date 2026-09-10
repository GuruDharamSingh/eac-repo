import type { WorkshopOfferingInput, WorkshopSessionInput } from "@elkdonis/services";
import { zonedInputToDate } from "@/lib/format";

/**
 * Shared compose answers → the workshop offering the service writes.
 *
 * The compose surface names fields the way the database does
 * (`banner_image_url`, `banner_focal_y`, `sessions`); the service takes
 * camelCase. One translation, at the boundary. Times are wall-clock in the
 * chosen zone (the site's, by default) and become instants here.
 */
type Answers = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const opt = (v: unknown): string | null => {
  const s = str(v).trim();
  return s ? s : null;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const iso = (v: unknown, tz: string | null): string | null => {
  const d = zonedInputToDate(str(v), tz);
  return d ? d.toISOString() : null;
};

function sessions(raw: unknown, tz: string | null): WorkshopSessionInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Answers => Boolean(s) && typeof s === "object")
    .map((s) => ({
      title: str(s.title).trim() || "Session",
      description: str(s.description),
      scheduledAt: iso(s.scheduledAt, tz),
      durationMinutes: num(s.durationMinutes),
      isOnline: s.isOnline !== false,
      location: str(s.location),
      videoConferenceUrl: str(s.videoConferenceUrl),
      mediaUrl: opt(s.mediaUrl),
      videoUrl: opt(s.videoUrl),
      backgroundColor: opt(s.backgroundColor),
      resources: Array.isArray(s.resources) ? (s.resources as WorkshopSessionInput["resources"]) : [],
    }));
}

export function toWorkshopInput(answers: Answers, status: "draft" | "published"): WorkshopOfferingInput {
  const tz = opt(answers.time_zone);
  const level = str(answers.level);
  return {
    title: str(answers.title).trim(),
    subtitle: opt(answers.subtitle),
    descriptionShort: opt(answers.excerpt),
    body: opt(answers.body),
    format: (str(answers.format) || null) as WorkshopOfferingInput["format"],
    price: num(answers.price),
    currency: str(answers.currency) || "CAD",
    scheduledAt: iso(answers.scheduled_at, tz),
    durationMinutes: num(answers.duration_minutes),
    location: opt(answers.location),
    discipline: opt(answers.discipline),
    level: (level || null) as WorkshopOfferingInput["level"],
    attendeeLimit: answers.is_rsvp_enabled === false ? null : num(answers.attendee_limit),
    rsvpDeadline: iso(answers.rsvp_deadline, tz),
    minAttendees: num(answers.min_attendees),
    coverImageUrl: opt(answers.cover_image_url),
    bannerImageUrl: opt(answers.banner_image_url),
    bannerFocalY: num(answers.banner_focal_y) ?? 50,
    heroMediaUrl: opt(answers.hero_media_url),
    heroMediaType: opt(answers.hero_media_url) ? (/\.(mp4|webm|mov)(\?|$)/i.test(str(answers.hero_media_url)) ? "video" : "image") : null,
    heroText: opt(answers.hero_text),
    backgroundColor: opt(answers.background_color),
    status,
    visibility: (str(answers.visibility) === "ORGANIZATION" ? "ORGANIZATION" : "PUBLIC"),
    section: str(answers.feed_slug) || "offerings",
    sessions: sessions(answers.sessions, tz),
  };
}
