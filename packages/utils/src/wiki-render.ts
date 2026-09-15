export type WikiHeading = {
  id: string;
  text: string;
  level: number;
};

const HEADING = /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g;
const WIKILINK_ANCHOR = /<a\s([^>]*?)data-wiki-(slug|new)="([^"]*)"([^>]*?)>/g;

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function anchorSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "section"
  );
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

/**
 * Turns a stored wiki body into what the page actually renders:
 *
 *   1. every h2/h3 gets an `id`, and the heading list comes back for the TOC
 *   2. every wikilink's stored target becomes an href under `basePath`
 *
 * Both are render-time on purpose. Headings mean a page written before the
 * TOC existed still gets one; hrefs mean the stored content doesn't know or
 * care which app or route is displaying it.
 *
 * Regex rather than a DOM parse because the input is Tiptap's own output plus
 * anchors this codebase generated — flat blocks, inline markup only, already
 * sanitized on the way in. Duplicate headings get -2, -3 … so anchors stay
 * unique.
 */
export function renderWikiBody(
  html: string,
  basePath: string
): { html: string; headings: WikiHeading[] } {
  const headings: WikiHeading[] = [];
  const used = new Map<string, number>();

  let out = html.replace(HEADING, (full, level: string, attrs = "", inner: string) => {
    const text = plainText(inner);
    if (!text) return full;

    const base = anchorSlug(text);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}-${seen + 1}`;

    headings.push({ id, text, level: Number(level) });

    // An id the author somehow already set is replaced, not duplicated.
    const cleaned = (attrs || "").replace(/\sid="[^"]*"/g, "");
    return `<h${level}${cleaned} id="${id}">${inner}</h${level}>`;
  });

  out = out.replace(
    WIKILINK_ANCHOR,
    (_full, before: string, kind: string, value: string, after: string) => {
      const target = decodeAttr(value);
      const href =
        kind === "slug"
          ? `${basePath}/${encodeURIComponent(target)}`
          : `${basePath}/new?title=${encodeURIComponent(target)}`;
      const title =
        kind === "slug" ? "" : ` title="Unwritten page — click to start it"`;
      return `<a ${before}${after} href="${href}"${title}>`;
    }
  );

  return { html: out, headings };
}
