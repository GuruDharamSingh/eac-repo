"use server";

import { headers } from "next/headers";
import { z } from "zod";
import {
  createInterpretation,
  createQuestionInterpretation,
  INTERPRETATION_MAX,
  REASONING_ACTIONS,
  ReasoningError,
  recordReview,
  requeueInterpretation,
  ReviewError,
} from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";

/**
 * Server actions for the reasoning explorer. The reviewer always comes from
 * the session; the corpus layer checks that the chart is theirs, that a
 * question is not in the blind test set, and that every chain, step and
 * passage named belongs to the interpretation.
 */

const uuid = z.string().uuid();

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const failure = (e: unknown, what: string): { ok: false; error: string } => {
  if (e instanceof ReasoningError || e instanceof ReviewError) return { ok: false, error: e.message };
  console.error(`[studio] ${what} failed`, e);
  return { ok: false, error: "Could not save. Try again." };
};

const newSchema = z.object({
  chartId: uuid,
  body: z.string().trim().min(1, "Write your interpretation").max(INTERPRETATION_MAX),
});

export async function createInterpretationAction(input: z.input<typeof newSchema>): Promise<Result<{ id: string }>> {
  const viewer = await requireStudioReviewer("/hub/studio/interpret");
  const parsed = newSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  try {
    const id = await createInterpretation({ chartId: parsed.data.chartId, authorId: viewer.userId, body: parsed.data.body });
    return { ok: true, id };
  } catch (e) {
    return failure(e, "createInterpretation");
  }
}

const questionSchema = z.object({
  questionId: uuid,
  body: z.string().trim().min(1, "Write what you think").max(INTERPRETATION_MAX),
});

/** "Explain my thinking" from the deck: the owner's answer to a question, queued for the worker. */
export async function createQuestionInterpretationAction(input: z.input<typeof questionSchema>): Promise<Result<{ id: string }>> {
  const viewer = await requireStudioReviewer("/hub/studio/deck");
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  try {
    const id = await createQuestionInterpretation({ questionId: parsed.data.questionId, authorId: viewer.userId, body: parsed.data.body });
    return { ok: true, id };
  } catch (e) {
    return failure(e, "createQuestionInterpretation");
  }
}

export async function requeueInterpretationAction(id: string): Promise<Result> {
  const viewer = await requireStudioReviewer("/hub/studio/interpret");
  if (!uuid.safeParse(id).success) return { ok: false, error: "Interpretation not found" };
  try {
    const ok = await requeueInterpretation(id, viewer.userId);
    return ok ? { ok: true } : { ok: false, error: "It is already waiting for the worker" };
  } catch (e) {
    return failure(e, "requeueInterpretation");
  }
}

const reviewSchema = z.object({
  action: z.enum(REASONING_ACTIONS),
  // Shape, vocabulary and lengths are checked in @elkdonis/astro-corpus (cleanReasoningPayload).
  payload: z.record(z.string(), z.unknown()),
  seconds: z.number().min(0).max(86400).nullable().optional(),
});

export type ReasoningReviewInput = z.input<typeof reviewSchema>;

export async function reasoningReviewAction(input: ReasoningReviewInput): Promise<Result> {
  const viewer = await requireStudioReviewer("/hub/studio/interpret");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const ua = (await headers()).get("user-agent") ?? "";
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "phone" : "desktop";
  try {
    await recordReview({
      reviewerId: viewer.userId,
      questionId: null,
      action: parsed.data.action,
      candidateIds: [],
      shownOrder: [],
      stance: null,
      seconds: parsed.data.seconds ?? null,
      device,
      payload: parsed.data.payload,
    });
    return { ok: true };
  } catch (e) {
    return failure(e, "reasoning review");
  }
}
