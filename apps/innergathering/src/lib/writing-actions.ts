"use server";

import { revalidatePath } from "next/cache";
import {
  canEditProfile,
  createWritingPost,
  getProfile,
} from "@elkdonis/services";
import type { DeskResult } from "@elkdonis/cms-ui/writing";
import { getApiMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Starting a piece from a member's own page.
 *
 * The AUTHOR (or a global admin) may write as themselves —
 * `canEditProfile(viewer, authorId)`. Authorship is checked against the id the
 * caller claims rather than trusted from it, so a request cannot create a post
 * under somebody else's name.
 */
export async function startPieceAction(
  authorId: string,
  title: string
): Promise<DeskResult> {
  const viewer = await getApiMember();
  if (!viewer) return { ok: false, error: "Sign in required." };
  if (!(await canEditProfile(viewer.userId, authorId))) {
    return { ok: false, error: "Not authorized." };
  }

  const result = await createWritingPost({
    authorId,
    orgId: siteConfig.orgId,
    title,
  });
  if (!result.ok) return result;

  const profile = await getProfile(authorId).catch(() => null);
  if (profile?.slug) {
    revalidatePath(`/artists/${profile.slug}`);
    revalidatePath(`/artists/${profile.slug}/writing`);
  }
  return { ok: true, slug: result.post.slug };
}
