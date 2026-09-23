import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { slugify } from '@elkdonis/utils';
import type { PortfolioItem } from './profiles';
import { sanitizeThemeVars, type ThemeVars } from './themes';

// ============================================================================
// User galleries — as many gallery PAGES as a person wants (migration 124).
//
// users.portfolio is the one highlight grid on a profile. These are the rest:
// a series, a show, a year, each its own page under the person's profile
// (/artists/<slug>/galleries/<gallery> on IFAC). Owned by the user, not the
// org, exactly like the portfolio and the files under EAC_Network/users/<slug>/
// — the org only decides whether to link to them.
//
// Items share the PortfolioItem shape so the shared ProfileGallery component
// (@elkdonis/cms-ui/gallery) renders a gallery page and the profile grid with
// the same code. URLs are platform media URLs and may point into the person's
// own folder OR an org tree; each file is gated by media-authz when served,
// never by this table.
//
// Authorization is NOT in here. Every write takes a userId the caller has
// already established as the owner (or an admin acting for them) — see
// canEditProfile in profiles.ts. Keeping the check out of the data layer is
// what lets an app with a different rule reuse this.
// ============================================================================

export interface UserGallery {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  items: PortfolioItem[];
  /** Per-gallery presentation overrides (CSS custom properties), sanitised. */
  settings: ThemeVars;
  isPublic: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** The page on its home site that shows it (migration 146). */
  pagePath: string | null;
  /** The site that made it. */
  origin: string | null;
  /** Sites that must not show it. */
  hiddenOn: string[];
  /** Its storage folder, relative to the owner's user root. */
  folder: string | null;
}

/** What a listing card needs — no items payload. */
export interface UserGallerySummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  itemCount: number;
  isPublic: boolean;
  sortOrder: number;
  pagePath: string | null;
  origin: string | null;
  hiddenOn: string[];
}

type Row = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  items: unknown;
  settings: unknown;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  page_path: string | null;
  origin: string | null;
  hidden_on: string[] | null;
  folder: string | null;
};

const MAX_ITEMS = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A gallery's own id (nanoid). */
const GALLERY_ID = /^[A-Za-z0-9_-]{8,64}$/;
/** A page path as stored: lowercase segments, no leading slash. */
const PAGE_PATH = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/;
/** A site id, e.g. 'ifac'. */
const SITE_ID = /^[a-z][a-z0-9_-]{0,49}$/;

function cleanSites(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((v) => SITE_ID.test(v)))].slice(0, 20);
}

/** Same tolerant parse as profiles.ts's asPortfolio — a malformed entry is dropped, not fatal. */
export function asGalleryItems(value: unknown): PortfolioItem[] {
  if (!Array.isArray(value)) return [];
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  return value
    .slice(0, MAX_ITEMS)
    .map((w): PortfolioItem | null => {
      if (!w || typeof w !== 'object' || !('url' in w)) return null;
      const r = w as Record<string, unknown>;
      const url = String(r.url);
      // Only platform-relative media URLs. A gallery item is rendered as an
      // <img src>, so an absolute URL here would let a row point a visitor's
      // browser anywhere; the upload and library routes only ever hand out
      // /api/media/... paths, so nothing legitimate is lost.
      if (!url.startsWith('/') || url.startsWith('//')) return null;
      const artworkId =
        typeof r.artworkId === 'string' && UUID.test(r.artworkId) ? r.artworkId : undefined;
      const opens = typeof r.opens === 'string' && GALLERY_ID.test(r.opens) ? r.opens : undefined;
      const pct = (v: unknown) => {
        const n = num(v);
        return n === undefined ? undefined : Math.min(100, Math.max(0, n));
      };
      const zoom = num(r.zoom);
      const sv = r.saved && typeof r.saved === 'object' ? (r.saved as Record<string, unknown>) : null;
      const saved =
        sv && [sv.x, sv.y, sv.w, sv.h].every((v) => typeof v === 'number' && Number.isFinite(v))
          ? { x: sv.x as number, y: sv.y as number, w: sv.w as number, h: sv.h as number }
          : undefined;
      const subtitle = typeof r.subtitle === 'string' ? r.subtitle.slice(0, 300) : '';
      return {
        url,
        title: String(r.title ?? '').slice(0, 200),
        id: typeof r.id === 'string' ? r.id.slice(0, 64) : undefined,
        x: num(r.x), y: num(r.y), w: num(r.w), h: num(r.h),
        ...(artworkId ? { artworkId } : {}),
        ...(opens ? { opens } : {}),
        ...(subtitle ? { subtitle } : {}),
        ...(pct(r.fx) !== undefined ? { fx: pct(r.fx) } : {}),
        ...(pct(r.fy) !== undefined ? { fy: pct(r.fy) } : {}),
        ...(zoom !== undefined ? { zoom: Math.min(4, Math.max(1, zoom)) } : {}),
        ...(saved ? { saved } : {}),
      };
    })
    .filter((w): w is PortfolioItem => w !== null);
}

function jsonb(value: unknown): ReturnType<typeof db.json> {
  return db.json(value as never);
}

function rowToGallery(row: Row): UserGallery {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    items: asGalleryItems(row.items),
    settings: sanitizeThemeVars(row.settings),
    isPublic: row.is_public,
    sortOrder: row.sort_order,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    pagePath: row.page_path,
    origin: row.origin,
    hiddenOn: row.hidden_on ?? [],
    folder: row.folder,
  };
}

const COLS = `id, user_id, slug, title, description, cover_url, items, settings, is_public, sort_order, created_at, updated_at, page_path, origin, hidden_on, folder`;

/**
 * `site` — the site asking. A gallery whose `hidden_on` names it is left out,
 * so a gallery made on one site appears on another only by its owner's choice.
 * Omitted = no site filter (the owner's own management views).
 */
export async function listUserGalleries(
  userId: string,
  options: { onlyPublic?: boolean; site?: string } = {}
): Promise<UserGallerySummary[]> {
  try {
    const rows = await db<Array<{
      id: string; slug: string; title: string; description: string | null;
      cover_url: string | null; item_count: number; is_public: boolean; sort_order: number;
      page_path: string | null; origin: string | null; hidden_on: string[] | null;
    }>>`
      SELECT id, slug, title, description, cover_url, is_public, sort_order,
             page_path, origin, hidden_on,
             jsonb_array_length(items) AS item_count
      FROM user_galleries
      WHERE user_id = ${userId}
        -- Unconditional, not gated on onlyPublic: a backing gallery (migration
        -- 159) is not a lesser-visibility gallery, it is not a gallery this
        -- listing should ever mention — including to its own owner, editing
        -- their own site, where onlyPublic is false. It is reached only by
        -- direct id, from the block that owns it.
        AND NOT is_backing
        ${options.onlyPublic ? db`AND is_public = TRUE` : db``}
        ${options.site ? db`AND NOT (${options.site}::text = ANY(hidden_on))` : db``}
      ORDER BY sort_order ASC, created_at ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      coverUrl: r.cover_url,
      itemCount: Number(r.item_count) || 0,
      isPublic: r.is_public,
      sortOrder: r.sort_order,
      pagePath: r.page_path,
      origin: r.origin,
      hiddenOn: r.hidden_on ?? [],
    }));
  } catch (err) {
    console.error(`[galleries] listUserGalleries(${userId}):`, err);
    return [];
  }
}

export async function countUserGalleries(userId: string): Promise<number> {
  try {
    const [row] = await db<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM user_galleries WHERE user_id = ${userId} AND NOT is_backing
    `;
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function getUserGallery(
  userId: string,
  slug: string,
  options: { site?: string } = {}
): Promise<UserGallery | null> {
  try {
    const [row] = await db<Row[]>`
      SELECT ${db.unsafe(COLS)} FROM user_galleries
      WHERE user_id = ${userId} AND slug = ${slug}
        ${options.site ? db`AND NOT (${options.site}::text = ANY(hidden_on))` : db``}
      LIMIT 1
    `;
    return row ? rowToGallery(row) : null;
  } catch (err) {
    console.error(`[galleries] getUserGallery(${userId}, ${slug}):`, err);
    return null;
  }
}

export async function getUserGalleryById(id: string): Promise<UserGallery | null> {
  try {
    const [row] = await db<Row[]>`
      SELECT ${db.unsafe(COLS)} FROM user_galleries WHERE id = ${id} LIMIT 1
    `;
    return row ? rowToGallery(row) : null;
  } catch (err) {
    console.error(`[galleries] getUserGalleryById(${id}):`, err);
    return null;
  }
}

/** The gallery a page shows — at most one per page per person (146). */
export async function getUserGalleryByPage(userId: string, pagePath: string): Promise<UserGallery | null> {
  try {
    const [row] = await db<Row[]>`
      SELECT ${db.unsafe(COLS)} FROM user_galleries
      WHERE user_id = ${userId} AND page_path = ${pagePath}
      LIMIT 1
    `;
    return row ? rowToGallery(row) : null;
  } catch (err) {
    console.error(`[galleries] getUserGalleryByPage(${userId}, ${pagePath}):`, err);
    return null;
  }
}

/** A slug unique within this person's galleries: "summer-show", then "summer-show-2"… */
async function uniqueGallerySlug(userId: string, title: string): Promise<string> {
  const base = (slugify(title) || 'gallery').slice(0, 60);
  const taken = new Set(
    (await db<Array<{ slug: string }>>`
      SELECT slug FROM user_galleries WHERE user_id = ${userId} AND slug LIKE ${base + '%'}
    `).map((r) => r.slug)
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${nanoid(6)}`;
}

export interface CreateUserGalleryInput {
  title: string;
  description?: string | null;
  isPublic?: boolean;
  items?: PortfolioItem[];
  pagePath?: string | null;
  origin?: string | null;
  hiddenOn?: string[];
  folder?: string | null;
}

export async function createUserGallery(
  userId: string,
  input: CreateUserGalleryInput
): Promise<{ ok: true; gallery: UserGallery } | { ok: false; error: string }> {
  const title = (input.title ?? '').trim().slice(0, 160);
  if (!title) return { ok: false, error: 'A gallery needs a title.' };
  try {
    const slug = await uniqueGallerySlug(userId, title);
    const [{ next }] = await db<Array<{ next: number }>>`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM user_galleries WHERE user_id = ${userId}
    `;
    const items = asGalleryItems(input.items ?? []);
    const [row] = await db<Row[]>`
      INSERT INTO user_galleries (id, user_id, slug, title, description, items, is_public, sort_order, cover_url,
                                  page_path, origin, hidden_on, folder)
      VALUES (
        ${nanoid()}, ${userId}, ${slug}, ${title},
        ${input.description?.trim() || null},
        ${jsonb(items)},
        ${input.isPublic ?? true},
        ${Number(next) || 0},
        ${items[0]?.url ?? null},
        ${cleanPagePath(input.pagePath)},
        ${input.origin && SITE_ID.test(input.origin) ? input.origin : null},
        ${cleanSites(input.hiddenOn)},
        ${cleanFolder(input.folder)}
      )
      RETURNING ${db.unsafe(COLS)}
    `;
    return { ok: true, gallery: rowToGallery(row) };
  } catch (err) {
    console.error(`[galleries] createUserGallery(${userId}):`, err);
    return { ok: false, error: 'Could not create the gallery.' };
  }
}

export interface UpdateUserGalleryInput {
  title?: string;
  description?: string | null;
  items?: PortfolioItem[];
  isPublic?: boolean;
  /** Explicit cover. When omitted and items change, the first item becomes the cover. */
  coverUrl?: string | null;
  settings?: ThemeVars;
  pagePath?: string | null;
  hiddenOn?: string[];
  folder?: string | null;
}

function cleanPagePath(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim().replace(/^\/+|\/+$/g, '') : '';
  return v && v.length <= 200 && PAGE_PATH.test(v) ? v : null;
}

/** Relative to the owner's user root; never absolute, never escaping. */
function cleanFolder(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim().replace(/^\/+|\/+$/g, '') : '';
  if (!v || v.length > 200 || v.includes('..') || v.includes('\\')) return null;
  return /^[A-Za-z0-9 _.\/-]+$/.test(v) ? v : null;
}

export async function updateUserGallery(
  id: string,
  input: UpdateUserGalleryInput
): Promise<{ ok: boolean; error?: string }> {
  const sets: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const t = input.title.trim().slice(0, 160);
    if (!t) return { ok: false, error: 'A gallery needs a title.' };
    sets.title = t;
  }
  if (input.description !== undefined) sets.description = input.description?.trim() || null;
  if (input.isPublic !== undefined) sets.is_public = Boolean(input.isPublic);
  if (input.settings !== undefined) sets.settings = jsonb(sanitizeThemeVars(input.settings));
  if (input.pagePath !== undefined) sets.page_path = cleanPagePath(input.pagePath);
  if (input.hiddenOn !== undefined) sets.hidden_on = cleanSites(input.hiddenOn);
  if (input.folder !== undefined) sets.folder = cleanFolder(input.folder);
  if (input.items !== undefined) {
    const items = asGalleryItems(input.items);
    sets.items = jsonb(items);
    if (input.coverUrl === undefined) sets.cover_url = items[0]?.url ?? null;
  }
  if (input.coverUrl !== undefined) sets.cover_url = input.coverUrl || null;
  if (Object.keys(sets).length === 0) return { ok: true };
  sets.updated_at = new Date();

  try {
    await db`UPDATE user_galleries SET ${db(sets as never)} WHERE id = ${id}`;
    return { ok: true };
  } catch (err) {
    console.error(`[galleries] updateUserGallery(${id}):`, err);
    return { ok: false, error: 'Could not save the gallery.' };
  }
}

/**
 * Save a gallery's item layout, checked against who is asking.
 *
 * This is the ONE write path meant to be reachable from a fixed, unauthenticated-
 * by-itself route on any host that offers the resizable grid (@elkdonis/blocks'
 * gallery-grid — see its client component's header) — the same "one fixed
 * path every host implements" contract contact-form's /api/contact uses.
 * `updateUserGallery` itself does not check ownership (every existing caller
 * already gates it first, single-site); this is the version safe to put
 * behind a route that ANY signed-in visitor can reach, because a gallery
 * shown on one org's page may be a person nobody there administers.
 *
 * Deliberately narrow: only the gallery's OWNER may drag-resize it — not
 * "anyone who can edit this org's site", which is danamccool's own,
 * single-tenant rule (gallery-actions.ts). A shared, multi-tenant route
 * cannot assume the viewer and the gallery belong to the same org's roster,
 * so it falls back to the one relationship that is always true: whose
 * gallery it is.
 */
export async function updateOwnGalleryItems(
  viewerId: string,
  galleryId: string,
  items: PortfolioItem[]
): Promise<{ ok: boolean; error?: string }> {
  const gallery = await getUserGalleryById(galleryId);
  if (!gallery) return { ok: false, error: 'No such gallery.' };
  if (gallery.userId !== viewerId) return { ok: false, error: 'Not your gallery.' };
  return updateUserGallery(galleryId, { items });
}

export async function deleteUserGallery(id: string): Promise<boolean> {
  try {
    await db`DELETE FROM user_galleries WHERE id = ${id}`;
    return true;
  } catch (err) {
    console.error(`[galleries] deleteUserGallery(${id}):`, err);
    return false;
  }
}

/** Persist a new order. Ids not in the list keep their old sort_order. */
export async function reorderUserGalleries(userId: string, orderedIds: string[]): Promise<boolean> {
  try {
    await db.begin(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx`
          UPDATE user_galleries SET sort_order = ${i}, updated_at = NOW()
          WHERE id = ${orderedIds[i]} AND user_id = ${userId}
        `;
      }
    });
    return true;
  } catch (err) {
    console.error(`[galleries] reorderUserGalleries(${userId}):`, err);
    return false;
  }
}
