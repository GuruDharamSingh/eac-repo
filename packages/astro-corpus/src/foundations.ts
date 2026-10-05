/**
 * "Foundations" (/hub/studio/foundations): lessons, the items of a concept
 * with the owner's decisions on them, the rulebook entry, and recording
 * decisions. The rules and the replay are in src/foundations-rules.ts; the
 * items are astro_foundation_items (migration 183,
 * scripts/import-foundations.ts).
 */

import { db } from "@elkdonis/db";
import { ORG_ID } from "./sources";
import {
  buildConceptEntry,
  cleanFoundationPayload,
  buildCorrTable,
  buildSubjectView,
  buildTermEntry,
  cleanLine,
  CORR_SUBJECT_TYPES,
  conceptKey,
  normFacet,
  FOUNDATION_ACTIONS,
  FOUNDATION_MEANING_MAX,
  FoundationError,
  headOf,
  itemStands,
  normFoundationText,
  readFoundationSource,
  replayFoundations,
  UNDOABLE_FOUNDATION_ACTIONS,
  verdictFits,
  type ConceptEntry,
  type CatalogueTerm,
  type CellView,
  type CorrCell,
  type CorrTable,
  type SubjectView,
  type FoundationAction,
  type FoundationFacet,
  type TermEntry,
  type FoundationConceptMeta,
  type FoundationItem,
  type FoundationKind,
  type FoundationSource,
  type FoundationState,
} from "./foundations-rules";

export * from "./foundations-rules";

/** Whether migration 183 has been applied (the studio pages show a notice until it is). */
export async function foundationsReady(): Promise<boolean> {
  const [row] = await db<{ ok: boolean }[]>`SELECT to_regclass('astro_foundation_items') IS NOT NULL AS ok`;
  return Boolean(row?.ok);
}

interface ItemRow {
  id: string;
  lesson: string;
  concept: string;
  kind: string;
  item_key: string;
  text: string;
  payload: unknown;
  books: number;
  uses: number;
  origin: string;
  stale: boolean;
}

const objs = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

function toItem(r: ItemRow): FoundationItem {
  const p = (r.payload && typeof r.payload === "object" ? r.payload : {}) as Record<string, unknown>;
  return {
    id: r.id,
    lesson: r.lesson,
    concept: r.concept,
    kind: r.kind as FoundationKind,
    key: r.item_key,
    text: r.text,
    meaning: str(p.meaning),
    role: str(p.role),
    mode: str(p.mode),
    facet: normFacet(p.facet) ?? "itself",
    degree: str(p.degree),
    books: r.books,
    uses: r.uses,
    sources: objs(p.sources).flatMap((s) => readFoundationSource(s) ?? []),
    origin: r.origin === "owner" ? "owner" : "books",
    stale: r.stale,
  };
}

const itemColumns = () => db`id, lesson, concept, kind, item_key, text, payload, books, uses, origin, stale`;
/** The same row without its sources: enough for counting. */
const lightColumns = () => db`id, lesson, concept, kind, item_key, text, payload - 'sources' AS payload, books, uses, origin, stale`;

/** Every item of a lesson (or of every lesson), with or without its source quotes. */
export async function foundationItems(opts: { lesson?: string; concept?: string; light?: boolean } = {}): Promise<FoundationItem[]> {
  const rows = await db<ItemRow[]>`
    SELECT ${opts.light ? lightColumns() : itemColumns()} FROM astro_foundation_items
    WHERE org_id = ${ORG_ID}
      ${opts.lesson ? db`AND lesson = ${opts.lesson}` : db``}
      ${opts.concept ? db`AND concept = ${opts.concept}` : db``}
    ORDER BY books DESC, uses DESC, text
  `;
  return rows.map(toItem);
}

export interface FoundationLesson {
  lesson: string;
  title: string;
  version: string | null;
  shelf: { doc: string | null; book: string; mentions: number }[];
  concepts: FoundationConceptMeta[];
}

function toLesson(r: { lesson: string; title: string; version: string | null; shelf: unknown; concepts: unknown }): FoundationLesson {
  return {
    lesson: r.lesson,
    title: r.title,
    version: r.version,
    shelf: objs(r.shelf).flatMap((s) => (str(s.book) ? [{ doc: str(s.doc), book: s.book as string, mentions: Number(s.mentions) || 0 }] : [])),
    concepts: objs(r.concepts).flatMap((c) => {
      const st = (c.stats && typeof c.stats === "object" ? c.stats : {}) as Record<string, unknown>;
      const counts = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, number>) : {});
      return str(c.id)
        ? [
            {
              id: c.id as string,
              label: str(c.label) ?? (c.id as string),
              stats: {
                mentions: Number(st.mentions) || 0,
                books: Number(st.books) || 0,
                byRole: counts(st.byRole),
                byMode: counts(st.byMode),
                notElement: Number(st.notElement) || 0,
              },
            },
          ]
        : [];
    }),
  };
}

export async function getFoundationLesson(lesson: string): Promise<FoundationLesson | null> {
  const [row] = await db<{ lesson: string; title: string; version: string | null; shelf: unknown; concepts: unknown }[]>`
    SELECT lesson, title, version, shelf, concepts FROM astro_foundation_lessons WHERE org_id = ${ORG_ID} AND lesson = ${lesson}`;
  return row ? toLesson(row) : null;
}

/** The reviewer's foundation reviews, replayed. */
export async function foundationState(reviewerId: string): Promise<FoundationState> {
  const rows = await db<{ id: string; action: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, action, payload, created_at FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND reviewer_id = ${reviewerId} AND question_id IS NULL AND action = ANY (${[...FOUNDATION_ACTIONS]})
  `;
  return replayFoundations(rows.map((r) => ({ id: r.id, action: r.action, payload: r.payload, createdAt: r.created_at.toISOString() })));
}

export interface FoundationConceptProgress {
  id: string;
  label: string;
  total: number;
  reviewed: number;
  defined: boolean;
  confirmed: number;
}

export interface FoundationLessonSummary extends FoundationLesson {
  progress: FoundationConceptProgress[];
  total: number;
  reviewed: number;
}

function progressOf(lesson: FoundationLesson, items: FoundationItem[], state: FoundationState): FoundationConceptProgress[] {
  return lesson.concepts.map((c) => {
    const e = buildConceptEntry(lesson.lesson, c.id, items, state);
    return {
      id: c.id,
      label: c.label,
      total: e.progress.total,
      reviewed: e.progress.reviewed,
      defined: Boolean(e.definition),
      confirmed: e.traits.core.length + e.traits.fits.length + e.images.apt.length + e.passages.good.length + e.figurative.counts.length,
    };
  });
}

/** Every lesson with how far the reviewer is, oldest lesson first. */
export async function listFoundationLessons(reviewerId: string): Promise<FoundationLessonSummary[]> {
  const rows = await db<{ lesson: string; title: string; version: string | null; shelf: unknown; concepts: unknown }[]>`
    SELECT lesson, title, version, shelf, concepts FROM astro_foundation_lessons WHERE org_id = ${ORG_ID} ORDER BY created_at, lesson`;
  if (!rows.length) return [];
  const [state, items] = await Promise.all([foundationState(reviewerId), foundationItems({ light: true })]);
  return rows.map((r) => {
    const lesson = toLesson(r);
    const progress = progressOf(lesson, items, state);
    return { ...lesson, progress, total: progress.reduce((n, p) => n + p.total, 0), reviewed: progress.reduce((n, p) => n + p.reviewed, 0) };
  });
}

/** One item as the review page shows it: the sheet's reading plus the owner's standing decision. */
export interface FoundationViewItem {
  id: string;
  kind: FoundationKind;
  text: string;
  /** The model's reading. */
  meaning: string | null;
  role: string | null;
  mode: string | null;
  /** itself | dominant ("when a chart has a lot of it") | lacking ("when a chart has little or none of it"). */
  facet: FoundationFacet;
  /** "extreme": too much of it, not just a lot. */
  degree: string | null;
  books: number;
  uses: number;
  /** Traits: empty (the quotes are loaded when the row is opened, foundationItemSources). Images and passages: the first source. */
  sources: FoundationSource[];
  sourceCount: number;
  yours: boolean;
  /** A later sheet no longer has it. */
  stale: boolean;
  verdict: string | null;
  note: string | null;
  /** Image: his wording of the meaning. */
  hisMeaning: string | null;
  /** Trait: the trait it is listed under (the end of the "same as" chain). */
  mergedInto: string | null;
  /** Passage: his corrections. */
  hisRole: string | null;
  hisMode: string | null;
}

export interface FoundationLessonView {
  lesson: FoundationLesson;
  progress: FoundationConceptProgress[];
  concept: FoundationConceptMeta;
  definition: string | null;
  items: FoundationViewItem[];
  entry: ConceptEntry;
  /** "What each book gives": everything the correspondence table has for this concept (the element fire, …), if anything. */
  correspondences: SubjectView | null;
  history: { reviewId: string; label: string }[];
}

/** The review page of one concept (the first when `conceptId` is not one of the lesson's). Null when there is no such lesson. */
export async function foundationLessonView(reviewerId: string, lessonId: string, conceptId?: string | null): Promise<FoundationLessonView | null> {
  const lesson = await getFoundationLesson(lessonId);
  if (!lesson || !lesson.concepts.length) return null;
  const concept = lesson.concepts.find((c) => c.id === conceptId) ?? lesson.concepts[0];
  const [state, light, full] = await Promise.all([
    foundationState(reviewerId),
    foundationItems({ lesson: lessonId, light: true }),
    foundationItems({ lesson: lessonId, concept: concept.id }),
  ]);
  const standing = full.filter((it) => itemStands(it, state));
  const ids = new Set(standing.map((it) => it.id));
  const items = standing.map((it): FoundationViewItem => {
    const v = state.verdicts.get(it.id);
    const c = state.corrections.get(it.id);
    const head = it.kind === "trait" ? headOf(state, it.id) : it.id;
    return {
      id: it.id,
      kind: it.kind,
      text: it.text,
      meaning: it.meaning,
      role: it.role,
      mode: it.mode,
      facet: it.facet,
      degree: it.degree ?? null,
      books: it.books,
      uses: it.uses,
      sources: it.kind === "trait" ? [] : it.sources.slice(0, 1),
      sourceCount: it.sources.length,
      yours: it.origin === "owner",
      stale: it.stale,
      verdict: v?.verdict ?? null,
      note: v?.note ?? null,
      hisMeaning: it.kind === "image" && it.origin !== "owner" ? (v?.meaning ?? null) : null,
      mergedInto: head !== it.id && ids.has(head) ? head : null,
      hisRole: c?.role && c.role !== it.role ? c.role : null,
      hisMode: c?.mode && c.mode !== it.mode ? c.mode : null,
    };
  });
  return {
    lesson,
    progress: progressOf(lesson, light, state),
    concept,
    definition: state.definitions.get(conceptKey(lessonId, concept.id))?.text ?? null,
    items,
    entry: buildConceptEntry(lessonId, concept.id, full, state),
    correspondences: await conceptCorrespondences(state, lessonId, concept.id),
    history: await describeFoundationHistory(state, 5, lessonId),
  };
}

/** The source quotes of a few items (loaded when a row is opened). */
export async function foundationItemSources(ids: string[]): Promise<Record<string, FoundationSource[]>> {
  if (!ids.length) return {};
  const rows = await db<{ id: string; sources: unknown }[]>`
    SELECT id, payload->'sources' AS sources FROM astro_foundation_items WHERE id = ANY (${ids.slice(0, 50)}::uuid[]) AND org_id = ${ORG_ID}`;
  return Object.fromEntries(rows.map((r) => [r.id, objs(r.sources).flatMap((s) => readFoundationSource(s) ?? [])]));
}

/** What is confirmed so far for every concept of a lesson. */
export async function foundationRulebook(reviewerId: string, lessonId: string): Promise<{ lesson: FoundationLesson; entries: { concept: FoundationConceptMeta; entry: ConceptEntry }[] } | null> {
  const lesson = await getFoundationLesson(lessonId);
  if (!lesson) return null;
  const [state, items] = await Promise.all([foundationState(reviewerId), foundationItems({ lesson: lessonId })]);
  return { lesson, entries: lesson.concepts.map((concept) => ({ concept, entry: buildConceptEntry(lessonId, concept.id, items, state) })) };
}

const VERDICT_WORDS: Record<string, string> = {
  core: "Core",
  fits: "Fits",
  not: "Not the element",
  apt: "Apt",
  "not-apt": "Not apt",
  good: "Good teaching",
  counts: "Counts as the element",
  figure: "Just a figure of speech",
  fine: "Fine",
  misread: "Misread",
  keep: "kept",
  clear: "mark removed",
};
const TERM_VERDICT_WORDS: Record<string, string> = { right: "Right", fix: "Needs fixing", "not-basic": "Not a basic term", clear: "mark removed" };
const CATEGORY_WORDS: Record<string, string> = { useful: "useful for readings", lore: "lore only", drop: "dropped", clear: "ruling removed" };
/** describeFoundationHistory's `lesson` for the correspondence table's actions. */
export const TABLE_SCOPE = "#table";
/** describeFoundationHistory's `lesson` for the term catalogue's actions. */
export const TERMS_SCOPE = "#terms";
const short = (s: string, n = 48) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The last few undoable actions in words, newest first (only those of `lesson` when given). */
export async function describeFoundationHistory(state: FoundationState, n = 5, lesson?: string): Promise<{ reviewId: string; label: string; createdAt: string }[]> {
  const ids = [...new Set(state.history.flatMap((r) => [r.payload.itemId, r.payload.intoItemId].filter((x): x is string => typeof x === "string")))];
  const rows = ids.length
    ? await db<{ id: string; lesson: string; text: string }[]>`SELECT id, lesson, text FROM astro_foundation_items WHERE id = ANY (${ids}::uuid[]) AND org_id = ${ORG_ID}`
    : [];
  const item = new Map(rows.map((r) => [r.id, r]));
  const textOf = (v: unknown) => `“${short(typeof v === "string" ? (item.get(v)?.text ?? "an item") : "an item")}”`;
  const termIds = [...new Set(state.history.flatMap((r) => (typeof r.payload.termId === "string" ? [r.payload.termId] : [])))];
  const termRows = termIds.length
    ? await db<{ id: string; term: string }[]>`SELECT id, term FROM astro_foundation_terms WHERE id = ANY (${termIds}::uuid[]) AND org_id = ${ORG_ID}`
    : [];
  const terms = new Map(termRows.map((r) => [r.id, r.term]));
  const termOf = (v: unknown) => `“${short(typeof v === "string" ? (terms.get(v) ?? "a term") : "a term")}”`;
  const cellIds = [...new Set(state.history.flatMap((r) => (typeof r.payload.cellId === "string" ? [r.payload.cellId] : [])))];
  const cellRows =
    cellIds.length && (await correspondencesReady())
      ? await db<{ id: string; subject: string; category: string; value: string }[]>`
          SELECT id, subject, category, value FROM astro_correspondences WHERE id = ANY (${cellIds}::uuid[]) AND org_id = ${ORG_ID}`
      : [];
  const cellText = new Map(cellRows.map((r) => [r.id, `${r.subject} · ${r.category}: “${short(r.value, 30)}”`]));
  const cellOf = (v: unknown) => (typeof v === "string" ? (cellText.get(v) ?? "a value") : "a value");
  const out: { reviewId: string; label: string; createdAt: string }[] = [];
  for (const r of state.history) {
    const p = r.payload;
    const inLesson = typeof p.cellId === "string" || r.action.startsWith("foundation-category") ? TABLE_SCOPE : typeof p.termId === "string" ? TERMS_SCOPE : typeof p.lesson === "string" ? p.lesson : typeof p.itemId === "string" ? item.get(p.itemId)?.lesson : undefined;
    if (lesson && inLesson !== lesson) continue;
    let label: string;
    if (r.action === "foundation-define") label = p.text ? `your definition of ${String(p.concept)}` : `your definition of ${String(p.concept)} removed`;
    else if (r.action === "foundation-verdict") label = `${textOf(p.itemId)}: ${VERDICT_WORDS[String(p.verdict)] ?? String(p.verdict)}`;
    else if (r.action === "foundation-merge") label = p.intoItemId ? `${textOf(p.itemId)} same as ${textOf(p.intoItemId)}` : `${textOf(p.itemId)} on its own again`;
    else if (r.action === "foundation-correct")
      label = `${textOf(p.itemId)}: ${[p.mode ? `reading → ${String(p.mode)}` : null, p.role ? `what it does → ${String(p.role).replace(/_/g, " ")}` : null].filter(Boolean).join(", ")}`;
    else if (r.action === "foundation-cell-verdict")
      label =
        p.verdict === "fixed"
          ? `${cellOf(p.cellId)} changed to “${short(String(p.value))}”`
          : `${cellOf(p.cellId)}: ${p.verdict === "clear" ? "mark removed" : p.verdict === "right" ? "kept" : "wrong"}${p.scheme ? ` (${String(p.scheme)})` : ""}`;
    else if (r.action === "foundation-cell-add") label = `${String(p.subject)} · ${String(p.category)}: added “${short(String(p.value))}”`;
    else if (r.action === "foundation-category") label = `${String(p.category)}: ${CATEGORY_WORDS[String(p.ruling)] ?? String(p.ruling)}`;
    else if (r.action === "foundation-category-add") label = `added the row “${String(p.category)}”`;
    else if (r.action === "foundation-term-verdict") label = `${termOf(p.termId)}: ${TERM_VERDICT_WORDS[String(p.verdict)] ?? String(p.verdict)}`;
    else if (r.action === "foundation-term-keyword") label = `${termOf(p.termId)}: keyword “${String(p.keyword)}” ${p.keep ? "kept" : "dropped"}`;
    else if (r.action === "foundation-term-add-keyword") label = `${termOf(p.termId)}: added keyword “${String(p.keyword)}”`;
    else if (r.action === "foundation-term-note") label = `${termOf(p.termId)}: note ${p.note ? "saved" : "removed"}`;
    else label = `added “${short(String(p.text))}”`;
    out.push({ reviewId: r.id, label, createdAt: r.createdAt });
    if (out.length >= n) break;
  }
  return out;
}

async function conceptExists(lesson: string, concept: string): Promise<boolean> {
  const l = await getFoundationLesson(lesson);
  return Boolean(l?.concepts.some((c) => c.id === concept));
}

/** Check a foundation review against the items and the reviewer's state, then store it. */
export async function recordFoundationReview(r: {
  reviewerId: string;
  action: FoundationAction;
  payload: Record<string, unknown>;
  seconds: number | null;
  device: string | null;
}): Promise<{ reviewId: string }> {
  if (r.action === "foundation-add") throw new FoundationError("Add items with addFoundationItem");
  if (r.action === "foundation-cell-add") throw new FoundationError("Add values with addCorrespondenceCell");
  const payload = cleanFoundationPayload(r.action, r.payload);
  const itemsById = async (ids: string[]) =>
    db<{ id: string; lesson: string; concept: string; kind: string; origin: string }[]>`
      SELECT id, lesson, concept, kind, origin FROM astro_foundation_items WHERE id = ANY (${ids}::uuid[]) AND org_id = ${ORG_ID}`;
  if (r.action === "foundation-define") {
    if (!(await conceptExists(payload.lesson as string, payload.concept as string))) throw new FoundationError("No such lesson or idea");
  } else if (r.action === "foundation-verdict") {
    const [item] = await itemsById([payload.itemId as string]);
    if (!item) throw new FoundationError("Item not found");
    if (!verdictFits(item.kind, payload.verdict as string)) throw new FoundationError("That mark does not go with this kind of item");
    if (item.kind !== "image") delete payload.meaning;
  } else if (r.action === "foundation-merge") {
    const ids = [payload.itemId, payload.intoItemId].filter((x): x is string => typeof x === "string");
    const found = await itemsById(ids);
    if (found.length !== ids.length) throw new FoundationError("Item not found");
    if (found.some((i) => i.kind !== "trait")) throw new FoundationError("Only qualities can be marked the same");
    if (found.length === 2 && (found[0].lesson !== found[1].lesson || found[0].concept !== found[1].concept)) throw new FoundationError("Both qualities must belong to the same idea");
    const state = await foundationState(r.reviewerId);
    if (payload.intoItemId === null) {
      if (!state.merges.has(payload.itemId as string)) throw new FoundationError("That quality is already on its own");
    } else if (headOf(state, payload.intoItemId as string) === payload.itemId) throw new FoundationError("That one is already listed under this quality");
  } else if (r.action === "foundation-cell-verdict") {
    const [cell] = await db<{ id: string }[]>`SELECT id FROM astro_correspondences WHERE id = ${payload.cellId as string} AND org_id = ${ORG_ID}`;
    if (!cell) throw new FoundationError("That value is no longer in the table");
  } else if (r.action === "foundation-category" || r.action === "foundation-category-add") {
    const [row] = await db<{ category: string }[]>`
      SELECT category FROM astro_correspondences WHERE org_id = ${ORG_ID} AND lower(category) = ${(payload.category as string).toLowerCase()}
        ${r.action === "foundation-category-add" ? db`AND subject_type = ${payload.subjectType as string}` : db``}
      LIMIT 1`;
    const state = await foundationState(r.reviewerId);
    const added = state.addedCategories.find((a) => a.category.toLowerCase() === (payload.category as string).toLowerCase() && (r.action === "foundation-category" || a.subjectType === payload.subjectType));
    if (r.action === "foundation-category") {
      if (!row && !added) throw new FoundationError("No such category");
      payload.category = row?.category ?? added!.category;
    } else if (row || added) throw new FoundationError("That category is already in the table");
  } else if (r.action.startsWith("foundation-term-")) {
    const [term] = await db<{ id: string; payload: unknown }[]>`SELECT id, payload FROM astro_foundation_terms WHERE id = ${payload.termId as string} AND org_id = ${ORG_ID}`;
    if (!term) throw new FoundationError("Term not found");
    if (r.action === "foundation-term-keyword" || r.action === "foundation-term-add-keyword") {
      const p = (term.payload ?? {}) as Record<string, unknown>;
      const theirs = [...(Array.isArray(p.keywords) ? p.keywords : []), ...(Array.isArray(p.secondary) ? p.secondary : [])].filter((k): k is string => typeof k === "string");
      const mine = (await foundationState(r.reviewerId)).terms.get(term.id);
      const known = [...theirs, ...(mine?.added ?? [])].find((k) => k.toLowerCase() === (payload.keyword as string).toLowerCase());
      if (r.action === "foundation-term-keyword") {
        if (!known) throw new FoundationError("That keyword is not on the term");
        payload.keyword = known;
      } else if (known && !mine?.dropped.has(known.toLowerCase())) throw new FoundationError("That keyword is already there");
    }
  } else if (r.action === "foundation-correct") {
    const [item] = await itemsById([payload.itemId as string]);
    if (!item) throw new FoundationError("Item not found");
    if (item.kind !== "passage") throw new FoundationError("Only passages have a reading to correct");
  } else {
    const [prev] = await db<{ id: string; action: string; payload: Record<string, unknown> }[]>`
      SELECT id, action, payload FROM astro_reviews
      WHERE id = ${payload.reviewId as string} AND reviewer_id = ${r.reviewerId} AND org_id = ${ORG_ID}
        AND action = ANY (${[...UNDOABLE_FOUNDATION_ACTIONS]})
    `;
    if (!prev) throw new FoundationError("Nothing to undo");
    const [again] = await db<{ id: string }[]>`
      SELECT id FROM astro_reviews
      WHERE reviewer_id = ${r.reviewerId} AND org_id = ${ORG_ID} AND action = 'foundation-undo' AND payload->>'reviewId' = ${prev.id}
    `;
    if (again) throw new FoundationError("That was already undone");
    if (prev.action === "foundation-add" && typeof prev.payload.itemId === "string") await dropAddedItem(prev.payload.itemId, prev.id);
    if (prev.action === "foundation-cell-add" && typeof prev.payload.cellId === "string") await dropAddedCell(prev.payload.cellId, prev.id);
  }
  const [rev] = await db<{ id: string }[]>`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES (${ORG_ID}, NULL, ${r.reviewerId}, ${r.action}, ${db.json(payload as never)}, ${[]}, ${[]}, NULL, ${r.seconds}, ${r.device})
    RETURNING id
  `;
  return { reviewId: rev.id };
}

/**
 * Undoing an added item: delete its row when nothing else refers to it (no
 * other review names it as item or merge target). Otherwise the row stays and
 * the replay treats it as withdrawn.
 */
async function dropAddedItem(itemId: string, addReviewId: string) {
  const [refs] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND id <> ${addReviewId} AND action LIKE 'foundation-%'
      AND (payload->>'itemId' = ${itemId} OR payload->>'intoItemId' = ${itemId})
  `;
  if ((refs?.n ?? 0) > 0) return;
  await db`DELETE FROM astro_foundation_items WHERE id = ${itemId} AND org_id = ${ORG_ID} AND origin = 'owner'`;
}

export type AddFoundationResult = { ok: true; itemId: string; text: string; reviewId: string } | { ok: false; existing: { id: string; text: string } };

/**
 * Add something of the owner's own to a concept: a trait, an image (with what
 * it means) or a note. A trait or image the concept already has (same words,
 * ignoring case) is not duplicated; the existing item is returned instead.
 * Records a foundation-add review.
 */
export async function addFoundationItem(r: {
  reviewerId: string;
  lesson: string;
  concept: string;
  kind: string;
  text: string;
  meaning?: string | null;
  facet?: string | null;
  note?: string | null;
  seconds?: number | null;
  device?: string | null;
}): Promise<AddFoundationResult> {
  const itemId = crypto.randomUUID();
  const payload = cleanFoundationPayload("foundation-add", { itemId, lesson: r.lesson, concept: r.concept, kind: r.kind, text: r.text, meaning: r.meaning, facet: r.facet, note: r.note });
  const lesson = payload.lesson as string;
  const concept = payload.concept as string;
  const kind = payload.kind as string;
  const text = payload.text as string;
  const facet = (payload.facet as string | undefined) ?? "itself";
  if (!(await conceptExists(lesson, concept))) throw new FoundationError("No such lesson or idea");
  if (kind !== "note") {
    const same = await db<{ id: string; text: string }[]>`
      SELECT id, text FROM astro_foundation_items
      WHERE org_id = ${ORG_ID} AND lesson = ${lesson} AND concept = ${concept} AND kind = ${kind} AND lower(text) = ${normFoundationText(text)}
        AND COALESCE(payload->>'facet', 'itself') = ${facet}
      LIMIT 1`;
    const state = same.length ? await foundationState(r.reviewerId) : null;
    if (same[0] && !state!.withdrawn.has(same[0].id)) return { ok: false, existing: same[0] };
  }
  const meaning = cleanLine(r.meaning, "The meaning", FOUNDATION_MEANING_MAX);
  await db`
    INSERT INTO astro_foundation_items (id, org_id, lesson, concept, kind, item_key, text, payload, books, uses, version, origin)
    VALUES (${itemId}, ${ORG_ID}, ${lesson}, ${concept}, ${kind}, ${`own-${itemId}`}, ${text},
            ${db.json({ ...(kind === "image" && meaning ? { meaning } : {}), ...(facet !== "itself" ? { facet } : {}), sources: [] } as never)}, 0, 0, NULL, 'owner')
  `;
  const [rev] = await db<{ id: string }[]>`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES (${ORG_ID}, NULL, ${r.reviewerId}, 'foundation-add', ${db.json(payload as never)}, ${[]}, ${[]}, NULL, ${r.seconds ?? null}, ${r.device ?? null})
    RETURNING id
  `;
  return { ok: true, itemId, text, reviewId: rev.id };
}

// ── "Basic terms, book by book" (astro_foundation_terms) ───────────────────

interface TermRow {
  id: string;
  book_slug: string;
  term_key: string;
  term: string;
  grp: string;
  payload: unknown;
  stale: boolean;
}

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function toTerm(r: TermRow): CatalogueTerm & { id: string; stale: boolean } {
  const p = (r.payload && typeof r.payload === "object" ? r.payload : {}) as Record<string, unknown>;
  return {
    id: r.id,
    key: r.term_key,
    term: r.term,
    group: r.grp,
    facet: normFacet(p.facet),
    code: str(p.code),
    keywords: strs(p.keywords),
    secondary: strs(p.secondary),
    definition: str(p.definition),
    howToWeigh: str(p.how_to_weigh),
    figure: str(p.figure),
    related: strs(p.related),
    pages: (Array.isArray(p.pages) ? p.pages : []).filter((x): x is number => typeof x === "number"),
    bookPages: (Array.isArray(p.book_pages) ? p.book_pages : []).filter((x): x is number => typeof x === "number"),
    quote: str(p.quote),
    note: str(p.note),
    stale: r.stale,
  };
}

export interface FoundationCatalogueView {
  slug: string;
  book: string;
  author: string | null;
  /** Terms in the file's order; a stale term he never touched is left out. */
  terms: TermEntry[];
  total: number;
  reviewed: number;
  right: number;
}

/** Every book's term catalogue with the reviewer's decisions applied. */
export async function foundationCatalogues(reviewerId: string, state?: FoundationState): Promise<FoundationCatalogueView[]> {
  const s = state ?? (await foundationState(reviewerId));
  const books = await db<{ slug: string; book: string; author: string | null }[]>`
    SELECT slug, book, author FROM astro_foundation_catalogues WHERE org_id = ${ORG_ID} ORDER BY created_at, slug`;
  if (!books.length) return [];
  const rows = await db<TermRow[]>`
    SELECT id, book_slug, term_key, term, grp, payload, stale FROM astro_foundation_terms WHERE org_id = ${ORG_ID} ORDER BY book_slug, position, term`;
  return books.map((b) => {
    const terms = rows
      .filter((r) => r.book_slug === b.slug)
      .map((r) => buildTermEntry(toTerm(r), s))
      .filter((t) => !t.stale || t.verdict || t.note || t.droppedKeywords.length || t.droppedSecondary.length || t.addedKeywords.length);
    return { ...b, terms, total: terms.length, reviewed: terms.filter((t) => t.verdict).length, right: terms.filter((t) => t.verdict === "right").length };
  });
}

// ── the correspondence table (astro_correspondences, migration 184) ────────

/** Which kind of table subject a lesson's concepts are. */
const LESSON_SUBJECT: Record<string, string> = { elements: "element", modes: "modality", planets: "planet", signs: "sign", houses: "house" };

export async function correspondencesReady(): Promise<boolean> {
  const [row] = await db<{ ok: boolean }[]>`SELECT to_regclass('astro_correspondences') IS NOT NULL AS ok`;
  return Boolean(row?.ok);
}

interface CorrDbRow {
  id: string;
  book_slug: string;
  cell_key: string;
  subject_type: string;
  subject: string;
  category: string;
  value: string;
  payload: unknown;
  origin: string;
  stale: boolean;
}

function toCell(r: CorrDbRow): CorrCell {
  const p = (r.payload && typeof r.payload === "object" ? r.payload : {}) as Record<string, unknown>;
  return {
    id: r.id,
    key: r.cell_key,
    bookSlug: r.book_slug,
    subjectType: r.subject_type,
    subject: r.subject,
    category: r.category,
    value: r.value,
    page: typeof p.page === "number" ? p.page : null,
    source: str(p.source),
    derivedFrom: str(p.derived_from),
    scheme: str(p.scheme),
    facet: str(p.facet),
    degree: str(p.degree),
    note: str(p.note),
    tone: str(p.tone),
    label: str(p.label),
    book: str(p.book),
    author: str(p.author),
    origin: r.origin === "owner" ? "owner" : "books",
    stale: r.stale,
  };
}

export async function correspondenceCells(opts: { subjectType?: string; subject?: string } = {}): Promise<CorrCell[]> {
  if (!(await correspondencesReady())) return [];
  const rows = await db<CorrDbRow[]>`
    SELECT id, book_slug, cell_key, subject_type, subject, category, value, payload, origin, stale FROM astro_correspondences
    WHERE org_id = ${ORG_ID}
      ${opts.subjectType ? db`AND subject_type = ${opts.subjectType}` : db``}
      ${opts.subject ? db`AND subject = ${opts.subject}` : db``}
    ORDER BY (origin = 'owner'), book_slug, position, created_at
  `;
  return rows.map(toCell);
}

export interface CorrespondenceView {
  /** The subject types that have rows, with how many cells and how many he judged. */
  types: { type: string; total: number; judged: number }[];
  table: CorrTable;
  history: { reviewId: string; label: string }[];
}

/** The correspondence table of one subject type (the first that has rows when `subjectType` has none). */
export async function correspondenceView(reviewerId: string, subjectType?: string | null): Promise<CorrespondenceView | null> {
  const [state, cells] = await Promise.all([foundationState(reviewerId), correspondenceCells()]);
  const types = [...new Set(cells.map((c) => c.subjectType))];
  const order: readonly string[] = CORR_SUBJECT_TYPES;
  const rank = (t: string) => (order.includes(t) ? order.indexOf(t) : order.length);
  types.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  if (!types.length) return null;
  const type = types.includes(subjectType ?? "") ? (subjectType as string) : types[0];
  const tables = types.map((t) => buildCorrTable(cells, state, t));
  return {
    types: tables.map((t) => ({ type: t.subjectType, total: t.total, judged: t.judged })),
    table: tables.find((t) => t.subjectType === type)!,
    history: await describeFoundationHistory(state, 5, TABLE_SCOPE),
  };
}

async function conceptCorrespondences(state: FoundationState, lesson: string, concept: string): Promise<SubjectView | null> {
  const subjectType = LESSON_SUBJECT[lesson];
  if (!subjectType) return null;
  const cells = await correspondenceCells({ subjectType, subject: concept });
  const view = buildSubjectView(cells, state, subjectType, concept);
  return view.total ? view : null;
}

/** Everything every book gives for one subject (the subject page). Null when the table has nothing for it. */
export async function subjectView(reviewerId: string, subjectType: string, subject: string): Promise<{ view: SubjectView; history: { reviewId: string; label: string }[] } | null> {
  const [state, cells] = await Promise.all([foundationState(reviewerId), correspondenceCells({ subjectType, subject })]);
  const view = buildSubjectView(cells, state, subjectType, subject);
  if (!view.total) return null;
  return { view, history: await describeFoundationHistory(state, 5, TABLE_SCOPE) };
}

async function dropAddedCell(cellId: string, addReviewId: string) {
  const [refs] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND id <> ${addReviewId} AND action LIKE 'foundation-%' AND payload->>'cellId' = ${cellId}
  `;
  if ((refs?.n ?? 0) > 0) return;
  await db`DELETE FROM astro_correspondences WHERE id = ${cellId} AND org_id = ${ORG_ID} AND origin = 'owner'`;
}

/** Add a value of the owner's own to a cell of the table (a second value next to the books', or the first in an empty cell). Records a foundation-cell-add review. */
export async function addCorrespondenceCell(r: {
  reviewerId: string;
  subjectType: string;
  subject: string;
  category: string;
  value: string;
  scheme?: string | null;
  facet?: string | null;
  note?: string | null;
  device?: string | null;
}): Promise<{ ok: true; cellId: string; value: string; reviewId: string } | { ok: false; existing: string }> {
  const cellId = crypto.randomUUID();
  const payload = cleanFoundationPayload("foundation-cell-add", { cellId, subjectType: r.subjectType, subject: r.subject, category: r.category, value: r.value, scheme: r.scheme, facet: r.facet, note: r.note });
  const state = await foundationState(r.reviewerId);
  const same = await db<{ id: string; value: string; category: string }[]>`
    SELECT id, value, category FROM astro_correspondences
    WHERE org_id = ${ORG_ID} AND subject_type = ${payload.subjectType as string} AND subject = ${payload.subject as string} AND lower(category) = ${(payload.category as string).toLowerCase()}`;
  const dup = same.find((c) => c.value.toLowerCase() === (payload.value as string).toLowerCase() && !state.withdrawn.has(c.id));
  if (dup) return { ok: false, existing: dup.value };
  const [known] = await db<{ category: string }[]>`SELECT category FROM astro_correspondences WHERE org_id = ${ORG_ID} AND lower(category) = ${(payload.category as string).toLowerCase()} LIMIT 1`;
  const category = known?.category ?? state.addedCategories.find((a) => a.category.toLowerCase() === (payload.category as string).toLowerCase())?.category;
  if (!category) throw new FoundationError("No such category: add the row first");
  payload.category = category;
  await db`
    INSERT INTO astro_correspondences (id, org_id, book_slug, cell_key, subject_type, subject, category, value, payload, position, origin)
    VALUES (${cellId}, ${ORG_ID}, 'owner', ${`own-${cellId}`}, ${payload.subjectType as string}, ${payload.subject as string}, ${category}, ${payload.value as string}, ${db.json({ scheme: payload.scheme ?? null, facet: payload.facet ?? null } as never)}, 0, 'owner')
  `;
  const [rev] = await db<{ id: string }[]>`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES (${ORG_ID}, NULL, ${r.reviewerId}, 'foundation-cell-add', ${db.json(payload as never)}, ${[]}, ${[]}, NULL, NULL, ${r.device ?? null})
    RETURNING id
  `;
  return { ok: true, cellId, value: payload.value as string, reviewId: rev.id };
}
