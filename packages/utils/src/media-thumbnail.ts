/**
 * Client-safe URL helper for the media route's `?w=` variants.
 *
 * The server side (ladder, rendering, cache) is `media-thumbnail.ts` in
 * @elkdonis/services, which is server-only. This file only builds URLs, so
 * components can import it. Keep THUMBNAIL_LADDER in step with
 * THUMBNAIL_WIDTHS there: the server rounds any request up to its ladder, so
 * a drift only costs a wrong label on a srcset entry, never a broken image.
 *
 * Rules:
 *  - only same-origin `/api/media/...` URLs get `?w=`; external, data: and
 *    blob: URLs pass through untouched;
 *  - the width snaps up to the ladder;
 *  - existing query parameters are kept, and an existing `w` is left alone.
 */
export const THUMBNAIL_LADDER = [128, 256, 512, 1024] as const;

/** Smallest ladder step at or above `width`; the top step for anything bigger. */
export function snapThumbnailWidth(width: number): number {
  const w = Number.isFinite(width) && width > 0 ? width : THUMBNAIL_LADDER[0];
  return (
    THUMBNAIL_LADDER.find((step) => step >= w) ??
    THUMBNAIL_LADDER[THUMBNAIL_LADDER.length - 1]
  );
}

/** Width to request for a slot `cssWidth` px wide: x2 for retina, then snapped. */
export function thumbnailWidthFor(cssWidth: number, dpr = 2): number {
  return snapThumbnailWidth(cssWidth * dpr);
}

export function mediaThumbnail(url: string, width: number): string {
  if (!url || !url.startsWith("/api/media/")) return url;
  const hash = url.indexOf("#");
  const base = hash === -1 ? url : url.slice(0, hash);
  const frag = hash === -1 ? "" : url.slice(hash);
  const q = base.indexOf("?");
  const path = q === -1 ? base : base.slice(0, q);
  const params = new URLSearchParams(q === -1 ? "" : base.slice(q + 1));
  if (params.has("w")) return url;
  const rest = params.toString();
  return `${path}?${rest ? `${rest}&` : ""}w=${snapThumbnailWidth(width)}${frag}`;
}

/**
 * A `srcset` over the ladder, or undefined when the URL is not resizable.
 * `thumb` is injectable for callers with their own builder.
 */
export function buildSrcSet(
  url: string | null | undefined,
  thumb: (url: string, width: number) => string = mediaThumbnail,
  widths: readonly number[] = THUMBNAIL_LADDER.slice(1)
): string | undefined {
  if (!url) return undefined;
  const entries = widths
    .map((w) => [thumb(url, w), w] as const)
    .filter(([built]) => built !== url);
  if (entries.length === 0) return undefined;
  return entries.map(([built, w]) => `${built} ${w}w`).join(", ");
}

/** `{ src, srcSet }` for an img slot about `cssWidth` px wide. */
export function thumbnailProps(
  url: string | null | undefined,
  cssWidth: number
): { src: string | undefined; srcSet?: string } {
  if (!url) return { src: undefined };
  return { src: mediaThumbnail(url, thumbnailWidthFor(cssWidth)), srcSet: buildSrcSet(url) };
}
