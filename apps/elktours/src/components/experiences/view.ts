import type { Experience, TourAsset } from "@/lib/catalogue-types";
import type { ExperienceView } from "./types";

/**
 * Lib `Experience` → the public view the client pieces draw. Run on the
 * server. Copies public fields only: `page` (layout settings), lat/lng and
 * anything added to Experience later stay behind unless listed here.
 * `assets` are the experience's registry rows; only visible, unarchived
 * images with a URL are shown.
 */
export function toExperienceView(e: Experience, assets: TourAsset[] = []): ExperienceView {
  const images = assets
    .filter((a) => a.kind === "image" && a.visible && !a.archivedAt && !a.isPrivateFile && a.url)
    .sort((a, b) => a.position - b.position)
    .map((a) => a.url as string);
  const firstArtist = e.people.find((p) => p.role === "artist")?.userId ?? null;
  const people = [...e.people]
    .sort((a, b) => (a.role === b.role ? a.position - b.position : a.role === "artist" ? -1 : 1))
    .map((p) => ({
      userId: p.userId,
      role: p.role,
      name: p.name,
      avatarUrl: p.avatarUrl,
      profileUrl: p.profileUrl,
      serviceUrl: p.role === "artist" && p.userId === firstArtist ? e.serviceUrl : null,
    }));
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    excerpt: e.excerpt,
    body: e.body,
    status: e.status,
    coverImageUrl: e.coverImageUrl,
    images,
    location: e.location,
    isOnline: e.isOnline,
    format: e.format,
    durationMinutes: e.durationMinutes,
    price: e.price,
    currency: e.currency,
    highlights: e.highlights.filter((h) => h.trim().length > 0),
    people,
  };
}
