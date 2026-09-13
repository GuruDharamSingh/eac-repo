"use server";

import { defineTerm, lookupTerm, getTermDefinitions } from "@elkdonis/services";
import { requireUser } from "@/lib/session";

// ============================================================================
// The network dictionary, behind the define surface.
//
// Gated on authentication alone, matching the wiki itself: the dictionary IS
// the wiki, which any signed-in person on the network may read and edit. This
// is deliberately looser than the org-role gates elsewhere in this app — a
// collective's vocabulary is not one org's property.
// ============================================================================

export async function lookupTermAction(
  term: string
): Promise<{ slug: string; title: string; senses: number } | null> {
  await requireUser();
  const trimmed = term.trim();
  if (!trimmed) return null;

  const hit = await lookupTerm(trimmed);
  if (!hit) return null;

  const senses = await getTermDefinitions(hit.id);
  return { slug: hit.slug, title: hit.title, senses: senses.length };
}

export async function defineTermAction(input: {
  term: string;
  definition: string;
  sourceThreadId?: string;
}): Promise<{ slug: string; created: boolean; senses: number; duplicate: boolean }> {
  const user = await requireUser();
  const term = input.term.trim();
  if (!term) throw new Error("A term is required.");

  const result = await defineTerm({
    term,
    definition: input.definition,
    authorId: user.id,
    sourceThreadId: input.sourceThreadId,
  });

  return {
    slug: result.slug,
    created: result.created,
    senses: result.definitions.length,
    duplicate: result.duplicate,
  };
}
