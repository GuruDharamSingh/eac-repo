"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canEditProfile,
  createWritingPost,
  deleteWritingPost,
  getProfile,
  getWritingPostById,
  listListableOrgs,
  listThreadListings,
  setThreadListings,
  updateWritingPost,
} from "@elkdonis/services";
import type { DeskPatch, DeskResult } from "@elkdonis/cms-ui/writing";
import { getCurrentUser } from "@/lib/session";

// ============================================================================
// The writing desk on ArtDirect — a person's own pieces, homed in `oad`.
//
// Same rules as IFAC's writing-actions.ts: a new piece is always the signed-in
// person's own; a change to an existing piece is allowed to its author (or a
// global admin, canEditProfile), with the author read from the row, never
// from the request.
// ============================================================================

const PERSONAL_ORG_ID = "oad";

async function viewerId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

async function authorizePost(postId: string) {
  const viewer = await viewerId();
  if (!viewer) return { ok: false as const, error: "Sign in required." };
  const post = await getWritingPostById(postId);
  if (!post) return { ok: false as const, error: "That piece no longer exists." };
  if (!(await canEditProfile(viewer, post.authorId))) return { ok: false as const, error: "Not authorized." };
  return { ok: true as const, post, viewer };
}

async function revalidateWriting(authorId: string, pieceSlug?: string) {
  const profile = await getProfile(authorId);
  if (!profile?.slug) return;
  revalidatePath(`/${profile.slug}`);
  revalidatePath(`/${profile.slug}/writing`);
  if (pieceSlug) revalidatePath(`/${profile.slug}/writing/${pieceSlug}`);
}

/** Start a piece as the signed-in person. The desk opens at `<basePath>/<slug>?edit=1`. */
export async function startPieceAction(title: string): Promise<DeskResult> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in required." };
  const result = await createWritingPost({ authorId: viewer, orgId: PERSONAL_ORG_ID, title });
  if (!result.ok) return result;
  await revalidateWriting(viewer, result.post.slug);
  return { ok: true, slug: result.post.slug };
}

/**
 * Open the writing desk on a new piece, in one step: create an "Untitled"
 * draft for the signed-in person and go straight to it with the desk open.
 * A form action rather than a link, so prefetching can never create drafts.
 */
export async function openNewPieceAction(): Promise<void> {
  const viewer = await viewerId();
  if (!viewer) redirect("/login");
  const result = await createWritingPost({ authorId: viewer, orgId: PERSONAL_ORG_ID, title: "Untitled" });
  // `=== false` narrows the union under strict: false (packages rule).
  if (result.ok === false) throw new Error(result.error ?? "Could not start a piece.");
  const profile = await getProfile(viewer);
  await revalidateWriting(viewer, result.post.slug);
  redirect(`/${profile?.slug ?? viewer}/writing/${result.post.slug}?edit=1`);
}

export async function savePieceAction(postId: string, patch: DeskPatch): Promise<DeskResult> {
  const auth = await authorizePost(postId);
  if (!auth.ok) return auth;
  const result = await updateWritingPost(postId, patch);
  if (!result.ok) return result;
  await revalidateWriting(auth.post.authorId, auth.post.slug);
  await revalidateWriting(auth.post.authorId, result.post.slug);
  return { ok: true, slug: result.post.slug };
}

export async function deletePieceAction(postId: string): Promise<DeskResult> {
  const auth = await authorizePost(postId);
  if (!auth.ok) return auth;
  const ok = await deleteWritingPost(postId);
  if (!ok) return { ok: false, error: "Could not delete that piece." };
  await revalidateWriting(auth.post.authorId, auth.post.slug);
  return { ok: true };
}

/** "Show on": the orgs the viewer may list this piece on, and those listing it. */
export async function loadPieceListingAction(
  postId: string
): Promise<{ orgs: Array<{ orgId: string; name: string }>; selected: string[]; homeOrgId: string } | null> {
  const auth = await authorizePost(postId);
  if (!auth.ok) return null;
  const [orgs, selected] = await Promise.all([listListableOrgs(auth.viewer), listThreadListings(postId)]);
  return { orgs: orgs.map((o) => ({ orgId: o.orgId, name: o.name })), selected, homeOrgId: auth.post.orgId };
}

export async function setPieceListingAction(postId: string, orgIds: string[]): Promise<DeskResult> {
  const auth = await authorizePost(postId);
  if (!auth.ok) return auth;
  const result = await setThreadListings(auth.viewer, postId, orgIds.slice(0, 100));
  if (!result.ok) return { ok: false, error: result.error ?? "Could not change where this shows." };
  await revalidateWriting(auth.post.authorId, auth.post.slug);
  return { ok: true };
}
