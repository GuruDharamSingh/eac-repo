'use server';

import { revalidatePath } from 'next/cache';
import {
  createUserGallery,
  updateUserGallery,
  deleteUserGallery,
  getUserGalleryById,
  type UserGallery,
} from '@elkdonis/services';
import type { GalleryItem } from '@elkdonis/cms-ui/gallery';
import { getViewer } from './auth';

/**
 * Gallery write actions, gated by getViewer().canEdit — this is a
 * single-artist site, so "editable" just means "is Dana (or an admin with
 * the owner/guide role on org `danamccool`)", matching how amrit-canada and
 * IFAC gate their own editing.
 */

const NOT_SIGNED_IN = 'Sign in as the site owner required.';

// The repo compiles non-strict, so `{ ok: true } | { ok: false }` does not
// narrow — `ok` widens to boolean and stops being a discriminant. These
// helpers return a nullable value instead of a tagged union.
async function authorizedUserId(): Promise<string | null> {
  const viewer = await getViewer();
  return viewer?.canEdit ? viewer.userId : null;
}

async function authorizedGallery(
  galleryId: string
): Promise<{ gallery: UserGallery; error?: undefined } | { gallery?: undefined; error: string }> {
  const gallery = await getUserGalleryById(galleryId);
  if (!gallery) return { error: 'That gallery no longer exists.' };
  const userId = await authorizedUserId();
  if (!userId) return { error: NOT_SIGNED_IN };
  if (userId !== gallery.userId) return { error: 'Not authorized.' };
  return { gallery };
}

export async function createGalleryAction(
  title: string
): Promise<{ ok: boolean; error?: string; slug?: string }> {
  const userId = await authorizedUserId();
  if (!userId) return { ok: false, error: NOT_SIGNED_IN };
  const result = await createUserGallery(userId, { title });
  if (!result.ok) return result;
  revalidatePath('/gallery');
  return { ok: true, slug: result.gallery.slug };
}

export async function saveGalleryItemsAction(
  galleryId: string,
  items: GalleryItem[]
): Promise<{ ok: boolean; error?: string }> {
  const { gallery, error } = await authorizedGallery(galleryId);
  if (!gallery) return { ok: false, error };
  const result = await updateUserGallery(galleryId, {
    items: items.map((i) => ({ id: i.id, url: i.url, title: i.title, x: i.x, y: i.y, w: i.w, h: i.h })),
  });
  if (result.ok) {
    revalidatePath('/gallery');
    revalidatePath(`/gallery/${gallery.slug}`);
  }
  return result;
}

export async function deleteGalleryAction(galleryId: string): Promise<{ ok: boolean; error?: string }> {
  const { gallery, error } = await authorizedGallery(galleryId);
  if (!gallery) return { ok: false, error };
  const ok = await deleteUserGallery(galleryId);
  if (!ok) return { ok: false, error: 'Could not delete the gallery.' };
  revalidatePath('/gallery');
  return { ok: true };
}
