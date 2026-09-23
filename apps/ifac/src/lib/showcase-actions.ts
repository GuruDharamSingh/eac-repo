"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getHubViewer } from "@/lib/hub-auth";

/**
 * Pin (or unpin) a thread on the showcase.
 *
 * The same `threads.pinned` column the forum sorts on — one flag, not a
 * second "featured" concept, so a thread pinned here leads the board too and
 * a member cannot be looking at two different ideas of what is important.
 *
 * Editors only, and scoped to this org: the service layer writes what it is
 * told, so the ownership check belongs here.
 */
export async function setThreadPinnedAction(
  threadId: string,
  pinned: boolean
): Promise<{ ok: true; pinned: boolean } | { ok: false; error: string }> {
  const viewer = await getHubViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Not authorized" };

  try {
    const rows = await db<Array<{ id: string }>>`
      UPDATE threads SET pinned = ${pinned}, updated_at = NOW()
      WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
      RETURNING id
    `;
    if (rows.length === 0) return { ok: false, error: "Not found" };
    revalidatePath("/showcase");
    revalidatePath("/forum");
    return { ok: true, pinned };
  } catch (error) {
    console.error("[ifac] setThreadPinnedAction:", error);
    return { ok: false, error: "Could not save that" };
  }
}
