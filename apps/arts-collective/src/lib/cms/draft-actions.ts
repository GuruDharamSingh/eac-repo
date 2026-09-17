"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { ensureUniqueThreadSlug } from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { canEditOrgSite } from "@/lib/org";

/**
 * Turn a draft into a published thread.
 *
 * This step did not exist in this app. `createThreadAction` could make a draft
 * and `publishArticleAction` could build a published post into a static
 * artifact — it even says "Publish it first, then it can be built" — but
 * nothing here performed that first step, so a draft made in the hub could
 * only ever be published from another app. The console's Unfinished band is
 * the natural place for it, since that band exists precisely to count the
 * things stuck at this point.
 *
 * The gate is the org's editors, matching publishArticleAction: a draft's
 * author owns the text, but publishing changes the org's public site.
 */

/**
 * One shape with optional fields rather than a discriminated union: this repo
 * compiles with `strict: false`, so without strictNullChecks TypeScript will
 * not narrow `{ok:true,…} | {ok:false,…}` at all and every caller would need a
 * cast. Same posture as `UploadResult` in services/user-storage.ts.
 */
export type PublishDraftResult = { ok: boolean; slug?: string; error?: string };

export async function publishDraftAction(threadId: string): Promise<PublishDraftResult> {
  const user = await requireUser();

  const [thread] = await db<
    Array<{
      id: string;
      org_id: string;
      org_slug: string;
      title: string;
      slug: string | null;
      status: string;
    }>
  >`
    SELECT t.id, t.org_id, o.slug AS org_slug, t.title, t.slug, t.status
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    WHERE t.id = ${threadId}
  `;

  if (!thread) return { ok: false, error: "Not found" };
  if (!(await canEditOrgSite(user.id, thread.org_id))) {
    return { ok: false, error: "Only this org's owners and guides can publish." };
  }
  if (thread.status === "published") {
    return { ok: false, error: "Already published." };
  }
  if (thread.status !== "draft") {
    return { ok: false, error: `A ${thread.status} thread cannot be published.` };
  }

  // A draft may never have been given an address. Mint one now rather than
  // publishing something with no URL — getPublicThread resolves by slug, so a
  // null one would publish a page nobody can reach.
  const slug =
    thread.slug ?? (await ensureUniqueThreadSlug(thread.org_id, thread.title, thread.id));

  try {
    await db`
      UPDATE threads
      SET status = 'published',
          slug = ${slug},
          -- Keep an existing published_at if this was published once before
          -- and pulled back: the date it first went out is the true one.
          published_at = COALESCE(published_at, now()),
          updated_at = now()
      WHERE id = ${threadId}
    `;
  } catch (err) {
    console.error("[draft-actions] publishDraftAction:", err);
    return { ok: false, error: "Could not publish that." };
  }

  revalidatePath("/hub/organization");
  return { ok: true, slug };
}
