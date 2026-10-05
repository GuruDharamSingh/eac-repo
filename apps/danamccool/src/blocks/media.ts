// ============================================================================
// Picture addresses for this site's blocks.
//
// Her masters are big — the butterflies detail is 22MB, most gallery shots are
// 2-8MB — and the media route serves a downscaled variant for `?w=`. Only our
// own `/api/media/…` addresses understand that parameter, so anything else (a
// file in /public, an off-site link) is passed through untouched rather than
// given a query string it would ignore or, worse, mis-cache on.
// ============================================================================

/** The widths the media route actually renders; other numbers round up. */
export const WIDTHS = [256, 512, 1024] as const;

export function isResizable(src: string): boolean {
  return src.startsWith("/api/media/") && !src.includes("?");
}

/** `src` at a given width, when the route can make one. */
export function sized(src: string, width: number): string {
  return isResizable(src) ? `${src}?w=${width}` : src;
}

/** A srcset over the route's widths, or undefined for a fixed file. */
export function srcSet(src: string): string | undefined {
  if (!isResizable(src)) return undefined;
  // A srcset is split on whitespace and commas, and her folder names have
  // spaces ("DANAS FORMAT WEBSITE"): escape both, or the browser reads each
  // candidate as several broken ones. `src` itself tolerates a raw space.
  const url = src.replace(/ /g, "%20").replace(/,/g, "%2C");
  return WIDTHS.map((w) => `${url}?w=${w} ${w}w`).join(", ");
}
