"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { addVocabTerm, recordVocabReview, searchVocabCards, VOCAB_ACTIONS, VocabError, type VocabSearchHit } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";

/**
 * Server actions for "Sort the vocabulary". The reviewer always comes from
 * the session; the corpus layer checks the payload (cleanVocabPayload), that
 * the cards exist and that a renamed group is one of the reviewer's.
 */

type Result = { ok: true; reviewId: string } | { ok: false; error: string };

const schema = z.object({
  // vocab-add goes through addVocabTermAction (it creates the card).
  action: z.enum(VOCAB_ACTIONS).exclude(["vocab-add"]),
  // Shape, vocabulary and lengths are checked in @elkdonis/astro-corpus (cleanVocabPayload).
  payload: z.record(z.string(), z.unknown()),
  seconds: z.number().min(0).max(86400).nullable().optional(),
});

export type VocabReviewInput = z.input<typeof schema>;

export async function vocabReviewAction(input: VocabReviewInput): Promise<Result> {
  const viewer = await requireStudioReviewer("/hub/studio/vocabulary");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const ua = (await headers()).get("user-agent") ?? "";
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "phone" : "desktop";
  try {
    const { reviewId } = await recordVocabReview({
      reviewerId: viewer.userId,
      action: parsed.data.action,
      payload: parsed.data.payload,
      seconds: parsed.data.seconds ?? null,
      device,
    });
    return { ok: true, reviewId };
  } catch (e) {
    if (e instanceof VocabError) return { ok: false, error: e.message };
    console.error("[studio] vocabulary review failed", e);
    return { ok: false, error: "Could not save. Try again." };
  }
}

/** "Same as…": other cards whose term or spellings contain the query. */
export async function searchVocabAction(q: string, exclude?: string): Promise<VocabSearchHit[]> {
  const viewer = await requireStudioReviewer("/hub/studio/vocabulary");
  const query = z.string().max(100).safeParse(q);
  if (!query.success) return [];
  const ex = z.string().uuid().safeParse(exclude);
  return searchVocabCards(viewer.userId, query.data, { exclude: ex.success ? ex.data : undefined });
}

const addSchema = z.object({
  term: z.string().max(200),
  fromCardId: z.string().uuid().nullable().optional(),
  fromExample: z.number().int().min(0).max(50).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  seconds: z.number().min(0).max(86400).nullable().optional(),
});

export type AddTermInput = z.input<typeof addSchema>;

/** Add a term of his own as a new card (or learn that it already is one). */
export async function addVocabTermAction(
  input: AddTermInput,
): Promise<{ ok: true; cardId: string; term: string; reviewId: string } | { ok: false; error: string; existing?: { id: string; term: string } }> {
  const viewer = await requireStudioReviewer("/hub/studio/vocabulary");
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const ua = (await headers()).get("user-agent") ?? "";
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "phone" : "desktop";
  try {
    const r = await addVocabTerm({ reviewerId: viewer.userId, ...parsed.data, device });
    return r.ok ? r : { ok: false, error: `Already a card: ${r.existing.term}`, existing: r.existing };
  } catch (e) {
    if (e instanceof VocabError) return { ok: false, error: e.message };
    console.error("[studio] add vocabulary term failed", e);
    return { ok: false, error: "Could not save. Try again." };
  }
}
