"use server";

import { revalidatePath } from "next/cache";
import {
  createWikiPage,
  updateWikiPage,
  revertWikiPage,
  archiveWikiPage,
  listWikiPages,
  collectSubtreeIds,
} from "@elkdonis/services";
import { sanitizeRichText } from "@elkdonis/utils";
import { requireUser } from "@/lib/session";

// ============================================================================
// Server actions for the network wiki.
//
// Any authenticated user can edit — the wiki is network-wide, not org-scoped.
// ============================================================================

type Result = { ok: true; slug: string; threadId: string } | { ok: false; error: string };

const INVALID_PARENT = "__invalid_parent__";

async function validParent(
  requested: string | null | undefined,
  selfId?: string
): Promise<string | null | typeof INVALID_PARENT> {
  if (!requested) return null;
  if (selfId && requested === selfId) return INVALID_PARENT;

  const pages = await listWikiPages();
  if (!pages.some((p) => p.id === requested)) return null;

  if (selfId && collectSubtreeIds(pages, selfId).has(requested)) {
    return INVALID_PARENT;
  }
  return requested;
}

export async function createWikiPageAction(
  data: { title: string; body: string; parentId?: string | null }
): Promise<Result> {
  const user = await requireUser();
  if (!data.title.trim()) return { ok: false, error: "Title is required." };

  const parentId = await validParent(data.parentId);

  const page = await createWikiPage({
    authorId: user.id,
    title: data.title.trim(),
    body: sanitizeRichText(data.body),
    parentId,
  });

  revalidatePath("/hub/wiki");
  return { ok: true, slug: page.slug, threadId: page.id };
}

export async function updateWikiPageAction(
  threadId: string,
  data: { title: string; body: string; parentId?: string | null }
): Promise<Result> {
  const user = await requireUser();
  if (!data.title.trim()) return { ok: false, error: "Title is required." };

  const parentId = await validParent(data.parentId, threadId);
  if (parentId === INVALID_PARENT) {
    return { ok: false, error: "A page can't sit under itself or one of its own subpages." };
  }

  const page = await updateWikiPage(threadId, user.id, {
    title: data.title.trim(),
    body: sanitizeRichText(data.body),
    parentId,
  });

  revalidatePath("/hub/wiki");
  revalidatePath(`/hub/wiki/${page.slug}`);
  return { ok: true, slug: page.slug, threadId: page.id };
}

export async function archiveWikiPageAction(
  threadId: string
): Promise<{ ok: true; orphanedChildren: number } | { ok: false; error: string }> {
  await requireUser();

  const result = await archiveWikiPage(threadId);
  if (!result.archived) return { ok: false, error: "Page not found." };

  revalidatePath("/hub/wiki");
  return { ok: true, orphanedChildren: result.orphanedChildren };
}

export async function revertWikiPageAction(
  threadId: string,
  revisionId: string
): Promise<Result> {
  const user = await requireUser();

  const page = await revertWikiPage(threadId, revisionId, user.id);

  revalidatePath("/hub/wiki");
  revalidatePath(`/hub/wiki/${page.slug}`);
  return { ok: true, slug: page.slug, threadId: page.id };
}
