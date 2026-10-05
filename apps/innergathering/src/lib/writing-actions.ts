"use server";

import { revalidatePath } from "next/cache";
import {
  canEditProfile,
  createWritingPost,
  getProfile,
  getWritingPostById,
  listListableOrgs,
  listThreadListings,
  setThreadListings,
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

/**
 * "Show on" for a piece (person pages, 2026-09-26). Same rule as starting one:
 * the author (or a global admin) — canEditProfile(viewer, post.authorId), the
 * author read from the row. Listing itself is gated again per org in
 * setThreadListings (author, and a member of that org).
 *
 * This app has no writing desk yet; these back WritingDesk's `listing` prop
 * when one is added. The profile popup's "Show on" list covers the same rows.
 */
async function authorizePiece(postId: string) {
  const viewer = await getApiMember();
  if (!viewer) return { ok: false as const, error: "Sign in required." };
  const post = await getWritingPostById(postId);
  if (!post) return { ok: false as const, error: "That piece no longer exists." };
  if (!(await canEditProfile(viewer.userId, post.authorId))) {
    return { ok: false as const, error: "Not authorized." };
  }
  return { ok: true as const, post, viewerId: viewer.userId };
}

export async function loadPieceListingAction(
  postId: string
): Promise<{ orgs: Array<{ orgId: string; name: string }>; selected: string[]; homeOrgId: string } | null> {
  const auth = await authorizePiece(postId);
  if (!auth.ok) return null;
  const [orgs, selected] = await Promise.all([listListableOrgs(auth.viewerId), listThreadListings(postId)]);
  return {
    orgs: orgs.map((o) => ({ orgId: o.orgId, name: o.name })),
    selected,
    homeOrgId: auth.post.orgId,
  };
}

export async function setPieceListingAction(postId: string, orgIds: string[]): Promise<DeskResult> {
  const auth = await authorizePiece(postId);
  if (!auth.ok) return { ok: false, error: auth.error };
  const result = await setThreadListings(auth.viewerId, postId, orgIds.slice(0, 100));
  if (!result.ok) return { ok: false, error: result.error ?? "Could not change where this shows." };
  const profile = await getProfile(auth.post.authorId).catch(() => null);
  if (profile?.slug) {
    revalidatePath(`/artists/${profile.slug}`);
    revalidatePath(`/artists/${profile.slug}/writing`);
    revalidatePath(`/artists/${profile.slug}/writing/${auth.post.slug}`);
  }
  return { ok: true };
}
