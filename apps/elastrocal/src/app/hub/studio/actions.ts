"use server";

import { headers } from "next/headers";
import { z } from "zod";
import {
  EXPLANATION_ABOUT,
  EXPLANATION_MAX,
  EXPLANATION_SEVERITY,
  QUOTE_MAX,
  QUESTION_REVIEW_ACTIONS,
  recordReview,
  ReviewError,
} from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";

/**
 * One server action for every lever in the review deck. The reviewer comes
 * from the session, never from the form; the corpus layer checks that every
 * text id named belongs to the question.
 */

const uuid = z.string().uuid();
const score = z.number().int().min(1).max(5);
const tradition = z.string().trim().max(40).nullable().optional();
// Which values `about` may take per action is checked in the corpus layer.
const explanation = z
  .object({
    text: z.string().trim().min(1, "Write the explanation, or close it").max(EXPLANATION_MAX),
    about: z.enum(EXPLANATION_ABOUT),
    quote: z.string().trim().max(QUOTE_MAX).optional(),
    severity: z.enum(EXPLANATION_SEVERITY).optional(),
    principles: z.array(z.string().max(60)).max(8).optional(),
  })
  .optional();

const payloads = {
  pick: z.object({ winner: uuid.nullable(), reasons: z.array(z.string().max(60)).max(8).default([]), explanation }),
  rate: z.object({ textId: uuid, scores: z.object({ faithful: score, specific: score, usable: score }), explanation }),
  fix: z.object({ fromTextId: uuid, body: z.string().max(20000), tradition, explanation }),
  write: z.object({ body: z.string().max(20000), tradition }),
  tag: z.object({ add: z.array(z.string().max(80)).max(20).default([]), remove: z.array(z.string().max(80)).max(20).default([]) }),
  flag: z.object({ reason: z.string().max(40), note: z.string().max(500).optional() }),
  skip: z.object({}),
} as const;

const schema = z.object({
  questionId: uuid,
  // The reasoning explorer's actions go through interpret/actions.ts.
  action: z.enum(QUESTION_REVIEW_ACTIONS),
  candidateIds: z.array(uuid).max(12),
  shownOrder: z.array(uuid).max(12),
  stance: z.enum(["preference", "claim"]).nullable(),
  seconds: z.number().min(0).max(86400).nullable(),
  payload: z.record(z.string(), z.unknown()),
});

export type ReviewFormInput = z.input<typeof schema>;

export async function submitReviewAction(input: ReviewFormInput): Promise<{ ok: boolean; error?: string }> {
  const viewer = await requireStudioReviewer();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const payload = payloads[d.action].safeParse(d.payload);
  if (!payload.success) return { ok: false, error: payload.error.issues[0]?.message ?? "Check the form" };

  const ua = (await headers()).get("user-agent") ?? "";
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "phone" : "desktop";

  try {
    await recordReview({
      reviewerId: viewer.userId,
      questionId: d.questionId,
      action: d.action,
      candidateIds: d.candidateIds,
      shownOrder: d.shownOrder,
      stance: d.stance,
      seconds: d.seconds,
      device,
      payload: payload.data as Record<string, unknown>,
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof ReviewError) return { ok: false, error: e.message };
    console.error("[studio] review failed", e);
    return { ok: false, error: "Could not save. Try again." };
  }
}
