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
};

const MAX_ITEMS = 500;

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
      return {
        url,
        title: String(r.title ?? '').slice(0, 200),
        id: typeof r.id === 'string' ? r.id.slice(0, 64) : undefined,
        x: num(r.x), y: num(r.y), w: num(r.w), h: num(r.h),
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
  };
}

const COLS = `id, user_id, slug, title, description, cover_url, items, settings, is_public, sort_order, created_at, updated_at`;

export async function listUserGalleries(
  userId: string,
  options: { onlyPublic?: boolean } = {}
): Promise<UserGallerySummary[]> {
  try {
    const rows = await db<Array<{
      id: string; slug: string; title: string; description: string | null;
      cover_url: string | null; item_count: number; is_public: boolean; sort_order: number;
    }>>`
      SELECT id, slug, title, description, cover_url, is_public, sort_order,
             jsonb_array_length(items) AS item_count
      FROM user_galleries
      WHERE user_id = ${userId}
        ${options.onlyPublic ? db`AND is_public = TRUE` : db``}
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
    }));
  } catch (err) {
    console.error(`[galleries] listUserGalleries(${userId}):`, err);
    return [];
  }
}

export async function countUserGalleries(userId: string): Promise<number> {
  try {
    const [row] = await db<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM user_galleries WHERE user_id = ${userId}
    `;
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function getUserGallery(userId: string, slug: string): Promise<UserGallery | null> {
  try {
    const [row] = await db<Row[]>`
      SELECT ${db.unsafe(COLS)} FROM user_galleries
      WHERE user_id = ${userId} AND slug = ${slug}
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
      INSERT INTO user_galleries (id, user_id, slug, title, description, items, is_public, sort_order, cover_url)
      VALUES (
        ${nanoid()}, ${userId}, ${slug}, ${title},
        ${input.description?.trim() || null},
        ${jsonb(items)},
        ${input.isPublic ?? true},
        ${Number(next) || 0},
        ${items[0]?.url ?? null}
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
