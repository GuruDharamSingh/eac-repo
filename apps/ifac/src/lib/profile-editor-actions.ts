"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@elkdonis/auth-server";
import { updateProfile, canEditProfile, getProfile, type UpdateProfileInput } from "@elkdonis/services";
import type { SaveFieldPayload, SaveResult, GalleryItem } from "@elkdonis/ui";

/**
 * Save actions behind the inline profile editor on IFAC's own artist/dealer
 * pages (see apps/ifac/src/app/artists/[slug]/page.tsx). Unlike amrit-canada's
 * updateOwnProfileAction (no userId param — always the caller's own row),
 * these DO take a profileUserId: the page renders for any profile's public
 * visitors, and canEditProfile(viewerId, profileUserId) is the actual check
 * — self, or a global admin. Same underlying rule, just checked explicitly
 * because the target isn't implicitly "whoever is signed in" here.
 */

// Returns SaveResult (ok: boolean; error?: string) rather than a true
// discriminated union on purpose: TS fails to narrow `if (!x.ok) return
// x.error` unions declared in a "use server" file (Next's server-action
// type transform interacts oddly with it — confirmed elsewhere in this
// session too). error is simply optional here, so no narrowing is needed.
async function authorize(profileUserId: string): Promise<SaveResult> {
  const session = await getServerSession();
  if (!session.user) return { ok: false, error: "Sign in required." };
  const viewerId = session.user.db_user_id ?? session.user.id;
  const allowed = await canEditProfile(viewerId, profileUserId);
  if (!allowed) return { ok: false, error: "Not authorized to edit this profile." };
  return { ok: true };
}

async function revalidateProfile(profileUserId: string) {
  revalidatePath("/");
  const profile = await getProfile(profileUserId);
  if (profile?.slug) {
    revalidatePath(`/artists/${profile.slug}`);
    revalidatePath(`/dealers/${profile.slug}`);
  }
}

// Only fields the page actually renders as self-owned data belong here —
// role_title, for instance, is IFAC's own call (see /admin/directory), not
// the artist's, so it's deliberately not offered through this self-edit path.
const FIELD_TO_COLUMN: Record<string, keyof UpdateProfileInput> = {
  bio: "bio",
};

/** Bound to LiveEditorProps.onSaveField for the bio trait. */
export async function saveProfileFieldAction(profileUserId: string, payload: SaveFieldPayload): Promise<SaveResult> {
  const auth = await authorize(profileUserId);
  if (!auth.ok) return auth;

  if (typeof payload.value !== "string") return { ok: false, error: "Unsupported field type." };
  const column = FIELD_TO_COLUMN[payload.trait];
  if (!column) return { ok: false, error: `Unknown field: ${payload.trait}` };

  await updateProfile(profileUserId, { [column]: payload.value || null });
  await revalidateProfile(profileUserId);
  return { ok: true };
}

export async function saveAvatarAction(profileUserId: string, avatarUrl: string): Promise<SaveResult> {
  const auth = await authorize(profileUserId);
  if (!auth.ok) return auth;

  await updateProfile(profileUserId, { avatarUrl });
  await revalidateProfile(profileUserId);
  return { ok: true };
}

export async function saveGalleryAction(profileUserId: string, items: GalleryItem[]): Promise<SaveResult> {
  const auth = await authorize(profileUserId);
  if (!auth.ok) return auth;

  await updateProfile(profileUserId, {
    portfolio: items.map((i) => ({ id: i.id, url: i.url, title: i.title, x: i.x, y: i.y, w: i.w, h: i.h })),
  });
  await revalidateProfile(profileUserId);
  return { ok: true };
}
