"use server";
// CONTRACT: reviews server actions: public list; followers+ write/delete own; editors hide/unhide. Types in lib/catalogue-types.ts.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@elkdonis/db";
import { getViewer, type Viewer } from "@/lib/auth";
import { listReviews, reviewSummary, targetExists, validTarget } from "@/lib/reviews";
import { siteConfig } from "@/config/site";
import type { Review, ReviewInput, ReviewList, ReviewTarget, Result } from "@/lib/catalogue-types";

/**
 * Who may review: any signed-in person with a user_organizations row for this
 * org, followers included (role 'viewer' = Viewer.isAffiliate). Following
 * after sign-up (the arrival notice or /center follow) creates exactly that
 * row, so a follower can review. Network membership semantics are unchanged:
 * this rule lives here only.
 */
const canReview = (v: Viewer | null) => !!v && v.isAffiliate;
const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;

async function revalidateTarget(t: ReviewTarget) {
  if (t.type === "place") {
    revalidatePath(`/manage/places/${t.id}`);
    return;
  }
  const [row] = (await db`SELECT slug FROM threads WHERE id = ${t.id} AND org_id = ${ORG}`) as unknown as Row[];
  if (row) revalidatePath(`/${t.type === "tour" ? "tours" : "experiences"}/${row.slug as string}`);
}

/** Public. Visible reviews (plus the viewer's own, and hidden ones for editors), the summary, and what the viewer may do. */
export async function listReviewsAction(target: ReviewTarget): Promise<ReviewList> {
  const viewer = await getViewer().catch(() => null);
  const empty: ReviewList = {
    reviews: [],
    summary: { target, count: 0, ratedCount: 0, average: null },
    viewer: { signedIn: !!viewer, canReview: canReview(viewer), canModerate: !!viewer?.canEdit, mineId: null },
  };
  if (!validTarget(target)) return empty;
  const [reviews, summary] = await Promise.all([
    listReviews(target, { viewerId: viewer?.userId ?? null, includeHidden: !!viewer?.canEdit }),
    reviewSummary(target),
  ]);
  return { reviews, summary, viewer: { ...empty.viewer, mineId: reviews.find((r) => r.mine)?.id ?? null } };
}

const inputSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  body: z
    .string()
    .max(4000, "Keep it under 4000 characters")
    .nullable()
    .optional()
    .transform((v) => (v ?? "").replace(/<[^>]*>/g, "").replace(/\s+\n/g, "\n").trim() || null),
});

/** Create, or replace the viewer's own review of this target (one per person). */
export async function saveReviewAction(input: ReviewInput): Promise<Result<{ review: Review }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to leave a review." };
  if (!canReview(viewer)) return { ok: false, error: "Follow us to leave a review." };
  if (!validTarget(input?.target)) return { ok: false, error: "Nothing to review." };
  const parsed = inputSchema.safeParse({ rating: input.rating ?? null, body: input.body ?? null });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the review" };
  const { rating, body } = parsed.data;
  if (rating == null && !body) return { ok: false, error: "Give a rating or write a few words." };
  // Places are reviewable once they exist; tours/experiences only when public.
  if (!(await targetExists(input.target, { publicOnly: input.target.type !== "place" }))) return { ok: false, error: "That is not open for reviews." };
  try {
    const [r] = (await db`
      INSERT INTO org_reviews (org_id, target_type, target_id, user_id, rating, body)
      VALUES (${ORG}, ${input.target.type}, ${input.target.id}, ${viewer.userId}, ${rating ?? null}, ${body})
      ON CONFLICT (org_id, target_type, target_id, user_id) DO UPDATE SET
        rating = EXCLUDED.rating, body = EXCLUDED.body, updated_at = NOW()
      RETURNING id
    `) as unknown as Row[];
    const review = (await listReviews(input.target, { viewerId: viewer.userId, includeHidden: viewer.canEdit })).find((x) => x.id === r!.id);
    await revalidateTarget(input.target);
    return { ok: true, review: review! };
  } catch (err) {
    console.error("[elktours] saveReviewAction:", err);
    return { ok: false, error: "Could not save the review." };
  }
}

/** The author deletes their own review. */
export async function deleteOwnReviewAction(id: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Not found" };
  const rows = (await db`
    DELETE FROM org_reviews WHERE id = ${id} AND org_id = ${ORG} AND user_id = ${viewer.userId}
    RETURNING target_type, target_id
  `) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: "Not found" };
  await revalidateTarget({ type: rows[0].target_type as ReviewTarget["type"], id: rows[0].target_id as string });
  return { ok: true };
}

/** Editors (owner/guide): hide or show a review. Hidden reviews stay visible to their author. */
export async function setReviewHiddenAction(id: string, hidden: boolean, reason?: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only editors can hide reviews." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Not found" };
  const rows = (await db`
    UPDATE org_reviews SET
      status = ${hidden ? "hidden" : "visible"},
      hidden_by = ${hidden ? viewer.userId : null}, hidden_at = ${hidden ? db`NOW()` : null},
      hidden_reason = ${hidden ? reason?.trim().slice(0, 500) || null : null}, updated_at = NOW()
    WHERE id = ${id} AND org_id = ${ORG}
    RETURNING target_type, target_id
  `) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: "Not found" };
  await revalidateTarget({ type: rows[0].target_type as ReviewTarget["type"], id: rows[0].target_id as string });
  return { ok: true };
}
