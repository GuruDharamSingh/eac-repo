/**
 * Generate URL-friendly slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Format bytes to human readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
/** Named/numeric HTML entities common in rich-text bodies. */
const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, token: string) => {
    const key = token.toLowerCase();
    if (key.startsWith("#")) {
      const code = key.startsWith("#x")
        ? Number.parseInt(key.slice(2), 16)
        : Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[key] ?? match;
  });
}

/**
 * Plain-text excerpt from a rich-text (HTML) body.
 *
 * Consolidates four near-identical copies that lived in amrit-canada,
 * hidden-enneagram, arts-collective and blog-server. Each got part of it
 * right; this keeps the best of each and fixes what none of them did:
 *
 *   - `explicit` wins when the author wrote their own summary
 *     (from the amrit-canada / hidden-enneagram pair)
 *   - ellipsis and trailing-space trim on truncation
 *     (from arts-collective)
 *   - truncates on a WORD boundary — every previous version cut mid-word,
 *     producing excerpts ending "…the congrega"
 *   - decodes HTML entities, so excerpts no longer read "Bob &amp; Alice"
 *   - returns null rather than "", matching the nullable column
 */
export function deriveExcerpt(
  body: string | null | undefined,
  options: { explicit?: string | null; max?: number } = {}
): string | null {
  const { explicit, max = 200 } = options;
  if (explicit?.trim()) return explicit.trim();
  if (!body) return null;

  const text = decodeEntities(body.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= max) return text;

  // Cut at the last space before the limit so words stay whole. Fall back to a
  // hard cut for text with no spaces in range (e.g. CJK, or a long URL).
  const window = text.slice(0, max - 1);
  const lastSpace = window.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? window.slice(0, lastSpace) : window;
  return `${cut.trimEnd()}…`;
}
