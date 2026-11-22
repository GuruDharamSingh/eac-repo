import type { Tour } from "@/lib/tours";

/** The tour's own fields as the wizard edits them (strings, as the tour form keeps them). */
export interface TourDraft {
  city: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  price: string;
  durationMinutes: string;
  /** The meeting point's label (threads.location). */
  location: string;
  meetingLat: string;
  meetingLng: string;
  /** Catalogue place chosen as the meeting point, if any (becomes stop 1's place). Not stored on the tour. */
  meetingPlaceId: string | null;
  languages: string;
  highlights: string;
  includes: string;
  maxParty: string;
  effort: string;
}

/** Cities the wizard offers. Paris until another is listed (developer, 2026-11-19). */
export const CITIES = ["Paris"] as const;

export const CITY_CENTRES: Record<string, { lat: number; lng: number }> = {
  Paris: { lat: 48.8566, lng: 2.3522 },
};

const s = (v: number | null | undefined) => (v != null ? String(v) : "");

export function blankTourDraft(): TourDraft {
  return {
    city: "Paris",
    title: "",
    excerpt: "",
    body: "",
    coverImageUrl: "",
    price: "",
    durationMinutes: "120",
    location: "",
    meetingLat: "",
    meetingLng: "",
    meetingPlaceId: null,
    languages: "English",
    highlights: "",
    includes: "",
    maxParty: "",
    effort: "",
  };
}

export function draftFromTour(t: Tour): TourDraft {
  return {
    city: t.details.city ?? "Paris",
    title: t.title,
    excerpt: t.excerpt ?? "",
    body: t.body ?? "",
    coverImageUrl: t.coverImageUrl ?? "",
    price: s(t.price),
    durationMinutes: s(t.durationMinutes),
    location: t.location ?? "",
    meetingLat: s(t.details.meetingPoint?.lat),
    meetingLng: s(t.details.meetingPoint?.lng),
    meetingPlaceId: null,
    languages: t.details.languages.join("\n"),
    highlights: t.details.highlights.join("\n"),
    includes: t.details.includes.join("\n"),
    maxParty: s(t.details.maxParty),
    effort: t.details.effort ?? "",
  };
}

export const numOrNull = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** The stop's line on the tour page (tour_stops.excerpt): soft limit 240 shown as a counter; hard limit 280 (DESIGN: the stage column holds ~280; the server accepts 300). */
export const NARRATIVE_SOFT = 240;
export const NARRATIVE_HARD = 280;

/** Narratives by StopDraft.key (an existing stop's id, or `new-…` for an unsaved one). */
export type Narratives = Record<string, string>;

/**
 * What the tour page falls back to when a stop has no line: the first one or two sentences of its body, tags
 * stripped. Shown as a placeholder only, never saved (the page computes the same fallback, lib/tour-stage-data.ts).
 */
export function bodyFallback(body: string, max = NARRATIVE_SOFT): string {
  const text = body.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [text];
  let out = sentences[0]!.trim();
  if (sentences[1] && (out + " " + sentences[1].trim()).length <= max) out += " " + sentences[1].trim();
  if (out.length <= max) return out;
  const cut = out.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).trimEnd() + "…";
}
