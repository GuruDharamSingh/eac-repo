"use server";

import { defineTerm, lookupTerm, getTermDefinitions } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";

// ============================================================================
// The network dictionary, behind the define surface.
//
// The dictionary is the wiki, and the wiki is network-wide: a term defined
// while writing here becomes a page every org can read and edit. So the gate
// is membership, not editorship — the same bar the wiki itself applies, and
// deliberately looser than requireOrgEditor, which guards this org's own
// content.
// ============================================================================

export async function lookupTermAction(
  term: string
): Promise<{ slug: string; title: string; senses: number } | null> {
  await requireOrgMember();
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
  const viewer = await requireOrgMember();
  const term = input.term.trim();
  if (!term) throw new Error("A term is required.");

  const result = await defineTerm({
    term,
    definition: input.definition,
    authorId: viewer.userId,
    sourceThreadId: input.sourceThreadId,
  });
  return {
    slug: result.slug,
    created: result.created,
    senses: result.definitions.length,
    duplicate: result.duplicate,
  };
}
