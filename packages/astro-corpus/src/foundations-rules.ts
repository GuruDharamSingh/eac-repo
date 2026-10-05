/**
 * "Foundations" (/hub/studio/foundations): the rules, with no database
 * access — reading a lesson sheet, payload validation, replaying the owner's
 * decisions, and building the rulebook entry of a concept. Shared by
 * src/foundations.ts, the importer, the export and the smoke test.
 *
 * A lesson ("elements") has concepts (fire, earth, air, water). For each
 * concept a local model listed what the shelf's books say: qualities
 * ("trait"), pictures and metaphors ("image") and teaching passages
 * ("passage"). The items are astro_foundation_items (migration 183). The
 * owner's decisions are astro_reviews rows with question_id NULL, replayed
 * oldest first:
 *
 *   foundation-define  {lesson, concept, text}  his own short statement of
 *                      what the concept is; the latest wins, "" withdraws it.
 *   foundation-verdict {itemId, verdict, note?, meaning?}  the item's whole
 *                      current decision; the latest wins.
 *                        trait:   core | fits | not
 *                        image:   apt | not-apt   (meaning: his wording of what the picture says)
 *                        passage: good | fine | misread; a passage the reader
 *                                 set aside as a figurative use of the word
 *                                 (role "figurative"): counts | figure
 *                        note:    keep | not      (only his own notes)
 *                      "clear" withdraws the decision. A verdict on a merged
 *                      trait un-merges it.
 *   foundation-merge   {itemId, intoItemId | null}  this trait is the same as
 *                      that one ("enthusiastic" = "enthusiasm"); it is listed
 *                      under the end of the chain and takes its verdict.
 *                      null un-merges.
 *   foundation-correct {itemId, role?, mode?}  correct the model's reading of
 *                      a passage: what the text is doing (role) and the kind
 *                      of reading (mode). Each field's latest value wins.
 *   foundation-add     {itemId, lesson, concept, kind: trait | image | note, text, meaning?, note?}
 *                      something of his own the books missed; the item itself
 *                      is inserted into astro_foundation_items (origin owner).
 *                      It stands confirmed (trait: core, image: apt, note:
 *                      keep) until he says otherwise.
 *   foundation-term-verdict     {termId, verdict: right | fix | not-basic | clear, note?}
 *   foundation-term-keyword     {termId, keyword, keep: boolean}  strike one of a
 *                      term's keywords (or secondary descriptors), or put it back.
 *   foundation-term-add-keyword {termId, keyword}  a keyword of his own.
 *   foundation-term-note        {termId, note}  his note on the term; "" removes it.
 *                      These four are about the per-book term catalogue
 *                      (astro_foundation_terms, /hub/studio/foundations/terms).
 *   foundation-cell-verdict, foundation-cell-add, foundation-category,
 *   foundation-category-add   the correspondence table (described further down).
 *   foundation-undo    {reviewId}  withdraw one earlier action; the replay
 *                      skips it. An undone foundation-add withdraws the item.
 */

export const FOUNDATION_ACTIONS = [
  "foundation-define",
  "foundation-verdict",
  "foundation-merge",
  "foundation-correct",
  "foundation-add",
  "foundation-term-verdict",
  "foundation-term-keyword",
  "foundation-term-add-keyword",
  "foundation-term-note",
  "foundation-cell-verdict",
  "foundation-cell-add",
  "foundation-category",
  "foundation-category-add",
  "foundation-undo",
] as const;
export type FoundationAction = (typeof FOUNDATION_ACTIONS)[number];
/** The actions "Undo" can withdraw. */
export const UNDOABLE_FOUNDATION_ACTIONS = [
  "foundation-define",
  "foundation-verdict",
  "foundation-merge",
  "foundation-correct",
  "foundation-add",
  "foundation-term-verdict",
  "foundation-term-keyword",
  "foundation-term-add-keyword",
  "foundation-term-note",
  "foundation-cell-verdict",
  "foundation-cell-add",
  "foundation-category",
  "foundation-category-add",
] as const;

export const FOUNDATION_KINDS = ["trait", "image", "passage", "note"] as const;
export type FoundationKind = (typeof FOUNDATION_KINDS)[number];
/** What the owner can add himself. */
export const FOUNDATION_ADD_KINDS = ["trait", "image", "note"] as const;

export const FOUNDATION_VERDICTS: Record<FoundationKind, readonly string[]> = {
  trait: ["core", "fits", "not"],
  image: ["apt", "not-apt"],
  passage: ["good", "fine", "misread", "counts", "figure"],
  note: ["keep", "not"],
};
const ALL_VERDICTS = new Set(Object.values(FOUNDATION_VERDICTS).flat());
/** What one of the owner's own additions counts as until he gives it a verdict. */
const ADDED_VERDICT: Record<string, string> = { trait: "core", image: "apt", note: "keep" };

export const FOUNDATION_ROLES = ["describes_element", "sign_through_element", "placement", "balance", "between_elements", "passing", "figurative"] as const;
export const FOUNDATION_MODES = ["general", "natal", "transit", "progression", "synastry", "other"] as const;

/**
 * Within one subject (Fire) there are subsections: the thing itself, and its
 * balance in a chart — "dominant" (the chart has a lot of it) and "lacking"
 * (little or none). Books word these differently; normFacet files them.
 */
export const FOUNDATION_FACETS = ["itself", "dominant", "lacking"] as const;
export type FoundationFacet = (typeof FOUNDATION_FACETS)[number];
export function normFacet(v: unknown): FoundationFacet | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (t === "itself") return "itself";
  if (/^(lack|lacking|weak|missing|deficien|absen|low|little|none)/.test(t)) return "lacking";
  if (/^(dominant|dominance|excess|emphasis|predomin|overemphasis|strong|high|a lot)/.test(t)) return "dominant";
  return null;
}
/** "extreme" on a dominant item or value: not just a lot, too much. */
const degreeOf = (raw: Record<string, unknown>): string | null => (raw.degree === "extreme" || (typeof raw.facet === "string" && /^excess|^overemphasis/i.test(raw.facet)) ? "extreme" : null);
export const TERM_VERDICTS = ["right", "fix", "not-basic"] as const;
export const TERM_GROUPS = [
  "element",
  "mode",
  "polarity",
  "element_balance",
  "mode_balance",
  "hemisphere",
  "quadrant",
  "planetary_pattern",
  "aspect_configuration",
  "aspect",
  "planet",
  "sign",
  "house",
  "house_type",
  "rulership",
  "planet_condition",
  "node",
  "angle",
  "method",
  "other",
] as const;
export const TERM_KEYWORD_MAX = 200;

export const FOUNDATION_TEXT_MAX = 300;
export const FOUNDATION_NOTE_MAX = 1000;
export const FOUNDATION_MEANING_MAX = 600;
export const FOUNDATION_DEFINITION_MAX = 3000;

export class FoundationError extends Error {}

/** The Foundations lesson whose concepts are correspondence-table subjects of this type. */
export const LESSON_OF_SUBJECT: Record<string, string> = { element: "elements", modality: "modes", planet: "planets", sign: "signs", house: "houses" };
/** Correspondence categories that are keyword lists ("Keywords (list)", "Keyword"), as a case-insensitive pattern. */
export const KEYWORD_CATEGORY_RE = "^keywords?( \\(list\\))?$";

export function isFoundationAction(a: string): a is FoundationAction {
  return (FOUNDATION_ACTIONS as readonly string[]).includes(a);
}

/** Whether `verdict` is one a `kind` item can take. */
export function verdictFits(kind: string, verdict: string): boolean {
  return verdict === "clear" || (FOUNDATION_VERDICTS[kind as FoundationKind] ?? []).includes(verdict);
}

// ── the sheet ($CORPUS_DIR/foundations/<lesson>/sheet.json) ────────────────

export interface FoundationSource {
  mention: string | null;
  book: string | null;
  author: string | null;
  where: string | null;
  pages: number[];
  quote: string;
  context: string | null;
  role: string | null;
  mode: string | null;
  /** Whether the passage is about the concept itself, a chart lacking it, or a chart with too much of it. */
  facet: FoundationFacet | null;
  degree: string | null;
  /** The reader's one-sentence reason for reading the passage this way. */
  why: string | null;
  /** Which model read it ("sonnet", "qwen"). */
  reader: string | null;
  /** Trait sources: the fuller wording the keyword came from. */
  phrase: string | null;
}

export interface FoundationConceptMeta {
  id: string;
  label: string;
  stats: { mentions: number; books: number; byRole: Record<string, number>; byMode: Record<string, number>; notElement: number };
}

export interface SheetItem {
  key: string;
  concept: string;
  kind: "trait" | "image" | "passage";
  text: string;
  meaning: string | null;
  role: string | null;
  mode: string | null;
  facet: FoundationFacet;
  degree: string | null;
  books: number;
  uses: number;
  sources: FoundationSource[];
}

export interface FoundationSheet {
  lesson: string;
  title: string;
  version: string | null;
  shelf: { doc: string | null; book: string; mentions: number }[];
  concepts: FoundationConceptMeta[];
  items: SheetItem[];
  /** Items left out, by reason. */
  rejected: Record<string, number>;
  duplicates: number;
}

const SLUG = /^[a-z0-9][a-z0-9_-]{0,60}$/;
const SHEET_TEXT_MAX = 6000;
const SHEET_SOURCES_MAX = 200;

const sStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const sInt = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
const sObjs = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);
const sCounts = (v: unknown): Record<string, number> =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, n]) => [k, sInt(n)])) : {};
const inList = (v: unknown, list: readonly string[]): string | null => (typeof v === "string" && list.includes(v) ? v : null);

export function readFoundationSource(raw: Record<string, unknown>): FoundationSource | null {
  const quote = sStr(raw.quote);
  if (!quote) return null;
  return {
    mention: sStr(raw.mention),
    book: sStr(raw.book),
    author: sStr(raw.author),
    where: sStr(raw.where),
    pages: (Array.isArray(raw.pages) ? raw.pages : []).filter((p): p is number => typeof p === "number" && Number.isFinite(p)),
    quote: quote.slice(0, SHEET_TEXT_MAX),
    context: sStr(raw.context)?.slice(0, SHEET_TEXT_MAX) ?? null,
    role: inList(raw.role, FOUNDATION_ROLES),
    mode: inList(raw.mode, FOUNDATION_MODES),
    facet: normFacet(raw.facet),
    degree: degreeOf(raw),
    why: sStr(raw.why)?.slice(0, 1000) ?? null,
    reader: sStr(raw.reader)?.slice(0, 40) ?? null,
    phrase: sStr(raw.phrase)?.slice(0, 600) ?? null,
  };
}

/** Check a parsed sheet.json and return its lesson, concepts and items. Throws FoundationError when the file as a whole is unusable. */
export function readFoundationSheet(raw: unknown): FoundationSheet {
  if (!raw || typeof raw !== "object") throw new FoundationError("the sheet is not an object");
  const o = raw as Record<string, unknown>;
  const lesson = sStr(o.lesson);
  if (!lesson || !SLUG.test(lesson) || lesson === "terms" || lesson === "catalogue") throw new FoundationError("the sheet has no usable lesson id (lower-case letters, digits, - and _)");
  if (!Array.isArray(o.concepts) || !Array.isArray(o.items)) throw new FoundationError("the sheet needs concepts and items arrays");
  const concepts: FoundationConceptMeta[] = [];
  for (const c of sObjs(o.concepts)) {
    const id = sStr(c.id);
    if (!id || !SLUG.test(id) || concepts.some((x) => x.id === id)) continue;
    const st = (c.stats && typeof c.stats === "object" ? c.stats : {}) as Record<string, unknown>;
    concepts.push({
      id,
      label: sStr(c.label) ?? id.charAt(0).toUpperCase() + id.slice(1),
      stats: { mentions: sInt(st.mentions), books: sInt(st.books), byRole: sCounts(st.by_role), byMode: sCounts(st.by_mode), notElement: sInt(st.not_element) },
    });
  }
  if (!concepts.length) throw new FoundationError("the sheet has no concepts");
  const conceptIds = new Set(concepts.map((c) => c.id));
  const items = new Map<string, SheetItem>();
  const rejected: Record<string, number> = {};
  const reject = (why: string) => void (rejected[why] = (rejected[why] ?? 0) + 1);
  let duplicates = 0;
  for (const it of o.items as unknown[]) {
    if (!it || typeof it !== "object") {
      reject("not an object");
      continue;
    }
    const i = it as Record<string, unknown>;
    const key = sStr(i.id);
    const kind = inList(i.kind, ["trait", "image", "passage"]) as SheetItem["kind"] | null;
    const text = sStr(i.text);
    const concept = sStr(i.concept);
    if (!key || key.length > 80 || key.startsWith("own-")) reject("no usable id");
    else if (!kind) reject("unknown kind");
    else if (!concept || !conceptIds.has(concept)) reject("unknown concept");
    else if (!text) reject("no text");
    else if (items.has(key)) duplicates++;
    else {
      const sources = sObjs(i.sources)
        .flatMap((s) => readFoundationSource(s) ?? [])
        .slice(0, SHEET_SOURCES_MAX);
      items.set(key, {
        key,
        concept,
        kind,
        text: text.replace(kind === "passage" ? /[ \t]+/g : /\s+/g, " ").slice(0, SHEET_TEXT_MAX),
        meaning: kind === "image" ? (sStr(i.meaning)?.slice(0, SHEET_TEXT_MAX) ?? null) : null,
        role: kind === "passage" ? inList(i.role, FOUNDATION_ROLES) : null,
        mode: kind === "passage" ? inList(i.mode, FOUNDATION_MODES) : null,
        facet: normFacet(i.facet) ?? "itself",
        degree: degreeOf(i),
        books: sInt(i.books) || new Set(sources.map((s) => s.book).filter(Boolean)).size,
        uses: sInt(i.uses) || sources.length,
        sources,
      });
    }
  }
  return {
    lesson,
    title: sStr(o.title) ?? lesson,
    version: sStr(o.version),
    shelf: sObjs(o.shelf).flatMap((s) => (sStr(s.book) ? [{ doc: sStr(s.doc), book: sStr(s.book)!, mentions: sInt(s.mentions) }] : [])),
    concepts,
    items: [...items.values()],
    rejected,
    duplicates,
  };
}

// ── payloads ───────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown, field: string): string => {
  if (typeof v !== "string" || !UUID.test(v)) throw new FoundationError(`${field} is not a valid id`);
  return v;
};
const slug = (v: unknown, field: string): string => {
  if (typeof v !== "string" || !SLUG.test(v)) throw new FoundationError(`${field} is required`);
  return v;
};

/** Trimmed, inner whitespace collapsed; undefined when empty. */
export function cleanLine(v: unknown, field: string, max: number): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new FoundationError(`${field} must be text`);
  const t = v.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  if (t.length > max) throw new FoundationError(`${field} is longer than ${max} characters`);
  return t;
}

/** Trimmed, line breaks kept (at most one blank line in a row). */
function cleanBlock(v: unknown, field: string, max: number): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new FoundationError(`${field} must be text`);
  const t = v
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (t.length > max) throw new FoundationError(`${field} is longer than ${max} characters`);
  return t;
}

/** What a trait is compared by: lower case, outer punctuation trimmed. */
export function normFoundationText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’()[\],.;:!?-]+|[\s"'“”‘’()[\],.;:!?-]+$/g, "")
    .trim();
}

/** Shape, vocabulary and length checks; unknown fields dropped. That the items exist (and their kind) is checked in src/foundations.ts. */
export function cleanFoundationPayload(action: FoundationAction, p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  switch (action) {
    case "foundation-define":
      out.lesson = slug(p.lesson, "lesson");
      out.concept = slug(p.concept, "concept");
      out.text = cleanBlock(p.text, "The definition", FOUNDATION_DEFINITION_MAX);
      return out;
    case "foundation-verdict": {
      out.itemId = uuid(p.itemId, "itemId");
      if (typeof p.verdict !== "string" || (p.verdict !== "clear" && !ALL_VERDICTS.has(p.verdict))) throw new FoundationError("Unknown verdict");
      out.verdict = p.verdict;
      if (p.verdict !== "clear") {
        const meaning = cleanLine(p.meaning, "The meaning", FOUNDATION_MEANING_MAX);
        if (meaning) out.meaning = meaning;
        const note = cleanLine(p.note, "The note", FOUNDATION_NOTE_MAX);
        if (note) out.note = note;
      }
      return out;
    }
    case "foundation-merge":
      out.itemId = uuid(p.itemId, "itemId");
      out.intoItemId = p.intoItemId === null || p.intoItemId === undefined ? null : uuid(p.intoItemId, "intoItemId");
      if (out.intoItemId === out.itemId) throw new FoundationError("A quality can't be the same as itself");
      return out;
    case "foundation-correct": {
      out.itemId = uuid(p.itemId, "itemId");
      if (p.role !== undefined && p.role !== null) {
        if (!inList(p.role, FOUNDATION_ROLES)) throw new FoundationError(`role must be one of ${FOUNDATION_ROLES.join(", ")}`);
        out.role = p.role;
      }
      if (p.mode !== undefined && p.mode !== null) {
        if (!inList(p.mode, FOUNDATION_MODES)) throw new FoundationError(`mode must be one of ${FOUNDATION_MODES.join(", ")}`);
        out.mode = p.mode;
      }
      if (out.role === undefined && out.mode === undefined) throw new FoundationError("Choose what to correct");
      return out;
    }
    case "foundation-add": {
      out.itemId = uuid(p.itemId, "itemId");
      out.lesson = slug(p.lesson, "lesson");
      out.concept = slug(p.concept, "concept");
      if (!inList(p.kind, FOUNDATION_ADD_KINDS)) throw new FoundationError(`kind must be one of ${FOUNDATION_ADD_KINDS.join(", ")}`);
      out.kind = p.kind;
      const text = cleanLine(p.text, "The text", p.kind === "note" ? FOUNDATION_NOTE_MAX : FOUNDATION_TEXT_MAX);
      if (!text) throw new FoundationError("Type something first");
      out.text = text;
      if (p.kind === "image") {
        const meaning = cleanLine(p.meaning, "The meaning", FOUNDATION_MEANING_MAX);
        if (meaning) out.meaning = meaning;
      }
      if (p.facet !== undefined && p.facet !== null && p.facet !== "itself") {
        if (!normFacet(p.facet)) throw new FoundationError(`facet must be one of ${FOUNDATION_FACETS.join(", ")}`);
        out.facet = normFacet(p.facet);
      }
      const note = cleanLine(p.note, "The note", FOUNDATION_NOTE_MAX);
      if (note) out.note = note;
      return out;
    }
    case "foundation-term-verdict": {
      out.termId = uuid(p.termId, "termId");
      if (typeof p.verdict !== "string" || (p.verdict !== "clear" && !(TERM_VERDICTS as readonly string[]).includes(p.verdict))) throw new FoundationError("Unknown verdict");
      out.verdict = p.verdict;
      const note = p.verdict === "clear" ? undefined : cleanLine(p.note, "The note", FOUNDATION_NOTE_MAX);
      if (note) out.note = note;
      return out;
    }
    case "foundation-term-keyword":
    case "foundation-term-add-keyword": {
      out.termId = uuid(p.termId, "termId");
      const keyword = cleanLine(p.keyword, "The keyword", TERM_KEYWORD_MAX);
      if (!keyword) throw new FoundationError("Type the keyword");
      out.keyword = keyword;
      if (action === "foundation-term-keyword") {
        if (typeof p.keep !== "boolean") throw new FoundationError("keep must be true or false");
        out.keep = p.keep;
      }
      return out;
    }
    case "foundation-term-note":
      out.termId = uuid(p.termId, "termId");
      out.note = cleanLine(p.note, "The note", FOUNDATION_NOTE_MAX) ?? "";
      return out;
    case "foundation-cell-verdict": {
      out.cellId = uuid(p.cellId, "cellId");
      if (typeof p.verdict !== "string" || (p.verdict !== "clear" && !(CELL_VERDICTS as readonly string[]).includes(p.verdict))) throw new FoundationError("Unknown verdict");
      out.verdict = p.verdict;
      if (p.verdict === "fixed") {
        const value = cleanLine(p.value, "The value", CORR_VALUE_MAX);
        if (!value) throw new FoundationError("Type the right value");
        out.value = value;
      }
      if (p.verdict !== "clear" && p.scheme !== undefined && p.scheme !== null) {
        if (!inList(p.scheme, CORR_SCHEMES)) throw new FoundationError(`scheme must be one of ${CORR_SCHEMES.join(", ")}`);
        out.scheme = p.scheme;
      }
      const note = p.verdict === "clear" ? undefined : cleanLine(p.note, "The note", FOUNDATION_NOTE_MAX);
      if (note) out.note = note;
      return out;
    }
    case "foundation-cell-add": {
      out.cellId = uuid(p.cellId, "cellId");
      if (!corrType(p.subjectType)) throw new FoundationError("Unknown kind of subject");
      out.subjectType = p.subjectType;
      if (p.scheme !== undefined && p.scheme !== null) {
        if (!inList(p.scheme, CORR_SCHEMES)) throw new FoundationError(`scheme must be one of ${CORR_SCHEMES.join(", ")}`);
        out.scheme = p.scheme;
      }
      if (p.facet !== undefined && p.facet !== null && p.facet !== "itself") {
        if (!normFacet(p.facet)) throw new FoundationError(`facet must be one of ${CORR_FACETS.join(", ")}`);
        out.facet = normFacet(p.facet);
      }
      const subject = cleanLine(p.subject, "The subject", 120)?.toLowerCase();
      const category = cleanLine(p.category, "The category", CORR_CATEGORY_MAX);
      const value = cleanLine(p.value, "The value", CORR_VALUE_MAX);
      if (!subject || !category) throw new FoundationError("subject and category are required");
      if (!value) throw new FoundationError("Type the value");
      Object.assign(out, { subject, category, value });
      const note = cleanLine(p.note, "The note", FOUNDATION_NOTE_MAX);
      if (note) out.note = note;
      return out;
    }
    case "foundation-category": {
      const category = cleanLine(p.category, "The category", CORR_CATEGORY_MAX);
      if (!category) throw new FoundationError("category is required");
      out.category = category;
      if (typeof p.ruling !== "string" || (p.ruling !== "clear" && !(CATEGORY_RULINGS as readonly string[]).includes(p.ruling))) throw new FoundationError("Unknown ruling");
      out.ruling = p.ruling;
      return out;
    }
    case "foundation-category-add": {
      if (!corrType(p.subjectType)) throw new FoundationError("Unknown kind of subject");
      out.subjectType = p.subjectType;
      const category = cleanLine(p.category, "The category", CORR_CATEGORY_MAX);
      if (!category) throw new FoundationError("Type the name of the category");
      out.category = category;
      return out;
    }
    case "foundation-undo":
      out.reviewId = uuid(p.reviewId, "reviewId");
      return out;
    default:
      throw new FoundationError("Unknown action");
  }
}

// ── replay ─────────────────────────────────────────────────────────────────

export interface FoundationReviewRow {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface FoundationVerdict {
  reviewId: string;
  verdict: string;
  note: string | null;
  /** Image only: his wording of what the picture says. */
  meaning: string | null;
  createdAt: string;
}

export interface TermDecision {
  verdict: string | null;
  verdictNote: string | null;
  dropped: Set<string>;
  added: string[];
  note: string | null;
}

export interface FoundationState {
  /** His definition per `${lesson}/${concept}`. */
  definitions: Map<string, { text: string; reviewId: string; createdAt: string }>;
  /** Latest standing verdict per item id. */
  verdicts: Map<string, FoundationVerdict>;
  /** Trait → the trait it is the same as (one step; follow with headOf). */
  merges: Map<string, string>;
  /** His corrections of the model's reading of a passage. */
  corrections: Map<string, { role: string | null; mode: string | null }>;
  /** Items he added (and has not withdrawn), oldest first. */
  added: { itemId: string; lesson: string; concept: string; kind: string; text: string; meaning: string | null; createdAt: string }[];
  /** Items whose foundation-add was undone. */
  withdrawn: Set<string>;
  /** Catalogue terms: his verdict, the keywords he struck (lower case) and added, his note. */
  terms: Map<string, TermDecision>;
  /** Correspondence cells: his verdict (and corrected value) per row id. */
  cells: Map<string, CellDecision>;
  /** His ruling per correspondence category: useful | lore | drop. */
  categories: Map<string, string>;
  /** Category rows he added to the table. */
  addedCategories: { subjectType: string; category: string }[];
  /** Undoable actions still standing, newest first. */
  history: FoundationReviewRow[];
  last: FoundationReviewRow | null;
}

export const conceptKey = (lesson: string, concept: string) => `${lesson}/${concept}`;

/** Replay the owner's foundation reviews, oldest first, into the current state. */
export function replayFoundations(reviews: FoundationReviewRow[]): FoundationState {
  const ordered = [...reviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const undone = new Set(ordered.filter((r) => r.action === "foundation-undo" && typeof r.payload.reviewId === "string").map((r) => r.payload.reviewId as string));
  const live = ordered.filter((r) => r.action !== "foundation-undo" && !undone.has(r.id));
  const withdrawn = new Set(
    ordered.flatMap((r) => {
      if (!undone.has(r.id)) return [];
      if (r.action === "foundation-add" && typeof r.payload.itemId === "string") return [r.payload.itemId];
      if (r.action === "foundation-cell-add" && typeof r.payload.cellId === "string") return [r.payload.cellId];
      return [];
    }),
  );
  const state: FoundationState = { definitions: new Map(), verdicts: new Map(), merges: new Map(), corrections: new Map(), added: [], withdrawn, terms: new Map(), cells: new Map(), categories: new Map(), addedCategories: [], history: [], last: null };
  const text = (v: unknown) => (typeof v === "string" && v ? v : null);
  for (const r of live) {
    const p = r.payload;
    if (r.action === "foundation-define") {
      if (typeof p.lesson !== "string" || typeof p.concept !== "string") continue;
      const key = conceptKey(p.lesson, p.concept);
      if (text(p.text)) state.definitions.set(key, { text: p.text as string, reviewId: r.id, createdAt: r.createdAt });
      else state.definitions.delete(key);
      continue;
    }
    if (typeof p.termId === "string") {
      const t = state.terms.get(p.termId) ?? { verdict: null, verdictNote: null, dropped: new Set<string>(), added: [], note: null };
      state.terms.set(p.termId, t);
      const kw = typeof p.keyword === "string" ? p.keyword : "";
      const same = (a: string) => a.toLowerCase() === kw.toLowerCase();
      if (r.action === "foundation-term-verdict" && typeof p.verdict === "string") {
        t.verdict = p.verdict === "clear" ? null : p.verdict;
        t.verdictNote = p.verdict === "clear" ? null : text(p.note);
      } else if (r.action === "foundation-term-note") t.note = text(p.note);
      else if (r.action === "foundation-term-add-keyword" && kw) {
        t.dropped.delete(kw.toLowerCase());
        if (!t.added.some(same)) t.added.push(kw);
      } else if (r.action === "foundation-term-keyword" && kw) {
        if (p.keep === true) t.dropped.delete(kw.toLowerCase());
        else if (t.added.some(same)) t.added = t.added.filter((a) => !same(a));
        else t.dropped.add(kw.toLowerCase());
      }
      continue;
    }
    if (r.action === "foundation-category" && typeof p.category === "string") {
      if (p.ruling === "clear") state.categories.delete(p.category);
      else if (typeof p.ruling === "string") state.categories.set(p.category, p.ruling);
      continue;
    }
    if (r.action === "foundation-category-add" && typeof p.category === "string" && typeof p.subjectType === "string") {
      if (!state.addedCategories.some((a) => a.subjectType === p.subjectType && a.category === p.category)) state.addedCategories.push({ subjectType: p.subjectType, category: p.category });
      continue;
    }
    if (typeof p.cellId === "string") {
      if (withdrawn.has(p.cellId)) continue;
      if (r.action === "foundation-cell-verdict" && typeof p.verdict === "string") {
        if (p.verdict === "clear") state.cells.delete(p.cellId);
        else state.cells.set(p.cellId, { verdict: p.verdict, value: text(p.value), scheme: text(p.scheme), note: text(p.note), reviewId: r.id });
      }
      continue;
    }
    const id = p.itemId;
    if (typeof id !== "string" || withdrawn.has(id)) continue;
    if (r.action === "foundation-verdict" && typeof p.verdict === "string") {
      state.merges.delete(id);
      if (p.verdict === "clear") state.verdicts.delete(id);
      else state.verdicts.set(id, { reviewId: r.id, verdict: p.verdict, note: text(p.note), meaning: text(p.meaning), createdAt: r.createdAt });
    } else if (r.action === "foundation-merge") {
      if (typeof p.intoItemId === "string" && !withdrawn.has(p.intoItemId)) {
        state.merges.set(id, p.intoItemId);
        state.verdicts.delete(id);
      } else state.merges.delete(id);
    } else if (r.action === "foundation-correct") {
      const cur = state.corrections.get(id) ?? { role: null, mode: null };
      state.corrections.set(id, { role: text(p.role) ?? cur.role, mode: text(p.mode) ?? cur.mode });
    } else if (r.action === "foundation-add" && typeof p.lesson === "string" && typeof p.concept === "string" && typeof p.kind === "string" && typeof p.text === "string") {
      state.added.push({ itemId: id, lesson: p.lesson, concept: p.concept, kind: p.kind, text: p.text, meaning: text(p.meaning), createdAt: r.createdAt });
      const v = ADDED_VERDICT[p.kind];
      if (v) state.verdicts.set(id, { reviewId: r.id, verdict: v, note: text(p.note), meaning: text(p.meaning), createdAt: r.createdAt });
    }
  }
  state.history = live.filter((r) => (UNDOABLE_FOUNDATION_ACTIONS as readonly string[]).includes(r.action)).reverse();
  state.last = state.history[0] ?? null;
  return state;
}

/** The end of an item's "same as" chain (the item itself when it is not merged; a loop stops where it would repeat). */
export function headOf(state: Pick<FoundationState, "merges">, id: string): string {
  const seen = new Set([id]);
  let cur = id;
  for (;;) {
    const next = state.merges.get(cur);
    if (!next || seen.has(next)) return cur;
    seen.add(next);
    cur = next;
  }
}

// ── the rulebook entry of one concept ──────────────────────────────────────

export interface FoundationItem {
  id: string;
  lesson: string;
  concept: string;
  kind: FoundationKind;
  key: string;
  text: string;
  meaning: string | null;
  role: string | null;
  mode: string | null;
  facet: FoundationFacet;
  degree?: string | null;
  books: number;
  uses: number;
  sources: FoundationSource[];
  origin: "books" | "owner";
  stale: boolean;
}

export interface Citation {
  book: string | null;
  author: string | null;
  where: string | null;
  pages: number[];
}

export interface TraitEntry {
  id: string;
  text: string;
  /** itself: a quality of the concept; dominant / lacking: what a chart with a lot / little or none of it shows. */
  facet: FoundationFacet;
  degree: string | null;
  books: number;
  uses: number;
  yours: boolean;
  note: string | null;
  /** Traits he marked the same as this one. */
  synonyms: { id: string; text: string; books: number }[];
}
export interface ImageEntry {
  id: string;
  text: string;
  /** His wording when he edited it, else the model's. */
  meaning: string | null;
  modelMeaning: string | null;
  yours: boolean;
  note: string | null;
  books: number;
  citation: Citation | null;
  quote: string | null;
}
export interface PassageEntry {
  id: string;
  text: string;
  citation: Citation | null;
  /** The reading that stands: his correction when he made one, else the model's. */
  role: string | null;
  mode: string | null;
  modelRole: string | null;
  modelMode: string | null;
  corrected: boolean;
  note: string | null;
}

export interface ConceptEntry {
  lesson: string;
  concept: string;
  definition: string | null;
  traits: { core: TraitEntry[]; fits: TraitEntry[]; rejected: TraitEntry[]; unreviewed: number };
  images: { apt: ImageEntry[]; notApt: ImageEntry[]; unreviewed: number };
  passages: { good: PassageEntry[]; fine: PassageEntry[]; misread: PassageEntry[]; /** No verdict yet, but he corrected the reading. */ correctedOnly: PassageEntry[]; unreviewed: number };
  /** Passages the reader set aside as figures of speech ("flames of love"): the ones he says do count as the concept, and the ones that are just a figure. */
  figurative: { counts: PassageEntry[]; figure: PassageEntry[]; unreviewed: number };
  /** His own notes that stand. */
  notes: { id: string; text: string }[];
  /** Everything he added himself that stands. */
  additions: { id: string; kind: string; text: string; meaning: string | null; verdict: string | null }[];
  progress: { total: number; reviewed: number };
}

const citationOf = (it: FoundationItem): Citation | null => {
  const s = it.sources[0];
  return s ? { book: s.book, author: s.author, where: s.where, pages: s.pages } : null;
};

/** Whether the item is still to be shown: not withdrawn, and not a stale item he never reviewed. */
export function itemStands(it: FoundationItem, state: FoundationState): boolean {
  if (state.withdrawn.has(it.id)) return false;
  if (!it.stale) return true;
  return state.verdicts.has(it.id) || state.merges.has(it.id) || state.corrections.has(it.id) || [...state.merges.values()].includes(it.id);
}

/**
 * What is confirmed for one concept: his definition, the traits by verdict
 * with merged synonyms under their head trait, the images, the passages with
 * the reading that stands, his notes. `items` are the concept's items.
 */
export function buildConceptEntry(lesson: string, concept: string, all: FoundationItem[], state: FoundationState): ConceptEntry {
  const items = all.filter((it) => it.lesson === lesson && it.concept === concept && itemStands(it, state));
  const byId = new Map(items.map((it) => [it.id, it]));
  const rank = <T extends { books: number; text: string; uses?: number }>(a: T, b: T) => b.books - a.books || (b.uses ?? 0) - (a.uses ?? 0) || a.text.localeCompare(b.text);

  const traits = items.filter((it) => it.kind === "trait");
  const synonyms = new Map<string, TraitEntry["synonyms"]>();
  const heads: FoundationItem[] = [];
  for (const t of traits) {
    const head = headOf(state, t.id);
    if (head !== t.id && byId.get(head)?.kind === "trait") synonyms.set(head, [...(synonyms.get(head) ?? []), { id: t.id, text: t.text, books: t.books }]);
    else heads.push(t);
  }
  const traitEntry = (t: FoundationItem): TraitEntry => ({
    id: t.id,
    text: t.text,
    facet: t.facet,
    degree: t.degree ?? null,
    books: t.books,
    uses: t.uses,
    yours: t.origin === "owner",
    note: state.verdicts.get(t.id)?.note ?? null,
    synonyms: (synonyms.get(t.id) ?? []).sort(rank),
  });
  const traitsBy = (v: string) => heads.filter((t) => state.verdicts.get(t.id)?.verdict === v).map(traitEntry).sort(rank);
  const unreviewedTraits = heads.filter((t) => !state.verdicts.has(t.id)).length;

  const images = items.filter((it) => it.kind === "image");
  const imageEntry = (it: FoundationItem): ImageEntry => ({
    id: it.id,
    text: it.text,
    meaning: state.verdicts.get(it.id)?.meaning ?? it.meaning,
    modelMeaning: it.origin === "owner" ? null : it.meaning,
    yours: it.origin === "owner",
    note: state.verdicts.get(it.id)?.note ?? null,
    books: it.books,
    citation: citationOf(it),
    quote: it.sources[0]?.quote ?? null,
  });
  const imagesBy = (v: string) => images.filter((it) => state.verdicts.get(it.id)?.verdict === v).map(imageEntry).sort(rank);

  const figurative = items.filter((it) => it.kind === "passage" && it.role === "figurative");
  const passages = items.filter((it) => it.kind === "passage" && it.role !== "figurative");
  const passageEntry = (it: FoundationItem): PassageEntry => {
    const c = state.corrections.get(it.id);
    const role = c?.role ?? it.role;
    const mode = c?.mode ?? it.mode;
    return {
      id: it.id,
      text: it.text,
      citation: citationOf(it),
      role,
      mode,
      modelRole: it.role,
      modelMode: it.mode,
      corrected: role !== it.role || mode !== it.mode,
      note: state.verdicts.get(it.id)?.note ?? null,
    };
  };
  const figurativeBy = (v: string) => figurative.filter((it) => state.verdicts.get(it.id)?.verdict === v).map(passageEntry);
  const passagesBy = (v: string) => passages.filter((it) => state.verdicts.get(it.id)?.verdict === v).map(passageEntry);
  const correctedOnly = passages.filter((it) => !state.verdicts.has(it.id)).map(passageEntry).filter((p) => p.corrected);

  const notes = items.filter((it) => it.kind === "note" && state.verdicts.get(it.id)?.verdict !== "not");
  const reviewable = items.filter((it) => it.kind !== "note");
  return {
    lesson,
    concept,
    definition: state.definitions.get(conceptKey(lesson, concept))?.text ?? null,
    traits: { core: traitsBy("core"), fits: traitsBy("fits"), rejected: traitsBy("not"), unreviewed: unreviewedTraits },
    images: { apt: imagesBy("apt"), notApt: imagesBy("not-apt"), unreviewed: images.filter((it) => !state.verdicts.has(it.id)).length },
    passages: {
      good: passagesBy("good"),
      fine: passagesBy("fine"),
      misread: passagesBy("misread"),
      correctedOnly,
      unreviewed: passages.filter((it) => !state.verdicts.has(it.id)).length,
    },
    figurative: { counts: figurativeBy("counts"), figure: figurativeBy("figure"), unreviewed: figurative.filter((it) => !state.verdicts.has(it.id)).length },
    notes: notes.map((n) => ({ id: n.id, text: n.text })),
    additions: items
      .filter((it) => it.origin === "owner" && !["not", "not-apt"].includes(state.verdicts.get(it.id)?.verdict ?? ""))
      .map((it) => ({ id: it.id, kind: it.kind, text: it.text, meaning: state.verdicts.get(it.id)?.meaning ?? it.meaning, verdict: state.verdicts.get(it.id)?.verdict ?? null })),
    progress: {
      total: reviewable.length,
      reviewed: reviewable.filter((it) => state.verdicts.has(it.id) || (state.merges.has(it.id) && headOf(state, it.id) !== it.id)).length,
    },
  };
}

/** "Book, Author · section · p. 12" */
export function citeText(c: Citation | null): string {
  if (!c) return "";
  const pages = c.pages.length ? `p. ${c.pages.join(", ")}` : null;
  return [[c.book, c.author].filter(Boolean).join(", "), c.where, pages].filter(Boolean).join(" · ");
}

// ── the per-book term catalogue ($CORPUS_DIR/foundations/catalogue/<book-slug>.json) ──

export interface CatalogueTerm {
  key: string;
  term: string;
  group: string;
  facet: string | null;
  code: string | null;
  keywords: string[];
  secondary: string[];
  definition: string | null;
  howToWeigh: string | null;
  figure: string | null;
  related: string[];
  /** Pages of the PDF scan; bookPages are the printed pages. */
  pages: number[];
  bookPages: number[];
  quote: string | null;
  note: string | null;
}

export interface Catalogue {
  book: string;
  author: string | null;
  /** The file's own slug, when it names one. */
  slug: string | null;
  terms: CatalogueTerm[];
  rejected: Record<string, number>;
  duplicates: number;
}

const nums = (v: unknown): number[] => (Array.isArray(v) ? v : []).filter((p): p is number => typeof p === "number" && Number.isFinite(p));
const strList = (v: unknown, max: number): string[] => [...new Set((Array.isArray(v) ? v : []).flatMap((x) => (sStr(x) ? [sStr(x)!.slice(0, max)] : [])))];

/** Check a parsed catalogue file. Throws FoundationError when the file as a whole is unusable. */
export function readCatalogue(raw: unknown): Catalogue {
  if (!raw || typeof raw !== "object") throw new FoundationError("the catalogue is not an object");
  const o = raw as Record<string, unknown>;
  const book = sStr(o.book);
  if (!book) throw new FoundationError("the catalogue has no book");
  if (!Array.isArray(o.terms)) throw new FoundationError("the catalogue needs a terms array");
  const terms = new Map<string, CatalogueTerm>();
  const rejected: Record<string, number> = {};
  let duplicates = 0;
  for (const t of sObjs(o.terms)) {
    const key = sStr(t.id);
    const term = sStr(t.term);
    if (!key || key.length > 120) rejected["no usable id"] = (rejected["no usable id"] ?? 0) + 1;
    else if (!term) rejected["no term"] = (rejected["no term"] ?? 0) + 1;
    else if (terms.has(key)) duplicates++;
    else
      terms.set(key, {
        key,
        term: term.slice(0, 200),
        group: inList(t.group, TERM_GROUPS) ?? "other",
        facet: normFacet(t.facet),
        code: sStr(t.code)?.slice(0, 80) ?? null,
        keywords: strList(t.keywords, TERM_KEYWORD_MAX),
        secondary: strList(t.secondary, 200),
        definition: sStr(t.definition)?.slice(0, SHEET_TEXT_MAX) ?? null,
        howToWeigh: sStr(t.how_to_weigh)?.slice(0, SHEET_TEXT_MAX) ?? null,
        figure: sStr(t.figure)?.slice(0, SHEET_TEXT_MAX) ?? null,
        related: strList(t.related, 200),
        pages: nums(Array.isArray(t.pdf_pages) && t.pdf_pages.length ? t.pdf_pages : t.pages),
        bookPages: nums(t.book_pages),
        quote: sStr(t.quote)?.slice(0, SHEET_TEXT_MAX) ?? null,
        note: sStr(t.note)?.slice(0, SHEET_TEXT_MAX) ?? null,
      });
  }
  return { book, author: sStr(o.author), slug: sStr(o.slug), terms: [...terms.values()], rejected, duplicates };
}

/** A catalogue term with the owner's decisions applied. */
export interface TermEntry {
  id: string;
  term: string;
  group: string;
  facet: string | null;
  code: string | null;
  /** The keywords that stand: the book's he did not strike, then his own. */
  keywords: string[];
  addedKeywords: string[];
  droppedKeywords: string[];
  secondary: string[];
  droppedSecondary: string[];
  definition: string | null;
  howToWeigh: string | null;
  figure: string | null;
  related: string[];
  pages: number[];
  bookPages: number[];
  quote: string | null;
  /** The reader's note from the file. */
  bookNote: string | null;
  verdict: string | null;
  verdictNote: string | null;
  note: string | null;
  stale: boolean;
}

export function buildTermEntry(t: CatalogueTerm & { id: string; stale?: boolean }, state: Pick<FoundationState, "terms">): TermEntry {
  const d = state.terms.get(t.id);
  const dropped = (k: string) => Boolean(d?.dropped.has(k.toLowerCase()));
  const added = (d?.added ?? []).filter((a) => !t.keywords.some((k) => k.toLowerCase() === a.toLowerCase()));
  return {
    id: t.id,
    term: t.term,
    group: t.group,
    facet: t.facet,
    code: t.code,
    keywords: [...t.keywords.filter((k) => !dropped(k)), ...added],
    addedKeywords: added,
    droppedKeywords: t.keywords.filter(dropped),
    secondary: t.secondary.filter((k) => !dropped(k)),
    droppedSecondary: t.secondary.filter(dropped),
    definition: t.definition,
    howToWeigh: t.howToWeigh,
    figure: t.figure,
    related: t.related,
    pages: t.pages,
    bookPages: t.bookPages,
    quote: t.quote,
    bookNote: t.note,
    verdict: d?.verdict ?? null,
    verdictNote: d?.verdictNote ?? null,
    note: d?.note ?? null,
    stale: Boolean(t.stale),
  };
}

/** Whether the owner has done anything to a term (so a re-import must keep it). */
export const termTouched = (state: Pick<FoundationState, "terms">, id: string): boolean => {
  const d = state.terms.get(id);
  return Boolean(d && (d.verdict || d.note || d.dropped.size || d.added.length));
};

/** "scan p. 14 (book pp. 27-28)" */
export function termPagesText(pages: number[], bookPages: number[]): string {
  const span = (p: number[]) => (p.length > 1 && p[p.length - 1] - p[0] === p.length - 1 ? `${p[0]}-${p[p.length - 1]}` : p.join(", "));
  const scan = pages.length ? `scan p${pages.length > 1 ? "p" : ""}. ${span(pages)}` : "";
  const book = bookPages.length ? `book p${bookPages.length > 1 ? "p" : ""}. ${span(bookPages)}` : "";
  return scan && book ? `${scan} (${book})` : scan || book;
}

// ── the correspondence table ($CORPUS_DIR/foundations/correspondences/<book-slug>.json) ──
//
// One cell = what one book gives for a subject (the sign Aries, the planet
// Mars, the element fire…) under a category (Color, Gems, Body Part,
// "Keywords (list)"…). Several books — and the owner — can give values for
// the same subject + category; they sit side by side. Rows are
// astro_correspondences (migration 184). His decisions:
//
//   foundation-cell-verdict  {cellId, verdict: right | wrong | fixed | clear, value?, scheme?, note?}
//                            right = keep; "fixed" carries his corrected value;
//                            scheme (traditional | later addition) re-files the value.
//   foundation-cell-add      {cellId, subjectType, subject, category, value, scheme?, facet?, note?}
//                            a value of his own (the row is inserted, origin owner).
//   foundation-category      {category, ruling: useful | lore | drop | clear}
//                            useful: use it in readings; lore: keep but do not
//                            interpret with it; drop: leave it out.
//   foundation-category-add  {subjectType, category}  a new, empty category row.

/** The usual subject types, in tab order; a file may bring others (any lower-case id). */
export const CORR_SUBJECT_TYPES = [
  "sign",
  "planet",
  "house",
  "point",
  "element",
  "modality",
  "polarity",
  "aspect",
  "aspect_configuration",
  "planetary_pattern",
  "planet_condition",
  "house_type",
  "rulership",
  "hemisphere",
] as const;
/** A cell can hold several values that are not in conflict: the traditional one and a later addition (Uranus, Neptune, Pluto). */
export const CORR_SCHEMES = ["traditional", "later addition"] as const;
export const CORR_FACETS = FOUNDATION_FACETS;
const corrType = (v: unknown): string | null => (typeof v === "string" && SLUG.test(v) ? v : null);
export const CELL_VERDICTS = ["right", "wrong", "fixed"] as const;
export const CATEGORY_RULINGS = ["useful", "lore", "drop"] as const;
export const CORR_VALUE_MAX = 1000;
export const CORR_CATEGORY_MAX = 80;
export const CORR_GROUPS = ["Basics", "Keywords", "Body & health", "Nature", "Classical sign classes", "Religion & myth", "Occult", "Other"] as const;

const SUBJECT_ORDER: Record<string, string[]> = {
  sign: ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"],
  planet: ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"],
  house: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  point: ["ascendant", "midheaven", "descendant", "ic", "north node", "south node", "vertex"],
  element: ["fire", "earth", "air", "water"],
  modality: ["cardinal", "fixed", "mutable"],
  polarity: ["masculine", "feminine"],
};

/** Subjects in their usual order (zodiac order, planet order…), unknown ones after, as given. */
export function orderSubjects(type: string, subjects: string[]): string[] {
  const known = SUBJECT_ORDER[type] ?? [];
  const uniq = [...new Set(subjects)];
  return [...known.filter((s) => uniq.includes(s)), ...uniq.filter((s) => !known.includes(s))];
}

const GROUP_RULES: [RegExp, (typeof CORR_GROUPS)[number]][] = [
  [/keyword|phrase|tendency/i, "Keywords"],
  [/body|disease|mineral salt|drug|health/i, "Body & health"],
  [/colou?r|gem|metal|plant|animal|perfume|music|stone|flower|herb/i, "Nature"],
  [/tarot|tree of life|path|qliphot|sephirot|hebrew|magical|alice bailey|hierarchy|realm|legendary|lineal|pranava|nature spirit|elemental ruler/i, "Occult"],
  [/apostle|evangelist|deit|tribe|prophet|jewish|angel|spirits|consecrated|infernal|damned|buddhist|god|myth/i, "Religion & myth"],
  [/gender|positive|quadruplicit|triplicit|ruling|ruler|detriment|exalt|fall|^house$|month|day of week|number|12 phases|critical degree|element|^mode|modality|polarity|temperament/i, "Basics"],
  [/\//, "Classical sign classes"],
  [/signs?\b|bestial|ruminant|ascension|crooked|brutish|conceptive|changeable|animal types/i, "Classical sign classes"],
];

/** The suggested group of a category (Basics, Keywords, Nature, …). */
export function categoryGroup(category: string): (typeof CORR_GROUPS)[number] {
  for (const [re, g] of GROUP_RULES) if (re.test(category)) return g;
  return "Other";
}

export interface CorrRow {
  key: string;
  subjectType: string;
  subject: string;
  category: string;
  value: string;
  page: number | null;
  source: string | null;
  derivedFrom: string | null;
  /** traditional | later addition, when the book's value belongs to one scheme. */
  scheme: string | null;
  /** itself | dominant | lacking: which subsection of the subject the value belongs to. */
  facet: string | null;
  degree: string | null;
  /** The book's own explanation of the value (or the line it comes from). */
  note?: string | null;
  /** positive | negative, only where the book itself marks it. */
  tone?: string | null;
  /** The author's own lead word for the line the value comes from. */
  label?: string | null;
}

export interface CorrFile {
  book: string;
  author: string | null;
  slug: string | null;
  rows: CorrRow[];
  rejected: Record<string, number>;
  duplicates: number;
}

/** Check a parsed correspondences file. Throws FoundationError when the file as a whole is unusable. */
export function readCorrespondences(raw: unknown): CorrFile {
  if (!raw || typeof raw !== "object") throw new FoundationError("the file is not an object");
  const o = raw as Record<string, unknown>;
  const book = sStr(o.book);
  if (!book) throw new FoundationError("the file has no book");
  if (!Array.isArray(o.rows)) throw new FoundationError("the file needs a rows array");
  const rows = new Map<string, CorrRow>();
  const rejected: Record<string, number> = {};
  const reject = (why: string) => void (rejected[why] = (rejected[why] ?? 0) + 1);
  let duplicates = 0;
  for (const r of sObjs(o.rows)) {
    const key = sStr(r.id);
    const subjectType = corrType(r.subject_type);
    const subject = (typeof r.subject === "number" ? String(r.subject) : sStr(r.subject))?.toLowerCase() ?? null;
    const category = sStr(r.category);
    const value = sStr(r.value);
    if (!key || key.length > 120) reject("no usable id");
    else if (!subjectType) reject("unknown subject type");
    else if (!subject || !category || !value) reject("subject, category or value missing");
    else if (rows.has(key)) duplicates++;
    else
      rows.set(key, {
        key,
        subjectType,
        subject: subject.replace(/\s+/g, " ").slice(0, 120),
        category: category.replace(/\s+/g, " ").slice(0, CORR_CATEGORY_MAX),
        value: value.replace(/\s+/g, " ").slice(0, CORR_VALUE_MAX),
        page: typeof r.page === "number" && Number.isFinite(r.page) ? r.page : null,
        source: sStr(r.source)?.slice(0, 200) ?? null,
        derivedFrom: sStr(r.derived_from)?.slice(0, 200) ?? null,
        scheme: inList(r.scheme, CORR_SCHEMES),
        facet: normFacet(r.facet),
        degree: degreeOf(r),
        note: sStr(r.note)?.slice(0, 2000) ?? null,
        tone: inList(r.tone, ["positive", "negative"]),
        label: sStr(r.label)?.slice(0, 200) ?? null,
      });
  }
  return { book, author: sStr(o.author), slug: sStr(o.slug), rows: [...rows.values()], rejected, duplicates };
}

export interface CellDecision {
  verdict: string;
  /** His corrected value (verdict "fixed"). */
  value: string | null;
  /** The scheme he re-filed the value under. */
  scheme: string | null;
  note: string | null;
  reviewId: string;
}

/** A stored correspondence row (a book's, or one the owner added). */
export interface CorrCell extends CorrRow {
  id: string;
  bookSlug: string;
  book: string | null;
  author: string | null;
  origin: "books" | "owner";
  stale: boolean;
}

/** One value in a cell of the table, with his decision on it. */
export interface CellView {
  id: string;
  value: string;
  /** What the book printed, when he fixed it. */
  original: string | null;
  verdict: string | null;
  note: string | null;
  yours: boolean;
  bookSlug: string;
  source: string | null;
  page: number | null;
  /** Lifted from the signs: the same for every sign of the group. */
  derived: boolean;
  /** The scheme that stands (his, else the book's) and the book's own. */
  scheme: string | null;
  bookScheme: string | null;
  facet: string;
  degree: string | null;
  /** The book's own explanation of the value. */
  bookNote: string | null;
  stale: boolean;
}

export interface CorrTable {
  subjectType: string;
  subjects: string[];
  groups: { group: string; categories: { category: string; ruling: string | null; yours: boolean; cells: Record<string, CellView[]> }[] }[];
  /** The books that give values here: slug → name, for the source marks. */
  books: { slug: string; book: string; author: string | null }[];
  total: number;
  judged: number;
}

const cellView = (c: CorrCell, state: Pick<FoundationState, "cells">): CellView => {
  const d = state.cells.get(c.id);
  const fixed = d?.verdict === "fixed" && d.value ? d.value : null;
  return {
    id: c.id,
    value: fixed ?? c.value,
    original: fixed ? c.value : null,
    verdict: d?.verdict ?? null,
    note: d?.note ?? null,
    yours: c.origin === "owner",
    bookSlug: c.bookSlug,
    source: c.source ?? c.book,
    page: c.page,
    derived: Boolean(c.derivedFrom),
    scheme: d?.scheme ?? c.scheme,
    bookScheme: c.scheme,
    facet: normFacet(c.facet) ?? "itself",
    degree: c.degree,
    bookNote: c.note ?? null,
    stale: c.stale,
  };
};

const cellStands = (c: CorrCell, state: Pick<FoundationState, "cells" | "withdrawn">) => !state.withdrawn.has(c.id) && (!c.stale || state.cells.has(c.id));

/** The table of one subject type: subjects as columns, categories (grouped) as rows, every book's values side by side. */
export function buildCorrTable(cells: CorrCell[], state: FoundationState, subjectType: string): CorrTable {
  const mine = cells.filter((c) => c.subjectType === subjectType && cellStands(c, state));
  const subjects = orderSubjects(subjectType, mine.map((c) => c.subject));
  const byCat = new Map<string, Record<string, CellView[]>>();
  for (const c of mine) {
    const row = byCat.get(c.category) ?? {};
    byCat.set(c.category, row);
    (row[c.subject] ??= []).push(cellView(c, state));
  }
  const added = state.addedCategories.filter((a) => a.subjectType === subjectType && !byCat.has(a.category));
  for (const a of added) byCat.set(a.category, {});
  const yoursOnly = new Set(added.map((a) => a.category));
  const groups = CORR_GROUPS.map((group) => ({
    group: group as string,
    categories: [...byCat]
      .filter(([category]) => categoryGroup(category) === group)
      .map(([category, row]) => ({ category, ruling: state.categories.get(category) ?? null, yours: yoursOnly.has(category), cells: row })),
  })).filter((g) => g.categories.length);
  const books = new Map<string, { slug: string; book: string; author: string | null }>();
  for (const c of mine) if (c.origin === "books" && !books.has(c.bookSlug)) books.set(c.bookSlug, { slug: c.bookSlug, book: c.book ?? c.bookSlug, author: c.author });
  return { subjectType, subjects, groups, books: [...books.values()], total: mine.length, judged: mine.filter((c) => state.cells.has(c.id)).length };
}

/**
 * correspondences.json: the cells he confirmed (Right, fixed — with his value —
 * or added himself), the ones he marked wrong, and his ruling on each category.
 */
export function buildCorrespondencesExport(cells: CorrCell[], reviews: FoundationReviewRow[]) {
  const state = replayFoundations(reviews);
  const standing = cells.filter((c) => cellStands(c, state));
  const out = (c: CorrCell) => {
    const v = cellView(c, state);
    return {
      subject_type: c.subjectType,
      subject: c.subject,
      category: c.category,
      value: v.value,
      original_value: v.original,
      verdict: v.yours && !v.verdict ? "yours" : v.verdict,
      note: v.note,
      source: v.yours ? "owner" : c.source ?? c.book,
      book_slug: v.yours ? null : c.bookSlug,
      page: c.page,
      derived_from: c.derivedFrom,
      scheme: v.scheme,
      facet: v.facet,
      category_ruling: state.categories.get(c.category) ?? null,
    };
  };
  const ok = (c: CorrCell) => (c.origin === "owner" ? state.cells.get(c.id)?.verdict !== "wrong" : ["right", "fixed"].includes(state.cells.get(c.id)?.verdict ?? ""));
  const categories = [...new Set([...standing.map((c) => c.category), ...state.addedCategories.map((a) => a.category), ...state.categories.keys()])].sort();
  return {
    confirmed_cells: standing.filter(ok).map(out),
    wrong_cells: standing.filter((c) => state.cells.get(c.id)?.verdict === "wrong").map(out),
    categories: categories.map((category) => ({
      category,
      group: categoryGroup(category),
      ruling: state.categories.get(category) ?? null,
      added_by_owner: state.addedCategories.some((a) => a.category === category),
      cells: standing.filter((c) => c.category === category).length,
    })),
    totals: { cells: standing.length, judged: standing.filter((c) => state.cells.has(c.id)).length },
  };
}

export interface SubjectView {
  subjectType: string;
  subject: string;
  /** itself first, then dominant, lacking; each with its categories (grouped as in the table) and every book's values. */
  facets: { facet: string; categories: { category: string; group: string; ruling: string | null; values: CellView[] }[] }[];
  books: { slug: string; book: string; author: string | null }[];
  total: number;
}

/** Everything every book (and the owner) gives for one subject, in one place: by facet, then category, each value with its book. */
export function buildSubjectView(cells: CorrCell[], state: FoundationState, subjectType: string, subject: string): SubjectView {
  const mine = cells.filter((c) => c.subjectType === subjectType && c.subject === subject);
  const table = buildCorrTable(mine, state, subjectType);
  const rows = table.groups.flatMap((g) => g.categories.map((c) => ({ category: c.category, group: g.group, ruling: c.ruling, values: c.cells[subject] ?? [] })));
  const facets = CORR_FACETS.map((facet) => ({
    facet: facet as string,
    categories: rows.map((r) => ({ ...r, values: r.values.filter((v) => v.facet === facet) })).filter((r) => r.values.length),
  })).filter((f) => f.categories.length);
  return { subjectType, subject, facets, books: table.books, total: table.total };
}
