"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { FoundationError, LIBRARY_NOTE_TARGETS, libraryPassageText, recordLibraryNote } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";

/** The Library's one write: a free-text note on an entry (checked in @elkdonis/astro-corpus, cleanLibraryNote). */

const schema = z.object({
  target_type: z.enum(LIBRARY_NOTE_TARGETS),
  target_id: z.string().min(1).max(400),
  silo: z.object({ type: z.string().min(1).max(60), subject: z.string().min(1).max(200) }),
  text: z.string().max(4000),
  context: z.string().max(2000),
});

export async function libraryNoteAction(input: z.input<typeof schema>): Promise<{ ok: true; reviewId: string } | { ok: false; error: string }> {
  const viewer = await requireStudioReviewer("/hub/studio/library");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the note" };
  const ua = (await headers()).get("user-agent") ?? "";
  try {
    const { reviewId } = await recordLibraryNote(viewer.userId, parsed.data, /Mobi|Android|iPhone|iPad/i.test(ua) ? "phone" : "desktop");
    return { ok: true, reviewId };
  } catch (e) {
    if (e instanceof FoundationError) return { ok: false, error: e.message };
    console.error("[studio] library note failed", e);
    return { ok: false, error: "Could not save. Try again." };
  }
}

/** The whole text of one imported passage, fetched when it is opened. */
export async function libraryPassageAction(textId: string): Promise<string | null> {
  await requireStudioReviewer("/hub/studio/library");
  const id = z.string().uuid().safeParse(textId);
  return id.success ? libraryPassageText(id.data) : null;
}
