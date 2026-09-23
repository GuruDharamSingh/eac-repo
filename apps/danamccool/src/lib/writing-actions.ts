"use server";

import { revalidatePath } from "next/cache";
import {
  canEditProfile,
  createWritingPost,
  deleteWritingPost,
  getWritingPostById,
  updateWritingPost,
} from "@elkdonis/services";
import type { DeskPatch, DeskResult } from "@elkdonis/cms-ui/writing";
import { getSiteOwnerUserId, getViewer } from "./auth";
import { siteConfig } from "@/config/site";

// ============================================================================
// Her writing — the blog at /blog. Save actions for the shelf and the desk.
//
// The author is always DANA (the site owner): this is her blog, in her voice.
// Only she — or a network admin, via canEditProfile — may start, change or
// delete a piece. A guide who can edit the site's pages cannot write as her.
// Authorship is read from the row, never from the request.
//
// Pieces are `threads` of kind 'writing' (see packages/services/src/writing.ts):
// kept off every org feed, forum and search by OFF_FEED_KINDS.
// ============================================================================

async function authorise(authorId: string): Promise<DeskResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in required." };
  if (!(await canEditProfile(viewer.userId, authorId))) {
    return { ok: false, error: "Only Dana can write on her blog." };
  }
  return { ok: true };
}

function refresh(slug?: string) {
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/hub");
}

export async function startPieceAction(title: string): Promise<DeskResult> {
  const authorId = await getSiteOwnerUserId();
  if (!authorId) return { ok: false, error: "The site has no owner yet." };
  const auth = await authorise(authorId);
  if (!auth.ok) return auth;
  const result = await createWritingPost({ authorId, orgId: siteConfig.orgId, title });
  if (!result.ok) return result;
  refresh(result.post.slug);
  return { ok: true, slug: result.post.slug };
}

export async function savePieceAction(postId: string, patch: DeskPatch): Promise<DeskResult> {
  const post = await getWritingPostById(postId);
  const owner = await getSiteOwnerUserId();
  if (!post || post.authorId !== owner) return { ok: false, error: "That piece no longer exists." };
  const auth = await authorise(post.authorId);
  if (!auth.ok) return auth;
  const result = await updateWritingPost(postId, patch);
  if (!result.ok) return result;
  refresh(post.slug);
  refresh(result.post.slug);
  return { ok: true, slug: result.post.slug };
}

export async function deletePieceAction(postId: string): Promise<DeskResult> {
  const post = await getWritingPostById(postId);
  const owner = await getSiteOwnerUserId();
  if (!post || post.authorId !== owner) return { ok: false, error: "That piece no longer exists." };
  const auth = await authorise(post.authorId);
  if (!auth.ok) return auth;
  if (!(await deleteWritingPost(postId))) return { ok: false, error: "Could not delete that piece." };
  refresh(post.slug);
  return { ok: true };
}
