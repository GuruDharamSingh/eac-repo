# Astro Studio: a corpus, a review app and a training loop for an astrologer AI

Design brief, 2026-09-26; phase 1 started 2026-09-26 (see Status). Covers the machine that turns astrological source
texts and the developer's own judgements into a graded, exportable dataset, and
the phone-first review app that collects those judgements. Decisions below were
made by the developer on 2026-09-26. Nothing in this brief is built. Current
state was established by reading `packages/astro` and the memory notes; the
database was not queried (the Docker socket is not reachable from the session
that wrote this).

## Summary

Elastrocal (`apps/elastrocal`, `arts-collective.com/astro`) already computes
charts and holds a Rosicrucian keyword engine. The next layer is a corpus of
interpretations keyed to a machine-readable taxonomy of chart factors, a queue
of questions about those factors, candidate answers from several sources, and
a review surface where the developer grades, edits and writes answers on a
phone. Everything reviewed is exported in the standard fine-tuning and
preference formats and scored against a held-out set. The model side starts as
a retrieval assistant on an existing model and becomes a fine-tuned model only
when the data justifies it. The domain lives in one new package and one
members-only section of the app, with no dependency on the network's org
tables beyond sign-in, so it can be lifted out of the monorepo later.

## Status (2026-09-26)

Phases 1 and 2 are live. Migration 167 applied 2026-09-26; `astro_factors`
seeded (2,328 rows, 19 impossible); both Hugging Face sources imported: 7,340
questions, 6,794 imported answers as candidates (verified by SQL count).

Phase 2, the review deck, is at `arts-collective.com/astro/hub/studio`
(owners of `elastrocal` only, `requireStudioReviewer` in
`apps/elastrocal/src/lib/auth.ts`):
- `/hub/studio`: queue by kind, own review counts, coverage (gold / asked /
  factors per kind), sources with licence and training status.
- `/hub/studio/deck[?kind=]`: one question at a time; levers Pick, Rate, Fix,
  Write, More (skip, flag, tags); preference/claim toggle kept in
  localStorage. Sign and house questions get a second candidate from the
  keyword engine (`packages/astro-corpus/src/engine.ts`), created on first
  showing. Queue and review writes: `packages/astro-corpus/src/studio.ts`;
  server action `apps/elastrocal/src/app/hub/studio/actions.ts`.
- Verified 2026-09-26 with a temporary owner test account (since deleted
  with its rows), headless Chrome at 390 px: studio and deck render with no
  console errors; Pick stored a review with winner, reason, stance, seconds,
  device `phone` and shown order; Write stored an `own` text tagged
  `house:jupiter:8` (confidence `human`) and linked it as a candidate; the
  deck advanced after each save. Rate, Fix, Tag, Flag and Skip were rendered
  but not submitted. Contrast was not measured (existing app tokens only).
- `next.config.ts` now sets `devIndicators: false`: the app is served from
  `next dev` and the badge covered the first lever.

Phases 3 and 4, started 2026-09-26 (late):
- Export (`packages/astro-corpus/src/export.ts`, `scripts/export.ts`):
  TRL conversational SFT and explicit-prompt preference files, train and
  held-out splits by question (sha256 of the question id, about 10%), a
  `trainable/` subset, manifest, `astro_snapshots` row. Pair direction is
  tested in the smoke test (pick winner over each other candidate shown; tie
  gives none; fix beats its source; ratings give a pair only at a mean
  difference of 1.5 or more; a later review of the same text by the same
  reviewer replaces the earlier one). Verified 2026-09-26: runs against the
  live tables; no reviews exist yet, so all files were empty.
- Helper AI (`src/helper.ts`, `scripts/draft.ts`): drafts through the Message
  Batches API with `claude-opus-5`, structured output `{tradition, answer}`,
  reference passages per factor (full-text search for untagged questions),
  stored as `generated` candidates with model, prompt hash, references, batch
  id and token usage. Not yet run: the API key in `.env` is organisation-level
  and the API requires `ANTHROPIC_WORKSPACE_ID` (2026-09-26). Both variables
  are passed to the `admin` and `elastrocal` services in `docker-compose.yml`.

Test set and scoring, 2026-09-26 (late):
- Fixed test set `v1`: 150 curated questions, stratified by pattern
  (`src/eval-set.ts`, `scripts/eval-set.ts`), marked in
  `astro_questions.meta.evalSet`. Replaces the random 10% split. The deck
  serves them first, Write only, with no candidates, engine reading or earlier
  answers shown; the studio page shows progress. They are excluded from helper
  drafting and every text attached to them is excluded from reference
  passages (verified with a dry run: the test answer was not among the
  references).
- Export splits by test-set membership and adds `kto.jsonl` (TRL unpaired
  format) from ratings: mean 4 or more good, 2.5 or less bad.
- Scoring (`src/evaluate.ts`, `src/scoring.ts`, `scripts/eval.ts`): the
  assistant (prompt `assistant-v1`) answers each test question with reference
  passages; a judge (`judge-v1`) grades it against the owner's answer (main
  points all/most/some/none, contradiction, specificity, fatalism; pass = all
  or most and no contradiction) and compares the two blind in both orders.
  Modes `--dry-run`, `--calibrate` (owner answers should pass, three junk
  answers per case should fail), default run; errors, truncations and refusals
  kept apart; served model checked on every call; per-row usage and cost.
  Design follows the Claude API skill's eval checklist and TRL's dataset
  formats (both read 2026-09-26). Not yet run: needs owner answers and
  `ANTHROPIC_WORKSPACE_ID`.

The loop (next layers, not built):
1. Collect: owners answer the test set, then review drafts and imports.
2. Calibrate: run `--calibrate`; then compare judge verdicts with the owners'
   own Picks on the same pairs; iterate the judge prompt until agreement is
   high on clear cases.
3. Synthesis: rewrite the drafting and assistant prompts from the owners'
   Pick reasons, Fix edits and flags (`draft-v2`, `assistant-v2`).
4. Re-score on the same test set; keep the version that scores higher.
5. New drafts from the better version go back into the deck; repeat. Fine-tune
   when prompt changes stop moving the score.
Not built for this loop: the judge-vs-Picks agreement report, and the
chunker for long source texts (section C).

Curated question sets, 2026-09-26 (dev request): 1,136 questions, origin
`curated`, generated by `packages/astro-corpus/src/question-sets.ts` and
inserted by `scripts/import-curated.ts`.
- 1,016 combinations across 12 patterns: planet alone (56), sign alone (48),
  aspect alone (36), sign on a house cusp (36), planet in sign (100), in house
  (100), in sign and house (120), aspect between bare planets (120), with one
  planet in a sign (100), both in signs (100), placed planet aspecting a
  planet in a sign (120), both in signs and houses (80). Attitude and
  compare-and-contrast wordings included. Tested: no impossible or unobserved
  aspect; two planets in an aspect sit the aspect's sign distance apart;
  Neptune and Pluto only in signs occupied 1900–2030; outer–outer pairs
  asked without signs.
- 120 hand-written area-of-life questions, ten per house.
- Registry grew to 2,375 factors: kinds `planet`, `zodiac`, `realm`,
  `aspect-type` added.
- The deck draws curated three times for every other question
  (`QUEUE_MIX` in `src/studio.ts`; 400 draws gave 291 curated / 109
  imported). A "Curated" filter chip shows only this set. The helper drafts
  curated questions first.

Phase 1 components:

- `packages/astro-corpus` (`@elkdonis/astro-corpus`, source export): factor
  registry (`src/factors.ts`), tagger (`src/tagger.ts`), question screening
  (`src/questions.ts`), DB access (`src/server.ts`), scripts `smoke`,
  `scan-aspects`, `extract-questions`, `seed-factors`, `import-hf`.
  Verified: `tsc --noEmit` clean; smoke test 4 checks (registry sizes, 19
  impossible aspects, 24 tagger phrasings, question screening).
- Registry: 2,328 factors — sign 168, house 144, aspect 810, transit 840,
  transit-sign 144, transit-house 144, compat 78. `src/aspect-occurrence.ts`
  generated by casting the sky every 2 days 1800–2200 (73,049 charts): 19
  impossible aspects (Sun–Mercury beyond the conjunction; Sun–Venus beyond the
  semisquare; Mercury–Venus beyond the sextile, maximum separation 73.8°).
- Questions extracted to `~/astro-corpus/derived/questions.jsonl`: 7,340
  (6,794 from the dialogs set after dropping 1,005 not about astrology, 551
  tied to their source text and 61 duplicates, with 413 rescued by removing
  "according to the text"; 546 compatibility questions). 2,267 carry factor
  tags, covering 912 factors; 5,073 are general technique questions.
- Migration 167 (`167_astro_studio_corpus.sql`): applied 2026-09-26.

## Decisions (dev, 2026-09-26)

1. **Traditions are several and tagged.** Rosicrucian/Heindel, modern
   psychological, Hellenistic and others coexist; every text and every grade
   carries a tradition tag, and one tradition is never marked wrong against
   another.
2. **Graders are the astro app owners** (`elastrocal` org owners, two accounts
   today). Other members and the public are out of scope until asked.
3. **Imported material**: the developer's Hugging Face datasets and any text
   supplied later. Each import is recorded with its licence; the export step
   filters on it.
4. **The taxonomy adds the factors the book index left out** (angles by sign;
   North Node and Chiron by sign and house) and **keeps every aspect separate**;
   the book's grouped chapters (trine / sextile) are a display convention.
5. **End goal is open.** The retrieval assistant comes first; whether a
   fine-tuned model follows is decided from the evaluation numbers.
6. **The developer's main instrument is a phone.** Review must work in short
   sessions on a small screen, including dictation for original text.
7. The developer marks a response as preference or as an objective claim where
   the distinction matters; the review record keeps that flag.

## Current state (2026-09-26)

- Engine: `packages/astro/src/constants.ts` defines 12 bodies (10 planets,
  North Node, Chiron), 12 signs, 12 houses, 9 aspects (conjunction, sextile,
  square, trine, opposition, quincunx, semisextile, semisquare, sesquisquare)
  with orbs. Aspects to the Ascendant and Midheaven are computed
  (`aspects.ts`, ENGINE_VERSION 4). Angle–angle aspects are skipped.
- Keyword engine: `packages/astro/src/keywords/` (Heindel's method; design in
  `packages/astro/KEYWORDS.md`). `corpus.ts` parses one-file-per-planet
  compilations of attributed passages ("Natal Sun in Aries", "(Betty
  Lundsted)") and ranks them beside the keyword reading. Corpus files stay
  outside the repo.
- Storage: `astro_charts` (migrations 117, 119, 120) holds birth data and a
  computed cache, owned by a user or a guest cookie. No interpretation tables.
- App: `/`, `/calculate`, `/charts`, `/charts/[id]`, `/hub`, `/people`,
  `/services` under basePath `/astro`. Chart page renders the keyword reading
  client-side (`components/chart/reading.tsx`). The service is not running as
  of 2026-09-26 (`docs/reference/apps.md`).
- Keys: `.env` holds no Anthropic, OpenAI or Voyage key (grep, 2026-09-26).
- Postgres image is `postgres:16-alpine` (`docker-compose.yml:6`), which does
  not ship the `vector` extension (assumed from the official image contents;
  verify with `select name from pg_available_extensions where name='vector'`).
- The book index supplied on 2026-09-26 (845 entries) double-counts pairs
  (Moon–Mercury appears under both), omits angles and points by sign/house,
  and includes about 19 aspect entries that cannot occur (Sun–Mercury beyond
  the conjunction, Sun–Venus beyond the semisquare, Mercury–Venus beyond the
  sextile). It is superseded by the generated registry below.

## Parts of the machine

Each part: what it is for, what goes in, what comes out, where it lives.

### A. Factor registry (the taxonomy)

Purpose: one stable key per thing an interpretation can be about, so a saved
chart, an imported passage, a question and a grade all point at the same row.

Generated by code from the engine's constants, not hand-written:

| kind | count | key shape |
|---|---|---|
| point in sign | 14 × 12 = 168 | `sign:moon:scorpio`, `sign:asc:leo` |
| point in house | 12 × 12 = 144 (angles have no house) | `house:venus:7` |
| pair by aspect | 90 pairs × 9 aspects = 810 (19 impossible) | `aspect:mars:saturn:square` |
| transiting body to natal point, majors | 12 × 14 × 5 = 840 | `transit:saturn:sun:conjunction` |
| transiting body through a sign / a house | 144 + 144 | `transit-sign:uranus:taurus`, `transit-house:saturn:5` |
| sun-sign compatibility, unordered | 78 | `compat:aries:virgo` |
| sign ruler in house, retrograde, dignity, element/modality balance | later | `rule:asc:mars:10`, `retro:mercury` |

Pairs are unordered and canonical (engine body order), which removes the
index's duplicates. Each row carries: `label` (display text), `group`
(personal / social / generational / point / angle), `generational` flag (outer
planet by sign, outer–outer aspects: shared by everyone born within years, so
low weight for an individual reading), `impossible` flag (set by scanning the
ephemeris over 1800–2100 with the engine's orbs; never shown, never trained
on), and `book_group` (the "trine / sextile" chapter a passage was filed under
when the source only distinguished that far).

Lives in `packages/astro-corpus/src/factors.ts` (pure TS, exported for the
app and for scripts; built 2026-09-26) and is mirrored into `astro_factors` by a seed script so
SQL can join on it. Charts map to factors by a function
`factorsOf(chart): FactorKey[]` in the same file.

### B. Source library (ingestion)

Purpose: every text the machine will ever show, quote, retrieve or train on,
with its origin recorded once.

- `astro_sources`: one row per import — title, author or compiler, kind
  (book, dataset, compilation, own, generated), licence (SPDX id or
  `unknown` / `all-rights-reserved`), `trainable` boolean derived from the
  licence, URL, date imported, importer version.
- `astro_texts`: the unit of content. Columns: `source_id`, `kind`
  (`import` / `own` / `engine` / `generated` / `edit`), `tradition`, `author`,
  `body`, `parent_id` (for chunks of a long passage), `model`, `prompt_hash`
  and `generated_from` (for generated texts), `derived_from` (for edits),
  `created_by`.
- `astro_text_factors`: many-to-many with `role` (`primary` / `mentioned`), so
  a passage about Sun conjunct Moon in Aries is primary on two factors.

Importers, one per shape, each a script under `packages/astro-corpus/scripts`:

1. **Compilation files** (the `SUN.txt` family): reuse `corpus.ts`'s parser,
   write rows instead of an in-memory index.
2. **Hugging Face datasets**: read parquet/JSON with a small Node reader;
   map columns (`instruction`/`question`, `output`/`answer`, any
   `chart`/`placement` field) to a question row plus a text row; run the
   factor tagger (below) over the question text. Record whether the dataset
   card says the rows were model-generated: those are candidates to grade,
   not gold. Of the public astrology datasets checked on 2026-09-26, one is a
   1M-row Vedic template set (jyotish-llm-sft), one is 16 model-generated
   Q&A rows (adaption-astro-insights-qa), and two have empty or broken cards
   (fivetech/astrology, Vignes/large-astrology-model-dataset); the developer's
   own datasets are to be named.
3. **Pasted text**: a studio form — paste, name the source, tag the factor(s).
4. **Books**: a markdown transcription split by headings, then by factor
   tagger; stays outside the repo until licence is known.

**Factor tagger**: a deterministic pass that finds "Natal Sun in Aries",
"Mars square Saturn", "Venus in the 7th" in a text and returns factor keys. It
is the same vocabulary the engine already formats, run backwards. Anything
the tagger cannot place goes to a "tag me" queue in the studio (lever 5).

### C. Chunker

Superseded in detail by `docs/open/ASTRO_DIGESTION_BRIEF_2026-09-27.md` (statement-level digestion by the astrological vocabulary, 2026-09-27).

Purpose: make units small enough to retrieve and grade, without cutting an
author's argument in half.

Rule: **the natural unit is one author's passage about one factor**, which is
what the compilations already provide and what the tagger produces from
books. Only passages over about 500 tokens are split, recursively at
paragraph then sentence boundaries, with `parent_id` kept so the whole
passage can be shown on demand. This follows the 2026 comparisons in which
recursive structural splitting at roughly 512 tokens outperformed semantic
chunking on end-to-end answer accuracy, and sentence-level splitting matched
semantic splitting on small corpora. Semantic or late chunking is not planned;
revisit only if retrieval metrics show a problem.

### D. Retrieval

Purpose: given a factor or a free-text question, return the texts to show
beside it — for the review screen, for the helper AI's context, and later for
the public "Ask".

Two tiers, the second added only when needed:

1. **Key lookup + full-text search.** For a corpus whose rows are already
   tagged by factor, the factor key is the index. Free-text questions go
   through `tsvector` full-text search with `pg_trgm` for misspellings, plus
   the keyword engine's domain vectors (`keywords/domains.ts`), which already
   map question words to topics. No new extension required.
2. **Embeddings**, when free-text questions ("why do I keep doing X")
   outgrow tier 1. Options, in order of preference:
   - Embedding provider: Voyage AI is the provider Anthropic's documentation
     names for use with Claude; its account tier includes a free token
     allowance that covers a corpus of this size many times over. A local
     model in a CPU container (nomic-embed-text or bge-small via Ollama or
     sentence-transformers) is the no-key alternative; a corpus of tens of
     thousands of chunks embeds in minutes on CPU.
   - Vector store: pgvector inside the existing Postgres (HNSW index,
     `halfvec` to halve memory) keeps one database to back up and lets
     vector search join on tradition, licence and factor filters. It needs
     the image changed to `pgvector/pgvector:pg16`, an ops decision because
     it recreates the Postgres container. Until then, storing the vector as
     `real[]` and ranking in TypeScript over a key-filtered candidate set is
     adequate: the filter reduces the set to hundreds of rows, and cosine
     over hundreds of 1024-float vectors is sub-millisecond. A dedicated
     vector database is not warranted at any size this project will reach.

### E. Question queue

Purpose: decide what the developer looks at next, so every minute of grading
lands where the corpus is weakest.

`astro_questions`: `type`, `factor_keys[]`, `chart_id` (nullable), `prompt`,
`priority`, `status`, `source` (generator name or `import`).

Types, fixed and few:

| type | prompt shape | yields |
|---|---|---|
| `interpret` | "Interpret Mars square Saturn." | gold text |
| `modify` | "How does Mars square Saturn change when Mars is in Cancer / in the 10th?" | combination text |
| `combine` | "Read Sun in Leo with Sun in the 12th together." | combination text |
| `compare` | two candidates for one factor | preference pair |
| `correct` | one candidate | edit → gold + pair |
| `ask` | free question from the developer or a chart | assistant answer to grade |
| `tag` | untagged passage | factor keys, tradition |

Priority: coverage gap (factor with no gold text) > real-chart placement
(factors present in saved charts, weighted by how often) > disagreement
(candidates the judge scores far apart, or a source contradicting gold) >
generational and minor-aspect factors last. The helper AI proposes questions
of the `modify`/`combine`/`ask` types; proposals enter the queue with
`source = 'helper'` and are subject to the same priority.

### F. Candidate generation

Purpose: put two to four answers in front of the developer so the work is
choosing and correcting, not composing from nothing.

Per question, in this order of cost:

1. **Sources**: the top texts by factor key and tradition (free).
2. **Keyword engine**: the Rosicrucian reading for that factor (free,
   deterministic, always tradition = rosicrucian).
3. **Helper AI**: a draft from Claude given the rubric, the sources retrieved
   for the factor, and the developer's gold texts for neighbouring factors as
   examples. Bulk drafting runs through the Message Batches API (asynchronous,
   half price); the rubric and source bundle sit in a cached prefix. Each
   draft records model id, prompt hash and the source ids it was shown.
4. **Own**: an empty slot, dictation-friendly.

Candidates are `astro_texts` rows with `kind = generated | engine | import`
and a link from `astro_candidates` (`question_id`, `text_id`, `position`).
The order shown is randomised per session and stored, because pairwise
graders (human and model) favour one position; this is documented in the
LLM-as-judge literature and is the reason both orders are recorded.

### G. Review (the levers)

Purpose: capture the developer's judgement in the forms that training and
evaluation can use, in sessions short enough for a phone.

Every action is one row in `astro_reviews`: `question_id`, `reviewer_id`,
`action`, `payload` (jsonb), `candidate_ids[]`, `shown_order[]`,
`stance` (`preference` / `claim`), `seconds`, `device`, `created_at`.
Nothing is updated in place; a later review of the same question is a new
row, so changes of mind are visible.

| lever | screen | one tap does | record |
|---|---|---|---|
| **Pick** | two candidates stacked, "A is better" / "B is better" / "same" | choose; optional reason chips: more specific, truer to the tradition, better written, less fatalistic | preference pair |
| **Rate** | one candidate, three sliders or 1–5 chips: faithful, specific, usable | score | criterion scores |
| **Fix** | one candidate in an editor, dictation allowed | edit and save | gold text (`kind = edit`, `derived_from`) + pair (edit beats original) |
| **Mark** | one candidate, select a span, tag it wrong / good / cut | span annotation | span record, used in the judge rubric |
| **Tag** | untagged passage, chips for factors and traditions | tag | `astro_text_factors` rows |
| **Write** | a factor with the sources beside it, empty box, dictation | write | gold text (`kind = own`) |
| **Ask** | question box; helper AI answers with citations | grade the answer with Pick/Rate/Fix | `ask` question + review |
| **Skip / Flag** | any item | skip, or flag impossible / duplicate / off-topic / not my tradition | flag |

Session design: a deck of ten to twenty items chosen by the queue; progress
kept server-side so a session resumes on any device; each item designed for
under thirty seconds except Fix and Write. The stance toggle (preference /
claim) sits on the same screen and defaults to the last value. A small
dashboard shows coverage by factor kind, items reviewed this week, and
judge–developer agreement.

These are Argilla's six question types (label, multi-label, rating, ranking,
span, text) rearranged for a phone; Argilla itself is not used because the
records must stay in this database, joined to charts and factors.

### H. Rubric and judge

Purpose: let a model pre-sort candidates so the developer's time goes to the
close calls, without letting the model's taste replace the developer's.

- The rubric is written from the developer's own Pick reasons and Mark spans
  after the first few hundred reviews, not before; a rubric written first
  would be the model's rubric.
- The judge is Claude with the rubric, run on every candidate pair twice with
  the order swapped, averaged (the standard position-bias correction).
- Agreement between judge and developer on a rolling sample of Pick actions
  is the calibration metric; it is shown on the dashboard. Pre-sorting is
  switched on only once agreement is stable, and the judge's opinion is never
  shown before the developer has answered.

### I. Export

Purpose: turn the review tables into files a trainer or an evaluator reads.

`packages/astro-corpus/scripts/export.ts` writes a versioned snapshot
directory outside the repo (`~/eac-astro-exports/<date>/`) with:

- `sft.jsonl` — conversational format: `{"messages":[{"role":"user",...},{"role":"assistant",...}]}`, one per gold text with its question as the prompt; filtered to `trainable` sources.
- `dpo.jsonl` — `{"prompt":[...],"chosen":[...],"rejected":[...]}` (TRL explicit-prompt format), one per Pick or Fix.
- `eval.jsonl` — a fixed held-out set drawn once and never added to `sft` or `dpo`; new factors are assigned to it at a fixed ratio when their first gold text arrives.
- `manifest.json` — counts, factor coverage, licence tally, tradition tally, source ids, git commit, export version.

No birth data or chart ids leave the database; questions generated from a
chart are exported with the factor keys only.

### J. Evaluation

Purpose: one number per snapshot that says whether anything improved.

- Run the current model (retrieval assistant now, fine-tuned model later) on
  `eval.jsonl`; score each answer with the calibrated judge against the gold
  text; the developer spot-grades a random ten percent through the normal
  Ask lever, which also feeds back into calibration.
- Report: judge score, spot-grade score, agreement, per tradition and per
  factor kind. Kept in `docs/sessions/` per run.

### K. Model side

Phase 1, **retrieval assistant**: Claude given the rubric, the retrieved
sources and gold texts for the factors in question, answering with citations.
No training. This is the helper AI and the first public "Ask".

Phase 2, **fine-tuned model**, only if the evaluation plateaus or the
developer wants to own weights: an open-weight instruction model trained with
LoRA on `sft.jsonl`, then DPO on `dpo.jsonl`, using TRL. Needs a GPU for
hours, not days, at this data size: rent one for the run, or use a provider's
fine-tuning endpoint. The trained model then serves as a candidate generator
(stage F) and is compared to phase 1 on the same held-out set. A rough
threshold from practice: a few thousand gold examples and a few thousand
pairs before fine-tuning for domain and voice pays off.

### L. Surfacing on the site

- Members (`elastrocal` owners): `/astro/studio` — queue, review deck,
  source library, factor browser, dashboard, imports.
- Chart pages: every placement links to its factor page; "Ask about this
  chart" opens the assistant scoped to that chart's factors, with the
  answers citing sources; a "grade this" control for owners feeds the queue.
- Public factor pages (`/astro/factors/<key>`) show gold texts and quotable
  imported passages by tradition; drafts and ungraded generations never
  appear publicly.

## Data model sketch

```
astro_factors        key PK, kind, label, group, generational, impossible, book_group, meta jsonb
astro_sources        id, title, author, kind, licence, trainable, url, imported_at, importer_version, notes
astro_texts          id, source_id, kind, tradition, author, body, parent_id, model, prompt_hash,
                     generated_from jsonb, derived_from, created_by, created_at
astro_text_factors   text_id, factor_key, role
astro_questions      id, type, factor_keys text[], chart_id, prompt, priority, status, source, created_at
astro_candidates     question_id, text_id, position
astro_reviews        id, question_id, reviewer_id, action, payload jsonb, candidate_ids, shown_order,
                     stance, seconds, device, created_at
astro_snapshots      id, exported_at, path, manifest jsonb
```

One migration. All tables prefixed `astro_`; reviewer_id references `users`
only for identity. Store jsonb with `db.json()`.

## Rules and constraints

- Every text has a source and a licence before it is shown: the export filter
  depends on it, and a text without one cannot be used for training.
- Every generated text records model id, prompt hash and the source ids it
  saw: without this a draft cannot be told apart from the developer's writing
  later.
- Randomise and record candidate order: pairwise choices skew to one position.
- Tag tradition on texts and reviews; never score across traditions.
- Keep aspects separate; use `book_group` for display only.
- Never train on `impossible` factors; down-weight `generational` ones.
- Held-out set is written once and only grows; nothing moves out of it.
- Birth data stays in `astro_charts`; exports carry factor keys only.
- Keep the domain in `packages/astro-corpus` and `apps/elastrocal/src/app/studio`
  with no imports from org, feed or thread services beyond `getServerSession`
  and the owner check, so the whole thing can move out of the monorepo.
- Judge suggestions are hidden until the developer has answered.

## Phases

| phase | builds | needs | lets the developer |
|---|---|---|---|
| 0 | this brief | — | confirm direction |
| 1 | factor registry, migration, importers (compilations, HF, paste), tagger | nothing external | see coverage; import the datasets |
| 2 | studio deck with Pick / Rate / Fix / Tag / Write / Skip; candidates from sources + engine only | app running | start grading and writing on a phone with no API key |
| 3 | helper AI: drafts, question proposals, Ask; judge and calibration | Anthropic key; cost scales with drafts (an estimate at current prices: cents per question) | grade model drafts; ask questions |
| 4 | export, held-out set, evaluation run | — | see the first score |
| 5 | public factor pages and chart-page Ask | — | show it |
| 6 | fine-tune, if numbers justify | GPU rental or provider endpoint | compare the two models |

Phase 2 is usable before any key exists: imported passages and engine readings
are already two candidates per factor.

## Open items

- Hugging Face datasets named 2026-09-26; raw files in `~/astro-corpus/hf/`
  with provenance in `~/astro-corpus/README.md`:
  - `ocaklisemih/astrology_dialogs`: downloaded, 8412 two-turn Q&A rows, no
    licence stated (not trainable until clarified); candidates to grade.
  - `GuruDharamSingh/astrology-compatibility`: downloaded 2026-09-26, 14,400
    rows. 1,008 distinct prompts (sign pair × 7 life areas); outputs are
    random template fills that do not depend on the signs, and 965 prompts
    span more than one split. Use the prompts as questions for a sign-to-sign
    factor kind and the outputs as rejected-side or judge-test material, not
    as gold or SFT data.
  - Transit and compatibility kinds were added to the registry on
    2026-09-26 for these sources.
- Anthropic API key and a monthly spend cap (developer).
- pgvector: swap the Postgres image, or use the `real[]` fallback (ops
  decision; not needed before tier 2 retrieval).
- Whether the host has a GPU (unknown; only matters in phase 6).
- ~~Restarting elastrocal (3016) for phase 2.~~ Started 2026-09-26 (`docker compose up -d elastrocal`).
- Offline review (PWA with a local queue) — not planned; noted in case phone
  connectivity is a problem in practice.
- Heindel's *Simplified Scientific Astrology* pp. 98–99 and *Message of the
  Stars* chapters would replace the approximated conjunction table in
  `keywords/nature.ts` (from `project_rosicrucian_keywords`).

## Sources consulted (2026-09-26)

- Chunking comparisons: [Firecrawl](https://www.firecrawl.dev/blog/best-chunking-strategies-rag), [Denser](https://denser.ai/blog/rag-chunking-strategies/), [MachineLearningMastery](https://machinelearningmastery.com/7-chunking-strategies-that-decide-whether-your-rag-works/), [dreaming.press](https://dreaming.press/posts/best-chunking-strategy-for-rag.html)
- pgvector sizing: [pgvector README](https://github.com/pgvector/pgvector), [pgvector in production](https://bigdataboutique.com/blog/pgvector-in-production), [ParadeDB limitations](https://www.paradedb.com/learn/postgresql/pgvector-limitations)
- Embeddings for Claude: [Claude docs — Embeddings](https://platform.claude.com/docs/en/build-with-claude/embeddings)
- Annotation question types: [Argilla data model](https://docs.v1.argilla.io/en/latest/conceptual_guides/data_model.html)
- Export formats: [TRL dataset formats](https://github.com/huggingface/trl/blob/main/docs/source/dataset_formats.md), [DPO trainer](https://huggingface.co/docs/trl/dpo_trainer)
- Judge position bias and calibration: [Systematic study of position bias](https://aclanthology.org/2025.ijcnlp-long.18.pdf), [Justice or Prejudice?](https://llm-judge-bias.github.io/), [LLM-as-judge survey](https://www.sciencedirect.com/science/article/pii/S2666675825004564)
- Public astrology datasets: [jyotish-llm-sft](https://huggingface.co/datasets/AmareshHebbar/jyotish-llm-sft), [adaption-astro-insights-qa](https://huggingface.co/datasets/rodriguescarson/adaption-astro-insights-qa), [fivetech/astrology](https://huggingface.co/datasets/fivetech/astrology), [Vignes/large-astrology-model-dataset](https://huggingface.co/datasets/Vignes/large-astrology-model-dataset)
