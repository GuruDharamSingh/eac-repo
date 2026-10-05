/**
 * The Library (/hub/studio/library): a read-only view of what has been
 * accumulated per subject ("silo") and where it came from. Keywords and
 * reference passages come from the Foundations lessons (astro_foundation_items),
 * correspondences from astro_correspondences, placement sections, glossary
 * terms and people from astro_library_entries (migration 185), and — for
 * placements — the statements of the earlier digest pass
 * (astro_statement_factors). Nothing is hidden: single-book items simply come
 * later in the same list.
 */

import { db } from "@elkdonis/db";
import { ORG_ID } from "./sources";
import { correspondenceCells, foundationItems, foundationsReady } from "./foundations";
import { KEYWORD_CATEGORY_RE, LESSON_OF_SUBJECT, termPagesText, type CorrCell } from "./foundations-rules";
import {
  cleanLibraryNote,
  LIBRARY_NOTE_ACTION,
  mergeGlossary,
  mergeKeywords,
  placementLabel,
  replayLibraryNotes,
  type GlossaryTerm,
  type KeywordSource,
  type LibraryKeyword,
  type LibraryNoteRecord,
  type OutlineSection,
  type BookCard,
  readingGroupRank,
} from "./library-rules";

export * from "./library-rules";

export async function libraryReady(): Promise<boolean> {
  const [row] = await db<{ ok: boolean }[]>`SELECT to_regclass('astro_library_entries') IS NOT NULL AND to_regclass('astro_correspondences') IS NOT NULL AS ok`;
  return Boolean(row?.ok) && (await foundationsReady());
}

export interface LibrarySiloRef {
  /** element | modality | sign | planet | point | house | aspect | … | placement */
  type: string;
  subject: string;
  label: string;
  keywords: number;
  passages: number;
  books: number;
}

export interface LibraryIndex {
  groups: { name: string; silos: LibrarySiloRef[] }[];
  glossary: { terms: number; books: number };
  people: number;
}

const GROUPS: { name: string; types: string[] }[] = [
  { name: "Elements", types: ["element"] },
  { name: "Qualities", types: ["modality", "polarity"] },
  { name: "Signs", types: ["sign"] },
  { name: "Planets and points", types: ["planet", "point"] },
  { name: "Houses", types: ["house", "house_type", "hemisphere"] },
  { name: "Aspects and patterns", types: ["aspect", "aspect_configuration", "planetary_pattern", "planet_condition", "rulership"] },
];
const PLACEMENT_GROUPS: { name: string; prefix: string }[] = [
  { name: "Planet in sign", prefix: "sign:" },
  { name: "Planet in house", prefix: "house:" },
  { name: "Planet aspects", prefix: "aspect:" },
  { name: "Sign pairs", prefix: "compat:" },
];
const ORDER: Record<string, string[]> = {
  element: ["fire", "earth", "air", "water"],
  modality: ["cardinal", "fixed", "mutable"],
  sign: ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"],
  planet: ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"],
  point: ["ascendant", "midheaven", "north node", "south node", "vertex"],
  house: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const rank = (type: string, subject: string) => {
  const i = (ORDER[type] ?? []).indexOf(subject);
  return i < 0 ? 999 : i;
};

/** Every silo with how much is in it. */
export async function libraryIndex(): Promise<LibraryIndex> {
  const stamped = await db<{ silo: string; n: number; books: number }[]>`
    SELECT silo, count(*)::int AS n, count(DISTINCT ts.book_slug)::int AS books
    FROM astro_text_sections ts, unnest(ts.silos) AS silo WHERE ts.org_id = ${ORG_ID} AND ts.kind <> 'front_back' GROUP BY 1`.catch(() => []);
  const [corr, items, lessons, sections, earlier, people, gloss, terms] = await Promise.all([
    db<{ subject_type: string; subject: string; keywords: number; books: number }[]>`
      SELECT subject_type, subject, count(*) FILTER (WHERE category ~* ${KEYWORD_CATEGORY_RE})::int AS keywords, count(DISTINCT book_slug)::int AS books
      FROM astro_correspondences WHERE org_id = ${ORG_ID} GROUP BY 1, 2`,
    db<{ lesson: string; concept: string; keywords: number; passages: number }[]>`
      SELECT lesson, concept, count(*) FILTER (WHERE kind = 'trait')::int AS keywords, count(*) FILTER (WHERE kind = 'passage')::int AS passages
      FROM astro_foundation_items WHERE org_id = ${ORG_ID} AND NOT stale GROUP BY 1, 2`,
    db<{ lesson: string; concepts: unknown }[]>`SELECT lesson, concepts FROM astro_foundation_lessons WHERE org_id = ${ORG_ID}`,
    db<{ silo: string; n: number; books: number }[]>`
      SELECT silo, count(*)::int AS n, count(DISTINCT book_slug)::int AS books FROM astro_library_entries WHERE org_id = ${ORG_ID} AND kind = 'section' GROUP BY 1`,
    db<{ factor_key: string; n: number; books: number }[]>`
      SELECT f.factor_key, count(*)::int AS n, count(DISTINCT t.source_id)::int AS books
      FROM astro_statement_factors f JOIN astro_statements s ON s.id = f.statement_id JOIN astro_texts t ON t.id = s.text_id
      WHERE f.factor_key LIKE 'sign:%' AND s.org_id = ${ORG_ID} GROUP BY 1`.catch(() => []),
    db<{ n: number }[]>`SELECT count(*)::int AS n FROM astro_library_entries WHERE org_id = ${ORG_ID} AND kind = 'person'`,
    db<{ n: number; books: number }[]>`SELECT count(*)::int AS n, count(DISTINCT book_slug)::int AS books FROM astro_library_entries WHERE org_id = ${ORG_ID} AND kind = 'glossary'`,
    db<{ n: number; books: number }[]>`SELECT count(*)::int AS n, count(DISTINCT book_slug)::int AS books FROM astro_foundation_terms WHERE org_id = ${ORG_ID} AND NOT stale`,
  ]);
  const shelfBooks = new Map<string, number>();
  for (const l of lessons)
    for (const c of Array.isArray(l.concepts) ? (l.concepts as { id?: string; stats?: { books?: number } }[]) : []) if (c.id) shelfBooks.set(`${l.lesson}/${c.id}`, Number(c.stats?.books) || 0);
  const silos = new Map<string, LibrarySiloRef>();
  const at = (type: string, subject: string) => {
    const k = `${type}/${subject}`;
    if (!silos.has(k)) silos.set(k, { type, subject, label: cap(subject), keywords: 0, passages: 0, books: 0 });
    return silos.get(k)!;
  };
  for (const c of corr) {
    const s = at(c.subject_type, c.subject);
    s.keywords += c.keywords;
    s.books += c.books;
  }
  for (const i of items) {
    const type = Object.entries(LESSON_OF_SUBJECT).find(([, lesson]) => lesson === i.lesson)?.[0];
    if (!type) continue;
    const s = at(type, i.concept);
    s.keywords += i.keywords;
    s.passages += i.passages;
    s.books += shelfBooks.get(`${i.lesson}/${i.concept}`) ?? 0;
  }
  const placements = new Map<string, LibrarySiloRef>();
  const place = (key: string) => {
    if (!placements.has(key)) placements.set(key, { type: "placement", subject: key, label: placementLabel(key), keywords: 0, passages: 0, books: 0 });
    return placements.get(key)!;
  };
  for (const s of sections) {
    const p = place(s.silo);
    p.passages += s.n;
    p.books += s.books;
  }
  for (const e of earlier) {
    const p = place(e.factor_key);
    p.passages += e.n;
    p.books += e.books;
  }
  for (const st of stamped) {
    const i = st.silo.indexOf("/");
    const [type, subject] = [st.silo.slice(0, i), st.silo.slice(i + 1)];
    const ref = type === "placement" ? place(subject) : at(type, subject);
    ref.passages += st.n;
    ref.books += st.books;
  }
  const all = [...silos.values()];
  const groups = GROUPS.map((g) => ({
    name: g.name,
    silos: all.filter((s) => g.types.includes(s.type)).sort((a, b) => g.types.indexOf(a.type) - g.types.indexOf(b.type) || rank(a.type, a.subject) - rank(b.type, b.subject) || a.subject.localeCompare(b.subject)),
  }));
  const pointOrder = ["sun", "moon", "ascendant", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
  const pr = (key: string) => {
    const [, point, sign] = key.split(":");
    return (pointOrder.includes(point) ? pointOrder.indexOf(point) : 50) * 100 + rank("sign", sign);
  };
  for (const g of PLACEMENT_GROUPS)
    groups.push({
      name: g.name,
      silos: [...placements.values()].filter((p) => p.subject.startsWith(g.prefix)).sort((a, b) => (g.prefix === "sign:" ? pr(a.subject) - pr(b.subject) : 0) || a.subject.localeCompare(b.subject, undefined, { numeric: true })),
    });
  return {
    groups,
    glossary: { terms: (gloss[0]?.n ?? 0) + (terms[0]?.n ?? 0), books: (gloss[0]?.books ?? 0) + (terms[0]?.books ?? 0) },
    people: people[0]?.n ?? 0,
  };
}

export interface LibraryPassage {
  id: string;
  text: string;
  book: string;
  author: string | null;
  pages: number[];
  where: string | null;
  /** What the text is doing, and the kind of reading (the AI's labels; null for a book's own section). */
  role: string | null;
  mode: string | null;
  /** The kind of reading, from the book's outline (or the lesson's reading); null = kind not known yet. */
  kind: string | null;
  /** The outline's section title. */
  section: string | null;
  /** When `text` is only the beginning: the passage whose whole text can be fetched (libraryPassageText). */
  textId: string | null;
  /** "book section" = a book's whole section on the subject; "passage" = a lesson's reference passage; "book passage" = an imported passage filed by its book's outline; "earlier pass" = a statement of the first digest. */
  origin: "book section" | "passage" | "book passage" | "earlier pass";
  /** A foundation item: its context can be fetched. */
  itemId: string | null;
}

export interface LibraryFact {
  category: string;
  values: { id: string; value: string; book: string; page: number | null; note: string | null; scheme: string | null; facet: string | null }[];
}

export interface LibrarySilo {
  type: string;
  subject: string;
  label: string;
  keywords: LibraryKeyword[];
  passages: LibraryPassage[];
  /** How many earlier-pass statements exist beyond the ones listed. */
  passagesMore: number;
  facts: LibraryFact[];
  people: { name: string; book: string }[];
  /** Sentences of worked chart readings whose author names this subject as the reason. */
  readings: LibraryReading[];
  books: string[];
}

export interface LibraryReading {
  id: string;
  book: string;
  page: number | null;
  placement: string | null;
  sentence: string;
  /** What the sentence says, and the factor the author gives for it. */
  parts: { says: string; because: string }[];
  note: string | null;
}

const nums = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const bookOf = (c: CorrCell) => [c.book ?? c.source ?? c.bookSlug, c.author].filter(Boolean).join(", ");
const EARLIER_LIMIT = 300;
const STAMPED_LIMIT = 500;
const EXCERPT = 280;

/** Imported passages filed in a silo by their book's outline (front and back matter left out), the beginning of each. */
async function stampedPassages(silo: string): Promise<{ passages: LibraryPassage[]; more: number }> {
  const rows = await db<{ text_id: string; kind: string; title: string | null; chapter: string | null; excerpt: string; len: number; pages: unknown; book: string; author: string | null }[]>`
    SELECT ts.text_id, ts.kind, ts.title, ts.chapter, left(t.body, ${EXCERPT}) AS excerpt, length(t.body)::int AS len, t.meta->'pages' AS pages, so.title AS book, COALESCE(t.author, so.author) AS author
    FROM astro_text_sections ts JOIN astro_texts t ON t.id = ts.text_id JOIN astro_sources so ON so.id = t.source_id
    WHERE ts.org_id = ${ORG_ID} AND ts.silos @> ${[silo]}::text[] AND ts.kind <> 'front_back'
    ORDER BY so.title, ts.chunk_index LIMIT ${STAMPED_LIMIT}`.catch(() => []);
  const [total] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM astro_text_sections ts WHERE ts.org_id = ${ORG_ID} AND ts.silos @> ${[silo]}::text[] AND ts.kind <> 'front_back'`.catch(() => [{ n: 0 }]);
  return {
    passages: rows.map((r) => ({
      id: r.text_id,
      text: r.len > EXCERPT ? `${r.excerpt}…` : r.excerpt,
      book: r.book,
      author: r.author,
      pages: nums(r.pages),
      where: r.chapter,
      role: null,
      mode: null,
      kind: r.kind,
      section: r.title,
      textId: r.len > EXCERPT ? r.text_id : null,
      origin: "book passage",
      itemId: null,
    })),
    more: Math.max(0, (total?.n ?? 0) - rows.length),
  };
}

/** The whole text of one imported passage (opened from a silo or a book page). */
export async function libraryPassageText(textId: string): Promise<string | null> {
  const [row] = await db<{ body: string }[]>`SELECT body FROM astro_texts WHERE id = ${textId} AND org_id = ${ORG_ID} AND kind = 'import'`;
  return row?.body ?? null;
}

/** Everything filed under one subject. Null when there is nothing. */
export async function librarySilo(type: string, subject: string): Promise<LibrarySilo | null> {
  const silo: LibrarySilo = { type, subject, label: type === "placement" ? placementLabel(subject) : cap(subject), keywords: [], passages: [], passagesMore: 0, facts: [], people: [], readings: [], books: [] };
  const readings = await db<{ book_slug: string; entry_key: string; body: string; payload: Record<string, unknown> | null }[]>`
    SELECT book_slug, entry_key, body, payload FROM astro_library_entries
    WHERE org_id = ${ORG_ID} AND kind = 'reading' AND jsonb_exists(payload->'silos', ${`${type}/${subject}`}) ORDER BY book_slug, position`;
  silo.readings = readings.map((r) => ({
    id: `${r.book_slug}/${r.entry_key}`,
    book: String(r.payload?.book ?? "?"),
    page: typeof r.payload?.page === "number" ? r.payload.page : null,
    placement: typeof r.payload?.placement === "string" ? r.payload.placement : null,
    sentence: r.body,
    parts: (Array.isArray(r.payload?.parts) ? (r.payload.parts as { says?: unknown; because?: unknown }[]) : []).flatMap((p) => (typeof p.says === "string" && typeof p.because === "string" ? [{ says: p.says, because: p.because }] : [])),
    note: typeof r.payload?.note === "string" ? r.payload.note : null,
  }));
  if (type === "placement") {
    const [sections, people, earlier, total] = await Promise.all([
      db<{ id: string; title: string; body: string; payload: Record<string, unknown> | null }[]>`
        SELECT id, title, body, payload FROM astro_library_entries WHERE org_id = ${ORG_ID} AND kind = 'section' AND silo = ${subject} ORDER BY book_slug, position`,
      db<{ title: string; payload: Record<string, unknown> | null }[]>`
        SELECT title, payload FROM astro_library_entries WHERE org_id = ${ORG_ID} AND kind = 'person' AND silo = ${subject} ORDER BY title`,
      db<{ id: string; body: string; pages: unknown; headings: unknown; title: string; author: string | null; kind: string | null; section: string | null }[]>`
        SELECT s.id, s.body, t.meta->'pages' AS pages, t.meta->'headings' AS headings, so.title, COALESCE(t.author, so.author) AS author, ts.kind, ts.title AS section
        FROM astro_statement_factors f
        JOIN astro_statements s ON s.id = f.statement_id
        JOIN astro_texts t ON t.id = s.text_id
        JOIN astro_sources so ON so.id = t.source_id
        LEFT JOIN astro_text_sections ts ON ts.text_id = t.id
        WHERE f.factor_key = ${subject} AND s.org_id = ${ORG_ID} AND ts.kind IS DISTINCT FROM 'front_back'
        ORDER BY (ts.kind IS NULL), so.title, t.id, s.ordinal LIMIT ${EARLIER_LIMIT}`.catch(() => []),
      db<{ n: number }[]>`SELECT count(*)::int AS n FROM astro_statement_factors WHERE factor_key = ${subject}`.catch(() => [{ n: 0 }]),
    ]);
    silo.passages = [
      ...sections.map((s): LibraryPassage => ({ id: s.id, text: s.body, book: String(s.payload?.book ?? "?"), author: null, pages: [], where: s.title.replace(/_/g, " "), role: null, mode: null, kind: "natal", section: null, textId: null, origin: "book section", itemId: null })),
      ...earlier.map((e): LibraryPassage => ({ id: e.id, text: e.body, book: e.title, author: e.author, pages: nums(e.pages), where: strs(e.headings).join(" > ") || null, role: null, mode: null, kind: e.kind, section: e.section, textId: null, origin: "earlier pass", itemId: null })),
    ];
    silo.passagesMore = Math.max(0, (total[0]?.n ?? 0) - earlier.length);
    silo.people = people.map((p) => ({ name: p.title, book: String(p.payload?.book ?? "?") }));
  } else {
    const lesson = LESSON_OF_SUBJECT[type];
    const [cells, items] = await Promise.all([correspondenceCells({ subjectType: type, subject }), lesson ? foundationItems({ lesson, concept: subject }) : Promise.resolve([])]);
    const live = items.filter((i) => !i.stale && i.origin === "books");
    const kw: { text: string; facet: string; source: KeywordSource; itemId?: string }[] = [];
    for (const it of live.filter((i) => i.kind === "trait"))
      for (const s of it.sources) kw.push({ text: it.text, facet: it.facet, itemId: it.id, source: { book: s.book ?? "?", author: s.author || null, pages: s.pages, where: s.where, via: "passages" } });
    for (const c of cells.filter((c) => c.origin === "books" && !c.stale && KEYWORD_CATEGORY_RE_.test(c.category)))
      kw.push({
        text: c.value,
        facet: c.facet ?? "itself",
        source: { book: bookOf(c), author: null, pages: c.page ? [c.page] : [], where: c.category === "Keywords (list)" ? null : c.category, via: "keyword list", tone: c.tone ?? null, label: c.label ?? null, line: c.note ?? null },
      });
    silo.keywords = mergeKeywords(kw);
    silo.passages = live
      .filter((i) => i.kind === "passage")
      .sort((a, b) => Number(a.role === "figurative" || a.role === "passing") - Number(b.role === "figurative" || b.role === "passing"))
      .map((p): LibraryPassage => {
        const s = p.sources[0];
        return { id: p.id, text: p.text, book: s?.book ?? "?", author: s?.author || null, pages: s?.pages ?? [], where: s?.where ?? null, role: p.role, mode: p.mode, kind: p.mode, section: null, textId: null, origin: "passage", itemId: p.id };
      });
    const facts = new Map<string, LibraryFact>();
    for (const c of cells.filter((c) => c.origin === "books" && !c.stale && !KEYWORD_CATEGORY_RE_.test(c.category))) {
      const f = facts.get(c.category) ?? { category: c.category, values: [] };
      facts.set(c.category, f);
      f.values.push({ id: c.id, value: c.value, book: bookOf(c), page: c.page, note: c.note ?? null, scheme: c.scheme, facet: c.facet && c.facet !== "itself" ? c.facet : null });
    }
    silo.facts = [...facts.values()];
  }
  const stamped = await stampedPassages(`${type}/${subject}`);
  silo.passages = [...stamped.passages, ...silo.passages]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => readingGroupRank(a.p.kind) - readingGroupRank(b.p.kind) || a.i - b.i)
    .map((x) => x.p);
  silo.passagesMore += stamped.more;
  silo.books = [...new Set([...silo.keywords.flatMap((k) => k.sources.map((s) => s.book)), ...silo.passages.map((p) => p.book), ...silo.facts.flatMap((f) => f.values.map((v) => v.book)), ...silo.readings.map((r) => r.book)])].sort();
  return silo.readings.length || silo.keywords.length || silo.passages.length || silo.facts.length || silo.people.length ? silo : null;
}
const KEYWORD_CATEGORY_RE_ = new RegExp(KEYWORD_CATEGORY_RE, "i");

/** Every book's glossary terms (the imported glossaries and the term catalogues), merged, alphabetical. */
export async function libraryGlossary(): Promise<GlossaryTerm[]> {
  const [entries, terms] = await Promise.all([
    db<{ title: string; body: string; payload: Record<string, unknown> | null }[]>`
      SELECT title, body, payload FROM astro_library_entries WHERE org_id = ${ORG_ID} AND kind = 'glossary' ORDER BY book_slug, position`,
    db<{ term: string; payload: Record<string, unknown> | null; book: string; author: string | null }[]>`
      SELECT t.term, t.payload, c.book, c.author FROM astro_foundation_terms t JOIN astro_foundation_catalogues c ON c.org_id = t.org_id AND c.slug = t.book_slug
      WHERE t.org_id = ${ORG_ID} AND NOT t.stale ORDER BY t.book_slug, t.position`,
  ]);
  return mergeGlossary([
    ...entries.map((e) => ({ term: e.title, also: strs(e.payload?.also), book: String(e.payload?.book ?? "?"), definition: e.body })),
    ...terms.map((t) => ({
      term: t.term,
      also: [],
      book: [t.book, t.author].filter(Boolean).join(", "),
      definition: typeof t.payload?.definition === "string" ? t.payload.definition : "",
      keywords: strs(t.payload?.keywords),
      pages: termPagesText(nums(t.payload?.pages), nums(t.payload?.book_pages)) || null,
    })),
  ]);
}

/** Famous people by placement. */
export async function libraryPeople(): Promise<{ placement: string; label: string; people: { name: string; book: string }[] }[]> {
  const rows = await db<{ silo: string; title: string; payload: Record<string, unknown> | null }[]>`
    SELECT silo, title, payload FROM astro_library_entries WHERE org_id = ${ORG_ID} AND kind = 'person' ORDER BY silo, title`;
  const by = new Map<string, { name: string; book: string }[]>();
  for (const r of rows) by.set(r.silo, [...(by.get(r.silo) ?? []), { name: r.title, book: String(r.payload?.book ?? "?") }]);
  return [...by].map(([placement, people]) => ({ placement, label: placementLabel(placement), people }));
}

// ── his notes ──────────────────────────────────────────────────────────────

/** A standing note as the pages show it. */
export interface LibraryNoteView {
  text: string;
  createdAt: string;
  /** How many times it has been written (1 = never edited). */
  versions: number;
}

async function noteRecords(reviewerId: string): Promise<Map<string, LibraryNoteRecord>> {
  const rows = await db<{ id: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, payload, created_at FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND reviewer_id = ${reviewerId} AND question_id IS NULL AND action = ${LIBRARY_NOTE_ACTION}`;
  return replayLibraryNotes(rows.map((r) => ({ id: r.id, payload: r.payload, createdAt: r.created_at.toISOString() })));
}

/** The reviewer's standing notes by noteKey(targetType, targetId); only one silo's when given. */
export async function libraryNotes(reviewerId: string, silo?: { type: string; subject?: string }): Promise<Record<string, LibraryNoteView>> {
  const out: Record<string, LibraryNoteView> = {};
  for (const [key, n] of await noteRecords(reviewerId))
    if (!silo || (n.silo.type === silo.type && (!silo.subject || n.silo.subject === silo.subject))) out[key] = { text: n.text, createdAt: n.createdAt, versions: n.history.length + 1 };
  return out;
}

export interface LibraryNoteListItem {
  key: string;
  targetType: string;
  text: string;
  context: string;
  createdAt: string;
  versions: number;
}

/** Every standing note, grouped by silo; groups and notes newest first. */
export async function libraryNotesList(reviewerId: string): Promise<{ silo: { type: string; subject: string }; label: string; notes: LibraryNoteListItem[] }[]> {
  const groups = new Map<string, { silo: { type: string; subject: string }; label: string; notes: LibraryNoteListItem[] }>();
  const all = [...(await noteRecords(reviewerId)).entries()].sort((a, b) => b[1].createdAt.localeCompare(a[1].createdAt));
  for (const [key, n] of all) {
    const k = `${n.silo.type}/${n.silo.subject}`;
    const label = n.silo.type === "placement" ? placementLabel(n.silo.subject) : n.silo.subject.charAt(0).toUpperCase() + n.silo.subject.slice(1);
    if (!groups.has(k)) groups.set(k, { silo: n.silo, label, notes: [] });
    groups.get(k)!.notes.push({ key, targetType: n.targetType, text: n.text, context: n.context, createdAt: n.createdAt, versions: n.history.length + 1 });
  }
  return [...groups.values()];
}

/** Store a note (append-only; an empty text removes the standing note). */
export async function recordLibraryNote(reviewerId: string, input: Record<string, unknown>, device: string | null): Promise<{ reviewId: string }> {
  const payload = cleanLibraryNote(input);
  const [rev] = await db<{ id: string }[]>`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES (${ORG_ID}, NULL, ${reviewerId}, ${LIBRARY_NOTE_ACTION}, ${db.json(payload as never)}, ${[]}, ${[]}, NULL, NULL, ${device})
    RETURNING id`;
  return { reviewId: rev.id };
}

// ── books and their outlines ───────────────────────────────────────────────

export interface LibraryBookRef {
  slug: string;
  book: string;
  sections: number;
  passages: number;
  notMatched: number;
  byKind: Record<string, number>;
  /** The book's card, when it has one. */
  card: BookCard | null;
}

/** The outlined books, with their kind-of-reading totals as stored, then how many imported books have no outline yet. */
export async function libraryBooks(): Promise<{ outlined: LibraryBookRef[]; withoutOutline: { title: string; passages: number }[] }> {
  const [outlines, kinds, rest] = await Promise.all([
    db<{ slug: string; book: string; sections: number; stats: Record<string, unknown> | null; card: BookCard | null }[]>`
      SELECT slug, book, jsonb_array_length(sections)::int AS sections, stats, card - 'shape' - 'alsoHas' AS card FROM astro_book_outlines WHERE org_id = ${ORG_ID} ORDER BY book`,
    db<{ book_slug: string; kind: string; n: number }[]>`SELECT book_slug, kind, count(*)::int AS n FROM astro_text_sections WHERE org_id = ${ORG_ID} GROUP BY 1, 2`,
    db<{ title: string; passages: number }[]>`
      SELECT so.title, count(*)::int AS passages FROM astro_texts t JOIN astro_sources so ON so.id = t.source_id
      WHERE t.org_id = ${ORG_ID} AND t.kind = 'import' AND NOT EXISTS (SELECT 1 FROM astro_book_outlines o WHERE o.org_id = t.org_id AND o.source_id = t.source_id)
      GROUP BY so.title ORDER BY so.title`,
  ]);
  return {
    outlined: outlines.map((o) => {
      const byKind = Object.fromEntries(kinds.filter((k) => k.book_slug === o.slug).map((k) => [k.kind, k.n]));
      return { slug: o.slug, book: o.book, sections: o.sections, passages: Object.values(byKind).reduce((n, x) => n + x, 0), notMatched: Number(o.stats?.notMatched) || 0, byKind, card: o.card ? { ...o.card, shape: null, alsoHas: [], basics: Object.fromEntries(Object.entries(o.card.basics ?? {}).map(([k, v]) => [k, v.slice(0, 0).concat(v.length ? [v[0]] : [])])) } : null };
    }),
    withoutOutline: rest,
  };
}

export interface LibraryBook extends LibraryBookRef {
  chapters: { chapter: string; sections: OutlineSection[] }[];
}

/** One book's outline: chapters, and under each its sections in book order. */
export async function libraryBook(slug: string): Promise<LibraryBook | null> {
  const [o] = await db<{ slug: string; book: string; sections: unknown; stats: Record<string, unknown> | null; card: BookCard | null }[]>`
    SELECT slug, book, sections, stats, card FROM astro_book_outlines WHERE org_id = ${ORG_ID} AND slug = ${slug}`;
  if (!o) return null;
  const sections = (Array.isArray(o.sections) ? (o.sections as OutlineSection[]) : []).sort((a, b) => a.from - b.from || a.level - b.level);
  const kinds = await db<{ kind: string; n: number }[]>`SELECT kind, count(*)::int AS n FROM astro_text_sections WHERE org_id = ${ORG_ID} AND book_slug = ${slug} GROUP BY 1`;
  const chapters: LibraryBook["chapters"] = [];
  for (const sec of sections) {
    const name = sec.chapter ?? (sec.level === 1 ? sec.title : "(no chapter)");
    if (chapters.at(-1)?.chapter !== name) chapters.push({ chapter: name, sections: [] });
    chapters.at(-1)!.sections.push(sec);
  }
  const byKind = Object.fromEntries(kinds.map((k) => [k.kind, k.n]));
  return { slug: o.slug, book: o.book, sections: sections.length, passages: Object.values(byKind).reduce((n, x) => n + x, 0), notMatched: Number(o.stats?.notMatched) || 0, byKind, card: o.card, chapters };
}
