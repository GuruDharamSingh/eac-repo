"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@elkdonis/auth-server";
import {
  canEditProfile,
  getProfile,
  createWritingPost,
  getWritingPostById,
  updateWritingPost,
  deleteWritingPost,
} from "@elkdonis/services";
import type { DeskPatch, DeskResult } from "@elkdonis/cms-ui/writing";
import { siteConfig } from "@/config/site";

/**
 * Save actions behind a member's own writing on IFAC.
 *
 * Same rule as gallery-actions.ts: the AUTHOR (or a global admin) may change a
 * piece — canEditProfile(viewer, post.authorId). Authorship is read from the
 * row, never from the request, so a caller cannot move a post id under a user
 * they control. Every action takes the piece's id and re-reads it; nothing
 * here trusts an author id sent from the browser.
 */

async function viewerId(): Promise<string | null> {
  const session = await getServerSession();
  if (!session.user) return null;
  return session.user.db_user_id ?? session.user.id;
}

async function authorizeUser(authorId: string): Promise<DeskResult> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in required." };
  if (!(await canEditProfile(viewer, authorId))) {
    return { ok: false, error: "Not authorized." };
  }
  return { ok: true };
}

async function authorizePost(postId: string) {
  const post = await getWritingPostById(postId);
  if (!post) return { ok: false as const, error: "That piece no longer exists." };
  const auth = await authorizeUser(post.authorId);
  if (!auth.ok) return { ok: false as const, error: auth.error ?? "Not authorized." };
  return { ok: true as const, post };
}

/**
 * Both profile routes, the shelf and the piece itself.
 *
 * A person is listed under /artists or /dealers depending on their tags, and
 * this does not read which — revalidating a path that does not exist for them
 * costs nothing, and guessing wrong would leave a stale page.
 */
async function revalidateWritingPaths(authorId: string, slug?: string) {
  const profile = await getProfile(authorId);
  if (!profile?.slug) return;
  for (const base of [`/artists/${profile.slug}`, `/dealers/${profile.slug}`]) {
    revalidatePath(base);
    revalidatePath(`${base}/writing`);
    if (slug) revalidatePath(`${base}/writing/${slug}`);
  }
}

export async function startPieceAction(
  authorId: string,
  title: string
): Promise<DeskResult> {
  const auth = await authorizeUser(authorId);
  if (!auth.ok) return auth;
  const result = await createWritingPost({
    authorId,
    orgId: siteConfig.orgId,
    title,
  });
  if (!result.ok) return result;
  await revalidateWritingPaths(authorId, result.post.slug);
  return { ok: true, slug: result.post.slug };
}

export async function savePieceAction(
  postId: string,
  patch: DeskPatch
): Promise<DeskResult> {
  const auth = await authorizePost(postId);
  if (!auth.ok) return auth;
  const result = await updateWritingPost(postId, patch);
  if (!result.ok) return result;
  // The old slug too: a draft renamed to a new address leaves the old page
  // cached and reachable until something clears it.
  await revalidateWritingPaths(auth.post.authorId, auth.post.slug);
  await revalidateWritingPaths(auth.post.authorId, result.post.slug);
  return { ok: true, slug: result.post.slug };
}

export async function deletePieceAction(postId: string): Promise<DeskResult> {
  const auth = await authorizePost(postId);
  if (!auth.ok) return auth;
  const ok = await deleteWritingPost(postId);
  if (!ok) return { ok: false, error: "Could not delete that piece." };
  await revalidateWritingPaths(auth.post.authorId, auth.post.slug);
  return { ok: true };
}
