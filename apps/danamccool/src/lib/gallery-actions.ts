'use server';

import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';
import { db } from '@elkdonis/db';
import {
  createUserGallery,
  updateUserGallery,
  deleteUserGallery,
  getUserGalleryById,
  listUserGalleries,
  reorderUserGalleries,
  type UserGallery,
} from '@elkdonis/services';
import type { GalleryItem } from '@elkdonis/cms-ui/gallery';
import { getSiteOwnerUserId, getViewer } from './auth';

// ============================================================================
// Galleries — her COLLECTIONS. Server actions for the gallery manager (the
// Puck rail panel, /hub and /gallery all mount the same one) and for the
// picture wall on a single gallery page.
//
// Every gallery here is DANA's (user_galleries.user_id = the site owner):
// this is her personal site, so a gallery made on it is hers whoever made it.
// Who may arrange them: anyone who can edit the site (owner or guide). What
// an artwork IS — its title, whether it is for sale — stays with
// /manage/artworks, which only she or an owner can change.
//
// Made here, a gallery:
//   origin     'danamccool'
//   hidden_on  ['ifac']   — appearing on her IFAC profile is her choice
//   folder     Galleries/<slug> in her storage — uploads into it land there
// ============================================================================

const SITE = 'danamccool';
const NOT_ALLOWED = 'Sign in as someone who can edit this site.';

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function editorAndOwner(): Promise<{ ownerId: string } | null> {
  const [viewer, ownerId] = await Promise.all([getViewer(), getSiteOwnerUserId()]);
  if (!viewer?.canEdit || !ownerId) return null;
  return { ownerId };
}

async function ownedGallery(galleryId: string): Promise<{ gallery: UserGallery } | { error: string }> {
  const who = await editorAndOwner();
  if (!who) return { error: NOT_ALLOWED };
  const gallery = await getUserGalleryById(galleryId);
  // A gallery belonging to anyone but her is not this site's to touch.
  if (!gallery || gallery.userId !== who.ownerId) return { error: 'That gallery no longer exists.' };
  return { gallery };
}

function touch(gallery: Pick<UserGallery, 'slug' | 'pagePath'>) {
  revalidatePath('/gallery');
  revalidatePath(`/gallery/${gallery.slug}`);
  if (gallery.pagePath) revalidatePath(`/${gallery.pagePath}`);
  revalidatePath('/hub');
}

// ---------------------------------------------------------------------------
// Reading, for the manager
// ---------------------------------------------------------------------------

export interface HudGallery {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  itemCount: number;
  isPublic: boolean;
  pagePath: string | null;
  showOnIfac: boolean;
  origin: string | null;
}

/** Everything in the catalogue, whatever its state — the manager shows all. */
export interface HudArtwork {
  id: string;
  title: string;
  year: number | null;
  image: string | null;
  /** How the site shows it: see lib/artwork-actions.ts. */
  mode: 'sale' | 'portfolio' | 'hidden' | 'sold' | 'reserved';
  titleConfirmed: boolean;
}

export interface HudItem {
  /** The item's own id within the gallery. */
  key: string;
  url: string;
  title: string;
  subtitle?: string;
  /** Another of her galleries this picture opens (nested gallery), by id. */
  opens?: string;
  artwork: HudArtwork | null;
  /** Where it sits on the grid, when it has been placed — for listing in that order. */
  x?: number;
  y?: number;
}

export async function listGalleriesForHud(): Promise<Result<{ galleries: HudGallery[] }>> {
  const who = await editorAndOwner();
  if (!who) return { ok: false, error: NOT_ALLOWED };
  const rows = await listUserGalleries(who.ownerId);
  return {
    ok: true,
    galleries: rows.map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      description: g.description,
      coverUrl: g.coverUrl,
      itemCount: g.itemCount,
      isPublic: g.isPublic,
      pagePath: g.pagePath,
      showOnIfac: !g.hiddenOn.includes('ifac'),
      origin: g.origin,
    })),
  };
}

async function catalogue(ownerId: string, ids?: string[]): Promise<HudArtwork[]> {
  const rows = await db<
    Array<{
      id: string;
      title: string;
      year_created: number | null;
      status: string;
      site: string | null;
      confirmed: boolean | null;
      image: string | null;
    }>
  >`
    SELECT a.id, a.title, a.year_created, a.status,
           a.metadata->>'site' AS site,
           (a.metadata->>'title_confirmed')::boolean AS confirmed,
           COALESCE(pm.url, (SELECT url FROM artwork_media m WHERE m.artwork_id = a.id ORDER BY position LIMIT 1)) AS image
    FROM artwork a
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.artist_user_id = ${ownerId}
      ${ids ? db`AND a.id = ANY(${ids}::uuid[])` : db``}
    ORDER BY COALESCE((a.metadata->>'position')::int, 1000), a.title
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    year: r.year_created,
    image: r.image,
    mode:
      r.status === 'sold' || r.status === 'reserved'
        ? r.status
        : r.status === 'available'
          ? 'sale'
          : r.site === 'portfolio'
            ? 'portfolio'
            : 'hidden',
    titleConfirmed: r.confirmed !== false,
  }));
}

/** Her whole catalogue, for "add from the catalogue". */
export async function listCatalogueForHud(): Promise<Result<{ artworks: HudArtwork[] }>> {
  const who = await editorAndOwner();
  if (!who) return { ok: false, error: NOT_ALLOWED };
  return { ok: true, artworks: await catalogue(who.ownerId) };
}

export async function getGalleryForHud(
  galleryId: string
): Promise<Result<{ gallery: HudGallery & { folder: string | null }; items: HudItem[] }>> {
  const found = await ownedGallery(galleryId);
  if ('error' in found) return { ok: false, error: found.error };
  const g = found.gallery;
  const ids = g.items.map((i) => i.artworkId).filter((x): x is string => !!x);
  const owner = (await getSiteOwnerUserId())!;
  const byId = new Map((ids.length ? await catalogue(owner, ids) : []).map((a) => [a.id, a]));
  return {
    ok: true,
    gallery: {
      id: g.id,
      slug: g.slug,
      title: g.title,
      description: g.description,
      coverUrl: g.coverUrl,
      itemCount: g.items.length,
      isPublic: g.isPublic,
      pagePath: g.pagePath,
      showOnIfac: !g.hiddenOn.includes('ifac'),
      origin: g.origin,
      folder: g.folder,
    },
    items: g.items.map((i, n) => ({
      key: i.id ?? `${g.id}-${n}`,
      url: i.artworkId ? (byId.get(i.artworkId)?.image ?? i.url) : i.url,
      title: i.artworkId ? (byId.get(i.artworkId)?.title ?? i.title) : i.title,
      subtitle: i.subtitle,
      ...(i.opens ? { opens: i.opens } : {}),
      ...(typeof i.x === 'number' ? { x: i.x } : {}),
      ...(typeof i.y === 'number' ? { y: i.y } : {}),
      artwork: i.artworkId ? (byId.get(i.artworkId) ?? null) : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export async function createGalleryAction(
  title: string,
  options: { pagePath?: string | null } = {}
): Promise<Result<{ id: string; slug: string }>> {
  const who = await editorAndOwner();
  if (!who) return { ok: false, error: NOT_ALLOWED };
  const result = await createUserGallery(who.ownerId, {
    title,
    pagePath: options.pagePath ?? null,
    origin: SITE,
    hiddenOn: ['ifac'],
    // Hidden until her IFAC profile honours `hidden_on` (IFAC needs a rebuild
    // for that) — a public gallery would otherwise appear there at once. Her
    // own pages show a linked gallery either way; see lib/galleries.ts.
    isPublic: false,
  });
  if ('error' in result) return { ok: false, error: result.error };
  const folder = `Galleries/${result.gallery.slug}`;
  await updateUserGallery(result.gallery.id, { folder });
  touch(result.gallery);
  return { ok: true, id: result.gallery.id, slug: result.gallery.slug };
}

export async function updateGalleryAction(
  galleryId: string,
  input: {
    title?: string;
    description?: string | null;
    isPublic?: boolean;
    showOnIfac?: boolean;
    pagePath?: string | null;
  }
): Promise<Result> {
  const found = await ownedGallery(galleryId);
  if ('error' in found) return { ok: false, error: found.error };
  const g = found.gallery;
  const hiddenOn =
    input.showOnIfac === undefined
      ? undefined
      : input.showOnIfac
        ? g.hiddenOn.filter((s) => s !== 'ifac')
        : [...new Set([...g.hiddenOn, 'ifac'])];
  const result = await updateUserGallery(galleryId, {
    title: input.title,
    description: input.description,
    isPublic: input.isPublic,
    hiddenOn,
    pagePath: input.pagePath,
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        input.pagePath && result.error?.includes('save')
          ? 'Another gallery already belongs to that page.'
          : (result.error ?? 'Could not save.'),
    };
  }
  touch({ slug: g.slug, pagePath: g.pagePath });
  if (input.pagePath) revalidatePath(`/${input.pagePath}`);
  return { ok: true };
}

/**
 * Replace the gallery's items — the order, and what is in it. Items keep
 * their artwork link; a plain picture keeps its address and title.
 */
export async function saveGalleryItemsAction(
  galleryId: string,
  items: Array<GalleryItem & { artworkId?: string; saved?: unknown; opens?: string }>
): Promise<Result> {
  const found = await ownedGallery(galleryId);
  if ('error' in found) return { ok: false, error: found.error };
  // A caller that knows nothing of artworks — the picture-wall editor on
  // /gallery/<slug> rebuilds items from its own shape — must not unlink them.
  // An item that arrives without `artworkId` keeps the one it already had.
  const had = new Map(
    found.gallery.items.filter((i) => i.id && i.artworkId).map((i) => [i.id!, i.artworkId!])
  );
  // Likewise the words and framing: a caller that does not send them (the
  // Galleries panel's reorder) keeps what the item already had.
  const before = new Map(found.gallery.items.filter((i) => i.id).map((i) => [i.id!, i]));
  const result = await updateUserGallery(galleryId, {
    items: items.map((i) => {
      const artworkId = i.artworkId ?? (i.id ? had.get(i.id) : undefined);
      return {
        id: i.id,
        url: i.url,
        title: i.title,
        x: i.x,
        y: i.y,
        w: i.w,
        h: i.h,
        ...(artworkId ? { artworkId } : {}),
        // Carried through as given; asGalleryItems clamps and drops anything malformed.
        ...(() => {
          const old = i.id ? before.get(i.id) : undefined;
          const subtitle = typeof i.subtitle === "string" ? i.subtitle : old?.subtitle;
          const fx = typeof i.fx === "number" ? i.fx : old?.fx;
          const fy = typeof i.fy === "number" ? i.fy : old?.fy;
          const zoom = typeof i.zoom === "number" ? i.zoom : old?.zoom;
          const saved = i.saved && typeof i.saved === "object" ? (i.saved as { x: number; y: number; w: number; h: number }) : old?.saved;
          // A nested-gallery link is changed only by setGalleryItemOpensAction;
          // a caller that does not send it keeps it ("" clears it).
          const opens = typeof i.opens === "string" ? i.opens : old?.opens;
          return {
            ...(opens && opens !== galleryId ? { opens } : {}),
            ...(subtitle ? { subtitle } : {}),
            ...(fx !== undefined ? { fx } : {}),
            ...(fy !== undefined ? { fy } : {}),
            ...(zoom !== undefined ? { zoom } : {}),
            ...(saved ? { saved } : {}),
          };
        })(),
      };
    }),
  });
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save.' };
  touch(found.gallery);
  return { ok: true };
}

/** The HUD's own shape: add artworks from her catalogue, at the end. */
export async function addArtworksAction(galleryId: string, artworkIds: string[]): Promise<Result<{ added: number }>> {
  const found = await ownedGallery(galleryId);
  if ('error' in found) return { ok: false, error: found.error };
  const g = found.gallery;
  const already = new Set(g.items.map((i) => i.artworkId).filter(Boolean));
  const wanted = [...new Set(artworkIds)].filter((id) => !already.has(id));
  if (wanted.length === 0) return { ok: true, added: 0 };
  // Only her own pieces can go in — the query is scoped by artist.
  const art = await catalogue(g.userId, wanted);
  const next = [
    ...g.items,
    ...art.filter((a) => a.image).map((a) => ({ id: nanoid(10), url: a.image!, title: a.title, artworkId: a.id })),
  ];
  const result = await updateUserGallery(galleryId, { items: next });
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save.' };
  touch(g);
  return { ok: true, added: next.length - g.items.length };
}

/** Plain pictures — an upload, or a file chosen from storage. */
export async function addPicturesAction(
  galleryId: string,
  pictures: Array<{ url: string; title?: string }>
): Promise<Result<{ added: number }>> {
  const found = await ownedGallery(galleryId);
  if ('error' in found) return { ok: false, error: found.error };
  const g = found.gallery;
  const clean = pictures
    .filter((p) => typeof p.url === 'string' && p.url.startsWith('/api/media/'))
    .map((p) => ({ id: nanoid(10), url: p.url, title: String(p.title ?? '').slice(0, 200) }));
  const result = await updateUserGallery(galleryId, { items: [...g.items, ...clean] });
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save.' };
  touch(g);
  return { ok: true, added: clean.length };
}

export async function deleteGalleryAction(galleryId: string): Promise<Result> {
  const found = await ownedGallery(galleryId);
  if ('error' in found) return { ok: false, error: found.error };
  // The gallery goes; its files and the artworks in it do not. A folder of
  // pictures is not deleted because a list that pointed at it was.
  const ok = await deleteUserGallery(galleryId);
  if (!ok) return { ok: false, error: 'Could not delete the gallery.' };
  touch(found.gallery);
  return { ok: true };
}

export async function reorderGalleriesAction(orderedIds: string[]): Promise<Result> {
  const who = await editorAndOwner();
  if (!who) return { ok: false, error: NOT_ALLOWED };
  const ok = await reorderUserGalleries(who.ownerId, orderedIds);
  if (!ok) return { ok: false, error: 'Could not save the order.' };
  revalidatePath('/gallery');
  revalidatePath('/hub');
  return { ok: true };
}

/** Where uploads into this gallery go — see /api/media/upload. */
export async function galleryUploadTarget(galleryId: string): Promise<string | null> {
  const found = await ownedGallery(galleryId);
  return 'error' in found ? null : found.gallery.slug;
}


/**
 * Make one picture OPEN another of her galleries (a nested gallery), or stop
 * it (`null`). The target must be hers and not this gallery itself; a longer
 * loop (A → B → A) is allowed to be saved and stopped where it is shown —
 * see blocks/nested.ts.
 */
export async function setGalleryItemOpensAction(
  galleryId: string,
  itemId: string,
  opens: string | null
): Promise<Result> {
  const found = await ownedGallery(galleryId);
  if ('error' in found) return { ok: false, error: found.error };
  const g = found.gallery;
  if (opens) {
    if (opens === galleryId) return { ok: false, error: 'A picture cannot open the gallery it is in.' };
    const target = await ownedGallery(opens);
    if ('error' in target) return { ok: false, error: 'That gallery no longer exists.' };
  }
  let hit = false;
  const items = g.items.map((i) => {
    if (i.id !== itemId) return i;
    hit = true;
    const next = { ...i };
    if (opens) next.opens = opens;
    else delete next.opens;
    return next;
  });
  if (!hit) return { ok: false, error: 'That picture is no longer in the gallery.' };
  const result = await updateUserGallery(galleryId, { items });
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save.' };
  touch(g);
  return { ok: true };
}

/** The gallery linked to a page, for the editor's Pictures field. */
export async function galleryForPageAction(pagePath: string): Promise<Result<{ id: string | null }>> {
  const who = await editorAndOwner();
  if (!who) return { ok: false, error: NOT_ALLOWED };
  const [row] = await db<Array<{ id: string }>>`
    SELECT id FROM user_galleries WHERE user_id = ${who.ownerId} AND page_path = ${pagePath} LIMIT 1
  `;
  return { ok: true, id: row?.id ?? null };
}

/**
 * One picture's words: its title (plain pictures only — an artwork's title
 * belongs to the artwork) and its subtitle. Written straight to the gallery.
 */
export async function updateGalleryItemTextAction(
  galleryId: string,
  itemId: string,
  patch: { title?: string; subtitle?: string }
): Promise<Result> {
  const found = await ownedGallery(galleryId);
  if ('error' in found) return { ok: false, error: found.error };
  const g = found.gallery;
  let hit = false;
  const items = g.items.map((i) => {
    if (i.id !== itemId) return i;
    hit = true;
    const next = { ...i };
    if (patch.title !== undefined && !i.artworkId) next.title = patch.title.trim().slice(0, 200);
    if (patch.subtitle !== undefined) {
      const sub = patch.subtitle.trim().slice(0, 300);
      if (sub) next.subtitle = sub;
      else delete next.subtitle;
    }
    return next;
  });
  if (!hit) return { ok: false, error: 'That picture is no longer in the gallery.' };
  const result = await updateUserGallery(galleryId, { items });
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save.' };
  touch(g);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sub-galleries — a gallery one picture of another gallery OPENS.
//
// Made from inside the parent: name it, choose its pictures (the parent's
// own, and/or files from storage), and one of them — the COVER — stays in
// the parent and opens it. The link is the cover item's `opens` (see
// blocks/nested.ts); nothing else ties the two together, so a sub-gallery is
// an ordinary gallery in every other respect.
// ---------------------------------------------------------------------------

type SubItem = UserGallery['items'][number];

/** A picture copied into another gallery: its words and artwork, not its layout. */
function copyItem(i: SubItem): SubItem {
  return {
    id: nanoid(10),
    url: i.url,
    title: i.title,
    ...(i.artworkId ? { artworkId: i.artworkId } : {}),
    ...(i.subtitle ? { subtitle: i.subtitle } : {}),
  } as SubItem;
}

function storagePicture(p: { url: string; name?: string }): SubItem | null {
  if (typeof p.url !== 'string' || !p.url.startsWith('/api/media/')) return null;
  const name = String(p.name ?? p.url.split('/').pop() ?? '');
  let title = name;
  try {
    title = decodeURIComponent(name);
  } catch {
    /* keep */
  }
  return { id: nanoid(10), url: p.url, title: title.replace(/\.[^.]+$/, '').slice(0, 200) } as SubItem;
}

export async function createSubGalleryAction(
  parentId: string,
  input: {
    title: string;
    /** The parent's pictures to include, by item key. */
    keys: string[];
    /** Pictures from storage to include. */
    files?: Array<{ url: string; name?: string }>;
    /** Which chosen picture stays in the parent and opens the new gallery. Default: the first. */
    coverKey?: string;
    /** Take the chosen parent pictures out of the parent (the cover stays). */
    move?: boolean;
  }
): Promise<Result<{ id: string; title: string }>> {
  const found = await ownedGallery(parentId);
  if ('error' in found) return { ok: false, error: found.error };
  const parent = found.gallery;
  const title = input.title.trim().slice(0, 120);
  if (!title) return { ok: false, error: 'Give the sub-gallery a name.' };

  const byKey = new Map(parent.items.map((i, n) => [i.id ?? `${parent.id}-${n}`, i]));
  const chosen = [...new Set(input.keys)].map((k) => byKey.get(k)).filter((i): i is SubItem => !!i);
  const files = (input.files ?? []).map(storagePicture).filter((i): i is SubItem => !!i);
  if (chosen.length + files.length === 0) return { ok: false, error: 'Choose at least one picture for it.' };

  // 1. The new gallery, with the chosen pictures.
  const made = await createUserGallery(found.gallery.userId, {
    title,
    pagePath: null,
    origin: SITE,
    hiddenOn: ['ifac'],
    isPublic: false,
  });
  if ('error' in made) return { ok: false, error: made.error };
  const sub = made.gallery;
  const subItems = [...chosen.map(copyItem), ...files];
  const filled = await updateUserGallery(sub.id, { folder: `Galleries/${sub.slug}`, items: subItems });
  if (!filled.ok) return { ok: false, error: filled.error ?? 'Could not save the sub-gallery.' };

  // 2. The parent: the cover opens it; the rest optionally leave.
  const coverKey = input.coverKey && byKey.has(input.coverKey) ? input.coverKey : chosen.length ? (chosen[0]!.id ?? null) : null;
  const leaving = new Set(input.move ? chosen.map((i) => i.id).filter((id) => id && id !== coverKey) : []);
  let items: SubItem[] = parent.items
    .filter((i) => !(i.id && leaving.has(i.id)))
    .map((i) => (coverKey && i.id === coverKey ? ({ ...i, opens: sub.id } as SubItem) : i));
  if (!coverKey) {
    // Only files were chosen: the first joins the parent as the cover.
    items = [...items, { ...files[0]!, id: nanoid(10), opens: sub.id } as SubItem];
  }
  const linked = await updateUserGallery(parentId, { items });
  if (!linked.ok) return { ok: false, error: linked.error ?? 'Made the sub-gallery, but could not link it.' };
  touch(parent);
  return { ok: true, id: sub.id, title };
}

/** Copy some of one gallery's pictures into another (a sub-gallery's "add"). */
export async function copyPicturesToGalleryAction(
  targetId: string,
  sourceId: string,
  keys: string[]
): Promise<Result<{ added: number }>> {
  const [target, source] = await Promise.all([ownedGallery(targetId), ownedGallery(sourceId)]);
  if ('error' in target) return { ok: false, error: target.error };
  if ('error' in source) return { ok: false, error: source.error };
  const byKey = new Map(source.gallery.items.map((i, n) => [i.id ?? `${sourceId}-${n}`, i]));
  const have = new Set(target.gallery.items.map((i) => i.url));
  const add = [...new Set(keys)]
    .map((k) => byKey.get(k))
    .filter((i): i is SubItem => !!i && !have.has(i.url))
    .map(copyItem);
  if (add.length === 0) return { ok: true, added: 0 };
  const result = await updateUserGallery(targetId, { items: [...target.gallery.items, ...add] });
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save.' };
  touch(target.gallery);
  return { ok: true, added: add.length };
}

/** Take pictures out of a gallery. The files stay in storage. */
export async function removeGalleryPicturesAction(galleryId: string, keys: string[]): Promise<Result<{ removed: number }>> {
  const found = await ownedGallery(galleryId);
  if ('error' in found) return { ok: false, error: found.error };
  const g = found.gallery;
  const drop = new Set(keys);
  const items = g.items.filter((i, n) => !drop.has(i.id ?? `${g.id}-${n}`));
  const result = await updateUserGallery(galleryId, { items });
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not save.' };
  touch(g);
  return { ok: true, removed: g.items.length - items.length };
}
