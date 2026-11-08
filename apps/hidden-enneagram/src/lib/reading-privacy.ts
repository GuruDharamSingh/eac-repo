import { randomInt } from "node:crypto";
import type { Metadata } from "next";

// ============================================================================
// A reading is about a real person, so a page that holds one is private by
// default (server only):
//
//   - noindex, nofollow, noarchive (robots meta) on every route that draws a
//     studio page, found by walking the page JSON for an `he-reading` block,
//     so a reading dropped onto any page takes its page with it;
//   - no-referrer, so following a link out of it does not leak its address;
//   - the site has no sitemap and no public list of studio pages (only
//     /studio and /manage/pages, both editor-only), so nothing lists it;
//   - its address is suggested unguessable: reading-<12 random characters>
//     (about 60 bits), and Ario shares it with the person directly.
// It is not a lock: anyone holding the link can read it. Signed-in gating is
// an open item (docs/editor.md).
// ============================================================================

export const READING_BLOCK = "he-reading";

/** Does this page JSON hold a reading anywhere (slots and zones included)? */
export function hasReading(data: unknown, depth = 0): boolean {
  if (!data || typeof data !== "object" || depth > 12) return false;
  if (Array.isArray(data)) return data.some((d) => hasReading(d, depth + 1));
  const o = data as Record<string, unknown>;
  if (o.type === READING_BLOCK) return true;
  return Object.values(o).some((v) => v && typeof v === "object" && hasReading(v, depth + 1));
}

/** Metadata a page with a reading adds. */
export function readingMetadata(data: unknown): Metadata {
  if (!hasReading(data)) return {};
  return {
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
    referrer: "no-referrer",
  };
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** An unguessable studio address for a new reading. */
export function readingSlug(): string {
  let s = "";
  for (let i = 0; i < 12; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `reading-${s}`;
}
