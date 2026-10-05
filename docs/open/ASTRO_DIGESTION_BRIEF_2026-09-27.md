# Digesting astrology books by their vocabulary

Design brief, 2026-09-27. Covers how a library of about a hundred astrology
books is broken into indexed statements, using the fact that astrology's
subject matter is a closed, countable vocabulary. Extends the Astro Studio
brief (`docs/open/ASTRO_STUDIO_BRIEF_2026-09-26.md`, sections B–D). Nothing in
this brief is built. Figures marked (est.) are estimates.

## Summary

Every astrological statement is about a small set of things that recur without
end: fourteen points, twelve signs, twelve houses, nine aspects, a handful of
chart contexts and conditions. A book is digested by (1) finding which of
those things each passage is about, mostly from headings, (2) breaking the
passage into single statements, (3) labelling what each statement says (a
trait, an event, advice) and under what condition, and (4) storing each
statement against every factor it touches, with its source. The result is a
dossier per factor: every statement any author made about the Sun square
Saturn, grouped by context and theme, with agreements and contradictions
visible. Books mostly write about one or two factors at a time; the owners'
answers in the studio teach how factors combine.

## 1. The vocabulary (what recurs)

Counts are the registry's (`packages/astro-corpus/src/factors.ts`) unless
marked as additions.

| Layer | Items | Count | In registry |
|---|---|---|---|
| Points | Sun … Pluto, North Node, Chiron, Ascendant, Midheaven | 14 | yes |
| Points, additions | South Node, Descendant, IC, Part of Fortune, Vertex, Lilith, Ceres, Pallas, Juno, Vesta, fixed stars (Regulus, Algol, Spica, Antares, Aldebaran …) | ~20 | no |
| Signs | Aries … Pisces, each with element, modality, polarity, ruler, exaltation, detriment, fall | 12 | yes |
| Houses | 1–12, with angular / succedent / cadent and each house's areas of life | 12 | yes (`realm`) |
| Aspects | conjunction, sextile, square, trine, opposition, quincunx, semisextile, semisquare, sesquisquare | 9 | yes |
| Aspects, additions | quintile, biquintile, septile, novile, parallel, contraparallel | 6 | no |
| Contexts | natal, transit, progression, solar arc, solar / lunar return, synastry, composite, horary, electional, mundane | 10 | natal, transit, sign compatibility only |
| Conditions | retrograde, stationary, combust / cazimi / under the beams, out of bounds, domicile / exaltation / detriment / fall / peregrine, intercepted, critical or anaretic degree, void of course, applying / separating, day / night chart (sect) | ~20 | no |
| Relations | ruler of a house placed in a house ("lord of the 7th in the 10th"), dispositor, mutual reception | 12 × 12 rulers-in-houses, + pairs | no |
| Configurations | stellium, T-square, grand trine, grand cross, yod, kite, mystic rectangle, chart shapes | ~12 | no |
| Frame | tropical / sidereal zodiac, house system, tradition | — | tradition only |

The countable combinations, which set how much a library can cover:

| Level | Example | Distinct factors |
|---|---|---|
| One part | Mars; Scorpio; the 7th house; the square | 47 |
| Two parts | Mars in Virgo; Venus in the 7th; Mars square Saturn | 168 + 144 + 810 = 1,122 |
| Three parts | Mars in Virgo in the 10th | 12 × 12 × 12 = 1,728 |
| Aspect with both signs | Mars in Aries square Saturn in Cancer | about 20,000 consistent (est.: 90 pairs × ~240 sign combinations, fewer for Sun–Mercury–Venus) |
| Full placement pairs | both planets with sign and house | hundreds of thousands (est.) |

Books concentrate on the first two levels, heavily on Sun signs, and thin out
fast after that. Nobody writes the three-part level exhaustively, which is why
the studio's combination questions exist.

## 2. The unit: a statement

A passage is split into statements, usually a sentence or two that make one
claim. Each statement carries:

| Field | Values | Example (Lundsted, Sun in Aries) |
|---|---|---|
| Subject factors | registry keys, with a role: subject, modifier, mentioned | `sign:sun:aries` (subject) |
| Context | natal, transit, synastry, … | natal |
| Theme | character, relationship, family, childhood, career, money, health and body, spirituality, events, timing, advice or remedy | family (the father) |
| Valence | positive, negative, mixed, neutral | mixed |
| Certainty | always, usually, may, rarely | usually ("tend to") |
| Condition | free text plus factor keys: "if well aspected", "when in the 10th", "in a woman's chart" | none |
| Frame | zodiac, house system, tradition | tropical; modern psychological |
| Source | book, author, edition, page, span offsets | Lundsted, via the Sun compilation |

Themes reuse the ~90 topics in `packages/astro/src/keywords/domains.ts`
grouped into the dozen above, so the keyword engine and the corpus share one
vocabulary of meaning.

## 3. How a book is read

Four passes, cheapest first. Each records how every label was obtained
(`rule`, `model`, `human`) so disagreements are visible.

**Pass 1 — normalise** (rules, no cost)
- Glyphs to words: ☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ ☊ ☋ ⚷, ♈–♓, ☌ ⚹ □ △ ☍ ⚻ ⚺ ∠ ⚼, ℞.
- Abbreviations: Su, Mo, Me, Ve, Ma, Ju, Sa, Ur, Ne, Pl; Asc, MC, IC, Dsc; cnj, sxt, sq, tri, opp, qcx.
- Synonyms: Sol, Luna, the luminaries, the lights; Dragon's Head / Tail, Rahu, Ketu; the greater / lesser benefic, the greater / lesser malefic; house names ("house of marriage", "house of death"); ordinal words; adjectives (Martian, Saturnine, Jovial, Venusian, Mercurial, lunar, solar, Arian, Leonine …).
- Midpoint notation (Sun/Moon) is kept apart from aspect notation ("Sun-Moon square").
- Page furniture, hyphenation, footnotes out.

**Pass 2 — structure and inheritance** (rules)
- Headings are the strongest signal. A passage inherits the factors of every heading above it until a heading of the same level changes them. Under "Natal Sun in Aries", "Aries people are thoughtless" is tagged `sign:sun:aries` although it never names the Sun.
- A sentence that names another factor adds it as a modifier ("…especially if Mars is in the 10th").
- Context cues set the context: "transiting", "progressed", "in synastry", "your partner's", "return", "horary".
- The existing tagger (`src/tagger.ts`) does the factor part for questions; this pass generalises it to prose and adds inheritance.
- Per-book profiles hold the heading patterns; most books fall into six or seven layouts.

**Pass 3 — statements and labels** (Claude, batch)
- For each passage: split into statements, resolve "it", "this placement", "these natives" to factors, and fill theme, valence, certainty and condition as structured output.
- Only fields pass 2 could not settle are asked for; the pass 2 tags are given to the model as the starting point.
- Scale (est.): about 16 million tokens for a hundred books. At batch rates, labelling everything with a large model is tens of dollars; with a small model, a few dollars. A sample of 200 passages is labelled both ways first and checked by hand before choosing.

**Pass 4 — human** (studio Tag queue)
- Passages where the rules and the model disagree on subject factors, and a random sample of the rest, go to the Tag lever.
- Each correction is kept, and becomes a test case for the next version of the tagger.

## 4. Storage

Passages stay in `astro_texts` (with `parent_id` to the chapter). Statements
and their factor links get two new tables (a migration when built):

```
astro_statements   id, text_id, start, end, body, context, theme, valence, certainty,
                   condition, condition_keys text[], frame jsonb, labelled_by, model, created_at
astro_statement_factors
                   statement_id, factor_key, role (subject | modifier | mentioned),
                   point, other_point, sign, house, aspect, kind
```

The decomposed columns (`point`, `sign`, `house`, `aspect`) make partial
lookups plain SQL: every statement about the Sun in any sign
(`point = 'sun' AND kind = 'sign'`), the Sun in any aspect to Saturn, anything
about the 7th house by any planet. The factor key alone would need pattern
matching.

## 5. What comes out

- **Factor dossier.** For any key, or any partial pattern: every statement,
  grouped by context and theme, each with author, book and page. This is what
  the helper is given as reference material and what the studio shows beside a
  question.
- **Agreement and contradiction.** Statements on one factor are clustered by
  meaning (embeddings, section D of the Studio brief). Large clusters across
  several authors are the consensus; a statement contradicted by another
  author's becomes a compare question in the studio ("Two authors disagree
  about Venus in Scorpio; which is closer?").
- **Theme view.** Every statement about marriage, across all factors, for the
  area-of-life questions.
- **Coverage map.** Statement counts per factor show where books are thick
  (Sun signs) and thin (Chiron quincunx the Node), which is where the owners'
  own writing adds most.
- **Traceability.** Any sentence the assistant produces can be traced to the
  statements it was shown.

## 6. Rules and constraints

- Keep sidereal (Vedic) statements apart by frame: a sidereal Moon in Aries is
  about 24° from a tropical one, so the two must never share a key without the
  frame.
- Keep context on every statement: "Saturn conjunct the Sun" means different
  things natal, in transit and in synastry.
- Keep tables and keyword lists as data rows, not statements.
- Record licence per book; modern books are reference-only by default, and
  works published before 1930 (US public domain) may be marked trainable.
- Remove near-duplicates before counting agreement: compilations quote the
  same authors, and a passage copied into three books is one opinion.

## 7. Built so far (2026-09-27)

- Tagger additions in `packages/astro-corpus/src/tagger.ts`: glyph
  normalisation (`normalizeAstro`), bare mentions as `planet:`, `zodiac:`,
  `realm:`, `aspect-type:` (`{ mentions: true }`), heading inheritance
  (`tagWithHeadings`); compatibility tags need a compatibility word in the
  same sentence. Smoke test: 8 checks pass.
- `scripts/tag-jsonl.ts`: JSON-lines in, tagged JSON-lines out, with the
  decomposed columns per tag and `tagger_version`.
- `scripts/build-tagger.mjs` (`build:tagger`): bundles the tagger into
  `dist/astro-tagger.mjs` (50 KB, plain Node 18+, only `node:readline`), for
  the book-ingestion pipeline on Ubuntu/WSL. Package with registry JSON,
  README and Python wrapper: `~/astro-corpus/dist/astro-tagger-<version>.zip`.
- Trial on the Sun compilation, 1,450 paragraph chunks with headings: 1,447
  carry a specific factor; 441 are about the Sun in an aspect. The bundle
  run with the host's glibc Node gave identical tags to the in-repo tagger on
  all 1,450 (2026-09-27, version `2026-09-27+878b6a4dab`).

- Book import from the chunker pipeline (Ubuntu/WSL; its schema is
  `SCHEMA.md` at the repo root, 2026-09-27): the pipeline runs
  `export-for-studio.sh` (in the astro-tagger package) and copies the archive
  to `~/astro-corpus/inbox/`; `scripts/import-chunker.ts` imports books with
  status `tagged` as sources of kind `book` (licence unknown, not trainable),
  chunks as texts with pages and headings in `astro_texts.meta`, tags as factor
  links; duplicates across books are skipped by normalised-text hash.
  Verified with a test bundle built from the Sun chunks: dry run, and a trial
  that wrote 1,450 texts and 1,929 tags and skipped 25 duplicates inside a
  transaction, then rolled back (0 book sources afterwards). The export
  script was tested against a stub `psql`, not the real chunker database.
- Migration 176 (`astro_texts.meta`) is written, not applied: the runner
  would also apply 174, which belongs to another session and is pending on
  purpose. `--write` refuses until 176 is applied.
- Book sources are excluded from the helper AI's reference passages (owner
  decision, 2026-09-27; `referencesFor` in `src/helper.ts`).

## 8. Open items

- Pilot on the Sun compilation already on disk
  (`astrologychart2/examples/SUN.txt`: 1.2 MB, 53 entries, 265 author
  passages; parsed by `packages/astro/src/keywords/corpus.ts`), then on 3–5
  books chosen by the owners to cover the main layouts.
- Registry additions for the points, aspects, contexts, conditions, relations
  and configurations marked "no" in section 1.
- Choose the pass 3 model after the 200-passage comparison.
- pgvector and the embedding model (Studio brief, section D).
