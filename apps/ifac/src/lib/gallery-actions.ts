"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@elkdonis/auth-server";
import {
  canEditProfile,
  getProfile,
  getUserGalleryById,
  createUserGallery,
  updateUserGallery,
  deleteUserGallery,
  sanitizeThemeVars,
  type ThemeVars,
} from "@elkdonis/services";
import type { SaveFieldPayload, SaveResult } from "@elkdonis/live-editor";
import type { GalleryItem } from "@elkdonis/cms-ui/gallery";

/**
 * Save actions behind a person's gallery pages on IFAC.
 *
 * Same rule as profile-editor-actions.ts: the gallery's OWNER (or a global
 * admin) may change it — canEditProfile(viewer, gallery.userId). Ownership is
 * read from the gallery row, never from the request, so a caller cannot move
 * a gallery id under a user they control.
 */

async function viewerId(): Promise<string | null> {
  const session = await getServerSession();
  if (!session.user) return null;
  return session.user.db_user_id ?? session.user.id;
}

async function authorizeUser(profileUserId: string): Promise<SaveResult> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in required." };
  if (!(await canEditProfile(viewer, profileUserId))) return { ok: false, error: "Not authorized." };
  return { ok: true };
}

async function authorizeGallery(galleryId: string) {
  const gallery = await getUserGalleryById(galleryId);
  if (!gallery) return { ok: false as const, error: "That gallery no longer exists." };
  const auth = await authorizeUser(gallery.userId);
  if (!auth.ok) return { ok: false as const, error: auth.error ?? "Not authorized." };
  return { ok: true as const, gallery };
}

async function revalidateGalleryPaths(userId: string, gallerySlug?: string) {
  const profile = await getProfile(userId);
  if (!profile?.slug) return;
  for (const base of [`/artists/${profile.slug}`, `/dealers/${profile.slug}`]) {
    revalidatePath(base);
    if (gallerySlug) revalidatePath(`${base}/galleries/${gallerySlug}`);
  }
}

export async function createGalleryAction(
  profileUserId: string,
  title: string
): Promise<{ ok: boolean; error?: string; slug?: string }> {
  const auth = await authorizeUser(profileUserId);
  if (!auth.ok) return auth;
  const result = await createUserGallery(profileUserId, { title });
  if (!result.ok) return result;
  await revalidateGalleryPaths(profileUserId, result.gallery.slug);
  return { ok: true, slug: result.gallery.slug };
}

export async function saveGalleryItemsAction(galleryId: string, items: GalleryItem[]): Promise<SaveResult> {
  const auth = await authorizeGallery(galleryId);
  if (!auth.ok) return auth;
  const result = await updateUserGallery(galleryId, {
    items: items.map((i) => ({ id: i.id, url: i.url, title: i.title, x: i.x, y: i.y, w: i.w, h: i.h })),
  });
  if (result.ok) await revalidateGalleryPaths(auth.gallery.userId, auth.gallery.slug);
  return result;
}

/** Bound to LiveEditorProps.onSaveField on a gallery page. */
export async function saveGalleryFieldAction(galleryId: string, payload: SaveFieldPayload): Promise<SaveResult> {
  const auth = await authorizeGallery(galleryId);
  if (!auth.ok) return auth;
  if (typeof payload.value !== "string") return { ok: false, error: "Unsupported field type." };
  const patch =
    payload.trait === "galleryTitle" ? { title: payload.value }
    : payload.trait === "galleryDescription" ? { description: payload.value }
    : null;
  if (!patch) return { ok: false, error: `Unknown field: ${payload.trait}` };
  const result = await updateUserGallery(galleryId, patch);
  if (result.ok) await revalidateGalleryPaths(auth.gallery.userId, auth.gallery.slug);
  return result;
}

export async function setGalleryPublicAction(galleryId: string, isPublic: boolean): Promise<SaveResult> {
  const auth = await authorizeGallery(galleryId);
  if (!auth.ok) return auth;
  const result = await updateUserGallery(galleryId, { isPublic });
  if (result.ok) await revalidateGalleryPaths(auth.gallery.userId, auth.gallery.slug);
  return result;
}

/**
 * This gallery page's own look — CSS variables scoped to the page, saved on
 * the row rather than on the person, so one show can be framed differently
 * from the next without repainting the profile.
 */
export async function saveGallerySettingsAction(galleryId: string, vars: ThemeVars): Promise<SaveResult> {
  const auth = await authorizeGallery(galleryId);
  if (!auth.ok) return auth;
  const result = await updateUserGallery(galleryId, { settings: sanitizeThemeVars(vars) });
  if (result.ok) await revalidateGalleryPaths(auth.gallery.userId, auth.gallery.slug);
  return result;
}

export async function deleteGalleryAction(galleryId: string): Promise<SaveResult> {
  const auth = await authorizeGallery(galleryId);
  if (!auth.ok) return auth;
  const ok = await deleteUserGallery(galleryId);
  if (!ok) return { ok: false, error: "Could not delete the gallery." };
  await revalidateGalleryPaths(auth.gallery.userId, auth.gallery.slug);
  return { ok: true };
}
