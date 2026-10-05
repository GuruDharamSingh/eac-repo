/**
 * The Library (/hub/studio/library): the rules, with no database access —
 * reading the outline, glossary and people files, and merging what several
 * books say about one subject. Shared by src/library.ts, the importer and
 * the smoke test. Nothing in the Library is reviewed; it is for looking up
 * what has been accumulated and where it came from.
 */

import { FoundationError, normFoundationText } from "./foundations-rules";
import { aspectKey, compatKey, FACTOR_BY_KEY } from "./factors";

export interface LibraryEntry {
  kind: "section" | "glossary" | "person" | "reading";
  key: string;
  silo: string | null;
  title: string;
  body: string;
  payload: Record<string, unknown>;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const objs = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);
/** A placement's factor key: sign:<point>:<sign>. */
const PLACEMENT = /^sign:[a-z_ ]+:[a-z]+$/;

/** Check a parsed outline, glossary or people file; the entries it yields, and how many rows were left out. */
export function readLibraryFile(folder: "outline" | "glossary" | "people" | "readings", raw: unknown): { book: string; entries: LibraryEntry[]; rejected: number } {
  if (!raw || typeof raw !== "object") throw new FoundationError("the file is not an object");
  const o = raw as Record<string, unknown>;
  const book = str(o.book);
  if (!book) throw new FoundationError("the file has no book");
  const entries = new Map<string, LibraryEntry>();
  let rejected = 0;
  const add = (e: LibraryEntry | null) => {
    if (!e || entries.has(e.key)) rejected++;
    else entries.set(e.key, e);
  };
  if (folder === "outline")
    for (const s of objs(o.sections)) {
      const key = str(s.key)?.toLowerCase();
      const text = str(s.text);
      add(key && PLACEMENT.test(key) && text ? { kind: "section", key, silo: key, title: str(s.kind) ?? "planet_in_sign", body: text, payload: { book, doc: str(s.doc), chunks: Array.isArray(s.chunks) ? s.chunks : [] } } : null);
    }
  else if (folder === "glossary")
    for (const t of objs(o.terms)) {
      const key = str(t.id);
      const term = str(t.term);
      add(
        key && term
          ? { kind: "glossary", key, silo: null, title: term, body: str(t.definition) ?? "", payload: { book, also: (Array.isArray(t.also) ? t.also : []).filter((a): a is string => typeof a === "string"), source: str(t.source) } }
          : null,
      );
    }
  else if (folder === "readings") {
    let n = 0;
    for (const t of objs(o.sentences)) {
      n++;
      const sentence = str(t.sentence);
      const parts = objs(t.parts).flatMap((p) => (str(p.says) && str(p.because) ? [{ says: str(p.says)!, because: str(p.because)! }] : []));
      const placement = str(t.placement);
      add(
        sentence
          ? {
              kind: "reading",
              key: `p${typeof t.page === "number" ? t.page : 0}-${n}`,
              silo: null,
              title: placement ?? "",
              body: sentence,
              payload: { book, page: typeof t.page === "number" ? t.page : null, placement, parts, note: str(t.note), silos: readingSilos(placement, parts.map((p) => p.because)) },
            }
          : null,
      );
    }
  } else
    for (const p of objs(o.people)) {
      const key = str(p.id);
      const name = str(p.name);
      const placement = str(p.placement)?.toLowerCase();
      add(key && name && placement && PLACEMENT.test(placement) ? { kind: "person", key, silo: placement, title: name, body: "", payload: { book, source: str(p.source) } } : null);
    }
  return { book, entries: [...entries.values()], rejected };
}

const R_SIGNS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
const R_PLANETS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const R_POINTS: Record<string, string> = { ascendant: "ascendant", asc: "ascendant", midheaven: "midheaven", mc: "midheaven" };

/**
 * The silos a worked-reading sentence belongs on, from the factors its author
 * names ("venus", "leo", "sun/leo", "mc/cancer", "sun/leo square neptune",
 * "ascendant libra") and the placement it is filed under ("moon in
 * capricorn"): planet/…, point/…, sign/… and placement/sign:<point>:<sign>.
 */
export function readingSilos(placement: string | null, because: string[]): string[] {
  const out = new Set<string>();
  for (const raw of [placement ?? "", ...because])
    for (const seg of raw.toLowerCase().split("+")) {
      const words = seg.split(/[^a-z]+/).filter(Boolean);
      const bodies = words.flatMap((w) => (R_PLANETS.includes(w) ? [w] : R_POINTS[w] ? [R_POINTS[w]] : []));
      const signs = words.filter((w) => R_SIGNS.includes(w));
      for (const b of bodies) out.add(`${R_PLANETS.includes(b) ? "planet" : "point"}/${b}`);
      for (const g of signs) out.add(`sign/${g}`);
      if (bodies.length && signs.length) out.add(`placement/sign:${bodies[0]}:${signs[0]}`);
    }
  return [...out];
}

/** "sign:jupiter:capricorn" → "Jupiter in Capricorn". */
export function placementLabel(key: string): string {
  const known = FACTOR_BY_KEY.get(key)?.label;
  if (known) return known;
  const [, point, sign] = key.split(":");
  const cap = (s: string) => s.replace(/_/g, " ").replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
  return point && sign ? `${cap(point)} in ${cap(sign)}` : key;
}

/** Where one book gives a keyword. */
export interface KeywordSource {
  book: string;
  author: string | null;
  pages: number[];
  /** The section or heading it came from. */
  where: string | null;
  /** How the book came to give it: read from its passages, or listed in its keyword table. */
  via: "passages" | "keyword list";
  /** positive | negative, only where the book itself marks it. */
  tone?: string | null;
  /** The author's own lead word for the line. */
  label?: string | null;
  /** The line of the book the keyword comes from. */
  line?: string | null;
}

export interface LibraryKeyword {
  text: string;
  /** itself | dominant | lacking */
  facet: string;
  sources: KeywordSource[];
  /** Distinct books. */
  books: number;
  /** The tones the books themselves give it (positive, negative); empty when none does. */
  tones: string[];
  /** An author's lead word for it, when different from the keyword. */
  label: string | null;
  /** The foundation items behind it: their source lines can be fetched. */
  itemIds: string[];
}

/** Keywords for one subject from every source, the same word merged, most-agreed first; nothing left out. */
export function mergeKeywords(input: { text: string; facet: string; source: KeywordSource; itemId?: string }[]): LibraryKeyword[] {
  const by = new Map<string, LibraryKeyword>();
  for (const k of input) {
    const key = `${k.facet}|${normFoundationText(k.text)}`;
    const cur = by.get(key) ?? { text: k.text, facet: k.facet, sources: [], books: 0, tones: [], label: null, itemIds: [] };
    if (k.source.tone && !cur.tones.includes(k.source.tone)) cur.tones.push(k.source.tone);
    if (!cur.label && k.source.label && normFoundationText(k.source.label) !== normFoundationText(k.text)) cur.label = k.source.label;
    by.set(key, cur);
    if (!cur.sources.some((s) => s.book === k.source.book && s.where === k.source.where && s.via === k.source.via)) cur.sources.push(k.source);
    if (k.itemId && !cur.itemIds.includes(k.itemId)) cur.itemIds.push(k.itemId);
  }
  const order = ["itself", "dominant", "lacking"];
  return [...by.values()]
    .map((k) => ({ ...k, books: new Set(k.sources.map((s) => s.book)).size }))
    .sort((a, b) => order.indexOf(a.facet) - order.indexOf(b.facet) || b.books - a.books || b.sources.length - a.sources.length || a.text.localeCompare(b.text));
}

export interface GlossaryTerm {
  term: string;
  slug: string;
  also: string[];
  /** One per book that has the term. */
  definitions: { book: string; definition: string; keywords: string[]; pages: string | null }[];
  /** For a "See X" definition: X, and its slug when the glossary has it. */
  see: { term: string; slug: string | null } | null;
}

export const glossarySlug = (term: string) =>
  normFoundationText(term)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");

/** Every book's terms in one alphabetical list; the same term from two books is one entry with both definitions. */
export function mergeGlossary(input: { term: string; also: string[]; book: string; definition: string; keywords?: string[]; pages?: string | null }[]): GlossaryTerm[] {
  const by = new Map<string, GlossaryTerm>();
  for (const t of input) {
    const slug = glossarySlug(t.term);
    if (!slug) continue;
    const cur = by.get(slug) ?? { term: t.term, slug, also: [], definitions: [], see: null };
    by.set(slug, cur);
    for (const a of t.also) if (!cur.also.some((x) => x.toLowerCase() === a.toLowerCase())) cur.also.push(a);
    cur.definitions.push({ book: t.book, definition: t.definition, keywords: t.keywords ?? [], pages: t.pages ?? null });
  }
  for (const t of by.values()) {
    const m = t.definitions.map((d) => /^see (?:also )?([^.;]+)[.;]?\s*$/i.exec(d.definition.trim())).find(Boolean);
    if (m) t.see = { term: m[1].trim(), slug: by.has(glossarySlug(m[1])) ? glossarySlug(m[1]) : null };
  }
  return [...by.values()].sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));
}

// ── the owner's notes on Library entries ───────────────────────────────────
//
// astro_reviews rows (question_id NULL), append-only:
//   library-note {target_type, target_id, silo{type, subject}, text, context}
// The latest row per target wins; an empty text removes the note; earlier
// wordings stay as history. `context` is a short snapshot of what the note
// is attached to, so the note can be understood on its own later.

export const LIBRARY_NOTE_ACTION = "library-note";
// (book sections take notes too: target_type "section", silo {type: "book", subject: <slug>})
export const LIBRARY_NOTE_TARGETS = ["silo", "keyword", "passage", "correspondence", "term", "section", "person", "reading"] as const;
export const LIBRARY_NOTE_MAX = 4000;

export function cleanLibraryNote(p: Record<string, unknown>): Record<string, unknown> {
  if (typeof p.target_type !== "string" || !(LIBRARY_NOTE_TARGETS as readonly string[]).includes(p.target_type)) throw new FoundationError("Unknown kind of entry");
  const id = str(p.target_id);
  if (!id || id.length > 400) throw new FoundationError("target_id is required");
  const silo = (p.silo && typeof p.silo === "object" ? p.silo : {}) as Record<string, unknown>;
  const type = str(silo.type);
  const subject = str(silo.subject);
  if (!type || !subject || type.length > 60 || subject.length > 200) throw new FoundationError("silo is required");
  if (p.text !== undefined && p.text !== null && typeof p.text !== "string") throw new FoundationError("The note must be text");
  const text = String(p.text ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length > LIBRARY_NOTE_MAX) throw new FoundationError(`The note is longer than ${LIBRARY_NOTE_MAX} characters`);
  return { target_type: p.target_type, target_id: id, silo: { type, subject }, text, context: (str(p.context) ?? "").replace(/\s+/g, " ").slice(0, 600) };
}

export interface LibraryNoteRecord {
  targetType: string;
  targetId: string;
  silo: { type: string; subject: string };
  text: string;
  context: string;
  createdAt: string;
  reviewId: string;
  /** Earlier wordings, oldest first (the current one not included). */
  history: { text: string; createdAt: string }[];
}

export const noteKey = (targetType: string, targetId: string) => `${targetType}|${targetId}`;

/** The notes that stand, by noteKey: latest per target, removed ones left out. */
export function replayLibraryNotes(rows: { id: string; payload: Record<string, unknown>; createdAt: string }[]): Map<string, LibraryNoteRecord> {
  const out = new Map<string, LibraryNoteRecord>();
  const past = new Map<string, { text: string; createdAt: string }[]>();
  for (const r of [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
    const p = r.payload;
    const silo = (p.silo ?? {}) as Record<string, unknown>;
    if (typeof p.target_type !== "string" || typeof p.target_id !== "string" || typeof silo.type !== "string" || typeof silo.subject !== "string") continue;
    const key = noteKey(p.target_type, p.target_id);
    const before = out.get(key);
    const history = past.get(key) ?? [];
    if (before) history.push({ text: before.text, createdAt: before.createdAt });
    past.set(key, history);
    const text = typeof p.text === "string" ? p.text : "";
    if (!text) out.delete(key);
    else
      out.set(key, { targetType: p.target_type, targetId: p.target_id, silo: { type: silo.type, subject: silo.subject }, text, context: typeof p.context === "string" ? p.context : "", createdAt: r.createdAt, reviewId: r.id, history: [...history] });
  }
  return out;
}

/** library-notes.jsonl: one record per standing note, newest first, with its context snapshot and silo. */
export function buildLibraryNotes(rows: { id: string; payload: Record<string, unknown>; createdAt: string }[]) {
  return [...replayLibraryNotes(rows).values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((n) => ({
      id: n.reviewId,
      silo: n.silo,
      silo_label: n.silo.type === "placement" ? placementLabel(n.silo.subject) : n.silo.subject,
      target_type: n.targetType,
      target_id: n.targetId,
      about: n.context,
      note: n.text,
      written_at: n.createdAt,
      earlier_versions: n.history.filter((h) => h.text),
    }));
}

// ── book outlines: the section stamp on each imported passage ──────────────
//
// $CORPUS_DIR/foundations/sections/<book>.sections.json gives, per chunk of an
// imported book, the section it sits in: the kind of reading, the section
// title and chapter, what it is about (subject_type + subjects) and its
// layout. Stored in astro_text_sections (migration 186) keyed by text id.

export const READING_KINDS = ["general", "natal", "transit", "progression", "synastry", "technique", "example", "other", "front_back"] as const;

/** The order passages are shown in on a silo page; nothing is hidden, later groups are simply lower. */
export const READING_GROUPS: { key: string; label: string; kinds: readonly string[] }[] = [
  { key: "general", label: "General teaching", kinds: ["general"] },
  { key: "natal", label: "Natal", kinds: ["natal"] },
  { key: "synastry", label: "Synastry (two charts)", kinds: ["synastry"] },
  { key: "transit", label: "Transit", kinds: ["transit"] },
  { key: "progression", label: "Progression", kinds: ["progression"] },
  { key: "example", label: "Worked example", kinds: ["example"] },
  { key: "other", label: "Other", kinds: ["technique", "other", "front_back"] },
  { key: "unknown", label: "Kind not known yet", kinds: [] },
];
/** The group a kind of reading belongs to; "unknown" for a passage with no stamp. */
export function readingGroup(kind: string | null | undefined): string {
  if (!kind) return "unknown";
  return READING_GROUPS.find((g) => g.kinds.includes(kind))?.key ?? "other";
}
export const readingGroupRank = (kind: string | null | undefined) => READING_GROUPS.findIndex((g) => g.key === readingGroup(kind));
export const readingLabel = (kind: string | null | undefined) => (kind === "technique" ? "Technique" : kind === "front_back" ? "Front or back matter" : READING_GROUPS.find((g) => g.key === readingGroup(kind))!.label);

const S_BODY: Record<string, string> = {
  sun: "sun",
  moon: "moon",
  mercury: "mercury",
  venus: "venus",
  mars: "mars",
  jupiter: "jupiter",
  saturn: "saturn",
  uranus: "uranus",
  neptune: "neptune",
  pluto: "pluto",
  chiron: "chiron",
  "north node": "northNode",
  ascendant: "ascendant",
  midheaven: "midheaven",
};
const S_POINTS = ["ascendant", "midheaven", "descendant", "nadir", "north node", "south node", "vertex"];
const S_ASPECT: Record<string, string> = {
  conjunct: "conjunction",
  conjunction: "conjunction",
  sextile: "sextile",
  square: "square",
  trine: "trine",
  opposition: "opposition",
  opposite: "opposition",
  quincunx: "quincunx",
  inconjunct: "quincunx",
  semisextile: "semisextile",
  "semi-sextile": "semisextile",
  semisquare: "semisquare",
  "semi-square": "semisquare",
  sesquisquare: "sesquisquare",
  sesquiquadrate: "sesquisquare",
};
const S_PATTERN: Record<string, string> = { "grand trine": "grand trine", "grand cross": "grand cross (cosmic cross)", "t-square": "t-square", yod: "yod (finger of god)", stellium: "stellium", kite: "kite" };
const S_SHAPES = ["bowl", "bucket", "bundle", "fan", "locomotive", "seesaw", "splash", "splay"];
const S_SKIP = new Set(["glossary", "people", "method", "none"]);
const placed = (key: string) => (FACTOR_BY_KEY.has(key) ? [`placement/${key}`] : []);

/**
 * The Library silos a section is filed in, from its subjects ("capricorn",
 * "house 7", "jupiter in capricorn", "mars in house 7", "sun square moon",
 * "aries with taurus", "ascendant in leo"…). A subject that does not name one
 * thing ("all signs", "planets", "moon pairs") yields nothing: the section is
 * then only under its chapter, on the book's page. Placements, planet-in-house
 * and aspect pairs become their factor keys and must exist in the registry.
 */
export function sectionSilos(subjectType: string, subjects: string[]): string[] {
  if (S_SKIP.has(subjectType)) return [];
  const out = new Set<string>();
  const add = (list: string[]) => list.forEach((x) => out.add(x));
  for (const raw of subjects) {
    const s = raw.toLowerCase().replace(/\s+/g, " ").trim();
    let m: RegExpExecArray | null;
    if ((m = /^(.+) in house (\d{1,2})$/.exec(s))) add(S_BODY[m[1]] ? placed(`house:${S_BODY[m[1]]}:${Number(m[2])}`) : m[1] === "all planets" && Number(m[2]) <= 12 ? [`house/${Number(m[2])}`] : []);
    else if ((m = /^house (\d{1,2})$/.exec(s))) add(Number(m[1]) >= 1 && Number(m[1]) <= 12 ? [`house/${Number(m[1])}`] : []);
    else if ((m = /^(.+) in ([a-z]+)$/.exec(s)) && R_SIGNS.includes(m[2])) add(S_BODY[m[1]] ? placed(`sign:${S_BODY[m[1]]}:${m[2]}`) : []);
    else if ((m = /^(.+?) ([a-z-]+) (.+)$/.exec(s)) && S_ASPECT[m[2]] && S_BODY[m[1]] && S_BODY[m[3]]) add(placed(aspectKey(S_BODY[m[1]] as never, S_BODY[m[3]] as never, S_ASPECT[m[2]] as never)));
    else if ((m = /^([a-z]+) with ([a-z]+)$/.exec(s)) && R_SIGNS.includes(m[1]) && R_SIGNS.includes(m[2])) add(subjectType === "sign_pair" ? placed(compatKey(m[1] as never, m[2] as never)) : [`sign/${m[1]}`, `sign/${m[2]}`]);
    else if ((m = /^([a-z]+)(?: with each other sign| (?:first|second|third) decan)$/.exec(s)) && R_SIGNS.includes(m[1])) add([`sign/${m[1]}`]);
    else if ((m = /^([a-z]+) retrograde$/.exec(s)) && R_PLANETS.includes(m[1])) add([`planet_condition/${m[1]} retrograde`]);
    else if (R_SIGNS.includes(s)) add([`sign/${s}`]);
    else if (S_POINTS.includes(s)) add([`point/${s}`]);
    else if (R_PLANETS.includes(s)) add([`planet/${s}`]);
    else if (["fire", "earth", "air", "water"].includes(s)) add([`element/${s}`]);
    else if (["cardinal", "fixed", "mutable"].includes(s)) add([`modality/${s}`]);
    else if (["masculine", "positive"].includes(s)) add(["polarity/masculine"]);
    else if (["feminine", "negative"].includes(s)) add(["polarity/feminine"]);
    else if (subjectType === "aspect" && S_ASPECT[s]) add([`aspect/${S_ASPECT[s]}`]);
    else if (S_PATTERN[s]) add([`aspect_configuration/${S_PATTERN[s]}`]);
    else if (S_SHAPES.includes(s)) add([`planetary_pattern/${s}`]);
  }
  return [...out];
}

export interface SectionStamp {
  chunk: number;
  kind: string;
  title: string | null;
  chapter: string | null;
  subjectType: string;
  subjects: string[];
  layout: string | null;
  silos: string[];
}

export interface OutlineSection {
  from: number;
  to: number;
  title: string;
  level: number;
  chapter: string | null;
  kind: string;
  subjectType: string;
  subjects: string[];
  layout: string | null;
  note: string | null;
  silos: string[];
  /** Imported passages in it (filled by the importer). */
  passages?: number;
}

/** Check a parsed <book>.sections.json. Throws FoundationError when the file as a whole is unusable. */
export function readSectionsFile(raw: unknown): { book: string; doc: string; sections: OutlineSection[]; stamps: SectionStamp[]; rejected: number } {
  if (!raw || typeof raw !== "object") throw new FoundationError("the file is not an object");
  const o = raw as Record<string, unknown>;
  const book = str(o.book);
  const doc = str(o.doc);
  if (!book || !doc) throw new FoundationError("the file needs book and doc");
  if (!Array.isArray(o.sections) || !o.passages || typeof o.passages !== "object") throw new FoundationError("the file needs sections and passages");
  const kindOf = (v: unknown) => ((READING_KINDS as readonly string[]).includes(v as string) ? (v as string) : "other");
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : []);
  let rejected = 0;
  const sections = objs(o.sections).flatMap((s): OutlineSection[] => {
    if (typeof s.from !== "number" || typeof s.to !== "number" || s.to < s.from) {
      rejected++;
      return [];
    }
    const subjectType = str(s.subject_type) ?? "none";
    return [
      {
        from: s.from,
        to: s.to,
        title: str(s.title) ?? "(untitled)",
        level: typeof s.level === "number" ? s.level : 1,
        chapter: str(s.chapter),
        kind: kindOf(s.kind),
        subjectType,
        subjects: list(s.subjects),
        layout: str(s.layout),
        note: str(s.note),
        silos: sectionSilos(subjectType, list(s.subjects)),
      },
    ];
  });
  const stamps: SectionStamp[] = [];
  for (const [k, v] of Object.entries(o.passages as Record<string, unknown>)) {
    const chunk = Number(k);
    if (!Number.isInteger(chunk) || chunk < 0 || !v || typeof v !== "object") {
      rejected++;
      continue;
    }
    const p = v as Record<string, unknown>;
    const subjectType = str(p.subject_type) ?? "none";
    stamps.push({ chunk, kind: kindOf(p.kind), title: str(p.title), chapter: str(p.chapter), subjectType, subjects: list(p.subjects), layout: str(p.layout), silos: sectionSilos(subjectType, list(p.subjects)) });
  }
  return { book, doc, sections, stamps, rejected };
}

// ── book cards ($CORPUS_DIR/foundations/cards/<file>.json) ─────────────────

export const BOOK_BASICS = ["glossary", "keyword_lists", "fact_sheets", "elements", "modes", "signs", "planets", "houses", "aspects", "planet_in_sign", "planet_in_house", "planet_aspects", "ascendant_signs"] as const;
export const BOOK_PRIORITIES = ["high", "medium", "low"] as const;

export interface BookCard {
  slug: string;
  title: string;
  author: string | null;
  tradition: string | null;
  type: string | null;
  /** How the book is laid out, in a paragraph. */
  shape: string | null;
  kinds: Record<string, number>;
  /** Where the basic material is: per kind of basic, the passage ranges and what each is. */
  basics: Record<string, { from: number; to: number; what: string }[]>;
  alsoHas: string[];
  /** The reader's remark on the text, and its first word: good | damaged_headings | garbled | mostly_tables. */
  textQuality: string | null;
  quality: string | null;
  priority: string | null;
  duplicateOf: string | null;
  passages: number;
  sections: number;
}

/** Check a parsed cards file: one card per slug (the outline's slug). */
export function readBookCards(raw: unknown): { cards: BookCard[]; rejected: number } {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as Record<string, unknown>).cards)) throw new FoundationError("the file needs a cards array");
  const cards = new Map<string, BookCard>();
  let rejected = 0;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  for (const c of objs((raw as Record<string, unknown>).cards)) {
    const slug = str(c.slug);
    const title = str(c.title);
    if (!slug || !title || cards.has(slug)) {
      rejected++;
      continue;
    }
    const bm = (c.basic_material && typeof c.basic_material === "object" ? c.basic_material : {}) as Record<string, unknown>;
    const basics: BookCard["basics"] = {};
    for (const k of BOOK_BASICS) {
      const list = objs(bm[k]).flatMap((e) => (typeof e.from === "number" && typeof e.to === "number" ? [{ from: e.from, to: e.to, what: str(e.what) ?? k.replace(/_/g, " ") }] : []));
      if (list.length) basics[k] = list;
    }
    const textQuality = str(c.text_quality);
    const q = textQuality?.toLowerCase() ?? "";
    cards.set(slug, {
      slug,
      title,
      author: str(c.author),
      tradition: str(c.tradition),
      type: str(c.type),
      shape: str(c.shape),
      kinds: c.kinds && typeof c.kinds === "object" ? Object.fromEntries(Object.entries(c.kinds as Record<string, unknown>).map(([k, v]) => [k, num(v)])) : {},
      basics,
      alsoHas: (Array.isArray(c.also_has) ? c.also_has : []).filter((x): x is string => typeof x === "string" && x.trim() !== ""),
      textQuality,
      quality: q.startsWith("good") ? "good" : q.startsWith("damaged") ? "damaged_headings" : q.startsWith("garbled") ? "garbled" : q.startsWith("mostly_tables") ? "mostly_tables" : null,
      priority: (BOOK_PRIORITIES as readonly string[]).includes(c.priority as string) ? (c.priority as string) : null,
      duplicateOf: str(c.duplicate_of),
      passages: num(c.passages),
      sections: num(c.sections),
    });
  }
  return { cards: [...cards.values()], rejected };
}
