"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { getCurrentUser } from "@/lib/session";
import { updateProfile, canEditProfile, getProfile, type UpdateProfileInput } from "@elkdonis/services";
import type { SaveFieldPayload, SaveResult } from "@elkdonis/live-editor";
import type { GalleryItem } from "@elkdonis/cms-ui/gallery";
import { DOSSIER_SECTION_KEYS } from "@elkdonis/cms-bindings/dossier";

/**
 * Save actions behind the inline profile editor on ArtDirect's own /[slug]
 * page (StandardProfile). Mirrors apps/ifac/src/lib/profile-editor-actions.ts
 * — same underlying rule (canEditProfile: self, or a global admin), just
 * using ArtDirect's own getCurrentUser() instead of getServerSession
 * directly, and revalidating the one /[slug] route instead of IFAC's
 * artists/dealers pair.
 */

// Returns SaveResult (ok: boolean; error?: string) rather than a true
// discriminated union on purpose: TS fails to narrow `if (!x.ok) return
// x.error` unions declared in a "use server" file. error is simply optional
// here, so no narrowing is needed.
async function authorize(profileUserId: string): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in required." };
  const allowed = await canEditProfile(user.id, profileUserId);
  if (!allowed) return { ok: false, error: "Not authorized to edit this profile." };
  return { ok: true };
}

async function revalidateProfile(profileUserId: string) {
  revalidatePath("/");
  const profile = await getProfile(profileUserId);
  if (profile?.slug) revalidatePath(`/${profile.slug}`);
}

// Only fields the page actually renders as self-owned data belong here.
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

/**
 * Sections this page knows how to render. Anything else is refused, not stored.
 *
 * `store` is shared with every org site on purpose — a person who has turned
 * their store on for their IFAC page has turned it on here too. The rest come
 * from the dossier template's manifest, so adding a section to the template is
 * what adds it here rather than a second list drifting from the first.
 */
const KNOWN_PROFILE_SECTIONS = ["store", ...DOSSIER_SECTION_KEYS] as const;

/**
 * Switch an optional section of a profile page on or off
 * (users.profile_sections, migration 105). Same authorization as every other
 * edit here; `jsonb ||` merges so a key another site set is left alone. The
 * flag is network-wide on purpose: "show my store" means the same thing on
 * ArtDirect and on an org site.
 */
export async function setProfileSectionAction(
  profileUserId: string,
  key: string,
  on: boolean
): Promise<SaveResult> {
  const auth = await authorize(profileUserId);
  if (!auth.ok) return auth;
  if (!(KNOWN_PROFILE_SECTIONS as readonly string[]).includes(key)) {
    return { ok: false, error: `Unknown section: ${key}` };
  }

  await db`
    UPDATE users
    SET profile_sections = COALESCE(profile_sections, '{}'::jsonb) || ${db.json({ [key]: Boolean(on) } as never)}
    WHERE id = ${profileUserId}
  `;
  await revalidateProfile(profileUserId);
  return { ok: true };
}
