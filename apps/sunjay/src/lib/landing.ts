import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

/**
 * Everything the landing page reads that `data.ts` does not already answer.
 *
 * Two mechanisms, both owner-editable, neither of which has a service wrapper
 * in @elkdonis/services — they are read straight here the same way
 * apps/innergathering reads them:
 *
 *   org_site_sections   the WORDS (hero copy, section intros) — /manage/pages
 *   site_config         the IMAGES (`image_spaces`) — hero photo and gallery
 *
 * Every read is wrapped: a landing page that 500s because a config row is
 * missing is worse than one that falls back to its defaults.
 */

const ORG = siteConfig.orgId;

export interface ImageSlot {
  path?: string;
  alt?: string;
}

export interface ImageSpacesConfig {
  /** The banner photograph at the top of the page. */
  hero?: ImageSlot;
  /** Curated by the owner. Falls back to published cover images — see listGalleryImages. */
  gallery?: { images?: unknown[] };
}

async function readConfig<T>(key: string): Promise<T | null> {
  try {
    const [row] = await db<{ value: T }[]>`
      SELECT value FROM site_config WHERE org_id = ${ORG} AND key = ${key} LIMIT 1
    `;
    return row?.value ?? null;
  } catch (err) {
    console.error(`[sunjay] site_config ${key}:`, err);
    return null;
  }
}

export async function getImageSpaces(): Promise<ImageSpacesConfig> {
  return (await readConfig<ImageSpacesConfig>("image_spaces")) ?? {};
}

/**
 * Turn an owner-entered media path into something this app can serve.
 *
 * Values arrive in three shapes depending on which screen wrote them: an
 * absolute URL, a site-root path, or a bare Nextcloud tree path
 * (`EAC_Network/<org>/Media/...`). Only the third needs rewriting, onto the
 * app's own authenticated proxy at /api/media.
 */
export function mediaSrc(
  path: string | undefined | null,
  fallback: string | null = null
): string | null {
  if (!path) return fallback;
  const input = path.trim();
  if (!input) return fallback;
  if (/^https?:\/\//.test(input) || input.startsWith("/")) return input;
  const trimmed = input.replace(/^\/+/, "");
  const idx = trimmed.indexOf("EAC_Network/");
  const normalized = idx >= 0 ? trimmed.slice(idx) : trimmed;
  return normalized ? `/api/media/${normalized}` : fallback;
}

// ── the writing shelf ───────────────────────────────────────────────────────

export interface ShelfRow {
  id: string;
  slug: string;
  title: string;
  lede: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  href: string;
}

/**
 * The site's written pieces, for the shelf on the landing page.
 *
 * Reads the `writing` FEED (`threads.section`), not `kind = 'writing'`. Those
 * are two different things and the distinction matters: the `writing` kind is
 * a member's personal piece and is listed in OFF_FEED_KINDS precisely so it
 * stays OFF org feeds, living on its author's own page instead. This site's
 * blog is a section of the site, composed through /manage like every other
 * section, so the feed is the right source — and it means the shelf's links
 * (`/writing/<slug>`) are the same URLs the /writing page lists.
 */
export async function listWritingShelf(limit = 6): Promise<ShelfRow[]> {
  try {
    const rows = await db<
      Array<{
        id: string;
        slug: string | null;
        title: string;
        excerpt: string | null;
        cover_image_url: string | null;
        published_at: Date | null;
      }>
    >`
      -- The cover lives in metadata->>'coverImageUrl'; threads has no cover
      -- column. Naming one compiles in TypeScript and fails at RUNTIME, which
      -- the catch below would turn into a silently empty shelf on a 200.
      SELECT t.id, t.slug, t.title, t.excerpt, t.published_at,
             t.metadata->>'coverImageUrl' AS cover_image_url
      FROM threads t
      WHERE t.org_id = ${ORG}
        AND t.section = 'writing'
        AND t.status = 'published'
        AND t.visibility = 'PUBLIC'
      ORDER BY COALESCE(t.published_at, t.updated_at) DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug ?? r.id,
      title: r.title,
      lede: r.excerpt,
      coverImageUrl: r.cover_image_url,
      publishedAt: r.published_at ? r.published_at.toISOString() : null,
      href: `/writing/${r.slug ?? r.id}`,
    }));
  } catch (err) {
    console.error("[sunjay] listWritingShelf:", err);
    return [];
  }
}

// ── the gallery ─────────────────────────────────────────────────────────────

export interface GalleryImage {
  url: string;
  name: string;
}

function coerceCurated(images: unknown[]): GalleryImage[] {
  const out: GalleryImage[] = [];
  for (const raw of images) {
    if (typeof raw === "string") {
      const url = mediaSrc(raw);
      if (url) out.push({ url, name: "" });
      continue;
    }
    if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      const src = typeof o.path === "string" ? o.path : typeof o.url === "string" ? o.url : null;
      const url = mediaSrc(src);
      if (url) {
        out.push({
          url,
          name: typeof o.alt === "string" ? o.alt : typeof o.name === "string" ? o.name : "",
        });
      }
    }
  }
  return out;
}

/**
 * Images for the gallery at the foot of the page.
 *
 * Curated first: whatever the owner has put in `image_spaces.gallery`. When
 * that is empty, fall back to the cover images of PUBLISHED threads.
 *
 * Deliberately NOT `listOrgMediaLibrary`, which is what the hub's GalleryFace
 * uses. That lists the org's whole Nextcloud media tree including unpublished
 * filenames, which is why both amrit-canada and innergathering gate it behind
 * `canEdit`. This is a public page, so it may only show things that have
 * already been published.
 */
export async function listGalleryImages(limit = 12): Promise<GalleryImage[]> {
  const spaces = await getImageSpaces();
  const curated = coerceCurated(spaces.gallery?.images ?? []);
  if (curated.length > 0) return curated.slice(0, limit);

  try {
    const rows = await db<Array<{ cover: string | null; title: string }>>`
      SELECT t.metadata->>'coverImageUrl' AS cover, t.title
      FROM threads t
      WHERE t.org_id = ${ORG}
        AND t.status = 'published'
        AND t.visibility = 'PUBLIC'
        AND COALESCE(t.metadata->>'coverImageUrl', '') <> ''
      ORDER BY COALESCE(t.published_at, t.updated_at) DESC
      LIMIT ${limit}
    `;
    const seen = new Set<string>();
    const out: GalleryImage[] = [];
    for (const r of rows) {
      const url = mediaSrc(r.cover);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ url, name: r.title });
    }
    return out;
  } catch (err) {
    console.error("[sunjay] listGalleryImages:", err);
    return [];
  }
}
