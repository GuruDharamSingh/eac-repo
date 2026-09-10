/**
 * Reads the IFAC blog (Blogger) as data rather than embedding it.
 *
 * The section used to be an <iframe> of the whole blogspot site, which drags
 * in Blogger's own chrome, navigation and theme, ignores this site's design,
 * cannot be styled, and is a poor experience on a phone. Blogger publishes a
 * real feed, so the posts can be rendered as native cards instead.
 *
 * Deliberately fail-soft: every failure path returns an empty array rather
 * than throwing, and the page falls back to the old iframe when that happens.
 * A third-party feed being slow or down should never take out the home page.
 */

export interface BlogPost {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  author: string | null;
  excerpt: string;
  imageUrl: string | null;
}

/** Blogger's JSON feed, only the parts used here. */
interface FeedEntry {
  id?: { $t?: string };
  title?: { $t?: string };
  content?: { $t?: string };
  summary?: { $t?: string };
  published?: { $t?: string };
  author?: Array<{ name?: { $t?: string } }>;
  link?: Array<{ rel?: string; href?: string; type?: string }>;
  "media$thumbnail"?: { url?: string };
}

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  mdash: "—", ndash: "–", hellip: "…", middot: "·",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Post bodies are author-written HTML from a third party, so they are reduced
 * to plain text rather than rendered — an excerpt is not worth an injection
 * surface. Script and style blocks go first, so their contents never surface
 * as "text".
 */
function toExcerpt(html: string, title: string, max = 190): string {
  const text = decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();

  // These posts almost all open by repeating their own title, so the card
  // would read "Art Value vs. Price — Art Value vs. Price Are the prices…".
  // Drop the leading copy when it is there.
  const normalized = title.trim();
  const deduped =
    normalized && text.toLowerCase().startsWith(normalized.toLowerCase())
      ? text.slice(normalized.length).replace(/^[\s\p{P}]+/u, "")
      : text;
  if (deduped.length <= max) return deduped;
  // Cut on a word boundary so the ellipsis doesn't land mid-word.
  const cut = deduped.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Blogger serves thumbnails at s72 by default — far too small for a card, and
 * it upscales blurry. The size lives in a path segment, so asking for a bigger
 * render is a rewrite rather than a resize.
 */
function upscaleThumbnail(url: string): string {
  return url.replace(/\/s\d+(-[wh]\d+)*(-c)?\//, "/w640/");
}

function parseEntry(entry: FeedEntry): BlogPost | null {
  const title = entry.title?.$t?.trim();
  const url = entry.link?.find((l) => l.rel === "alternate")?.href;
  if (!title || !url) return null;

  const raw = entry.content?.$t ?? entry.summary?.$t ?? "";
  const thumb = entry["media$thumbnail"]?.url;

  return {
    id: entry.id?.$t ?? url,
    title: decodeEntities(title),
    url,
    publishedAt: entry.published?.$t ?? "",
    author: entry.author?.[0]?.name?.$t ?? null,
    excerpt: toExcerpt(raw, title),
    imageUrl: thumb ? upscaleThumbnail(thumb) : null,
  };
}

/**
 * Fetch the most recent posts.
 *
 * `blogUrl` is whatever site_config holds (e.g. https://ifacgroup.blogspot.com/),
 * so an editor changing the blog address in the CMS moves the feed with it.
 * Cached for an hour: this is a blog, not a ticker, and it keeps a slow
 * third-party host off the render path for all but one request an hour.
 */
export async function fetchBlogPosts(blogUrl: string, limit = 6): Promise<BlogPost[]> {
  if (!blogUrl) return [];
  let feedUrl: string;
  try {
    const base = new URL(blogUrl);
    feedUrl = new URL(
      `/feeds/posts/default?alt=json&max-results=${limit}`,
      base.origin
    ).toString();
  } catch {
    return [];
  }

  try {
    const res = await fetch(feedUrl, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.error(`[ifac] blog feed ${feedUrl} -> ${res.status}`);
      return [];
    }
    const body = (await res.json()) as { feed?: { entry?: FeedEntry[] } };
    const entries = body.feed?.entry ?? [];
    return entries
      .map(parseEntry)
      .filter((p): p is BlogPost => p !== null)
      .slice(0, limit);
  } catch (err) {
    // Network error, malformed JSON, a non-Blogger URL — all the same to the
    // caller, which just shows the fallback.
    console.error("[ifac] blog feed:", (err as Error).message);
    return [];
  }
}

/** e.g. "31 July 2023" — the feed's ISO timestamp is not for readers. */
export function formatPostDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
