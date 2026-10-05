"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { CLAIM_ACTIONS, ClaimError, recordClaimReview } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";

/**
 * Server action for "Check AI claims". The reviewer always comes from the
 * session; the corpus layer checks the payload's shape (cleanClaimPayload),
 * that the claim belongs to the passage and that removed tags were on it.
 */

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  action: z.enum(CLAIM_ACTIONS),
  // Shape, vocabulary and lengths are checked in @elkdonis/astro-corpus (cleanClaimPayload).
  payload: z.record(z.string(), z.unknown()),
  seconds: z.number().min(0).max(86400).nullable().optional(),
});

export type ClaimReviewInput = z.input<typeof schema>;

export async function claimReviewAction(input: ClaimReviewInput): Promise<Result> {
  const viewer = await requireStudioReviewer("/hub/studio/claims");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const ua = (await headers()).get("user-agent") ?? "";
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "phone" : "desktop";
  try {
    await recordClaimReview({
      reviewerId: viewer.userId,
      action: parsed.data.action,
      payload: parsed.data.payload,
      seconds: parsed.data.seconds ?? null,
      device,
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof ClaimError) return { ok: false, error: e.message };
    console.error("[studio] claim review failed", e);
    return { ok: false, error: "Could not save. Try again." };
  }
}
