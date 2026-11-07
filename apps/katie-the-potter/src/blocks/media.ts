// ============================================================================
// Picture addresses for this site's blocks (danamccool's media.ts, unchanged
// in substance). Only our own `/api/media/…` addresses understand `?w=`;
// anything else (a /public sample, an off-site link) passes through untouched.
// ============================================================================

export const WIDTHS = [256, 512, 1024] as const;

export function isResizable(src: string): boolean {
  return src.startsWith("/api/media/") && !src.includes("?");
}

export function sized(src: string, width: number): string {
  return isResizable(src) ? `${src}?w=${width}` : src;
}

export function srcSet(src: string): string | undefined {
  if (!isResizable(src)) return undefined;
  // A srcset is split on whitespace and commas, and media folders can carry
  // both in their names: escape them, or each candidate reads as several.
  const url = src.replace(/ /g, "%20").replace(/,/g, "%2C");
  return WIDTHS.map((w) => `${url}?w=${w} ${w}w`).join(", ");
}
