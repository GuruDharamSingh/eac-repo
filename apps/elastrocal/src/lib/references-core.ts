/**
 * Corpus references for factor keys — PASSAGE FIRST, relative to one chart.
 *
 * The unit is the book passage (astro_texts, kind 'import'). The AI-digested
 * statements are a first pass and are never the reference: at most a hint
 * ("the AI digest also tagged this") and an unverified summary on request.
 *
 * For a browsed key K, a passage is put in one group:
 *   about     its subject is K — its corrected heading scope names K (or, with
 *             no placement in its headings, its own text does). Then split by
 *             fit to the chart: more / applies / other (lib/applicability.ts,
 *             on the scope's placements, or the text's when the headings place
 *             nothing).
 *   mentions  it names K in its text, but its subject (scope) is something else
 *   mismatch  K came only from a heading that turns out to be a sibling or a
 *             running header — "this placement" there means the scope, not K
 *   passing   K only mentioned in passing (the tagger's bare mentions)
 * Only "about" passages that fit the chart make the summary and its counts.
 *
 * Evidence: astro_text_factors (explicit / inferred from the passage text;
 * heading tags are recomputed from the corrected headings, because the stored
 * ones inherited sibling headings) and the heading path in astro_texts.meta.
 * Reads use astro_text_factors_factor_idx, primary keys, and the GIN
 * search index on astro_texts for pattern phrases.
 */

import { db } from "@elkdonis/db";
import { factorsOf, FACTOR_BY_KEY } from "@elkdonis/astro-corpus";
import { patternPhraseOf, standingRefVotes } from "@elkdonis/astro-corpus/server";
import type { ChartResult } from "@elkdonis/astro";
import { calculateChart, ENGINE_VERSION } from "@elkdonis/astro/server";
import { siteConfig } from "@/config/site";
import type { Keeper } from "@/lib/auth";
import { applicability, FIT_RANK, isPlacementKey, type Fit } from "./applicability";
import { ANAPHORA, headingKeys, isAbout, labelOf, placementKeysFor, resolveScope, scopeLabel, type Crumb } from "./scope";

export interface RefVote {
  verdict: "helpful" | "not";
  note: string | null;
}

/**
 * transits / twoCharts / example: the passage is about the key, but its book's outline (astro_text_sections) says the
 * section is about transits or progressions, about two charts compared, or a worked example chart — so it is kept out
 * of a natal factor's main list and shown in its own labelled group.
 */
export type PassageGroup = "about" | "mentions" | "mismatch" | "passing" | "transits" | "twoCharts" | "example";

export interface PassageRef {
  textId: string;
  /** A window of the passage, starting near where it names the key when it does. */
  excerpt: string;
  /** Characters in the whole passage. */
  length: number;
  pages: number[] | null;
  book: { id: string; title: string; author: string | null };
  /** Corrected heading path; `ignored` = sibling headings / running headers dropped. */
  breadcrumb: Crumb[];
  ignored: string[];
  /** What the passage is about: "Sun in the 7th house". Null when nothing places it. */
  subject: string | null;
  /** Where the subject came from. */
  subjectFrom: "headings" | "text" | null;
  group: PassageGroup;
  /** The kind of reading its section is, from the book's outline: general | natal | transit | progression | synastry | technique | example | other | front_back. Null: the book has no outline yet (kind not known). */
  reading: string | null;
  /** Why it is in a side group: "about Sun in Leo; mentions Venus in Aries". */
  note: string | null;
  /** A pronoun / "this placement" in the passage — it refers to `subject`. */
  anaphora: string | null;
  fit: Fit | null;
  matched: string[];
  missing: string[];
  alternatives: string | null;
  /** The AI digest also tagged this key in this passage (a hint, unverified). */
  aiTagged: boolean;
  /** Passages (in the same group) this book has on the key. */
  inBook: number;
  vote: RefVote | null;
}

export interface KeyPassages {
  key: string;
  /** "about" passages that fit the chart (more + applies), their books and authors. */
  passages: number;
  books: number;
  authors: number;
  more: number;
  /** "about" passages that need placements this chart lacks. */
  other: number;
  otherBooks: number;
  mentions: number;
  mismatch: number;
  passing: number;
  /** "about" passages set aside by their kind of reading. */
  transits: number;
  twoCharts: number;
  example: number;
  helpful: number;
  tossed: number;
  top: PassageRef[];
  byBook: Array<{ id: string; title: string; author: string | null; passages: number }>;
}

// ── the chart ───────────────────────────────────────────────────────────────

/** The chart's factor keys, read-only and scoped to its keeper (owner account or guest cookie, as the chart page); a stale cache is recomputed in memory, never written. */
export async function chartKeySet(chartId: string, keeper: Keeper): Promise<Set<string> | null> {
  const [row] = await db<
    {
      computed: ChartResult | null;
      computed_version: string | null;
      birth_date: string;
      birth_time: string;
      timezone: string;
      latitude: number;
      longitude: number;
      house_system: ChartResult["input"]["houseSystem"];
      time_known: boolean;
    }[]
  >`
    SELECT computed, computed_version, to_char(birth_date, 'YYYY-MM-DD') AS birth_date, to_char(birth_time, 'HH24:MI:SS') AS birth_time,
           timezone, latitude, longitude, house_system, time_known
    FROM astro_charts
    WHERE id = ${chartId} AND org_id = ${siteConfig.orgId}
      AND ${keeper.kind === "user" ? db`owner_id = ${keeper.userId}` : db`guest_id = ${keeper.guestId} AND owner_id IS NULL`}
  `.catch(() => []);
  if (!row) return null;
  const chart =
    row.computed && row.computed_version === ENGINE_VERSION
      ? row.computed
      : calculateChart({
          date: row.birth_date,
          time: row.birth_time.endsWith(":00") ? row.birth_time.slice(0, 5) : row.birth_time,
          timezone: row.timezone,
          latitude: row.latitude,
          longitude: row.longitude,
          houseSystem: row.house_system,
          timeKnown: row.time_known,
        });
  return new Set(factorsOf(chart));
}

// ── reading candidates ──────────────────────────────────────────────────────

interface Row {
  id: string;
  source_id: string;
  title: string;
  author: string | null;
  headings: unknown;
  pages: unknown;
  chunk: number | null;
  reading: string | null;
  /** The passage's own strong tags (explicit / inferred), never the stored heading tags. */
  strong: string[];
  /** The stored tags for K, any confidence. */
  k_conf: string[];
  ai: boolean;
  verdict: "helpful" | "not" | null;
  note: string | null;
}

const rowColumns = (key: string) => db`
  t.id, t.source_id, so.title, so.author, t.meta->'headings' AS headings, t.meta->'pages' AS pages,
  (t.meta->>'chunkIndex')::int AS chunk,
  (SELECT x.kind FROM astro_text_sections x WHERE x.text_id = t.id) AS reading,
  ARRAY(SELECT x.factor_key FROM astro_text_factors x WHERE x.text_id = t.id AND x.confidence IN ('explicit', 'inferred')) AS strong,
  ARRAY(SELECT x.confidence FROM astro_text_factors x WHERE x.text_id = t.id AND x.factor_key = ${key}) AS k_conf,
  EXISTS (SELECT 1 FROM astro_statements s JOIN astro_statement_factors sf ON sf.statement_id = s.id
          WHERE s.text_id = t.id AND sf.factor_key = ${key}) AS ai,
  v.verdict, v.note
`;

/**
 * Passages with any evidence for `key` beyond a bare mention: tagged with it
 * (explicit / inferred / heading), or — for a general key — tagged with a
 * placement of its subject. Pattern keys: full-text search on the passages.
 */
async function readCandidates(key: string, reviewerId: string): Promise<Row[]> {
  const phrase = patternPhraseOf(key);
  if (phrase) {
    return db<Row[]>`
      SELECT ${rowColumns(key)}
      FROM astro_texts t
      JOIN astro_sources so ON so.id = t.source_id
      LEFT JOIN ${standingRefVotes(reviewerId, [key])} v ON v.text_id = t.id
      WHERE t.kind = 'import' AND t.search @@ phraseto_tsquery('english', ${phrase})
    `;
  }
  const keys = isPlacementKey(key) ? [key] : [key, ...placementKeysFor(key)];
  return db<Row[]>`
    WITH c AS (
      SELECT DISTINCT tf.text_id FROM astro_text_factors tf
      WHERE tf.factor_key = ANY (${keys}::text[]) AND tf.confidence <> 'mentioned'
    )
    SELECT ${rowColumns(key)}
    FROM c
    JOIN astro_texts t ON t.id = c.text_id AND t.kind = 'import'
    JOIN astro_sources so ON so.id = t.source_id
    LEFT JOIN ${standingRefVotes(reviewerId, [key])} v ON v.text_id = t.id
  `;
}

/** Passages where the tagger saw K only as a bare mention — "in passing". */
async function readPassing(key: string, reviewerId: string, opts: { offset: number; limit: number } | null) {
  const keys = isPlacementKey(key) ? [key] : [key, ...placementKeysFor(key)];
  const base = db`
    FROM astro_text_factors tf
    JOIN astro_texts t ON t.id = tf.text_id AND t.kind = 'import'
    JOIN astro_sources so ON so.id = t.source_id
    WHERE tf.factor_key = ${key} AND tf.confidence = 'mentioned'
      AND NOT EXISTS (SELECT 1 FROM astro_text_factors y WHERE y.text_id = t.id AND y.factor_key = ANY (${keys}::text[]) AND y.confidence <> 'mentioned')
  `;
  if (!opts) {
    const [r] = await db<{ n: number; books: number }[]>`SELECT count(*)::int AS n, count(DISTINCT t.source_id)::int AS books ${base}`;
    return { count: r?.n ?? 0, books: r?.books ?? 0, rows: [] as Row[] };
  }
  const rows = await db<Row[]>`
    SELECT ${rowColumns(key)}
    FROM astro_text_factors tf
    JOIN astro_texts t ON t.id = tf.text_id AND t.kind = 'import'
    JOIN astro_sources so ON so.id = t.source_id
    LEFT JOIN ${standingRefVotes(reviewerId, [key])} v ON v.text_id = t.id
    WHERE tf.factor_key = ${key} AND tf.confidence = 'mentioned'
      AND NOT EXISTS (SELECT 1 FROM astro_text_factors y WHERE y.text_id = t.id AND y.factor_key = ANY (${keys}::text[]) AND y.confidence <> 'mentioned')
    ORDER BY so.title, (t.meta->>'chunkIndex')::int NULLS LAST, t.id
    OFFSET ${opts.offset} LIMIT ${opts.limit}
  `;
  const [r] = await db<{ n: number; books: number }[]>`SELECT count(*)::int AS n, count(DISTINCT t.source_id)::int AS books ${base}`;
  return { count: r?.n ?? 0, books: r?.books ?? 0, rows };
}

// ── classifying ─────────────────────────────────────────────────────────────

interface Classified extends Row {
  scope: ReturnType<typeof resolveScope>;
  group: PassageGroup;
  subject: string | null;
  subjectFrom: PassageRef["subjectFrom"];
  note: string | null;
  app: ReturnType<typeof applicability>;
}

const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const ASIDE_NOTE: Record<string, string> = {
  transits: "about transits or progressions, not a birth chart",
  twoCharts: "about the relationship between two charts",
  example: "from a worked example chart",
};

/** The side group a passage about the key goes to because of its kind of reading (a transit key keeps its transit text, a compatibility key its synastry text). */
function asideGroup(reading: string | null, key: string): PassageGroup | null {
  if ((reading === "transit" || reading === "progression") && !key.startsWith("transit")) return "transits";
  if (reading === "synastry" && !key.startsWith("compat:")) return "twoCharts";
  if (reading === "example") return "example";
  return null;
}

/** Natal and general teaching first, then passages whose kind is not known yet, then technique and the rest. */
const readingRank = (c: { reading: string | null }) => (c.reading === "natal" || c.reading === "general" ? 0 : c.reading ? 2 : 1);

/** Put one passage in its group for `key`, and judge its fit to the chart. */
export function classify(row: Row, key: string, chart: Set<string> | null, forcedGroup?: PassageGroup): Classified {
  const scope = resolveScope(strArr(row.headings));
  const strong = row.strong ?? [];
  const headingPlaces = scope.keys.some(isPlacementKey);
  // The subject: the corrected headings when they place something; else the passage's own text.
  const subjectKeys = headingPlaces ? scope.keys : [...scope.keys, ...strong];
  const subjectFrom: PassageRef["subjectFrom"] = headingPlaces ? "headings" : strong.some(isPlacementKey) ? "text" : scope.keys.length ? "headings" : null;
  const subject = scopeLabel(headingPlaces ? scope.keys.filter(isPlacementKey) : subjectKeys);
  const pattern = !!patternPhraseOf(key);
  const namesIt = pattern || isAbout(strong, key);

  let group: PassageGroup;
  let note: string | null = null;
  if (forcedGroup) group = forcedGroup;
  else if (pattern || isAbout(subjectKeys, key)) group = "about";
  else if (namesIt) {
    group = "mentions";
    note = `about ${subject ?? "something else"}; mentions ${labelOf(key)}`;
  } else {
    group = "mismatch";
    const from = scope.ignored.find((h) => headingKeys(h).includes(key)) ?? scope.ignored[0];
    note = `tagged ${labelOf(key)} from ${from ? `the heading “${from}”, which is a sibling or running header` : "a heading"}; this passage is about ${subject ?? "something else"}`;
  }
  const aside = forcedGroup ? null : asideGroup(row.reading, key);
  if (aside && group === "about") {
    group = aside;
    note = ASIDE_NOTE[aside];
  }
  if (forcedGroup === "passing") note = `${labelOf(key)} only in passing; about ${subject ?? "something else"}`;

  // Fit: on the subject's placements (headings), or the text's own when the headings place nothing.
  const requirements = headingPlaces ? scope.keys.filter(isPlacementKey) : strong.filter(isPlacementKey);
  const app = applicability(requirements, pattern ? null : key, chart);
  return { ...row, scope, group, subject, subjectFrom, note, app };
}

const voteRank = (c: Classified) => (c.verdict === "helpful" ? 0 : c.verdict === "not" ? 2 : 1);
const fitRank = (c: Classified) => FIT_RANK[c.app.fit];
/** Best first: vote, fit, subject from headings (a section on it) over text, then book order. */
const better = (a: Classified, b: Classified) =>
  voteRank(a) - voteRank(b) ||
  readingRank(a) - readingRank(b) ||
  fitRank(a) - fitRank(b) ||
  Number(a.subjectFrom !== "headings") - Number(b.subjectFrom !== "headings") ||
  (a.chunk ?? 1e9) - (b.chunk ?? 1e9) ||
  a.id.localeCompare(b.id);

// ── bodies, for what is shown ───────────────────────────────────────────────

const EXCERPT = 700;

async function bodies(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db<{ id: string; body: string }[]>`SELECT id, body FROM astro_texts WHERE id = ANY (${ids}::uuid[])`;
  return new Map(rows.map((r) => [r.id, r.body]));
}

/** Start the excerpt at the line that names the key, when the passage names it. */
function excerptOf(body: string, key: string): string {
  const label = FACTOR_BY_KEY.get(key)?.label;
  let start = 0;
  if (label) {
    const i = body.toLowerCase().indexOf(label.toLowerCase());
    if (i > EXCERPT / 2) start = Math.max(body.lastIndexOf("\n", i) + 1, i - 120);
  }
  const s = body.slice(start, start + EXCERPT);
  return `${start > 0 ? "… " : ""}${s}${start + EXCERPT < body.length ? " …" : ""}`;
}

async function toRefs(items: Array<{ c: Classified; inBook: number }>, key: string, withChart: boolean): Promise<PassageRef[]> {
  const text = await bodies(items.map((i) => i.c.id));
  return items.map(({ c, inBook }) => {
    const body = text.get(c.id) ?? "";
    const m = c.subject ? ANAPHORA.exec(body) : null;
    return {
      textId: c.id,
      excerpt: excerptOf(body, key),
      length: body.length,
      pages: Array.isArray(c.pages) ? (c.pages as number[]) : null,
      book: { id: c.source_id, title: c.title, author: c.author },
      breadcrumb: c.scope.breadcrumb,
      ignored: c.scope.ignored,
      subject: c.subject,
      subjectFrom: c.subjectFrom,
      group: c.group,
      reading: c.reading ?? null,
      note: c.note,
      anaphora: m ? m[0] : null,
      fit: withChart ? c.app.fit : null,
      matched: c.app.matched,
      missing: c.app.missing,
      alternatives: c.app.alternatives,
      aiTagged: c.ai,
      inBook,
      vote: c.verdict ? { verdict: c.verdict, note: c.note } : null,
    };
  });
}

// ── summary ─────────────────────────────────────────────────────────────────

const BOOK_LIST_CAP = 12;

export async function referencesSummary(keys: string[], limit: number, reviewerId: string, chart: Set<string> | null): Promise<Record<string, KeyPassages>> {
  const out: Record<string, KeyPassages> = {};
  await Promise.all(
    keys.map(async (key) => {
      const [rows, passing] = await Promise.all([readCandidates(key, reviewerId), patternPhraseOf(key) ? null : readPassing(key, reviewerId, null)]);
      const all = rows.map((r) => classify(r, key, chart));
      const about = all.filter((c) => c.group === "about");
      const fits = about.filter((c) => c.app.fit !== "other");
      const others = about.filter((c) => c.app.fit === "other");
      const byBook = new Map<string, Classified[]>();
      for (const c of fits) byBook.set(c.source_id, [...(byBook.get(c.source_id) ?? []), c]);
      const books = [...byBook.values()].map((list) => ({ rep: [...list].sort(better)[0], n: list.length }));
      books.sort((a, b) => better(a.rep, b.rep) || b.n - a.n);
      out[key] = {
        key,
        passages: fits.length,
        books: books.length,
        authors: new Set(books.map((b) => b.rep.author ?? b.rep.title)).size,
        more: fits.filter((c) => c.app.fit === "more").length,
        other: others.length,
        otherBooks: new Set(others.map((c) => c.source_id)).size,
        mentions: all.filter((c) => c.group === "mentions").length,
        mismatch: all.filter((c) => c.group === "mismatch").length,
        transits: all.filter((c) => c.group === "transits").length,
        twoCharts: all.filter((c) => c.group === "twoCharts").length,
        example: all.filter((c) => c.group === "example").length,
        passing: passing?.count ?? 0,
        helpful: fits.filter((c) => c.verdict === "helpful").length,
        tossed: fits.filter((c) => c.verdict === "not").length,
        top: await toRefs(books.slice(0, limit).map((b) => ({ c: b.rep, inBook: b.n })), key, chart !== null),
        byBook: [...books]
          .sort((a, b) => b.n - a.n || a.rep.title.localeCompare(b.rep.title))
          .slice(0, BOOK_LIST_CAP)
          .map((b) => ({ id: b.rep.source_id, title: b.rep.title, author: b.rep.author, passages: b.n })),
      };
    }),
  );
  return out;
}

// ── the full list ───────────────────────────────────────────────────────────

export const REFERENCE_SORTS = ["rank", "book", "author"] as const;
export type ReferenceSort = (typeof REFERENCE_SORTS)[number];
export const REFERENCE_SCOPES = ["fit", "other", "mentions", "mismatch", "passing", "transits", "twoCharts", "example"] as const;
export type ReferenceScope = (typeof REFERENCE_SCOPES)[number];

export interface ReferencePage {
  key: string;
  scope: ReferenceScope;
  total: number;
  counts: { more: number; applies: number; other: number; mentions: number; mismatch: number; passing: number; transits: number; twoCharts: number; example: number };
  offset: number;
  limit: number;
  sort: ReferenceSort;
  q: string | null;
  items: PassageRef[];
}

/**
 * Every passage on one key in one group, paged. `q` filters the passage text
 * (substring), heading or book. Sorts: rank (helpful, fit, sectioned, book
 * order; tossed last), book, author (grouped; tossed last).
 */
export async function listReferences(
  key: string,
  opts: { offset: number; limit: number; q: string | null; sort: ReferenceSort; scope: ReferenceScope; reviewerId: string; chart: Set<string> | null },
): Promise<ReferencePage> {
  const [rows, passing] = await Promise.all([
    opts.scope === "passing" ? Promise.resolve([] as Row[]) : readCandidates(key, opts.reviewerId),
    patternPhraseOf(key) ? null : readPassing(key, opts.reviewerId, opts.scope === "passing" ? { offset: opts.offset, limit: opts.limit } : null),
  ]);
  let all = rows.map((r) => classify(r, key, opts.chart));
  const counts = { more: 0, applies: 0, other: 0, mentions: 0, mismatch: 0, passing: passing?.count ?? 0, transits: 0, twoCharts: 0, example: 0 };
  for (const c of all) {
    if (c.group === "about") counts[c.app.fit]++;
    else if (c.group !== "passing") counts[c.group]++;
  }

  if (opts.scope === "passing") {
    const items = (passing?.rows ?? []).map((r) => classify(r, key, opts.chart, "passing"));
    return {
      key,
      scope: "passing",
      total: counts.passing,
      counts,
      offset: opts.offset,
      limit: opts.limit,
      sort: opts.sort,
      q: null,
      items: await toRefs(items.map((c) => ({ c, inBook: 1 })), key, opts.chart !== null),
    };
  }

  all = all.filter((c) =>
    opts.scope === "fit" ? c.group === "about" && c.app.fit !== "other" : opts.scope === "other" ? c.group === "about" && c.app.fit === "other" : c.group === opts.scope,
  );
  if (opts.q) {
    const needle = opts.q.toLowerCase();
    const text = await bodies(all.map((c) => c.id));
    all = all.filter(
      (c) =>
        (text.get(c.id) ?? "").toLowerCase().includes(needle) ||
        c.title.toLowerCase().includes(needle) ||
        strArr(c.headings).some((h) => h.toLowerCase().includes(needle)),
    );
  }
  const inBook = new Map<string, number>();
  for (const c of all) inBook.set(c.source_id, (inBook.get(c.source_id) ?? 0) + 1);
  const tossedLast = (a: Classified, b: Classified) => Number(a.verdict === "not") - Number(b.verdict === "not");
  const bookOrder = (a: Classified, b: Classified) => a.title.localeCompare(b.title) || a.source_id.localeCompare(b.source_id) || (a.chunk ?? 1e9) - (b.chunk ?? 1e9);
  all.sort(
    opts.sort === "book"
      ? (a, b) => tossedLast(a, b) || bookOrder(a, b)
      : opts.sort === "author"
        ? (a, b) => tossedLast(a, b) || (a.author ?? a.title).localeCompare(b.author ?? b.title) || bookOrder(a, b)
        : (a, b) => voteRank(a) - voteRank(b) || readingRank(a) - readingRank(b) || fitRank(a) - fitRank(b) || inBook.get(b.source_id)! - inBook.get(a.source_id)! || better(a, b),
  );
  const page = all.slice(opts.offset, opts.offset + opts.limit);
  return {
    key,
    scope: opts.scope,
    total: all.length,
    counts,
    offset: opts.offset,
    limit: opts.limit,
    sort: opts.sort,
    q: opts.q,
    items: await toRefs(page.map((c) => ({ c, inBook: inBook.get(c.source_id)! })), key, opts.chart !== null),
  };
}

// ── votes, relative to a chart ──────────────────────────────────────────────

/** Passage refs for voted (textId, factorKey) pairs, classified against a chart. */
export async function passagesFor(items: Array<{ textId: string; factorKey: string }>, chart: Set<string> | null): Promise<Map<string, PassageRef>> {
  const out = new Map<string, PassageRef>();
  for (const key of [...new Set(items.map((i) => i.factorKey))]) {
    const ids = items.filter((i) => i.factorKey === key).map((i) => i.textId);
    const rows = await db<Row[]>`
      SELECT ${rowColumns(key)}
      FROM astro_texts t JOIN astro_sources so ON so.id = t.source_id
      LEFT JOIN (SELECT NULL::text AS verdict, NULL::text AS note) v ON TRUE
      WHERE t.id = ANY (${ids}::uuid[])
    `;
    const refs = await toRefs(
      rows.map((r) => ({ c: classify(r, key, chart, r.k_conf.length || patternPhraseOf(key) ? undefined : "passing"), inBook: 1 })),
      key,
      chart !== null,
    );
    for (const r of refs) out.set(`${r.textId}|${key}`, r);
  }
  return out;
}
