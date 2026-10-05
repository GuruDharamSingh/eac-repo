/**
 * Footnotes for the deck's AI drafts (astro_texts kind 'generated'), computed
 * on the server per deck item.
 *
 * A draft's generated_from.references holds the chunk ids of the passages
 * the drafting model was given; a chunk id is the imported passage's
 * astro_texts.source_ref. Each draft sentence gets the reference passage that
 * best supports it (lib/footnotes.ts footnoteDraft), or none — shown as "no
 * source found".
 *
 * Only `references` is read from generated_from: the draft's design (strong,
 * subtle_error, …) must never reach the deck.
 */

import { db } from "@elkdonis/db";
import { footnoteDraft, type FootnotedSentence, type RefPassage } from "./footnotes";

const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function draftFootnotes(candidateIds: string[], bar?: Parameters<typeof footnoteDraft>[2]): Promise<Record<string, FootnotedSentence[]>> {
  if (!candidateIds.length) return {};
  const drafts = await db<{ id: string; body: string; refs: unknown }[]>`
    SELECT id, body, generated_from->'references' AS refs
    FROM astro_texts WHERE id = ANY (${candidateIds}::uuid[]) AND kind = 'generated'
  `;
  const chunkIds = [...new Set(drafts.flatMap((d) => strArr(d.refs)))];
  if (!chunkIds.length) return {};
  const passages = await db<
    { id: string; source_ref: string; body: string; headings: unknown; pages: unknown; title: string; author: string | null }[]
  >`
    SELECT t.id, t.source_ref, t.body, t.meta->'headings' AS headings, t.meta->'pages' AS pages, so.title, so.author
    FROM astro_texts t JOIN astro_sources so ON so.id = t.source_id
    WHERE t.source_ref = ANY (${chunkIds}::text[]) AND t.kind = 'import'
  `;
  const claims = passages.length
    ? await db<{ text_id: string; body: string; because: string | null }[]>`
        SELECT text_id, body, meta->>'because' AS because FROM astro_statements
        WHERE text_id = ANY (${passages.map((p) => p.id)}::uuid[]) ORDER BY text_id, ordinal
      `
    : [];
  const claimsOf = new Map<string, RefPassage["claims"]>();
  for (const c of claims) claimsOf.set(c.text_id, [...(claimsOf.get(c.text_id) ?? []), { body: c.body, because: c.because?.trim() || null }]);
  const byChunk = new Map<string, RefPassage>(
    passages.map((p) => [
      p.source_ref,
      {
        textId: p.id,
        body: p.body,
        headings: strArr(p.headings),
        pages: Array.isArray(p.pages) ? (p.pages as unknown[]).filter((x): x is number => typeof x === "number") : [],
        book: p.title,
        author: p.author,
        claims: claimsOf.get(p.id) ?? [],
      },
    ]),
  );
  const out: Record<string, FootnotedSentence[]> = {};
  for (const d of drafts) {
    const refs = strArr(d.refs).flatMap((c) => (byChunk.has(c) ? [byChunk.get(c)!] : []));
    out[d.id] = footnoteDraft(d.body, refs, bar);
  }
  return out;
}
