// ============================================================================
// Picture addresses for blocks that need a smaller variant.
//
// A master can be large — several MB is ordinary for a gallery shot — and a
// `/api/media/…` route MAY serve a downscaled variant for `?w=`. "May": not
// every app's media route honours the parameter yet (danamccool's does;
// several others still serve the master regardless). `sized()` only builds
// the URL — a host that ignores `?w=` serves the original, which is a slower
// picture, never a broken one. Anything that is not our own media path (a
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
  return WIDTHS.map((w) => `${src}?w=${w} ${w}w`).join(", ");
}
