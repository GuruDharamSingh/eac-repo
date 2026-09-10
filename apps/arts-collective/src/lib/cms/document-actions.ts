"use server";

import { revalidatePath } from "next/cache";
import {
  attachThreadDocument,
  getThreadDocument,
  syncThreadDocument,
  type SyncDirection,
  type ThreadDocument,
} from "@elkdonis/services";
import { db } from "@elkdonis/db";
import { requireUser } from "@/lib/session";

export type DocumentActionResult =
  | { ok: true; document: ThreadDocument | null; synced?: SyncDirection }
  | { ok: false; error: string };

/**
 * Only the thread's author manages its document.
 *
 * Not `canEditOrgSite`: the file lives in the AUTHOR'S own
 * `EAC_Network/users/<slug>/Documents/`, so letting a co-editor attach one
 * would write into a colleague's personal storage. Editing the post is an org
 * matter; the draft file is the writer's.
 */
async function requireAuthor(threadId: string): Promise<string | null> {
  const user = await requireUser();
  const [row] = await db<Array<{ author_id: string }>>`
    SELECT author_id FROM threads WHERE id = ${threadId}
  `;
  return row?.author_id === user.id ? user.id : null;
}

/** Give this post a markdown file in the author's Nextcloud. Idempotent. */
export async function attachDocumentAction(
  threadId: string
): Promise<DocumentActionResult> {
  if (!(await requireAuthor(threadId))) {
    return { ok: false, error: "Only the author can do that" };
  }

  const document = await attachThreadDocument(threadId);
  if (!document) {
    return {
      ok: false,
      error: "Could not create the document. Storage may be unavailable.",
    };
  }

  revalidatePath("/hub/organization");
  return { ok: true, document };
}

/**
 * Bring the post and the file into step, and say which way it went.
 *
 * The direction matters to the caller: a writing surface should be able to
 * tell someone "loaded your changes from Nextcloud" rather than silently
 * replacing the text under their cursor.
 */
export async function syncDocumentAction(
  threadId: string
): Promise<DocumentActionResult> {
  if (!(await requireAuthor(threadId))) {
    return { ok: false, error: "Only the author can do that" };
  }

  const synced = await syncThreadDocument(threadId);
  const document = await getThreadDocument(threadId);

  revalidatePath("/hub/organization");
  return { ok: true, document, synced };
}
