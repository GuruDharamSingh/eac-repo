"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { addCorrespondenceCell, addFoundationItem, FOUNDATION_ACTIONS, FoundationError, foundationItemSources, recordFoundationReview, type FoundationSource } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";

/**
 * Server actions for "Foundations". The reviewer always comes from the
 * session; the corpus layer checks the payload (cleanFoundationPayload), that
 * the items exist and that the mark goes with the kind of item.
 */

type Result = { ok: true; reviewId: string } | { ok: false; error: string };

const schema = z.object({
  // foundation-add goes through addFoundationItemAction (it creates the item).
  action: z.enum(FOUNDATION_ACTIONS).exclude(["foundation-add", "foundation-cell-add"]),
  // Shape, vocabulary and lengths are checked in @elkdonis/astro-corpus (cleanFoundationPayload).
  payload: z.record(z.string(), z.unknown()),
  seconds: z.number().min(0).max(86400).nullable().optional(),
});

export type FoundationReviewInput = z.input<typeof schema>;

async function device(): Promise<string> {
  const ua = (await headers()).get("user-agent") ?? "";
  return /Mobi|Android|iPhone|iPad/i.test(ua) ? "phone" : "desktop";
}

export async function foundationReviewAction(input: FoundationReviewInput): Promise<Result> {
  const viewer = await requireStudioReviewer("/hub/studio/foundations");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  try {
    const { reviewId } = await recordFoundationReview({
      reviewerId: viewer.userId,
      action: parsed.data.action,
      payload: parsed.data.payload,
      seconds: parsed.data.seconds ?? null,
      device: await device(),
    });
    return { ok: true, reviewId };
  } catch (e) {
    if (e instanceof FoundationError) return { ok: false, error: e.message };
    console.error("[studio] foundations review failed", e);
    return { ok: false, error: "Could not save. Try again." };
  }
}

const addSchema = z.object({
  lesson: z.string().max(80),
  concept: z.string().max(80),
  kind: z.enum(["trait", "image", "note"]),
  text: z.string().max(1200),
  meaning: z.string().max(800).nullable().optional(),
  facet: z.enum(["itself", "dominant", "lacking"]).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

export type AddFoundationInput = z.input<typeof addSchema>;

/** Add a quality, a picture or a note of his own (or learn that it is already there). */
export async function addFoundationItemAction(
  input: AddFoundationInput,
): Promise<{ ok: true; itemId: string; text: string; reviewId: string } | { ok: false; error: string }> {
  const viewer = await requireStudioReviewer("/hub/studio/foundations");
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  try {
    const r = await addFoundationItem({ reviewerId: viewer.userId, ...parsed.data, device: await device() });
    return r.ok ? r : { ok: false, error: `Already in the list: ${r.existing.text}` };
  } catch (e) {
    if (e instanceof FoundationError) return { ok: false, error: e.message };
    console.error("[studio] add foundation item failed", e);
    return { ok: false, error: "Could not save. Try again." };
  }
}

/** The source quotes of the given items (a row's quotes are loaded when it is opened). */
export async function foundationSourcesAction(ids: string[]): Promise<Record<string, FoundationSource[]>> {
  await requireStudioReviewer("/hub/studio/foundations");
  const parsed = z.array(z.string().uuid()).max(50).safeParse(ids);
  return parsed.success ? foundationItemSources(parsed.data) : {};
}

const cellSchema = z.object({
  subjectType: z.string().max(40),
  subject: z.string().max(80),
  category: z.string().max(120),
  value: z.string().max(1200),
  scheme: z.enum(["traditional", "later addition"]).nullable().optional(),
  facet: z.enum(["itself", "dominant", "lacking"]).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

/** Add a value of his own to a cell of the correspondence table. */
export async function addCorrespondenceCellAction(input: z.input<typeof cellSchema>): Promise<{ ok: true; cellId: string; value: string; reviewId: string } | { ok: false; error: string }> {
  const viewer = await requireStudioReviewer("/hub/studio/foundations/correspondences");
  const parsed = cellSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  try {
    const r = await addCorrespondenceCell({ reviewerId: viewer.userId, ...parsed.data, device: await device() });
    return r.ok ? r : { ok: false, error: `Already there: ${r.existing}` };
  } catch (e) {
    if (e instanceof FoundationError) return { ok: false, error: e.message };
    console.error("[studio] add correspondence failed", e);
    return { ok: false, error: "Could not save. Try again." };
  }
}
