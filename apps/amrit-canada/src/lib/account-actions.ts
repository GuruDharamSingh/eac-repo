"use server";

import { revalidatePath } from "next/cache";
import { updateProfile, ensureUniqueUserSlug } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import type { ActionResult } from "@/lib/cms/actions";

/**
 * Self-service profile editing from /account.
 *
 * Unlike saveGuideProfileAction (the owner console at /manage/people), this
 * always writes the CALLER's own profile — there is no userId parameter to
 * receive, on purpose, so there is no authorization check to get wrong.
 * "The artist can always edit their own page" is enforced by construction,
 * not by a role check.
 *
 * This only touches identity (users, via updateProfile) — never org_profiles.
 * Whether the result is published anywhere is still the org's call.
 */
export async function updateOwnProfileAction(input: {
  bio?: string;
  photoUrl?: string;
  city?: string;
  slug?: string;
}): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to edit your profile." };

  try {
    let slug = input.slug?.trim() || null;
    if (slug) slug = await ensureUniqueUserSlug(slug, viewer.userId);

    await updateProfile(viewer.userId, {
      bio: input.bio?.trim() || null,
      avatarUrl: input.photoUrl?.trim() || null,
      city: input.city?.trim() || null,
      slug,
    });

    revalidatePath("/account");
    revalidatePath("/about");
    if (slug) revalidatePath(`/about/${slug}`);
    return { ok: true };
  } catch (err) {
    console.error("[amrit-canada] updateOwnProfileAction:", err);
    return { ok: false, error: "Could not save your profile." };
  }
}
