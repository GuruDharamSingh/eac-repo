/**
 * "Sort the vocabulary" (/hub/studio/vocabulary): the queue, one card, the
 * owner's groups, card search for "Same as…", and recording decisions. The
 * rules and the replay of decisions are in src/vocab-rules.ts; the cards are
 * astro_vocab_cards (migration 182, scripts/import-vocab.ts).
 *
 * The queue serves cards the reviewer has not decided: the first deck in
 * deck_order, then terms the owner added himself, then the rest by how many
 * books use the term. Skipped cards come back once everything else is sorted.
 */

import { db } from "@elkdonis/db";
import { ORG_ID } from "./sources";
import {
  cleanName,
  cleanVocabPayload,
  groupNames,
  matchGroup,
  similarGroups,
  wouldCycle,
  normTerm,
  replayVocab,
  VOCAB_ACTIONS,
  VocabError,
  type VocabAction,
  type VocabDecision,
  type VocabReviewRow,
  type VocabState,
  UNDOABLE_VOCAB_ACTIONS,
  VOCAB_NOTE_MAX,
  VOCAB_TERM_MAX,
} from "./vocab-rules";

export * from "./vocab-rules";

/** Whether migration 182 has been applied (the studio pages show a notice until it is). */
export async function vocabReady(): Promise<boolean> {
  const [row] = await db<{ ok: boolean }[]>`SELECT to_regclass('astro_vocab_cards') IS NOT NULL AS ok`;
  return Boolean(row?.ok);
}

export interface VocabCard {
  id: string;
  norm: string;
  term: string;
  kindHint: string | null;
  groupHint: string | null;
  sources: { source: string; detail: string | null }[];
  books: number;
  uses: number;
  examples: { text: string; book: string | null }[];
  also: string[];
  deckOrder: number | null;
}

interface CardRow {
  id: string;
  norm: string;
  term: string;
  kind_hint: string | null;
  group_hint: string | null;
  sources: unknown;
  books: number;
  uses: number;
  examples: unknown;
  also: string[];
  deck_order: number | null;
}

const objs = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

function toCard(r: CardRow): VocabCard {
  return {
    id: r.id,
    norm: r.norm,
    term: r.term,
    kindHint: r.kind_hint,
    groupHint: r.group_hint,
    sources: objs(r.sources).map((s) => ({ source: str(s.source) ?? "?", detail: str(s.detail) })),
    books: r.books,
    uses: r.uses,
    examples: objs(r.examples).flatMap((e) => (str(e.text) ? [{ text: e.text as string, book: str(e.book) }] : [])),
    also: r.also ?? [],
    deckOrder: r.deck_order,
  };
}

const cardColumns = () => db`id, norm, term, kind_hint, group_hint, sources, books, uses, examples, also, deck_order`;

/** The reviewer's vocabulary reviews, replayed. */
export async function vocabState(reviewerId: string): Promise<VocabState> {
  const rows = await db<{ id: string; action: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, action, payload, created_at FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND reviewer_id = ${reviewerId} AND question_id IS NULL AND action = ANY (${[...VOCAB_ACTIONS]})
  `;
  return replayVocab(rows.map((r) => ({ id: r.id, action: r.action, payload: r.payload, createdAt: r.created_at.toISOString() })));
}

/** The next card to sort, or null when every card has a decision. */
export async function nextVocabCard(reviewerId: string, state?: VocabState): Promise<VocabCard | null> {
  const s = state ?? (await vocabState(reviewerId));
  const decided = [...[...s.decisions].filter(([, d]) => d.verdict !== "skip").map(([id]) => id), ...s.withdrawn];
  const skipped = [...s.decisions].filter(([, d]) => d.verdict === "skip").map(([id]) => id);
  const [row] = await db<CardRow[]>`
    SELECT ${cardColumns()} FROM astro_vocab_cards
    WHERE org_id = ${ORG_ID} AND NOT (id = ANY (${decided}::uuid[]))
    ORDER BY (id = ANY (${skipped}::uuid[])), deck_order NULLS LAST, (sources @> '[{"source": "owner"}]'::jsonb) DESC, books DESC, uses DESC, norm
    LIMIT 1
  `;
  return row ? toCard(row) : null;
}

export async function getVocabCard(id: string): Promise<VocabCard | null> {
  try {
    const [row] = await db<CardRow[]>`SELECT ${cardColumns()} FROM astro_vocab_cards WHERE id = ${id} AND org_id = ${ORG_ID}`;
    return row ? toCard(row) : null;
  } catch {
    return null; // a malformed id in the URL
  }
}

export interface VocabProgress {
  /** Cards in the first deck, and how many have a decision other than skip. */
  deck: { total: number; sorted: number };
  all: { total: number; sorted: number };
}

export async function vocabProgress(reviewerId: string, state?: VocabState): Promise<VocabProgress> {
  const s = state ?? (await vocabState(reviewerId));
  const sorted = [...s.decisions].filter(([, d]) => d.verdict !== "skip").map(([id]) => id);
  const [row] = await db<{ deck: number; deck_sorted: number; all: number; all_sorted: number }[]>`
    SELECT count(*) FILTER (WHERE deck_order IS NOT NULL)::int AS deck,
           count(*) FILTER (WHERE deck_order IS NOT NULL AND id = ANY (${sorted}::uuid[]))::int AS deck_sorted,
           count(*)::int AS all,
           count(*) FILTER (WHERE id = ANY (${sorted}::uuid[]))::int AS all_sorted
    FROM astro_vocab_cards WHERE org_id = ${ORG_ID}
  `;
  return { deck: { total: row?.deck ?? 0, sorted: row?.deck_sorted ?? 0 }, all: { total: row?.all ?? 0, sorted: row?.all_sorted ?? 0 } };
}

export interface VocabSearchHit {
  id: string;
  term: string;
  also: string[];
  books: number;
  /** The reviewer's decision on it, if any: its groups and preferred label. */
  group: string | null;
  groups: string[];
  preferred: string | null;
}

/** Cards whose term or other spellings contain the query, sorted ones first, then by books. */
export async function searchVocabCards(reviewerId: string, q: string, opts: { exclude?: string } = {}): Promise<VocabSearchHit[]> {
  const query = q.trim();
  if (!query) return [];
  const state = await vocabState(reviewerId);
  const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db<{ id: string; term: string; also: string[]; books: number }[]>`
    SELECT id, term, also, books FROM astro_vocab_cards
    WHERE org_id = ${ORG_ID} AND (term ILIKE ${like} OR norm ILIKE ${like} OR array_to_string(also, ' ') ILIKE ${like})
      ${opts.exclude ? db`AND id <> ${opts.exclude}` : db``}
    ORDER BY (lower(term) = lower(${query})) DESC, books DESC
    LIMIT 40
  `;
  return rows
    .map((r) => {
      const d = state.decisions.get(r.id);
      return { id: r.id, term: r.term, also: r.also ?? [], books: r.books, group: d?.group ?? null, groups: d?.groups ?? [], preferred: d?.preferred ?? null };
    })
    .sort((a, b) => Number(Boolean(b.group)) - Number(Boolean(a.group)))
    .slice(0, 12);
}

export interface VocabGroupCard {
  id: string;
  term: string;
  preferred: string | null;
  books: number;
  note: string | null;
  /** The owner's standing ratings of the card's example sentences. */
  exampleRatings: { good: number; weak: number; wrongSense: number };
  /** Added by the owner (vocab-add), not by the generator. */
  ownerAdded: boolean;
  /** All of the card's groups (it is listed under each), and the others besides the one it is shown under. */
  groups: string[];
  alsoIn: string[];
  /** Cards marked "same as" this one (directly or through a chain). */
  synonyms: { id: string; term: string; preferred: string | null }[];
}

export interface VocabGroupsView {
  groups: { name: string; cards: VocabGroupCard[]; total: number }[];
  notTerms: { id: string; term: string }[];
  skipped: { id: string; term: string }[];
  /** Terms the owner added, newest first, with where they came from and where they are now. */
  added: { id: string; term: string; fromTerm: string | null; group: string | null; groups: string[]; decision: string | null; createdAt: string }[];
  /** Every group name, for "edit groups". */
  names: string[];
  /** Group nesting: child → parent. */
  parents: Record<string, string>;
  /** Groups that look like the same group (case, plural, punctuation, a one-letter typo), most used name first. */
  similar: string[][];
}

/** Every group with its cards (synonyms nested under their main card), plus "not a term" and skipped cards. */
export async function vocabGroups(reviewerId: string): Promise<VocabGroupsView> {
  const state = await vocabState(reviewerId);
  const ids = [...new Set([...state.decisions.keys(), ...state.added.flatMap((a) => (a.fromCardId ? [a.cardId, a.fromCardId] : [a.cardId]))])];
  const rows = ids.length
    ? await db<{ id: string; term: string; books: number }[]>`SELECT id, term, books FROM astro_vocab_cards WHERE id = ANY (${ids}::uuid[])`
    : [];
  const card = new Map(rows.map((r) => [r.id, r]));
  const ownerAdded = new Set(state.added.map((a) => a.cardId));
  const byGroup = new Map<string, VocabGroupCard[]>();
  const synonyms = new Map<string, VocabGroupCard["synonyms"]>();
  for (const [id, d] of state.decisions) {
    const c = card.get(id);
    if (!c || d.verdict !== "group" || !d.groups.length) continue;
    if (d.mainId !== id) {
      synonyms.set(d.mainId, [...(synonyms.get(d.mainId) ?? []), { id, term: c.term, preferred: d.preferred }]);
      continue;
    }
    const ratings = [...(state.examples.get(id)?.values() ?? [])];
    for (const g of d.groups)
      byGroup.set(g, [
      ...(byGroup.get(g) ?? []),
      {
        id,
        term: c.term,
        preferred: d.preferred,
        books: c.books,
        note: d.note,
        exampleRatings: {
          good: ratings.filter((x) => x.rating === "good").length,
          weak: ratings.filter((x) => x.rating === "weak").length,
          wrongSense: ratings.filter((x) => x.rating === "wrong-sense").length,
        },
        ownerAdded: ownerAdded.has(id),
        groups: d.groups,
        alsoIn: d.groups.filter((x) => x !== g),
        synonyms: [],
      },
    ]);
  }
  for (const list of byGroup.values()) {
    for (const c of list) c.synonyms = (synonyms.get(c.id) ?? []).sort((a, b) => a.term.localeCompare(b.term));
    list.sort((a, b) => b.books - a.books || a.term.localeCompare(b.term));
  }
  const listOf = (verdict: VocabDecision["verdict"]) =>
    [...state.decisions]
      .filter(([id, d]) => d.verdict === verdict && card.has(id))
      .map(([id]) => ({ id, term: card.get(id)!.term }))
      .sort((a, b) => a.term.localeCompare(b.term));
  return {
    groups: state.groups.map((g) => ({ name: g.name, total: g.cards, cards: byGroup.get(g.name) ?? [] })),
    notTerms: listOf("not-a-term"),
    skipped: listOf("skip"),
    added: [...state.added]
      .reverse()
      .filter((a) => card.has(a.cardId))
      .map((a) => ({
        id: a.cardId,
        term: card.get(a.cardId)!.term,
        fromTerm: a.fromCardId ? (card.get(a.fromCardId)?.term ?? null) : null,
        group: state.decisions.get(a.cardId)?.group ?? null,
        groups: state.decisions.get(a.cardId)?.groups ?? [],
        decision: state.decisions.get(a.cardId)?.verdict ?? null,
        createdAt: a.createdAt,
      })),
    names: state.groups.map((g) => g.name),
    parents: Object.fromEntries(state.parents),
    similar: similarGroups(state.groups),
  };
}

/** Check a vocabulary review against the cards and the reviewer's groups, then store it. */
export async function recordVocabReview(r: {
  reviewerId: string;
  action: VocabAction;
  payload: Record<string, unknown>;
  seconds: number | null;
  device: string | null;
}): Promise<{ reviewId: string }> {
  if (r.action === "vocab-add") throw new VocabError("Add terms with addVocabTerm");
  const payload = cleanVocabPayload(r.action, r.payload);
  if (r.action === "vocab-example") {
    const [c] = await db<{ examples: unknown }[]>`SELECT examples FROM astro_vocab_cards WHERE id = ${payload.cardId as string} AND org_id = ${ORG_ID}`;
    if (!c) throw new VocabError("Card not found");
    if (!objs(c.examples).some((e) => e.text === payload.text)) throw new VocabError("That sentence is no longer one of the card's examples");
  } else if (r.action === "vocab-sort") {
    if (Array.isArray(payload.groups)) {
      // Never a near-duplicate group: "Aspects" sorts into his "Aspect".
      const names = [...groupNames(await vocabState(r.reviewerId))];
      payload.groups = [...new Set((payload.groups as string[]).map((g) => matchGroup(g, names) ?? g))];
    }
    const ids = [payload.cardId, payload.sameAs].filter((x): x is string => typeof x === "string");
    const found = await db<{ id: string }[]>`SELECT id FROM astro_vocab_cards WHERE id = ANY (${ids}::uuid[]) AND org_id = ${ORG_ID}`;
    if (found.length !== ids.length) throw new VocabError("Card not found");
  } else if (r.action === "vocab-group") {
    const names = groupNames(await vocabState(r.reviewerId));
    if (!names.has(payload.from as string)) throw new VocabError("No group by that name");
    // Renaming to a near-duplicate of another group merges into that group's spelling.
    payload.to = matchGroup(payload.to as string, [...names].filter((n) => n !== payload.from)) ?? payload.to;
    if (payload.to === payload.from) throw new VocabError("That is the same name");
  } else if (r.action === "vocab-group-parent") {
    const state = await vocabState(r.reviewerId);
    const names = groupNames(state);
    if (!names.has(payload.group as string)) throw new VocabError("No group by that name");
    if (payload.parent !== null) {
      if (!names.has(payload.parent as string)) throw new VocabError("No parent group by that name");
      if (wouldCycle(state.parents, payload.group as string, payload.parent as string)) throw new VocabError("That would put the group inside itself");
    } else if (!state.parents.has(payload.group as string)) throw new VocabError("That group is already at the top level");
  } else {
    const [prev] = await db<{ id: string; action: string; payload: Record<string, unknown> }[]>`
      SELECT id, action, payload FROM astro_reviews
      WHERE id = ${payload.reviewId as string} AND reviewer_id = ${r.reviewerId} AND org_id = ${ORG_ID}
        AND action = ANY (${[...UNDOABLE_VOCAB_ACTIONS]})
    `;
    if (!prev) throw new VocabError("Nothing to undo");
    const [again] = await db<{ id: string }[]>`
      SELECT id FROM astro_reviews
      WHERE reviewer_id = ${r.reviewerId} AND org_id = ${ORG_ID} AND action = 'vocab-undo' AND payload->>'reviewId' = ${prev.id}
    `;
    if (again) throw new VocabError("That was already undone");
    if (prev.action === "vocab-add" && typeof prev.payload.cardId === "string") await dropAddedCard(prev.payload.cardId, prev.id);
  }
  const [rev] = await db<{ id: string }[]>`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES (${ORG_ID}, NULL, ${r.reviewerId}, ${r.action}, ${db.json(payload as never)}, ${[]}, ${[]}, NULL, ${r.seconds}, ${r.device})
    RETURNING id
  `;
  return { reviewId: rev.id };
}

// ── terms the owner adds ───────────────────────────────────────────────────

/**
 * Undoing an added term: delete its card when it is still only the owner's
 * addition (no other review names it as card, synonym target or source, and
 * no import has taken it over). Otherwise the card stays and the replay
 * treats it as withdrawn.
 */
async function dropAddedCard(cardId: string, addReviewId: string) {
  const [refs] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND id <> ${addReviewId} AND action LIKE 'vocab-%'
      AND (payload->>'cardId' = ${cardId} OR payload->>'sameAs' = ${cardId} OR payload->>'fromCardId' = ${cardId})
  `;
  if ((refs?.n ?? 0) > 0) return;
  await db`DELETE FROM astro_vocab_cards WHERE id = ${cardId} AND org_id = ${ORG_ID} AND batch = 'owner'`;
}

/** The last few undoable actions in words, newest first, for the toast and the history list. */
export async function describeVocabHistory(state: VocabState, n = 5): Promise<{ reviewId: string; label: string; createdAt: string }[]> {
  const rows = state.history.slice(0, n);
  const ids = [...new Set(rows.flatMap((r) => [r.payload.cardId, r.payload.sameAs].filter((x): x is string => typeof x === "string")))];
  const terms = new Map(
    ids.length ? (await db<{ id: string; term: string }[]>`SELECT id, term FROM astro_vocab_cards WHERE id = ANY (${ids}::uuid[])`).map((c) => [c.id, c.term]) : [],
  );
  const termOf = (v: unknown) => (typeof v === "string" ? (terms.get(v) ?? "a card") : "a card");
  return rows.map((r) => {
    const p = r.payload;
    const term = termOf(p.cardId);
    let label: string;
    if (r.action === "vocab-group") label = `renamed group “${String(p.from)}” → “${String(p.to)}”`;
    else if (r.action === "vocab-group-parent")
      label = p.parent ? `put group “${String(p.group)}” under “${String(p.parent)}”` : `moved group “${String(p.group)}” to the top level`;
    else if (r.action === "vocab-example") label = `${term}: example ${Number(p.example) + 1} ${p.rating === "clear" ? "rating cleared" : `rated ${String(p.rating).replace("-", " ")}`}`;
    else if (r.action === "vocab-add") label = `added the term “${String(p.term)}”`;
    else if (p.verdict === "group") {
      const groups = Array.isArray(p.groups) ? (p.groups as string[]) : typeof p.group === "string" ? [p.group] : [];
      label = `${term} → ${[...groups, ...(typeof p.sameAs === "string" ? [`same as ${termOf(p.sameAs)}`] : [])].join(", ")}`;
    } else label = `${term} → ${p.verdict === "skip" ? "skipped" : "not a term"}`;
    return { reviewId: r.id, label, createdAt: r.createdAt };
  });
}

export type AddTermResult = { ok: true; cardId: string; term: string; reviewId: string } | { ok: false; existing: { id: string; term: string } };

/**
 * Add a term of the owner's own as a new card: typed, or selected in one of a
 * card's example sentences (which then becomes the new card's example). A
 * term whose norm is already a card is not duplicated; the existing card is
 * returned instead. books / uses are counted from the imported passages by
 * full-text phrase match (approximate). The new card has no deck order and is
 * queued right after the first deck. Records a vocab-add review.
 */
export async function addVocabTerm(r: {
  reviewerId: string;
  term: string;
  fromCardId?: string | null;
  fromExample?: number | null;
  note?: string | null;
  seconds?: number | null;
  device?: string | null;
}): Promise<AddTermResult> {
  const term = cleanName(r.term, "term", VOCAB_TERM_MAX);
  const norm = term ? normTerm(term) : "";
  if (!term || !norm) throw new VocabError("Type the term");
  const note = cleanName(r.note, "note", VOCAB_NOTE_MAX);

  const [existing] = await db<{ id: string; term: string }[]>`SELECT id, term FROM astro_vocab_cards WHERE org_id = ${ORG_ID} AND norm = ${norm}`;
  if (existing) return { ok: false, existing };

  let from: { id: string; term: string; examples: unknown } | undefined;
  if (r.fromCardId) {
    [from] = await db<{ id: string; term: string; examples: unknown }[]>`
      SELECT id, term, examples FROM astro_vocab_cards WHERE id = ${r.fromCardId} AND org_id = ${ORG_ID}`;
    if (!from) throw new VocabError("Card not found");
  }
  const example = from && r.fromExample != null ? objs(from.examples)[r.fromExample] : undefined;
  if (r.fromExample != null && !example) throw new VocabError("That example sentence is not on the card");

  const [counts] = await db<{ books: number; uses: number }[]>`
    SELECT count(DISTINCT source_id)::int AS books, count(*)::int AS uses
    FROM astro_texts WHERE kind = 'import' AND org_id = ${ORG_ID} AND search @@ phraseto_tsquery('english', ${term})
  `.catch(() => [{ books: 0, uses: 0 }]);

  const source = { source: "owner", detail: from ? `added while sorting “${from.term}”` : "suggested" };
  const [card] = await db<{ id: string }[]>`
    INSERT INTO astro_vocab_cards (org_id, norm, term, sources, books, uses, examples, also, deck_order, batch)
    VALUES (${ORG_ID}, ${norm}, ${term}, ${db.json([source] as never)}, ${counts?.books ?? 0}, ${counts?.uses ?? 0},
            ${db.json((example ? [{ text: example.text, book: str(example.book) }] : []) as never)}, ${[]}, NULL, 'owner')
    ON CONFLICT (org_id, norm) DO NOTHING
    RETURNING id
  `;
  if (!card) {
    const [now] = await db<{ id: string; term: string }[]>`SELECT id, term FROM astro_vocab_cards WHERE org_id = ${ORG_ID} AND norm = ${norm}`;
    return { ok: false, existing: now };
  }
  const payload = cleanVocabPayload("vocab-add", {
    cardId: card.id,
    term,
    fromCardId: from?.id,
    fromExample: example ? r.fromExample : undefined,
    note,
  });
  const [rev] = await db<{ id: string }[]>`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES (${ORG_ID}, NULL, ${r.reviewerId}, 'vocab-add', ${db.json(payload as never)}, ${[]}, ${[]}, NULL, ${r.seconds ?? null}, ${r.device ?? null})
    RETURNING id
  `;
  return { ok: true, cardId: card.id, term, reviewId: rev.id };
}
