"use server";

import { revalidatePath } from "next/cache";
import {
  isListedOn,
  createWritingPost,
  deleteWritingPost,
  getWritingPostById,
  updateWritingPost,
} from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Server actions for the writing room (/write).
 *
 * A piece is the author's own `writing` thread on this org (see
 * packages/services/src/writing.ts). Anyone with a user_organizations row here
 * may write; every action re-reads the session and only touches rows the
 * viewer authored on this org.
 */

export interface RoomPiece {
  id: string;
  slug: string;
  title: string;
  bodyHtml: string;
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
}

// A flat shape rather than a discriminated union: this app compiles without
// strictNullChecks, so `!res.ok` does not narrow a union.
export interface RoomResult {
  ok: boolean;
  piece?: RoomPiece;
  error?: string;
}

async function writer() {
  const viewer = await getViewer();
  return viewer?.isAffiliate ? viewer : null;
}

function toRoom(post: {
  id: string;
  slug: string;
  title: string;
  bodyHtml: string;
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
}): RoomPiece {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    bodyHtml: post.bodyHtml,
    status: post.status,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
  };
}

/**
 * The viewer's own piece shown on this org, or null. Pieces are homed in `oad`
 * and listed here since 2026-09-26, so "on this org" is homed or listed.
 */
async function ownPiece(id: string, userId: string) {
  const post = await getWritingPostById(id);
  if (!post || post.authorId !== userId || !(await isListedOn(post.id, siteConfig.orgId))) return null;
  return post;
}

/**
 * Save the room's state. Without an id the piece is created first, which
 * needs a title; the body follows in the same call.
 */
export async function saveRoomPiece(input: {
  id?: string | null;
  title: string;
  bodyHtml: string;
  status?: "draft" | "published";
}): Promise<RoomResult> {
  const viewer = await writer();
  if (!viewer) return { ok: false, error: "Sign in to write here." };

  let id = input.id ?? null;
  if (id) {
    if (!(await ownPiece(id, viewer.userId))) return { ok: false, error: "That piece is not yours to edit." };
  } else {
    const created = await createWritingPost({
      authorId: viewer.userId,
      orgId: siteConfig.orgId,
      title: input.title,
    });
    if (!created.ok || !("post" in created)) {
      return { ok: false, error: "error" in created ? created.error : "Could not start that piece." };
    }
    id = created.post.id;
  }

  const saved = await updateWritingPost(id, {
    title: input.title,
    bodyHtml: input.bodyHtml,
    ...(input.status ? { status: input.status } : {}),
  });
  if (!saved.ok || !("post" in saved)) {
    return { ok: false, error: "error" in saved ? saved.error : "Could not save that." };
  }

  if (input.status) revalidatePath("/writing", "layout");
  return { ok: true, piece: toRoom(saved.post) };
}

/** Archive a piece (deleteWritingPost archives; it does not DELETE). */
export async function deleteRoomPiece(id: string): Promise<{ ok: boolean; error?: string }> {
  const viewer = await writer();
  if (!viewer) return { ok: false, error: "Sign in to write here." };
  if (!(await ownPiece(id, viewer.userId))) return { ok: false, error: "That piece is not yours." };
  const done = await deleteWritingPost(id);
  if (done) revalidatePath("/writing", "layout");
  return done ? { ok: true } : { ok: false, error: "Could not remove that piece." };
}
