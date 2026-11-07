/**
 * What the public experience pieces (card, people chips, detail blocks) draw.
 * Client-safe and public-safe: a page builds these on the server from the lib
 * `Experience` (spec 1.4) with every link already resolved, so nothing private
 * and nothing server-only crosses into client components.
 */

export type ExperienceFormat = "in_person" | "online" | "hybrid";

export type ExperienceRole = "artist" | "host";

export interface ExperiencePersonView {
  userId: string;
  role: ExperienceRole;
  name: string;
  avatarUrl: string | null;
  /** Their ArtDirect profile (forumProfileUrl), or null without a slug. */
  profileUrl: string | null;
  /** The artist's own service listing on ArtDirect, when the experience links one (set on the first artist only). */
  serviceUrl: string | null;
}

export interface ExperienceView {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  status: string;
  coverImageUrl: string | null;
  images: string[];
  location: string | null;
  isOnline: boolean;
  format: ExperienceFormat;
  durationMinutes: number | null;
  /** Display only in Phase A (no checkout). Major units, like tours. */
  price: number | null;
  currency: string;
  highlights: string[];
  people: ExperiencePersonView[];
}

export const FORMAT_LABEL: Record<ExperienceFormat, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "In person or online",
};

/** "Online", the place, or both — what the card and the facts row say about where it happens. */
export function placeLabel(e: Pick<ExperienceView, "format" | "isOnline" | "location">): string | null {
  if (e.format === "online" || (e.isOnline && !e.location)) return "Online";
  if (e.format === "hybrid") return e.location ? `${e.location} · or online` : "In person or online";
  return e.location || null;
}

export function readFormat(v: unknown, isOnline = false): ExperienceFormat {
  return v === "in_person" || v === "online" || v === "hybrid" ? v : isOnline ? "online" : "in_person";
}
