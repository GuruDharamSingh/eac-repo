"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
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

/** Sections this site knows how to render on a member's page. Others are refused. */
const KNOWN_PROFILE_SECTIONS = ["store"] as const;

/**
 * Switch an optional section of the CALLER's own profile page on or off
 * (users.profile_sections, migration 105). Self-only by construction, like
 * updateOwnProfileAction. `jsonb ||` merges, so a section another site set
 * is left alone.
 */
export async function setOwnProfileSectionAction(input: {
  key: (typeof KNOWN_PROFILE_SECTIONS)[number];
  on: boolean;
}): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  if (!KNOWN_PROFILE_SECTIONS.includes(input.key)) {
    return { ok: false, error: "Unknown section." };
  }
  try {
    const [row] = await db<Array<{ slug: string | null }>>`
      UPDATE users
      SET profile_sections = COALESCE(profile_sections, '{}'::jsonb) || ${db.json({ [input.key]: Boolean(input.on) } as never)}
      WHERE id = ${viewer.userId}
      RETURNING slug
    `;
    revalidatePath("/account");
    if (row?.slug) revalidatePath(`/about/${row.slug}`);
    return { ok: true };
  } catch (err) {
    console.error("[amrit-canada] setOwnProfileSectionAction:", err);
    return { ok: false, error: "Could not save that." };
  }
}
