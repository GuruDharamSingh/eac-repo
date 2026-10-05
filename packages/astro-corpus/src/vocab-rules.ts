/**
 * "Sort the vocabulary" (bedrock, step 1): the rules, with no database
 * access — payload validation and replaying the owner's decisions into the
 * current state of every card and group. Shared by src/vocab.ts, the export
 * and the smoke test.
 *
 * The cards are astro_vocab_cards (migration 182). The owner's decisions are
 * astro_reviews rows with question_id NULL, replayed oldest first:
 *
 *   vocab-sort   {cardId, verdict: group | not-a-term | skip, groups?: string[] (1–8), preferred?, sameAs?: cardId, note?}
 *                The card's whole current decision; the latest wins. A term
 *                can sit in several groups. "group" needs at least one group,
 *                or sameAs (a synonym joins all of its main card's groups).
 *                Rows written before multi-group sorting carry a single
 *                `group`; they replay as groups: [group].
 *   vocab-group  {from, to}  rename a group, or merge it into another: every
 *                card in `from` at that moment is in `to` instead (and so are
 *                its parent link and its child groups).
 *   vocab-group-parent {group, parent: string | null}  nest a group under
 *                another (Malefics under Planets), or un-nest it with null.
 *                A link that would make a cycle is refused (and skipped on replay).
 *   vocab-undo   {reviewId}  withdraw one earlier vocab-sort, vocab-group,
 *                vocab-example or vocab-add; the replay skips it, so the
 *                card, group or rating goes back to what it was before. An
 *                undone vocab-add withdraws the term (src/vocab.ts deletes
 *                the card when nothing else refers to it).
 *   vocab-example {cardId, example: index, text, book?, rating: good | weak | wrong-sense | clear, note?}
 *                how well one of the card's example sentences shows the term
 *                ("wrong-sense": the word means something else there). Keyed by
 *                card + sentence text (stable across re-imports); the latest
 *                wins and "clear" withdraws it.
 *   vocab-add    {cardId, term, fromCardId?, fromExample?: index, note?}
 *                a term the owner added (from an example sentence, or
 *                suggested); the card itself is inserted into astro_vocab_cards.
 *
 * His groups become concept kinds; preferred labels and "same as" links
 * become the thesaurus.
 *
 * Group names that differ only in case, plural, spacing or punctuation are
 * the same group (groupKey): the studio uses his existing name instead of
 * creating a near-duplicate, and offers to merge near-duplicates already made.
 */

export const VOCAB_ACTIONS = ["vocab-sort", "vocab-group", "vocab-group-parent", "vocab-undo", "vocab-example", "vocab-add"] as const;
export type VocabAction = (typeof VOCAB_ACTIONS)[number];
/** The actions "Undo" can withdraw. */
export const UNDOABLE_VOCAB_ACTIONS = ["vocab-sort", "vocab-group", "vocab-group-parent", "vocab-example", "vocab-add"] as const;
export const VOCAB_VERDICTS = ["group", "not-a-term", "skip"] as const;
export type VocabVerdict = (typeof VOCAB_VERDICTS)[number];
export const VOCAB_GROUP_MAX = 80;
export const VOCAB_GROUPS_PER_CARD = 8;
export const VOCAB_LABEL_MAX = 120;
export const VOCAB_NOTE_MAX = 1000;
export const EXAMPLE_RATINGS = ["good", "weak", "wrong-sense", "clear"] as const;
export type ExampleRating = (typeof EXAMPLE_RATINGS)[number];
export const EXAMPLE_TEXT_MAX = 1500;
export const VOCAB_TERM_MAX = 120;

/** The key a term is stored under: lower case, inner whitespace collapsed, outer punctuation trimmed. */
export function normTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’()[\],.;:!?-]+|[\s"'“”‘’()[\],.;:!?-]+$/g, "")
    .trim();
}

export class VocabError extends Error {}

// ── group names ────────────────────────────────────────────────────────────

/** One word in the singular, roughly: aspects → aspect, triplicities → triplicity, houses → house. */
function singular(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** What makes two group names the same group: case, plural, spacing, punctuation and "&"/"and" ignored. */
export function groupKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(singular)
    .join(" ");
}

/** His existing group with the same key as `name`, if any. */
export function matchGroup(name: string | null | undefined, groups: readonly string[]): string | null {
  if (!name) return null;
  const k = groupKey(name);
  if (!k) return null;
  return groups.find((g) => groupKey(g) === k) ?? null;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Groups that look like the same group: the same key, or keys one letter
 * apart (typos; only for keys of five letters or more, so Sign and Sun stay
 * apart). Clusters of two or more names, the most used name first.
 */
export function similarGroups(groups: readonly { name: string; cards: number }[]): string[][] {
  const parent = groups.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const keys = groups.map((g) => groupKey(g.name));
  for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++)
      if (keys[i] === keys[j] || (keys[i].length >= 5 && keys[j].length >= 5 && editDistanceAtMostOne(keys[i], keys[j]))) parent[find(j)] = find(i);
  const clusters = new Map<number, { name: string; cards: number }[]>();
  groups.forEach((g, i) => clusters.set(find(i), [...(clusters.get(find(i)) ?? []), g]));
  return [...clusters.values()].filter((c) => c.length > 1).map((c) => c.sort((a, b) => b.cards - a.cards || a.name.localeCompare(b.name)).map((g) => g.name));
}

/** Whether nesting `group` under `parent` would make a loop, given the current parent links. */
export function wouldCycle(parents: ReadonlyMap<string, string>, group: string, parent: string): boolean {
  let cur: string | undefined = parent;
  const seen = new Set<string>();
  while (cur !== undefined) {
    if (cur === group) return true;
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = parents.get(cur);
  }
  return false;
}

export function isVocabAction(a: string): a is VocabAction {
  return (VOCAB_ACTIONS as readonly string[]).includes(a);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown, field: string, required = true): string | undefined => {
  if (v === undefined || v === null || v === "") {
    if (required) throw new VocabError(`${field} is required`);
    return undefined;
  }
  if (typeof v !== "string" || !UUID.test(v)) throw new VocabError(`${field} is not a valid id`);
  return v;
};

/** Trimmed, inner whitespace collapsed; undefined when empty. */
export function cleanName(v: unknown, field: string, max: number): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new VocabError(`${field} must be text`);
  const t = v.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  if (t.length > max) throw new VocabError(`${field} is longer than ${max} characters`);
  return t;
}

/** A sort's groups, cleaned: from `groups`, or a legacy single `group`; duplicates (ignoring case) dropped, first spelling kept. */
export function cleanGroups(p: Record<string, unknown>): string[] {
  const raw = p.groups !== undefined && p.groups !== null ? p.groups : p.group !== undefined && p.group !== null ? [p.group] : [];
  if (!Array.isArray(raw)) throw new VocabError("groups must be a list");
  const out: string[] = [];
  for (const g of raw) {
    const name = cleanName(g, "group", VOCAB_GROUP_MAX);
    if (name && !out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  if (out.length > VOCAB_GROUPS_PER_CARD) throw new VocabError(`At most ${VOCAB_GROUPS_PER_CARD} groups per card`);
  return out;
}

/**
 * The reviewer's strength of conviction (0 = no real reason, 5 = a strong
 * feeling of why) and the voice memo of their reasoning, both optional. Added
 * for the phone app (Jerusalem); the web studio simply does not send them.
 */
export function cleanVocabConviction(p: Record<string, unknown>, fail: (msg: string) => never): { conviction?: number; voice?: string } {
  const out: { conviction?: number; voice?: string } = {};
  if (p.conviction !== undefined && p.conviction !== null) {
    if (typeof p.conviction !== "number" || !Number.isInteger(p.conviction) || p.conviction < 0 || p.conviction > 5) fail("conviction must be a whole number from 0 to 5");
    out.conviction = p.conviction as number;
  }
  if (p.voice !== undefined && p.voice !== null && p.voice !== "") {
    if (typeof p.voice !== "string" || !p.voice.startsWith("Private/Jerusalem/") || p.voice.includes("..") || p.voice.length > 300) fail("voice must be an uploaded recording");
    out.voice = p.voice as string;
  }
  return out;
}

/** Shape, vocabulary and length checks; unknown fields dropped. That the cards exist is checked in src/vocab.ts. */
export function cleanVocabPayload(action: VocabAction, p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  switch (action) {
    case "vocab-sort": {
      out.cardId = uuid(p.cardId, "cardId");
      const verdict = p.verdict;
      if (typeof verdict !== "string" || !(VOCAB_VERDICTS as readonly string[]).includes(verdict))
        throw new VocabError(`verdict must be one of ${VOCAB_VERDICTS.join(", ")}`);
      out.verdict = verdict;
      if (verdict === "group") {
        const groups = cleanGroups(p);
        const sameAs = uuid(p.sameAs, "sameAs", false);
        if (!groups.length && !sameAs) throw new VocabError("Choose a group, or the card it is the same as");
        if (sameAs === out.cardId) throw new VocabError("A card can't be the same as itself");
        if (groups.length) out.groups = groups;
        if (sameAs) out.sameAs = sameAs;
        const preferred = cleanName(p.preferred, "preferred", VOCAB_LABEL_MAX);
        if (preferred) out.preferred = preferred;
      }
      break;
    }
    case "vocab-group": {
      const from = cleanName(p.from, "from", VOCAB_GROUP_MAX);
      const to = cleanName(p.to, "to", VOCAB_GROUP_MAX);
      if (!from || !to) throw new VocabError("Both group names are required");
      if (from === to) throw new VocabError("That is the same name");
      out.from = from;
      out.to = to;
      break;
    }
    case "vocab-group-parent": {
      const group = cleanName(p.group, "group", VOCAB_GROUP_MAX);
      if (!group) throw new VocabError("group is required");
      out.group = group;
      const parent = cleanName(p.parent, "parent", VOCAB_GROUP_MAX);
      if (parent && groupKey(parent) === groupKey(group)) throw new VocabError("A group can't be its own parent");
      out.parent = parent ?? null;
      break;
    }
    case "vocab-undo":
      out.reviewId = uuid(p.reviewId, "reviewId");
      break;
    case "vocab-example": {
      out.cardId = uuid(p.cardId, "cardId");
      if (typeof p.example !== "number" || !Number.isInteger(p.example) || p.example < 0 || p.example > 50) throw new VocabError("example must be the sentence's index");
      out.example = p.example;
      if (typeof p.text !== "string" || !p.text.trim()) throw new VocabError("text is required");
      if (p.text.length > EXAMPLE_TEXT_MAX) throw new VocabError("text is too long");
      out.text = p.text;
      const book = cleanName(p.book, "book", 300);
      if (book) out.book = book;
      if (typeof p.rating !== "string" || !(EXAMPLE_RATINGS as readonly string[]).includes(p.rating))
        throw new VocabError(`rating must be one of ${EXAMPLE_RATINGS.join(", ")}`);
      out.rating = p.rating;
      if (p.rating === "clear" && cleanName(p.note, "note", VOCAB_NOTE_MAX)) throw new VocabError("A cleared rating has no note");
      break;
    }
    case "vocab-add": {
      out.cardId = uuid(p.cardId, "cardId");
      const term = cleanName(p.term, "term", VOCAB_TERM_MAX);
      if (!term || !normTerm(term)) throw new VocabError("Type the term");
      out.term = term;
      const from = uuid(p.fromCardId, "fromCardId", false);
      if (from) out.fromCardId = from;
      if (p.fromExample !== undefined && p.fromExample !== null) {
        if (!from) throw new VocabError("fromExample needs fromCardId");
        if (typeof p.fromExample !== "number" || !Number.isInteger(p.fromExample) || p.fromExample < 0) throw new VocabError("fromExample must be the sentence's index");
        out.fromExample = p.fromExample;
      }
      break;
    }
    default:
      throw new VocabError("Unknown action");
  }
  const note = cleanName(p.note, "note", VOCAB_NOTE_MAX);
  if (note) out.note = note;
  Object.assign(out, cleanVocabConviction(p, (m) => { throw new VocabError(m); }));
  return out;
}

// ── replay ─────────────────────────────────────────────────────────────────

export interface VocabReviewRow {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface VocabDecision {
  reviewId: string;
  verdict: VocabVerdict;
  /** Every group the card is in, after renames and merges; a synonym also has all of its main card's. */
  groups: string[];
  /** The first of `groups` (single-group view, kept for compatibility). */
  group: string | null;
  /** The groups recorded on the card itself. */
  ownGroups: string[];
  preferred: string | null;
  sameAs: string | null;
  /** The end of the sameAs chain (the card itself when it is not a synonym). */
  mainId: string;
  note: string | null;
  createdAt: string;
}

export interface ExampleRatingEntry {
  example: number;
  text: string;
  book: string | null;
  rating: Exclude<ExampleRating, "clear">;
  note: string | null;
  createdAt: string;
}

export interface VocabState {
  /** Latest standing decision per card id. */
  decisions: Map<string, VocabDecision>;
  /** Standing example ratings: card id → sentence text → rating. */
  examples: Map<string, Map<string, ExampleRatingEntry>>;
  /** Terms the owner added (and has not withdrawn), oldest first. */
  added: { cardId: string; term: string; fromCardId: string | null; fromExample: number | null; note: string | null; createdAt: string }[];
  /** Cards whose vocab-add was undone: out of the queue, the groups and the thesaurus. */
  withdrawn: Set<string>;
  /** Groups with their card counts (a card in two groups counts in both; synonyms included), most used first. A group used only as a parent has 0. */
  groups: { name: string; cards: number }[];
  /** Group nesting: child group → parent group. */
  parents: Map<string, string>;
  /** Undoable actions still standing, newest first: what "Undo" withdraws. */
  history: VocabReviewRow[];
  /** history[0]. */
  last: VocabReviewRow | null;
}

const groupsOf = (p: Record<string, unknown>): string[] => {
  const raw = Array.isArray(p.groups) ? p.groups : typeof p.group === "string" ? [p.group] : [];
  return [...new Set(raw.filter((g): g is string => typeof g === "string" && g.trim() !== ""))];
};

/** Replay the owner's vocabulary reviews, oldest first, into the current state. */
export function replayVocab(reviews: VocabReviewRow[]): VocabState {
  const ordered = [...reviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const undone = new Set(ordered.filter((r) => r.action === "vocab-undo" && typeof r.payload.reviewId === "string").map((r) => r.payload.reviewId as string));
  const live = ordered.filter((r) => r.action !== "vocab-undo" && !undone.has(r.id));
  const withdrawn = new Set(
    ordered.filter((r) => r.action === "vocab-add" && undone.has(r.id) && typeof r.payload.cardId === "string").map((r) => r.payload.cardId as string),
  );

  const own = new Map<string, Omit<VocabDecision, "groups" | "group" | "mainId">>();
  const parents = new Map<string, string>();
  const examples = new Map<string, Map<string, ExampleRatingEntry>>();
  const added: VocabState["added"] = [];
  for (const r of live) {
    const p = r.payload;
    if (r.action === "vocab-group") {
      const from = p.from as string;
      const to = p.to as string;
      for (const d of own.values()) if (d.ownGroups.includes(from)) d.ownGroups = [...new Set(d.ownGroups.map((g) => (g === from ? to : g)))];
      // The renamed group keeps its place in the tree: its own parent link, and its children's.
      const up = parents.get(from);
      parents.delete(from);
      if (up !== undefined && up !== to && !parents.has(to) && !wouldCycle(parents, to, up)) parents.set(to, up);
      for (const [child, par] of [...parents]) if (par === from) {
        if (child === to || wouldCycle(parents, child, to)) parents.delete(child);
        else parents.set(child, to);
      }
    } else if (r.action === "vocab-group-parent") {
      const group = p.group as string;
      const parent = typeof p.parent === "string" ? p.parent : null;
      if (!parent) parents.delete(group);
      else if (!wouldCycle(parents, group, parent)) parents.set(group, parent);
    } else if (r.action === "vocab-sort") {
      if (typeof p.cardId !== "string" || typeof p.verdict !== "string" || withdrawn.has(p.cardId)) continue;
      own.set(p.cardId, {
        reviewId: r.id,
        verdict: p.verdict as VocabVerdict,
        ownGroups: p.verdict === "group" ? groupsOf(p) : [],
        preferred: p.verdict === "group" && typeof p.preferred === "string" ? p.preferred : null,
        sameAs: p.verdict === "group" && typeof p.sameAs === "string" ? p.sameAs : null,
        note: typeof p.note === "string" ? p.note : null,
        createdAt: r.createdAt,
      });
    } else if (r.action === "vocab-example" && typeof p.cardId === "string" && typeof p.text === "string") {
      const m = examples.get(p.cardId) ?? new Map<string, ExampleRatingEntry>();
      if (p.rating === "clear") m.delete(p.text);
      else if (p.rating === "good" || p.rating === "weak" || p.rating === "wrong-sense")
        m.set(p.text, {
          example: typeof p.example === "number" ? p.example : 0,
          text: p.text,
          book: typeof p.book === "string" ? p.book : null,
          rating: p.rating,
          note: typeof p.note === "string" ? p.note : null,
          createdAt: r.createdAt,
        });
      if (m.size) examples.set(p.cardId, m);
      else examples.delete(p.cardId);
    } else if (r.action === "vocab-add" && typeof p.cardId === "string" && typeof p.term === "string") {
      added.push({
        cardId: p.cardId,
        term: p.term,
        fromCardId: typeof p.fromCardId === "string" ? p.fromCardId : null,
        fromExample: typeof p.fromExample === "number" ? p.fromExample : null,
        note: typeof p.note === "string" ? p.note : null,
        createdAt: r.createdAt,
      });
    }
  }

  // Follow sameAs to the main card (a broken or cyclic chain stops where it would repeat).
  const mainOf = (id: string): string => {
    const seen = new Set<string>([id]);
    let cur = id;
    for (;;) {
      const next = own.get(cur)?.sameAs;
      if (!next || seen.has(next) || own.get(next)?.verdict !== "group") return cur;
      seen.add(next);
      cur = next;
    }
  };
  const decisions = new Map<string, VocabDecision>();
  for (const [id, d] of own) {
    const mainId = d.sameAs ? mainOf(id) : id;
    const groups = d.verdict === "group" ? [...new Set([...(mainId !== id ? (own.get(mainId)?.ownGroups ?? []) : []), ...d.ownGroups])] : [];
    decisions.set(id, { ...d, groups, group: groups[0] ?? null, mainId });
  }
  const counts = new Map<string, number>();
  for (const d of decisions.values()) for (const g of d.groups) counts.set(g, (counts.get(g) ?? 0) + 1);
  for (const [child, par] of parents) for (const g of [child, par]) if (!counts.has(g)) counts.set(g, 0);
  const groups = [...counts].map(([name, cards]) => ({ name, cards })).sort((a, b) => b.cards - a.cards || a.name.localeCompare(b.name));
  const history = live.filter((r) => (UNDOABLE_VOCAB_ACTIONS as readonly string[]).includes(r.action)).reverse();
  return { decisions, groups, parents, examples, added, withdrawn, history, last: history[0] ?? null };
}

/** Group names a group-level action may name: the groups that currently hold cards. */
export const groupNames = (state: VocabState): Set<string> => new Set(state.groups.map((g) => g.name));
