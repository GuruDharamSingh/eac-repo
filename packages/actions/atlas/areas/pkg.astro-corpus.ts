import type { Area, Capability, Host, HostKey } from '../types';

// packages/astro-corpus: the astrology corpus (migration 167) behind Astro Studio. 2026-11-16, round 3.
// Conventions: atlas/JOURNAL.md. Two kinds of host live here:
//  - the STUDIO layer: record one review or one owner addition. The owner-only pages and the Jerusalem app call these
//    through apps/elastrocal (apps.elastrocal.ts: astro-* rows, gate requireStudioReviewer or ownerOrResponse);
//    each is an `internal` row with `drift: "backs apps.elastrocal.ts:<id>"`.
//  - the IMPORTERS: operator scripts (packages/astro-corpus/scripts/*.ts) that seed and fill the corpus; class admin.
// The corpus is single-tenant (org astro, ORG_ID in sources.ts) and its writes take a `reviewerId` from the caller: THIS
// layer does not check that the reviewer is an owner. The callers do (requireStudioReviewer / ownerOrResponse).

const SRC = 'packages/astro-corpus/src/';
const V = '2026-11-16 read packages/astro-corpus/src/{server,studio,reasoning,foundations,vocab,claims,library,ref-votes,helper,sources}.ts (the write functions and their checks); apps/elastrocal studio actions for callers';
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const ha = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: 'elastrocal', path, how }, note });
const hs = (key: HostKey, service: string[], how: string, note?: string): Host => ({ key, service, address: { app: 'astro-corpus', path: 'scripts', how }, note });
const OWNERS = 'Callers gate on the elastrocal org owner (requireStudioReviewer or ownerOrResponse); this function does not.';

const capabilities: Capability[] = [
  // ---------------- studio layer ----------------
  {
    id: 'pkg-astro-corpus-review-record',
    area: 'pkg.astro-corpus',
    label: 'Record a review-deck answer',
    does: 'Stores one reviewer move on a deck question (pick, rate, fix, write, tag, flag or skip) after checking every text id is a candidate of that question; a fix or a written text becomes a new astro_texts row of the reviewer’s own, with the question’s factor tags.',
    class: 'internal',
    actors: ['owner'],
    scope: 'other',
    hosts: [
      ha(sq('studio.ts', 'recordReview'), ['(raw INSERT astro_reviews, astro_text_factors, astro_candidates)'], '/hub/studio/deck', 'the lever buttons of the review deck; also the Jerusalem scenario sheet', OWNERS),
      ha(sq('studio.ts', 'saveText'), ['(raw INSERT astro_texts)'], '/hub/studio/deck', 'the Write my own and Fix buttons of the deck (the saveText closure inside recordReview)', 'text must be at least 10 characters; kind edit or own.'),
    ],
    status: 'an astro_reviews row for the reviewer, question and action exists; a fix or own text exists as astro_texts kind edit or own',
    risk: ['none'],
    drift: 'backs apps.elastrocal.ts:astro-question-review',
    canonical: '@elkdonis/astro-corpus/server#recordReview',
    open: 'GOOD: question must exist in the org; every candidate and shown id must be a candidate of the question (studio.ts:~300-306); the explanation quote is checked against the shown texts before anything is written. SECURITY (note): the layer takes reviewerId on trust (callers gate); the reasoning branch (isReasoningAction) is delegated to recordReasoningReview.',
    verified: V,
  },
  {
    id: 'pkg-astro-corpus-engine-candidate',
    area: 'pkg.astro-corpus',
    label: 'Add the keyword engine’s reading as a candidate',
    does: 'When a deck question has exactly one factor, makes sure the keyword engine’s own reading is among its candidate answers (upsert on source and factor key).',
    class: 'internal',
    actors: ['system'],
    scope: 'other',
    hosts: [
      ha(sq('studio.ts', 'ensureEngineCandidate'), ['(raw INSERT astro_texts, astro_text_factors, astro_candidates)'], '/hub/studio/deck', 'no control: runs when a deck question is picked for the reviewer', 'Idempotent (ON CONFLICT).'),
    ],
    status: 'an astro_texts kind engine row for the factor is a candidate of the question',
    risk: ['none'],
    drift: 'backs the review deck (apps.elastrocal.ts:astro-question-review)',
    open: 'A write on a read path: choosing the next question inserts rows. Overwrites the engine text body on conflict (so a later change to the keyword engine rewrites the candidate the reviewer sees).',
    verified: V,
  },
  {
    id: 'pkg-astro-corpus-reasoning-review',
    area: 'pkg.astro-corpus',
    label: 'Record a review of an interpretation chain, step or passage',
    does: 'Stores the owner’s verdict in the reasoning explorer (chain pick, chain verdict, step verdict, step add, reference mark).',
    class: 'internal',
    actors: ['owner'],
    scope: 'other',
    hosts: [
      ha(sq('reasoning.ts', 'recordReasoningReview'), ['(raw INSERT astro_reviews)'], '/hub/studio/interpret', 'the review buttons of the reasoning explorer', OWNERS),
    ],
    status: 'an astro_reviews row with a reasoning action and null question exists',
    risk: ['none'],
    drift: 'backs apps.elastrocal.ts:astro-reasoning-review (also reached through recordReview)',
    canonical: '@elkdonis/astro-corpus/server#recordReview',
    verified: V,
  },
  {
    id: 'pkg-astro-corpus-interpretation-write',
    area: 'pkg.astro-corpus',
    label: 'Start or re-run an interpretation',
    does: 'Saves the owner’s written interpretation of one of their charts (or of a deck question) as a queued job for the reasoning worker, or sets a finished or failed one back to queued to get more chains.',
    class: 'internal',
    actors: ['owner'],
    scope: 'other',
    hosts: [
      ha(sq('reasoning.ts', 'createInterpretation'), ['(raw INSERT astro_interpretations)'], '/hub/studio/interpret', 'the Interpret form', OWNERS + ' The chart must be the author’s (ownedChart).'),
      ha(sq('reasoning.ts', 'createQuestionInterpretation'), ['(raw INSERT astro_interpretations)'], '/hub/studio/deck', 'the Explain my thinking button of the deck', OWNERS),
      ha(sq('reasoning.ts', 'requeueInterpretation'), ['(raw UPDATE astro_interpretations)'], '/hub/studio/interpret', 'the Run again button of an interpretation', 'UPDATE is by id AND author_id AND org AND status ready or failed: ownership is in the SQL.'),
    ],
    status: 'an astro_interpretations row for the author exists with status queued',
    risk: ['none'],
    drift: 'backs apps.elastrocal.ts:astro-interpretation-create, astro-question-interpretation-create and astro-interpretation-requeue',
    open: 'GOOD: requeue is owner-scoped in the statement itself. The text is limited to a length range (INTERPRETATION_MIN/MAX). The worker that fills the chains lives outside this package (WSL chunker), not mapped here.',
    verified: V,
  },
  {
    id: 'pkg-astro-corpus-chart-cache',
    area: 'pkg.astro-corpus',
    label: 'Refresh a chart’s cached calculation',
    does: 'When an owned chart’s stored calculation is from an older engine version, recomputes it and writes the cache back.',
    class: 'system',
    actors: ['system'],
    scope: 'person',
    hosts: [
      ha(sq('reasoning.ts', 'ownedChart'), ['(raw UPDATE astro_charts computed)'], '/hub/studio/interpret', 'no control: runs while an interpretation is read or written', 'Scoped to owner_id and org; failures are logged and ignored.'),
    ],
    status: 'astro_charts.computed_version equals the current engine version for the chart',
    risk: ['none'],
    drift: 'backs the chart reads of apps.elastrocal.ts (astro-interpretation-create)',
    verified: V,
  },
  {
    id: 'pkg-astro-corpus-foundation-review',
    area: 'pkg.astro-corpus',
    label: 'Record a foundations review',
    does: 'Stores one owner move on the foundations shelf (confirm, change, merge, withdraw, undo ...) after checking the lesson and idea exist.',
    class: 'internal',
    actors: ['owner'],
    scope: 'other',
    hosts: [
      ha(sq('foundations.ts', 'recordFoundationReview'), ['(raw INSERT astro_reviews)'], '/hub/studio/foundations', 'the item controls of Foundations', OWNERS),
    ],
    status: 'an astro_reviews row with a foundation action exists',
    risk: ['none'],
    drift: 'backs apps.elastrocal.ts:astro-foundation-review',
    verified: V,
  },
  {
    id: 'pkg-astro-corpus-foundation-add',
    area: 'pkg.astro-corpus',
    label: 'Add or withdraw an item of the owner’s own in foundations',
    does: 'Adds a trait, image or note of the owner’s own to a concept or a value to a cell of the correspondence table (a repeat is not duplicated); undoing deletes the row only when no other review points at it and it is the owner’s own.',
    class: 'internal',
    actors: ['owner'],
    scope: 'other',
    hosts: [
      ha(sq('foundations.ts', 'addFoundationItem'), ['(raw INSERT astro_foundation_items, astro_reviews)'], '/hub/studio/foundations', 'the Add box under a concept', OWNERS),
      ha(sq('foundations.ts', 'dropAddedItem'), ['(raw DELETE astro_foundation_items)'], '/hub/studio/foundations', 'the Undo of an added item', 'DELETE only WHERE origin = owner and nothing else refers to it (foundations.ts:~480-490).'),
      ha(sq('foundations.ts', 'addCorrespondenceCell'), ['(raw INSERT astro_correspondences, astro_reviews)'], '/hub/studio/foundations/correspondences', 'the cell editor of the correspondence table', OWNERS),
      ha(sq('foundations.ts', 'dropAddedCell'), ['(raw DELETE astro_correspondences)'], '/hub/studio/foundations/correspondences', 'the Undo of an added cell value', 'DELETE only WHERE origin = owner and nothing else refers to it.'),
    ],
    status: 'an astro_foundation_items or astro_correspondences row with origin owner exists, or is gone after undo',
    risk: ['irreversible'],
    drift: 'backs apps.elastrocal.ts:astro-foundation-item-add and astro-correspondence-cell-add',
    open: 'GOOD: both deletes are guarded by origin = owner and a reference count, so an undo cannot remove the books’ rows.',
    verified: V,
  },
  {
    id: 'pkg-astro-corpus-vocab-write',
    area: 'pkg.astro-corpus',
    label: 'Sort, add or withdraw a vocabulary term',
    does: 'Records a sorting move on a vocabulary card, adds a term of the owner’s own as a new card (typed, or taken from an example sentence), and on undo deletes the card when only the owner’s addition remains.',
    class: 'internal',
    actors: ['owner'],
    scope: 'other',
    hosts: [
      ha(sq('vocab.ts', 'recordVocabReview'), ['(raw INSERT astro_reviews)'], '/hub/studio/vocabulary', 'the sorting board', OWNERS),
      ha(sq('vocab.ts', 'addVocabTerm'), ['(raw INSERT astro_vocab_cards, astro_reviews)'], '/hub/studio/vocabulary', 'the Add a term box', OWNERS),
      ha(sq('vocab.ts', 'dropAddedCard'), ['(raw DELETE astro_vocab_cards)'], '/hub/studio/vocabulary', 'the Undo of an added term', 'DELETE only WHERE batch = owner and no review refers to it.'),
    ],
    status: 'an astro_reviews row exists for the move; an astro_vocab_cards row with batch owner exists or is gone after undo',
    risk: ['irreversible'],
    drift: 'backs apps.elastrocal.ts:astro-vocab-review and astro-vocab-term-add (and the vocab deck of the Jerusalem app)',
    verified: V,
  },
  {
    id: 'pkg-astro-corpus-claim-review',
    area: 'pkg.astro-corpus',
    label: 'Record a check of an AI claim',
    does: 'Stores the owner’s verdict on one claim extracted from a passage, after checking the passage is an imported text and the claim and its tags belong to it.',
    class: 'internal',
    actors: ['owner'],
    scope: 'other',
    hosts: [
      ha(sq('claims.ts', 'recordClaimReview'), ['(raw INSERT astro_reviews)'], '/hub/studio/claims', 'the claim cards of Check AI claims; also the claims deck of the Jerusalem app', OWNERS),
    ],
    status: 'an astro_reviews row with a claim action exists',
    risk: ['none'],
    drift: 'backs apps.elastrocal.ts:astro-claim-review',
    open: 'GOOD: passage, statement and the tags added or removed are all checked against the database before the insert (claims.ts:313-326).',
    verified: V,
  },
  {
    id: 'pkg-astro-corpus-library-note',
    area: 'pkg.astro-corpus',
    label: 'Record a library note',
    does: 'Stores a standing note on a library entry (append-only; an empty text removes the standing note).',
    class: 'internal',
    actors: ['owner'],
    scope: 'other',
    hosts: [
      ha(sq('library.ts', 'recordLibraryNote'), ['(raw INSERT astro_reviews)'], '/hub/studio/library', 'the note box of a library entry', OWNERS),
    ],
    status: 'an astro_reviews row with the library note action exists',
    risk: ['none'],
    drift: 'backs apps.elastrocal.ts:astro-library-note',
    open: 'The payload goes through cleanLibraryNote (library-rules.ts, not re-read here); the target is not looked up in this function.',
    verified: V,
  },
  {
    id: 'pkg-astro-corpus-ref-vote',
    area: 'pkg.astro-corpus',
    label: 'Record a Helpful or Not helpful vote on a reference',
    does: 'Stores the owner’s vote on a corpus passage shown beside a chart, after checking the passage is an imported text tagged with that factor, the statement is from it and the chart is the voter’s own.',
    class: 'internal',
    actors: ['owner'],
    scope: 'other',
    hosts: [
      ha(sq('ref-votes.ts', 'recordRefVote'), ['(raw INSERT astro_reviews)'], '/hub/readings', 'the Helpful and Not helpful buttons beside a reference', OWNERS),
    ],
    status: 'an astro_reviews row with the passage-vote action exists',
    risk: ['none'],
    drift: 'backs apps.elastrocal.ts:astro-reference-vote',
    open: 'GOOD: passage, factor, statement and chart ownership are each checked in SQL before the insert (ref-votes.ts:~100-122).',
    verified: V,
  },
  // ---------------- importers (operator scripts) ----------------
  {
    id: 'pkg-astro-corpus-seed-and-import',
    area: 'pkg.astro-corpus',
    label: 'Seed the factor registry and import a source',
    does: 'The operator’s importers: seed-factors upserts the whole factor registry; the import scripts register a source (upsertSource) and insert its questions and imported answer texts (importItems), idempotent on source and reference, so a re-run does not duplicate or move reviews.',
    class: 'admin',
    actors: ['operator'],
    scope: 'other',
    hosts: [
      hs(sq('server.ts', 'seedFactors'), ['(raw INSERT astro_factors ON CONFLICT)'], 'packages/astro-corpus/scripts/seed-factors.ts', 'Upserts every factor in chunks of 500.'),
      hs(sq('sources.ts', 'upsertSource'), ['(raw INSERT astro_sources ON CONFLICT)'], 'scripts/import-hf.ts, import-curated.ts, import-generated.ts, import-chunker.ts', 'Registers the source, its licence and whether it is trainable.'),
      hs(sq('server.ts', 'importItems'), ['(raw INSERT astro_questions, astro_texts, astro_candidates, astro_text_factors)'], 'scripts/import-*.ts', 'One transaction per 200 items; existing rows are left as they are.'),
    ],
    status: 'astro_factors, astro_sources and the source’s astro_questions rows exist',
    risk: ['none'],
    drift: 'Operator scripts only; no screen. A corpus-import page in apps/admin does not exist (the studio is owner-only in elastrocal).',
    open: 'The scripts run with the database credentials of whoever runs them (no actor recorded on the rows). Source licence and trainable flags are set by the script author. Imported text is not sanitised here: it is rendered by the studio (not read).',
    verified: V,
  },
  {
    id: 'pkg-astro-corpus-draft-store',
    area: 'pkg.astro-corpus',
    label: 'Store a helper-AI draft answer',
    does: 'The operator’s drafting script stores one answer drafted by the helper model (kind generated, trainable false, prompt hash and usage recorded) as a candidate text of its question.',
    class: 'admin',
    actors: ['operator'],
    scope: 'other',
    hosts: [
      hs(sq('helper.ts', 'storeDraft'), ['(raw INSERT astro_texts, astro_text_factors, astro_candidates)'], 'packages/astro-corpus/scripts/draft.ts', 'Idempotent on source and question plus prompt version; checks the question exists.'),
    ],
    status: 'an astro_texts row of kind generated is a candidate of the question',
    risk: ['none'],
    drift: 'Operator script only; model output is stored as untrusted candidate text, marked trainable false.',
    open: 'The model text is stored as returned (trimmed); reviewers see it beside human answers in the deck, so a prompt-injected draft is reviewed, not trusted.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
