/**
 * Export a snapshot of the reviewed corpus as training and evaluation files.
 *
 *   docker compose run --rm --no-deps -v ~/astro-corpus:/corpus -e CORPUS_DIR=/corpus \
 *     -w /app/packages/astro-corpus admin pnpm exec tsx scripts/export.ts
 *
 * Writes $CORPUS_DIR/exports/<timestamp>/:
 *   sft.jsonl, dpo.jsonl, kto.jsonl train split, every record
 *   explanations.jsonl              explained reviews with the texts they were about
 *   reasoning.jsonl                 reasoning-explorer interpretations, chains and marks
 *   retrieval.jsonl                 chart-explorer ref-votes as retrieval relevance labels
 *                                   (query = factor key + element; helpful / not helpful);
 *                                   trainable/retrieval.jsonl withholds the text of books
 *                                   not cleared for training
 *   claims.jsonl                    "Check AI claims": per judged passage, the passage, its
 *                                   headings, the AI's claims with the owner's verdicts and
 *                                   fixes, and claims he added; trainable/claims.jsonl
 *                                   withholds the text of books not cleared for training
 *   vocab.jsonl                     "Sort the vocabulary": one record per card with the owner's
 *                                   decision (group, preferred label, same-as resolved to the
 *                                   main card); vocab-groups.json lists his groups
 *   foundations.json                "Foundations": per lesson and concept, the owner's definition,
 *                                   core / fitting / rejected traits (synonyms under their head
 *                                   trait), apt images, passages by verdict with citation and the
 *                                   corrected role / mode, his additions; then each book's basic
 *                                   terms as he left them; trainable/foundations.json withholds
 *                                   the books' own words
 *   correspondences.json            the correspondence table: the values he kept, fixed or added,
 *                                   the ones he marked wrong, and his ruling on each category
 *   library-notes.jsonl             the owner's free-text notes on Library entries, newest first: one line
 *                                   per standing note with its silo and a snapshot of what it is about
 *   eval-*.jsonl                    the fixed test set (src/eval-set.ts)
 *   trainable/…                     the same files, only records whose texts all
 *                                   come from sources cleared for training
 *   manifest.json                   counts, sources and licences, git commit
 * and records the snapshot in astro_snapshots. Birth data and chart ids are
 * never exported. Formats: TRL conversational SFT ({messages}) and explicit-
 * prompt preference ({prompt, chosen, rejected}) and unpaired preference
 * ({prompt, completion, label}); `id` and `meta` are extra columns a trainer
 * can drop.
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "@elkdonis/db";
import {
  buildClaims,
  buildExplanations,
  buildCorrespondencesExport,
  buildFoundations,
  buildKto,
  buildPairs,
  buildReasoning,
  buildRefVoteRetrieval,
  buildSft,
  buildVocab,
  type ClaimExportPassage,
  type ExportQuestion,
  type ExportReview,
  type ExportText,
  type FoundationsExportCatalogue,
  type FoundationsExportLesson,
  type ReasoningExportStep,
  type RefVotePassage,
} from "../src/export";
import { CLAIM_ACTIONS, CLAIM_LABELLER } from "../src/claims-rules";
import { VOCAB_ACTIONS } from "../src/vocab-rules";
import { FOUNDATION_ACTIONS, normFacet, readFoundationSource, type CorrCell, type FoundationItem } from "../src/foundations-rules";
import { buildLibraryNotes, LIBRARY_NOTE_ACTION } from "../src/library-rules";
import { EVAL_SET } from "../src/eval-set";
import { cleanReferences, REASONING_ACTIONS, REF_VOTE_ACTION } from "../src/reasoning";
import { ORG_ID } from "../src/sources";

const CORPUS = process.env.CORPUS_DIR ?? "/corpus";

async function main() {
  const qRows = await db<{ id: string; prompt: string; factor_keys: string[]; tradition: string | null; is_test: boolean }[]>`
    SELECT id, prompt, factor_keys, tradition, COALESCE(meta->>'evalSet' = ${EVAL_SET}, false) AS is_test FROM astro_questions
    WHERE org_id = ${ORG_ID} AND status <> 'flagged'
      AND id IN (SELECT question_id FROM astro_reviews WHERE org_id = ${ORG_ID})
  `;
  const testSet = new Set(qRows.filter((q) => q.is_test).map((q) => q.id));
  const isEval = (id: string) => testSet.has(id);
  const questions = new Map<string, ExportQuestion>(qRows.map((q) => [q.id, { id: q.id, prompt: q.prompt, factorKeys: q.factor_keys, tradition: q.tradition }]));

  const rRows = await db<{ id: string; question_id: string; reviewer_id: string; action: string; payload: Record<string, unknown>; candidate_ids: string[]; stance: string | null; created_at: Date }[]>`
    SELECT id, question_id, reviewer_id, action, payload, candidate_ids, stance, created_at
    FROM astro_reviews WHERE org_id = ${ORG_ID} AND question_id IS NOT NULL
  `;
  const reviews: ExportReview[] = rRows
    .filter((r) => questions.has(r.question_id))
    .map((r) => ({
      id: r.id,
      questionId: r.question_id,
      reviewerId: r.reviewer_id,
      action: r.action,
      payload: r.payload,
      candidateIds: r.candidate_ids,
      stance: r.stance,
      createdAt: r.created_at.toISOString(),
    }));

  const textIds = new Set<string>();
  for (const r of reviews) {
    r.candidateIds.forEach((id) => textIds.add(id));
    for (const k of ["winner", "textId", "fromTextId"]) if (typeof r.payload[k] === "string") textIds.add(r.payload[k] as string);
  }
  const tRows = textIds.size
    ? await db<{ id: string; body: string; kind: string; tradition: string | null; slug: string; trainable: boolean; model: string | null }[]>`
        SELECT t.id, t.body, t.kind, t.tradition, s.slug, s.trainable, t.model
        FROM astro_texts t JOIN astro_sources s ON s.id = t.source_id
        WHERE t.id = ANY (${[...textIds]})
      `
    : [];
  const texts = new Map<string, ExportText>(
    tRows.map((t) => [t.id, { id: t.id, body: t.body, kind: t.kind, tradition: t.tradition, sourceSlug: t.slug, trainable: t.trainable, model: t.model }]),
  );

  // Gold texts come from Fix and Write reviews; the review names the question.
  const gold = reviews
    .filter((r) => (r.action === "fix" || r.action === "write") && typeof r.payload.textId === "string")
    .map((r) => ({ textId: r.payload.textId as string, questionId: r.questionId, stance: r.stance }));

  const pairs = buildPairs(questions, texts, reviews);
  const sft = buildSft(questions, texts, gold);
  const kto = buildKto(questions, texts, reviews);
  const explanations = buildExplanations(questions, texts, reviews);
  const reasoning = await loadReasoning();
  const refVotes = await loadRefVotes();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(CORPUS, "exports", stamp);
  mkdirSync(path.join(dir, "trainable"), { recursive: true });
  const jsonl = (rows: unknown[]) => rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
  const split = <T extends { meta: { questionId: string; trainable: boolean } }>(rows: T[]) => ({
    train: rows.filter((r) => !isEval(r.meta.questionId)),
    evaluation: rows.filter((r) => isEval(r.meta.questionId)),
  });
  const s = split(sft);
  const p = split(pairs);
  const k = split(kto);
  const x = split(explanations);
  const files: Record<string, unknown[]> = {
    "sft.jsonl": s.train,
    "dpo.jsonl": p.train,
    "kto.jsonl": k.train,
    "explanations.jsonl": x.train,
    "eval-sft.jsonl": s.evaluation,
    "eval-dpo.jsonl": p.evaluation,
    "eval-kto.jsonl": k.evaluation,
    "eval-explanations.jsonl": x.evaluation,
    // Not split: interpretations aren't test-set questions. Citations from
    // uncleared sources are already stripped, so every record is trainable.
    "reasoning.jsonl": reasoning,
  };
  const counts: Record<string, number> = {};
  for (const [name, rows] of Object.entries(files)) {
    const cleared = (rows as { meta: { trainable: boolean } }[]).filter((r) => r.meta.trainable);
    writeFileSync(path.join(dir, name), jsonl(rows));
    writeFileSync(path.join(dir, "trainable", name), jsonl(cleared));
    counts[name] = rows.length;
    counts[`trainable/${name}`] = cleared.length;
  }

  // Retrieval labels: the full file keeps every text; trainable/ withholds the text of
  // uncleared books instead of dropping the labels (as reasoning.jsonl does).
  const retrievalAll = buildRefVoteRetrieval(refVotes.reviews, refVotes.passages, { withholdUncleared: false });
  const retrievalCleared = buildRefVoteRetrieval(refVotes.reviews, refVotes.passages, { withholdUncleared: true });
  writeFileSync(path.join(dir, "retrieval.jsonl"), jsonl(retrievalAll));
  writeFileSync(path.join(dir, "trainable", "retrieval.jsonl"), jsonl(retrievalCleared));
  counts["retrieval.jsonl"] = retrievalAll.length;
  counts["trainable/retrieval.jsonl"] = retrievalCleared.length;

  // Claim checks: the same split as retrieval — full text in the main file, uncleared books withheld in trainable/.
  const claimData = await loadClaims();
  const claimsAll = buildClaims(claimData.passages, claimData.reviews, { withholdUncleared: false });
  const claimsCleared = buildClaims(claimData.passages, claimData.reviews, { withholdUncleared: true });
  writeFileSync(path.join(dir, "claims.jsonl"), jsonl(claimsAll));
  writeFileSync(path.join(dir, "trainable", "claims.jsonl"), jsonl(claimsCleared));
  counts["claims.jsonl"] = claimsAll.length;
  counts["trainable/claims.jsonl"] = claimsCleared.length;

  // Vocabulary: no book text, so the trainable/ copy is the same file.
  const vocab = await loadVocab();
  writeFileSync(path.join(dir, "vocab.jsonl"), jsonl(vocab.records));
  writeFileSync(path.join(dir, "trainable", "vocab.jsonl"), jsonl(vocab.records));
  writeFileSync(path.join(dir, "vocab-groups.json"), JSON.stringify(vocab.groups, null, 2) + "\n");
  counts["vocab.jsonl"] = vocab.records.length;
  counts["vocab.jsonl sorted"] = vocab.records.filter((r) => r.decision && r.decision !== "skip").length;
  counts["vocab-groups.json"] = vocab.groups.length;
  counts["vocab.jsonl owner-added"] = vocab.records.filter((r) => r.source === "owner").length;
  counts["vocab.jsonl example ratings"] = vocab.records.reduce((n, r) => n + r.example_ratings.length, 0);

  // Foundations: the rulebook entries. The trainable/ copy keeps citations and readings but not the books' own words.
  const fnd = await loadFoundations();
  const foundationsAll = buildFoundations(fnd.lessons, fnd.items, fnd.catalogues, fnd.reviews, { withholdQuotes: false });
  const foundationsCleared = buildFoundations(fnd.lessons, fnd.items, fnd.catalogues, fnd.reviews, { withholdQuotes: true });
  writeFileSync(path.join(dir, "foundations.json"), JSON.stringify(foundationsAll, null, 2) + "\n");
  writeFileSync(path.join(dir, "trainable", "foundations.json"), JSON.stringify(foundationsCleared, null, 2) + "\n");
  const fConcepts = foundationsAll.lessons.flatMap((l) => l.concepts);
  counts["foundations.json lessons"] = foundationsAll.lessons.length;
  counts["foundations.json concepts defined"] = fConcepts.filter((c) => c.definition).length;
  counts["foundations.json confirmed traits"] = fConcepts.reduce((n, c) => n + c.core_traits.length + c.fits_traits.length, 0);
  counts["foundations.json apt images"] = fConcepts.reduce((n, c) => n + c.apt_images.length, 0);
  counts["foundations.json good passages"] = fConcepts.reduce((n, c) => n + c.good_passages.length, 0);
  counts["foundations.json corrected readings"] = fConcepts.reduce(
    (n, c) => n + [...c.good_passages, ...c.fine_passages, ...c.misread_passages, ...c.corrected_passages].filter((p) => p.corrected).length,
    0,
  );
  counts["foundations.json terms reviewed"] = foundationsAll.term_catalogues.reduce((n, c) => n + c.reviewed, 0);

  // The correspondence table: short facts, no passages, so the trainable/ copy is the same file.
  const correspondences = buildCorrespondencesExport(await loadCorrespondences(), fnd.reviews);
  writeFileSync(path.join(dir, "correspondences.json"), JSON.stringify(correspondences, null, 2) + "\n");
  writeFileSync(path.join(dir, "trainable", "correspondences.json"), JSON.stringify(correspondences, null, 2) + "\n");
  counts["correspondences.json confirmed cells"] = correspondences.confirmed_cells.length;
  counts["correspondences.json category rulings"] = correspondences.categories.filter((c) => c.ruling).length;

  // Library notes: his own words, plus a short snapshot of what each is about.
  const noteRows = await db<{ id: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, payload, created_at FROM astro_reviews WHERE org_id = ${ORG_ID} AND question_id IS NULL AND action = ${LIBRARY_NOTE_ACTION}
  `;
  const libraryNotes = buildLibraryNotes(noteRows.map((r) => ({ id: r.id, payload: r.payload, createdAt: r.created_at.toISOString() })));
  writeFileSync(path.join(dir, "library-notes.jsonl"), jsonl(libraryNotes));
  counts["library-notes.jsonl"] = libraryNotes.length;

  const sources = await db<{ slug: string; licence: string; trainable: boolean }[]>`
    SELECT slug, licence, trainable FROM astro_sources WHERE org_id = ${ORG_ID} ORDER BY slug
  `;
  let commit: string | null = null;
  try {
    commit = execSync("git rev-parse --short HEAD", { cwd: "/app", stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    commit = null;
  }
  const manifest = {
    exportedAt: new Date().toISOString(),
    counts,
    reviews: reviews.length,
    questions: questions.size,
    pairsByOrigin: pairs.reduce<Record<string, number>>((m, x) => ((m[x.meta.origin] = (m[x.meta.origin] ?? 0) + 1), m), {}),
    sources,
    split: `eval = fixed test set ${EVAL_SET} (${testSet.size} questions reviewed)`,
    formats: {
      sft: "TRL conversational {messages}",
      dpo: "TRL explicit prompt {prompt, chosen, rejected}",
      kto: "TRL unpaired {prompt, completion, label}",
      explanations: "one explained review {question_id, prompt, action, candidates, winner|ratings|edited, explanation}",
      reasoning:
        "one interpretation {factor_keys, body, sentences, chains[{summary, verdict, steps[{kind, body, basedOn, statement, passage, source, verdict}]}], pick, added_steps, history, retrieval{query, positives, weak_positives, negatives}}",
      foundations:
        "{lessons[{lesson, title, version, concepts[{concept, label, definition, core_traits[], fits_traits[], rejected_traits[] ({text, facet: itself | lack | excess, books, uses, synonyms[], yours, note}), apt_images[], rejected_images[] ({text, meaning, model_meaning, yours, note, books, citation, quote}), good_passages[], fine_passages[], misread_passages[], corrected_passages[], figurative_counts[], figurative_only[] ({text, citation{book, author, where, pages}, role, mode, model_role, model_mode, corrected, note}), notes[], additions[], progress}]}], term_catalogues[{slug, book, author, total, reviewed, terms[{term, group, facet, code, verdict: right | fix | not-basic | null, verdict_note, note, keywords[], added_keywords[], dropped_keywords[], secondary[], definition, how_to_weigh, figure, related[], pages[], book_pages[], quote}]}]}",
      vocab:
        "one card {term, norm, also, kind_hint, group_hint, books, uses, decision (group | not-a-term | skip | null), groups[] (a card can be in several), group (= groups[0], for compatibility), preferred, label, same_as{id, label}, note, example_ratings[{example, text, book, rating: good | weak | wrong-sense, note}], source (owner | generated), withdrawn, added_from{cardId, term, example}}; vocab-groups.json [{name, parent, path, cards, terms}] (groups can nest)",
      claims:
        "one judged passage {passage, headings, pages, book, claims[{body, factorKeys[{key, role}], conditionKeys, condition, valence, certainty, register, because, verdict{verdict, fixes, tagsAdd, tagsRemove, condition, note}, corrected_keys}], added_claims[{body, factorKeys, note}], history}",
      retrieval:
        "one query {query{factor_key, factor_label, element_id}, positives[], negatives[]} per factor key + chart element; labels {textId, statementId|null, book, author, pages, headings, passage, note, reviewer, votedAt} from ref-votes on passages (helpful / not helpful), latest per reviewer + passage + key",
    },
    commit,
  };
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await db`INSERT INTO astro_snapshots (org_id, path, manifest) VALUES (${ORG_ID}, ${dir}, ${db.json(manifest as never)})`;
  console.log(dir);
  console.log(JSON.stringify(manifest.counts, null, 2));
  await db.end();
}

/** Reasoning-explorer interpretations with their chains, steps, citations and the owner's reviews. */
async function loadReasoning() {
  const interps = await db<{ id: string; body: string; sentences: string[]; factor_keys: string[]; question_id: string | null; references: unknown }[]>`
    SELECT id, body, sentences, factor_keys, question_id, meta->'references' AS references FROM astro_interpretations i
    WHERE org_id = ${ORG_ID} AND EXISTS (SELECT 1 FROM astro_reasoning_chains c WHERE c.interpretation_id = i.id)
  `;
  if (!interps.length) return [];
  const chains = await db<{ id: string; interpretation_id: string; ordinal: number; sentences: number[]; summary: string; model: string | null; prompt_version: string | null }[]>`
    SELECT id, interpretation_id, ordinal, sentences, summary, model, prompt_version FROM astro_reasoning_chains
    WHERE interpretation_id = ANY (${interps.map((i) => i.id)})
  `;
  const stepRows = await db<
    {
      id: string;
      chain_id: string;
      ordinal: number;
      kind: string;
      body: string;
      based_on: number[];
      factor_keys: string[];
      statement_id: string | null;
      text_id: string | null;
      source: Record<string, unknown>;
      statement: string | null;
      passage: string | null;
      trainable: boolean | null;
    }[]
  >`
    SELECT s.id, s.chain_id, s.ordinal, s.kind, s.body, s.based_on, s.factor_keys, s.statement_id, s.text_id, s.source,
           st.body AS statement, t.body AS passage, src.trainable
    FROM astro_reasoning_steps s
    LEFT JOIN astro_statements st ON st.id = s.statement_id
    LEFT JOIN astro_texts t ON t.id = COALESCE(s.text_id, st.text_id)
    LEFT JOIN astro_sources src ON src.id = t.source_id
    WHERE s.chain_id = ANY (${chains.map((c) => c.id)})
  `;
  const steps = new Map<string, ReasoningExportStep[]>();
  for (const s of stepRows) {
    const list = steps.get(s.chain_id) ?? [];
    list.push({
      id: s.id,
      ordinal: s.ordinal,
      kind: s.kind,
      body: s.body,
      basedOn: s.based_on ?? [],
      factorKeys: s.factor_keys ?? [],
      statementId: s.statement_id,
      textId: s.text_id,
      statement: s.statement,
      passage: s.passage,
      source: s.source ?? {},
      trainable: s.trainable,
    });
    steps.set(s.chain_id, list);
  }
  const reviews = await db<{ id: string; reviewer_id: string; action: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, reviewer_id, action, payload, created_at FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND question_id IS NULL AND action = ANY (${[...REASONING_ACTIONS]})
  `;
  // Training clearance of each retrieved passage's book, where the book is in the studio.
  const refsOf = new Map(interps.map((i) => [i.id, cleanReferences(i.references)]));
  const docHashes = [...new Set([...refsOf.values()].flat().flatMap((r) => (r.docHash ? [`book:${r.docHash}`] : [])))];
  const cleared = new Map(
    docHashes.length
      ? (await db<{ slug: string; trainable: boolean }[]>`SELECT slug, trainable FROM astro_sources WHERE slug = ANY (${docHashes})`).map((r) => [r.slug, r.trainable])
      : [],
  );
  return buildReasoning(
    interps.map((i) => ({
      id: i.id,
      body: i.body,
      sentences: i.sentences,
      factorKeys: i.factor_keys,
      questionId: i.question_id,
      references: (refsOf.get(i.id) ?? []).map((r) => ({ ...r, trainable: r.docHash ? (cleared.get(`book:${r.docHash}`) ?? null) : null })),
    })),
    chains.map((c) => ({ id: c.id, interpretationId: c.interpretation_id, ordinal: c.ordinal, sentences: c.sentences ?? [], summary: c.summary, model: c.model, promptVersion: c.prompt_version })),
    steps,
    reviews.map((r) => ({ id: r.id, reviewerId: r.reviewer_id, action: r.action, payload: r.payload, createdAt: r.created_at.toISOString() })),
  );
}

/** The chart explorer's ref-votes with the passages they are about. */
async function loadRefVotes(): Promise<{ reviews: { id: string; reviewerId: string; action: string; payload: Record<string, unknown>; createdAt: string }[]; passages: Map<string, RefVotePassage> }> {
  const rows = await db<{ id: string; reviewer_id: string; action: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, reviewer_id, action, payload, created_at FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND question_id IS NULL AND action = ${REF_VOTE_ACTION}
  `;
  const ids = [...new Set(rows.flatMap((r) => (typeof r.payload.textId === "string" ? [r.payload.textId] : [])))];
  const tRows = ids.length
    ? await db<{ id: string; passage: string; title: string; author: string | null; pages: unknown; headings: unknown; trainable: boolean }[]>`
        SELECT t.id, t.body AS passage, so.title, so.author, t.meta->'pages' AS pages, t.meta->'headings' AS headings, so.trainable
        FROM astro_texts t JOIN astro_sources so ON so.id = t.source_id
        WHERE t.id = ANY (${ids}::uuid[])
      `
    : [];
  const nums = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    reviews: rows.map((r) => ({ id: r.id, reviewerId: r.reviewer_id, action: r.action, payload: r.payload, createdAt: r.created_at.toISOString() })),
    passages: new Map(
      tRows.map((t) => [
        t.id,
        { textId: t.id, passage: t.passage, book: t.title, author: t.author, pages: nums(t.pages), headings: strs(t.headings), trainable: t.trainable },
      ]),
    ),
  };
}

/** Vocabulary cards and the owner's sorting decisions (empty until migration 182 is applied). */
async function loadVocab() {
  const [{ ready }] = await db<{ ready: boolean }[]>`SELECT to_regclass('astro_vocab_cards') IS NOT NULL AS ready`;
  if (!ready) return { records: [], groups: [] };
  const cards = await db<{ id: string; norm: string; term: string; also: string[]; kind_hint: string | null; group_hint: string | null; books: number; uses: number }[]>`
    SELECT id, norm, term, also, kind_hint, group_hint, books, uses FROM astro_vocab_cards WHERE org_id = ${ORG_ID}
  `;
  const reviews = await db<{ id: string; action: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, action, payload, created_at FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND question_id IS NULL AND action = ANY (${[...VOCAB_ACTIONS]})
  `;
  return buildVocab(
    cards.map((c) => ({ id: c.id, norm: c.norm, term: c.term, also: c.also ?? [], kindHint: c.kind_hint, groupHint: c.group_hint, books: c.books, uses: c.uses })),
    reviews.map((r) => ({ id: r.id, action: r.action, payload: r.payload, createdAt: r.created_at.toISOString() })),
  );
}

/** Passages the owner checked in "Check AI claims", with the digest's claims on them, and the claim reviews. */
async function loadClaims(): Promise<{ passages: ClaimExportPassage[]; reviews: { id: string; reviewerId: string; action: string; payload: Record<string, unknown>; createdAt: string }[] }> {
  const rows = await db<{ id: string; reviewer_id: string; action: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, reviewer_id, action, payload, created_at FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND question_id IS NULL AND action = ANY (${[...CLAIM_ACTIONS]})
  `;
  const reviews = rows.map((r) => ({ id: r.id, reviewerId: r.reviewer_id, action: r.action, payload: r.payload, createdAt: r.created_at.toISOString() }));
  const textIds = [...new Set(reviews.map((r) => r.payload.textId).filter((x): x is string => typeof x === "string"))];
  if (!textIds.length) return { passages: [], reviews };
  const texts = await db<{ id: string; body: string; meta: Record<string, unknown>; title: string | null; author: string | null; trainable: boolean }[]>`
    SELECT t.id, t.body, t.meta, s.title, s.author, s.trainable
    FROM astro_texts t JOIN astro_sources s ON s.id = t.source_id
    WHERE t.id = ANY (${textIds}::uuid[])
  `;
  const statements = await db<
    {
      id: string;
      text_id: string;
      ordinal: number;
      body: string;
      condition_keys: string[];
      condition: string | null;
      valence: string | null;
      certainty: string | null;
      register: string | null;
      frame: Record<string, unknown>;
      life_area: number | null;
      meta: Record<string, unknown>;
      factors: { key: string; role: string }[] | null;
    }[]
  >`
    SELECT s.id, s.text_id, s.ordinal, s.body, s.condition_keys, s.condition, s.valence, s.certainty, s.register, s.frame, s.life_area, s.meta,
           (SELECT json_agg(json_build_object('key', f.factor_key, 'role', f.role) ORDER BY f.factor_key) FROM astro_statement_factors f WHERE f.statement_id = s.id) AS factors
    FROM astro_statements s
    WHERE s.text_id = ANY (${textIds}::uuid[]) AND s.labelled_by = ${CLAIM_LABELLER}
  `;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    reviews,
    passages: texts.map((t) => ({
      textId: t.id,
      body: t.body,
      headings: strings(t.meta?.headings),
      pages: Array.isArray(t.meta?.pages) ? (t.meta.pages as unknown[]).filter((x): x is number => typeof x === "number") : [],
      book: t.title,
      author: t.author,
      docHash: typeof t.meta?.docHash === "string" ? t.meta.docHash : null,
      trainable: t.trainable,
      statements: statements
        .filter((s) => s.text_id === t.id)
        .map((s) => ({
          id: s.id,
          ordinal: s.ordinal,
          body: s.body,
          factorKeys: s.factors ?? [],
          conditionKeys: s.condition_keys ?? [],
          condition: s.condition,
          valence: s.valence,
          certainty: s.certainty,
          register: s.register,
          frame: s.frame ?? {},
          lifeArea: s.life_area,
          because: typeof s.meta?.because === "string" ? s.meta.because : null,
        })),
    })),
  };
}

main().catch(async (e) => {
  console.error(e);
  await db.end();
  process.exit(1);
});

/** Foundations: lessons, items, term catalogues and the owner's reviews (empty until migration 183 is applied). */
async function loadFoundations() {
  const [{ ready }] = await db<{ ready: boolean }[]>`SELECT to_regclass('astro_foundation_items') IS NOT NULL AS ready`;
  const none = { lessons: [], items: [], catalogues: [], reviews: [] } as {
    lessons: FoundationsExportLesson[];
    items: FoundationItem[];
    catalogues: FoundationsExportCatalogue[];
    reviews: { id: string; action: string; payload: Record<string, unknown>; createdAt: string }[];
  };
  if (!ready) return none;
  const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const lessons = await db<{ lesson: string; title: string; version: string | null; concepts: unknown }[]>`
    SELECT lesson, title, version, concepts FROM astro_foundation_lessons WHERE org_id = ${ORG_ID} ORDER BY created_at, lesson
  `;
  const items = await db<{ id: string; lesson: string; concept: string; kind: string; item_key: string; text: string; payload: unknown; books: number; uses: number; origin: string; stale: boolean }[]>`
    SELECT id, lesson, concept, kind, item_key, text, payload, books, uses, origin, stale FROM astro_foundation_items WHERE org_id = ${ORG_ID}
    ORDER BY books DESC, uses DESC, text
  `;
  const books = await db<{ slug: string; book: string; author: string | null }[]>`
    SELECT slug, book, author FROM astro_foundation_catalogues WHERE org_id = ${ORG_ID} ORDER BY created_at, slug
  `;
  const terms = await db<{ id: string; book_slug: string; term_key: string; term: string; grp: string; payload: unknown; stale: boolean }[]>`
    SELECT id, book_slug, term_key, term, grp, payload, stale FROM astro_foundation_terms WHERE org_id = ${ORG_ID} ORDER BY book_slug, position, term
  `;
  const reviews = await db<{ id: string; action: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, action, payload, created_at FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND question_id IS NULL AND action = ANY (${[...FOUNDATION_ACTIONS]})
  `;
  return {
    lessons: lessons.map((l) => ({
      lesson: l.lesson,
      title: l.title,
      version: l.version,
      concepts: (Array.isArray(l.concepts) ? l.concepts : []).flatMap((c) => (text(obj(c).id) ? [{ id: obj(c).id as string, label: text(obj(c).label) ?? (obj(c).id as string) }] : [])),
    })),
    items: items.map((r): FoundationItem => {
      const p = obj(r.payload);
      return {
        id: r.id,
        lesson: r.lesson,
        concept: r.concept,
        kind: r.kind as FoundationItem["kind"],
        key: r.item_key,
        text: r.text,
        meaning: text(p.meaning),
        role: text(p.role),
        mode: text(p.mode),
        facet: normFacet(p.facet) ?? "itself",
        degree: text(p.degree),
        books: r.books,
        uses: r.uses,
        sources: (Array.isArray(p.sources) ? p.sources : []).flatMap((s) => readFoundationSource(obj(s)) ?? []),
        origin: r.origin === "owner" ? "owner" : "books",
        stale: r.stale,
      };
    }),
    catalogues: books.map((b) => ({
      ...b,
      terms: terms
        .filter((t) => t.book_slug === b.slug)
        .map((t) => {
          const p = obj(t.payload);
          return {
            id: t.id,
            key: t.term_key,
            term: t.term,
            group: t.grp,
            facet: normFacet(p.facet),
            code: text(p.code),
            keywords: list(p.keywords),
            secondary: list(p.secondary),
            definition: text(p.definition),
            howToWeigh: text(p.how_to_weigh),
            figure: text(p.figure),
            related: list(p.related),
            pages: (Array.isArray(p.pages) ? p.pages : []).filter((x): x is number => typeof x === "number"),
            bookPages: (Array.isArray(p.book_pages) ? p.book_pages : []).filter((x): x is number => typeof x === "number"),
            quote: text(p.quote),
            note: text(p.note),
            stale: t.stale,
          };
        }),
    })),
    reviews: reviews.map((r) => ({ id: r.id, action: r.action, payload: r.payload, createdAt: r.created_at.toISOString() })),
  };
}

/** The correspondence table's rows (empty until migration 184 is applied). */
async function loadCorrespondences(): Promise<CorrCell[]> {
  const [{ ready }] = await db<{ ready: boolean }[]>`SELECT to_regclass('astro_correspondences') IS NOT NULL AS ready`;
  if (!ready) return [];
  const rows = await db<{ id: string; book_slug: string; cell_key: string; subject_type: string; subject: string; category: string; value: string; payload: Record<string, unknown> | null; origin: string; stale: boolean }[]>`
    SELECT id, book_slug, cell_key, subject_type, subject, category, value, payload, origin, stale FROM astro_correspondences
    WHERE org_id = ${ORG_ID} ORDER BY subject_type, subject, category, book_slug, position
  `;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return rows.map((r) => ({
    id: r.id,
    key: r.cell_key,
    bookSlug: r.book_slug,
    subjectType: r.subject_type,
    subject: r.subject,
    category: r.category,
    value: r.value,
    page: typeof r.payload?.page === "number" ? r.payload.page : null,
    source: text(r.payload?.source),
    derivedFrom: text(r.payload?.derived_from),
    scheme: text(r.payload?.scheme),
    facet: text(r.payload?.facet),
    degree: text(r.payload?.degree),
    book: text(r.payload?.book),
    author: text(r.payload?.author),
    origin: r.origin === "owner" ? "owner" : "books",
    stale: r.stale,
  }));
}
