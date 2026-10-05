/**
 * Corpus references for the chart explorer: passage-first summaries, full
 * lists and votes relative to a chart (./references-core.ts, ./scope.ts,
 * ./applicability.ts), and one whole passage on demand. READ-ONLY (votes are
 * written by recordRefVote in @elkdonis/astro-corpus).
 */

import { db } from "@elkdonis/db";
import { resolveScope, scopeLabel, type Crumb } from "./scope";
import { isPlacementKey } from "./applicability";
import { footnoteFor, splitSentences, type Footnote } from "./footnotes";

export * from "./references-core";

const pagesOf = (v: unknown) => (Array.isArray(v) ? (v as number[]) : null);
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export interface Passage {
  textId: string;
  /** The whole passage — null for non-owners (licences unknown: excerpts only). */
  body: string | null;
  excerptOnly: boolean;
  pages: number[] | null;
  /** Raw heading path as the chunker recorded it. */
  headings: string[];
  /** Corrected: siblings / running headers removed (lib/scope.ts). */
  breadcrumb: Crumb[];
  ignored: string[];
  subject: string | null;
  contentType: string | null;
  book: { id: string; title: string; author: string | null };
  /**
   * The AI digest's claims from this passage — UNVERIFIED, shown only on
   * request. `tagged`: the digest tagged the browsed factor key on it.
   */
  claims: Array<{ id: string; ordinal: number; body: string; tagged: boolean; because: string | null; keys: string[] }>;
  /** One footnote per claim (lib/footnotes.ts), computed here so the body need not be sent. For non-owners: one source sentence of ≤ 300 characters each. */
  claimNotes: Footnote[];
}

/** One passage (astro_texts.body, imported books only); `full: false` withholds the body (non-owners). */
export async function getPassage(textId: string, factorKey: string | null, opts: { full: boolean } = { full: true }): Promise<Passage | null> {
  const [t] = await db<
    { id: string; body: string; pages: unknown; headings: unknown; content_type: string | null; source_id: string; title: string; author: string | null }[]
  >`
    SELECT t.id, t.body, t.meta->'pages' AS pages, t.meta->'headings' AS headings, t.meta->>'contentType' AS content_type,
           so.id AS source_id, so.title, so.author
    FROM astro_texts t JOIN astro_sources so ON so.id = t.source_id
    WHERE t.id = ${textId} AND t.kind = 'import'
  `;
  if (!t) return null;
  const claims = await db<{ id: string; ordinal: number; body: string; tagged: boolean; because: string | null; keys: string[] }[]>`
    SELECT s.id, s.ordinal, s.body, NULLIF(trim(s.meta->>'because'), '') AS because,
           ARRAY(SELECT x.factor_key FROM astro_statement_factors x WHERE x.statement_id = s.id) || s.condition_keys AS keys,
           ${factorKey ? db`EXISTS (SELECT 1 FROM astro_statement_factors sf WHERE sf.statement_id = s.id AND sf.factor_key = ${factorKey})` : db`FALSE`} AS tagged
    FROM astro_statements s WHERE s.text_id = ${textId} ORDER BY s.ordinal
  `;
  const headings = strArr(t.headings);
  const scope = resolveScope(headings);
  const source = { textId: t.id, body: t.body, headings, pages: pagesOf(t.pages) ?? [], book: t.title, author: t.author };
  const sentences = splitSentences(t.body);
  const claimNotes = claims.map((c) => {
    const n = footnoteFor(c.body, source, { sentences, because: c.because, keys: c.keys, max: opts.full ? 2 : 1 });
    return opts.full ? n : { ...n, sentences: n.sentences.map((s) => ({ ...s, text: s.text.length > 300 ? `${s.text.slice(0, 300)} …` : s.text })) };
  });
  return {
    textId: t.id,
    body: opts.full ? t.body : null,
    excerptOnly: !opts.full,
    claimNotes,
    pages: pagesOf(t.pages),
    headings,
    breadcrumb: scope.breadcrumb,
    ignored: scope.ignored,
    subject: scopeLabel(scope.keys.some(isPlacementKey) ? scope.keys.filter(isPlacementKey) : scope.keys),
    contentType: t.content_type,
    book: { id: t.source_id, title: t.title, author: t.author },
    claims,
  };
}
