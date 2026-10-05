"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { createTalkRoom } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { getThreadById } from "@/lib/data";
import { siteConfig } from "@/config/site";

// ============================================================================
// Event detail pages.
//
// A gathering gets a designed page when `threads.metadata.detailPage` is true
// (no migration; metadata is jsonb). The page is the `event-detail` template
// document drawn for that thread (app/[feed]/[slug]/page.tsx). Choosing it
// also makes sure the event has a Talk room, the way a reading circle does
// (`ensureCircleSpace`, packages/services/src/reading-circle.ts).
//
// Editors only; the check is here, not in the button.
// ============================================================================

type Result = { ok: true; talkReady: boolean } | { ok: false; error: string };

/** Make the Talk room if the thread has none. Returns whether one exists after. */
async function ensureRoom(threadId: string): Promise<boolean> {
  const thread = await getThreadById(threadId);
  if (!thread) return false;
  if (thread.talkToken) return true;
  try {
    const [author] = await db<{ nextcloud_user_id: string | null }[]>`
      SELECT nextcloud_user_id FROM users WHERE id = ${thread.authorId}
    `;
    const token = await createTalkRoom(thread.title, "public", {
      moderator: author?.nextcloud_user_id ?? null,
      listable: 1,
    });
    if (!token) return false;
    await db`
      UPDATE threads SET nextcloud_talk_token = ${token}
      WHERE id = ${threadId} AND org_id = ${siteConfig.orgId} AND nextcloud_talk_token IS NULL
    `;
    return true;
  } catch (err) {
    console.error(`[sunjay] ensureRoom(${threadId}):`, err);
    return false;
  }
}

export async function createEventRoomAction(threadId: string): Promise<Result> {
  if (!(await getApiEditor())) return { ok: false, error: "Only editors can create a room." };
  const thread = await getThreadById(threadId);
  if (!thread) return { ok: false, error: "That gathering was not found." };
  const talkReady = await ensureRoom(threadId);
  if (!talkReady) return { ok: false, error: "The Talk room could not be created." };
  revalidatePath(`/${thread.feedSlug}/${thread.slug}`);
  return { ok: true, talkReady };
}

/** Turn the designed detail page on or off for one gathering. */
export async function setDetailPageAction(threadId: string, on: boolean): Promise<Result> {
  if (!(await getApiEditor())) return { ok: false, error: "Only editors can change this." };
  const thread = await getThreadById(threadId);
  if (!thread) return { ok: false, error: "That gathering was not found." };

  await db`
    UPDATE threads
    SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{detailPage}', to_jsonb(${on}::boolean))
    WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
  `;
  const talkReady = on ? await ensureRoom(threadId) : Boolean(thread.talkToken);
  revalidatePath(`/${thread.feedSlug}/${thread.slug}`);
  return { ok: true, talkReady };
}
