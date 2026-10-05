/**
 * Astro-corpus smoke test: `pnpm --filter @elkdonis/astro-corpus test`.
 *
 * 1. The registry has the expected size per kind and unique keys.
 * 2. Impossible aspects are exactly the ones geometry forbids.
 * 3. The tagger finds the factor in each phrasing the corpora use, and
 *    does not invent one where there is none.
 */

import assert from "node:assert/strict";
import { FACTORS, FACTOR_BY_KEY, registryCounts } from "../src/factors";
import { tagKeys, tagText, tagWithHeadings } from "../src/tagger";
import { questionViability, stripSourceClause } from "../src/questions";
import { combinationQuestions, realmQuestions } from "../src/question-sets";
import { pairScore, passes, wilson } from "../src/scoring";
import { buildExplanations, buildKto, buildPairs, buildSft, type ExportQuestion, type ExportReview, type ExportText } from "../src/export";
import { cleanExplanation, ExplanationError } from "../src/explanation";
import { buildClaims, buildFoundations, buildVocab } from "../src/export";
import {
  buildConceptEntry,
  buildCorrTable,
  buildCorrespondencesExport,
  buildSubjectView,
  categoryGroup,
  normFacet,
  orderSubjects,
  readCorrespondences,
  buildTermEntry,
  citeText,
  cleanFoundationPayload,
  FoundationError,
  headOf,
  isFoundationAction,
  itemStands,
  readCatalogue,
  readFoundationSheet,
  replayFoundations,
  termPagesText,
  termTouched,
  verdictFits,
  type FoundationItem,
} from "../src/foundations-rules";
import { buildLibraryNotes, cleanLibraryNote, mergeGlossary, mergeKeywords, placementLabel, readingGroup, readingGroupRank, readBookCards, readingSilos, readLibraryFile, readSectionsFile, replayLibraryNotes, sectionSilos, type KeywordSource } from "../src/library-rules";
import { cleanVocabPayload, groupKey, isVocabAction, matchGroup, normTerm, replayVocab, similarGroups, VocabError, wouldCycle } from "../src/vocab-rules";
import { ClaimError, cleanClaimPayload, isClaimAction, matchClaimSentences } from "../src/claims-rules";
import { buildReasoning, buildRefVoteRetrieval, type ReasoningExportStep, type RefVotePassage } from "../src/export";
import {
  cleanReasoningPayload,
  cleanReferences,
  cleanRefVotePayload,
  latestRefVotes,
  patternPhraseOf,
  ReasoningError,
  REF_PATTERN_PHRASES,
  splitSentences,
} from "../src/reasoning-rules";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

check("registry sizes", () => {
  const c = registryCounts();
  // 14 points × 12 signs; 12 bodies × 12 houses; (C(14,2) − AC–MC) × 9 aspects;
  // 12 transiting × 14 natal × 5 majors; 12 + C(12,2) sign pairs.
  assert.equal(c.sign, 168);
  assert.equal(c.house, 144);
  assert.equal(c.aspect, 90 * 9);
  assert.equal(c.transit, 12 * 14 * 5);
  assert.equal(c.compat, 78);
  assert.equal(c["transit-sign"], 144);
  assert.equal(c["transit-house"], 144);
  assert.equal(c.planet, 14);
  assert.equal(c.zodiac, 12);
  assert.equal(c.realm, 12);
  assert.equal(c["aspect-type"], 9);
  // Layers and compounds: 4 elements, 3 qualities, 2 polarities; 12 signs × 12 houses; 12 bodies × 12 signs × 12 houses.
  assert.equal(c.element, 4);
  assert.equal(c.modality, 3);
  assert.equal(c.polarity, 2);
  assert.equal(c["sign-house"], 144);
  assert.equal(c.placement, 12 * 12 * 12);
  assert.equal(FACTOR_BY_KEY.size, FACTORS.length, "keys are unique");
  console.log("   ", c);
});

check("impossible aspects follow the inner-planet limits", () => {
  const imp = FACTORS.filter((f) => f.impossible).map((f) => f.key);
  if (imp.length === 0) {
    console.log("    (aspect-occurrence.ts not generated yet; run scan:aspects)");
    return;
  }
  const bad = imp.filter((k) => !/^aspect:(sun|mercury|venus):(mercury|venus):/.test(k));
  assert.deepEqual(bad, []);
  assert.ok(FACTOR_BY_KEY.get("aspect:sun:mercury:trine")!.impossible);
  assert.ok(FACTOR_BY_KEY.get("aspect:sun:venus:square")!.impossible);
  assert.ok(!FACTOR_BY_KEY.get("aspect:sun:mercury:conjunction")!.impossible);
  assert.ok(!FACTOR_BY_KEY.get("aspect:sun:venus:semisquare")!.impossible);
  assert.ok(!FACTOR_BY_KEY.get("aspect:mercury:venus:sextile")!.impossible);
  console.log(`    ${imp.length} impossible: ${imp.map((k) => k.slice(7)).join(", ")}`);
});

const cases: [string, string[]][] = [
  ["Natal Sun in Aries", ["sign:sun:aries"]],
  ["Natal Sun in 7th House", ["house:sun:7"]],
  ["Natal Sun trine / sextile Moon", ["aspect:sun:moon:trine", "aspect:sun:moon:sextile"]],
  ["Why might surgeons often have Mars in Virgo?", ["sign:mars:virgo"]],
  ["What does Mars square Saturn mean?", ["aspect:mars:saturn:square"]],
  ["Saturn in conjunction with the Moon", ["aspect:moon:saturn:conjunction"]],
  ["How does Venus in the seventh house affect marriage?", ["house:venus:7"]],
  ["What is a Leo rising like?", ["sign:ascendant:leo"]],
  ["Describe a Scorpio Moon.", ["sign:moon:scorpio"]],
  ["What happens when transiting Saturn is conjunct your natal Sun?", ["transit:saturn:sun:conjunction"]],
  ["Analyze compatibility between Aries and Virgo.", ["compat:aries:virgo"]],
  ["What careers suit a Capricorn?", ["sign:sun:capricorn"]],
  ["How do Aquarius people handle conflict?", ["sign:sun:aquarius"]],
  ["Venus conjunct the Ascendant", ["aspect:venus:ascendant:conjunction"]],
  ["What is a planetary return?", []],
  ["Is Mercury in Gemini a good placement?", ["sign:mercury:gemini"]],
  ["What are the primary concerns when Pluto transits through the Second House?", ["transit-house:pluto:2"]],
  ["What financial action is recommended when Jupiter is transiting your 8th House?", ["transit-house:jupiter:8"]],
  ["What event was reflected during Uranus's transit through Taurus in the 1930s?", ["transit-sign:uranus:taurus"]],
  ["When does the Neptune Opposition Neptune transit typically occur?", ["transit:neptune:neptune:opposition"]],
  ["How does the transit of Mars in trine to the natal Moon affect relationships?", ["transit:mars:moon:trine"]],
  ["What opportunities might arise when a sextile forms between the Sun and Mercury?", ["aspect:sun:mercury:sextile"]],
  ["How is Jupiter's energy described when placed in Virgo?", ["sign:jupiter:virgo"]],
  ["What are the effects of the transit of Jupiter in sextile to the North Node?", ["transit:jupiter:northNode:sextile"]],
];

check("tagger phrasings", () => {
  for (const [text, want] of cases) {
    const got = tagKeys(text).sort();
    assert.deepEqual(got, [...want].sort(), `${text} → ${JSON.stringify(tagText(text))}`);
  }
});

check("tagger: glyphs, mentions, headings", () => {
  assert.deepEqual(tagKeys("☉ □ ♄ in the natal chart"), ["aspect:sun:saturn:square"]);
  assert.deepEqual(tagKeys("♂ in ♍"), ["sign:mars:virgo"]);
  // Off by default: questions keep their old tags.
  assert.deepEqual(tagKeys("Saturn is the teacher of the zodiac."), []);
  const m = tagKeys("Saturn is the teacher. Saturn's square to any planet slows it. The 10th house is its home. Scorpio is different.", { mentions: true }).sort();
  assert.deepEqual(m, ["aspect-type:square", "planet:saturn", "realm:10", "zodiac:scorpio"]);
  // No sign from the illness, no aspect from a sentence without a planet.
  assert.deepEqual(tagKeys("He was treated for cancer. There was opposition from his parents.", { mentions: true }), []);
  // A placement already found is not repeated as a bare mention.
  assert.deepEqual(tagKeys("Mars in Virgo is precise.", { mentions: true }), ["sign:mars:virgo"]);
  // Headings: a paragraph under "Natal Sun in Aries" is about the Sun in Aries.
  const h = tagWithHeadings("Aries people are not selfish on purpose, but they tend to be thoughtless.", ["The Sun in the Signs", "Natal Sun in Aries"]);
  const byKey = Object.fromEntries(h.map((t) => [t.key, t.confidence]));
  assert.equal(byKey["sign:sun:aries"], "heading");
  assert.equal(byKey["planet:sun"], undefined, "covered by sign:sun:aries");
  // Lists of signs in prose are not pairings.
  assert.ok(!tagKeys("We are taught that the Venus-ruled signs of Taurus and Libra are warm, loving people in relationships.").some((k) => k.startsWith("compat:")));
  assert.deepEqual(tagKeys("Analyze compatibility between Aries and Virgo."), ["compat:aries:virgo"]);
});

check("question viability", () => {
  assert.equal(questionViability("How is a high-vibe Gemini's fashion sense described?").ok, false);
  assert.equal(questionViability("According to the author, what does Saturn rule?").ok, false);
  assert.equal(questionViability("Why might surgeons often have Mars in Virgo?").ok, true);
  assert.equal(questionViability("What is it?").ok, false);
  assert.equal(stripSourceClause("What are the characteristics of the Moon in Aries as described in the text?"), "What are the characteristics of the Moon in Aries?");
  assert.equal(stripSourceClause("What is the primary focus of the Mercury period (ages 4-14) according to the text?"), "What is the primary focus of the Mercury period (ages 4-14)?");
  assert.equal(stripSourceClause("What professions are Sagittarians well-suited for, according to the text?"), "What professions are Sagittarians well-suited for?");
  assert.equal(stripSourceClause("What made the year 2003 the most critical year of the author's life?"), null);
});

check("export: preference direction", () => {
  const Q = "q-1";
  const questions = new Map<string, ExportQuestion>([[Q, { id: Q, prompt: "Interpret Mars square Saturn.", factorKeys: ["aspect:mars:saturn:square"], tradition: null }]]);
  const t = (id: string, body: string, kind = "import", trainable = false): [string, ExportText] => [id, { id, body, kind, tradition: null, sourceSlug: "s", trainable, model: null }];
  const texts = new Map<string, ExportText>([t("A", "imported answer"), t("B", "engine answer"), t("E", "corrected answer", "edit", true), t("W", "own answer", "own", true)]);
  const r = (id: string, action: string, payload: Record<string, unknown>, candidateIds: string[], createdAt: string, reviewerId = "me"): ExportReview =>
    ({ id, questionId: Q, reviewerId, action, payload, candidateIds, stance: "claim", createdAt });

  // Pick B over A: chosen must be B.
  let pairs = buildPairs(questions, texts, [r("r1", "pick", { winner: "B", reasons: ["more specific"] }, ["A", "B"], "2026-01-01")]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].chosen[0].content, "engine answer");
  assert.equal(pairs[0].rejected[0].content, "imported answer");
  assert.deepEqual(pairs[0].meta.reasons, ["more specific"]);

  // Change of mind: a later pick by the same reviewer replaces the earlier one.
  pairs = buildPairs(questions, texts, [
    r("r1", "pick", { winner: "B" }, ["A", "B"], "2026-01-01"),
    r("r2", "pick", { winner: "A" }, ["A", "B"], "2026-01-02"),
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].chosen[0].content, "imported answer");

  // A tie gives nothing.
  assert.equal(buildPairs(questions, texts, [r("r3", "pick", { winner: null }, ["A", "B"], "2026-01-03")]).length, 0);

  // Fix: the correction beats what it was corrected from.
  pairs = buildPairs(questions, texts, [r("r4", "fix", { fromTextId: "A", textId: "E" }, ["A"], "2026-01-04")]);
  assert.equal(pairs[0].chosen[0].content, "corrected answer");
  assert.equal(pairs[0].rejected[0].content, "imported answer");
  assert.equal(pairs[0].meta.trainable, false, "a pair is trainable only when both texts are");

  // Ratings: 5,5,4 beats 2,1,2; 4,4,4 vs 3,4,4 is inside the margin.
  pairs = buildPairs(questions, texts, [
    r("r5", "rate", { textId: "A", scores: { faithful: 2, specific: 1, usable: 2 } }, ["A"], "2026-01-05"),
    r("r6", "rate", { textId: "B", scores: { faithful: 5, specific: 5, usable: 4 } }, ["B"], "2026-01-05"),
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].chosen[0].content, "engine answer");
  assert.equal(pairs[0].meta.origin, "rating");
  assert.equal(buildPairs(questions, texts, [
    r("r7", "rate", { textId: "A", scores: { faithful: 4, specific: 4, usable: 4 } }, ["A"], "2026-01-06"),
    r("r8", "rate", { textId: "B", scores: { faithful: 3, specific: 4, usable: 4 } }, ["B"], "2026-01-06"),
  ]).length, 0);

  // Write makes a supervised example, not a pair.
  assert.equal(buildPairs(questions, texts, [r("r9", "write", { textId: "W" }, [], "2026-01-07")]).length, 0);
  const sft = buildSft(questions, texts, [{ textId: "W", questionId: Q, stance: "claim" }, { textId: "A", questionId: Q, stance: null }]);
  assert.equal(sft.length, 1, "only own/edit texts are supervised examples");
  assert.deepEqual(sft[0].messages.map((m) => m.role), ["user", "assistant"]);
  assert.equal(sft[0].messages[1].content, "own answer");

  // Ratings as unpaired examples: good at a mean of 4+, bad at 2.5 or less, nothing between.
  const kto = buildKto(questions, texts, [
    r("k1", "rate", { textId: "A", scores: { faithful: 2, specific: 2, usable: 3 } }, ["A"], "2026-01-08"),
    r("k2", "rate", { textId: "B", scores: { faithful: 4, specific: 5, usable: 4 } }, ["B"], "2026-01-08"),
    r("k3", "rate", { textId: "W", scores: { faithful: 3, specific: 3, usable: 4 } }, ["W"], "2026-01-08"),
  ]);
  assert.deepEqual(kto.map((k) => [k.completion[0].content, k.label]), [["imported answer", false], ["engine answer", true]]);
});

check("explanations: validation", () => {
  const shown = ["Mars square Saturn brings   frustrated effort that hardens into discipline.", "Hard luck all round."];
  const bad = (raw: unknown, action = "pick") => assert.throws(() => cleanExplanation(raw, action, shown), ExplanationError);

  assert.equal(cleanExplanation(undefined, "pick", shown), undefined);
  assert.equal(cleanExplanation(null, "rate", shown), undefined);
  bad({ text: "   ", about: "winner" });
  bad({ text: "x".repeat(2001), about: "winner" });
  bad({ text: "fine", about: "answer" }, "pick");
  bad({ text: "fine", about: "winner" }, "rate");
  bad({ text: "fine", about: "winner" }, "write");
  bad({ text: "fine", about: "winner", severity: "fatal" });
  bad({ text: "fine", about: "winner", quote: "q".repeat(301) });
  bad("just a string");

  // A quote found in a shown answer is kept (spacing and case ignored); one that is not is dropped.
  const e = cleanExplanation({ text: "  Names the growth.  ", about: "winner", quote: "Frustrated effort that hardens", severity: "major" }, "pick", shown);
  assert.deepEqual(e, { text: "Names the growth.", about: "winner", quote: "Frustrated effort that hardens", severity: "major" });
  assert.equal(cleanExplanation({ text: "x", about: "loser", quote: "not in any answer" }, "pick", shown)?.quote, undefined);

  // Principles: only the known chips, only on rate and fix (a pick keeps them in reasons).
  assert.deepEqual(
    cleanExplanation({ text: "x", about: "answer", principles: ["less fatalistic", "made up", "less fatalistic"] }, "fix", shown)?.principles,
    ["less fatalistic"],
  );
  assert.equal(cleanExplanation({ text: "x", about: "both", principles: ["more specific"] }, "pick", shown)?.principles, undefined);
});

check("explanations: export", () => {
  const Q = "q-1";
  const questions = new Map<string, ExportQuestion>([[Q, { id: Q, prompt: "Interpret Mars square Saturn.", factorKeys: ["aspect:mars:saturn:square"], tradition: null }]]);
  const t = (id: string, body: string, kind = "import", trainable = true): [string, ExportText] => [id, { id, body, kind, tradition: null, sourceSlug: "s", trainable, model: null }];
  const texts = new Map<string, ExportText>([t("A", "imported answer"), t("B", "engine answer"), t("E", "corrected answer", "edit")]);
  const r = (id: string, action: string, payload: Record<string, unknown>, candidateIds: string[], createdAt: string): ExportReview =>
    ({ id, questionId: Q, reviewerId: "me", action, payload, candidateIds, stance: "claim", createdAt });
  const why = { text: "B names the growth; A is fatalistic.", about: "both" };

  const pick = r("p1", "pick", { winner: "B", reasons: ["less fatalistic"], explanation: why }, ["A", "B"], "2026-01-01");
  assert.deepEqual(buildPairs(questions, texts, [pick])[0].meta.explanation, why);
  assert.equal(buildPairs(questions, texts, [r("p0", "pick", { winner: "B" }, ["A", "B"], "2026-01-01")])[0].meta.explanation, undefined);

  const hi = r("k1", "rate", { textId: "B", scores: { faithful: 5, specific: 5, usable: 5 }, explanation: { text: "Exact.", about: "answer" } }, ["B"], "2026-01-02");
  const lo = r("k2", "rate", { textId: "A", scores: { faithful: 1, specific: 2, usable: 1 }, explanation: { text: "Doom.", about: "answer" } }, ["A"], "2026-01-02");
  const rp = buildPairs(questions, texts, [hi, lo])[0];
  assert.equal(rp.meta.explanation?.text, "Exact.");
  assert.equal(rp.meta.rejectedExplanation?.text, "Doom.");
  assert.equal(buildKto(questions, texts, [lo])[0].meta.explanation?.text, "Doom.");

  const fix = r("f1", "fix", { fromTextId: "A", textId: "E", explanation: { text: "Softened the fate language.", about: "answer" } }, ["A"], "2026-01-03");
  const rows = buildExplanations(questions, texts, [pick, hi, fix, r("s1", "skip", {}, [], "2026-01-04")]);
  assert.deepEqual(rows.map((x) => x.action), ["pick", "rate", "fix"]);
  assert.equal(rows[0].winner, "B");
  assert.deepEqual(rows[0].candidates.map((c) => c.text_id), ["A", "B"]);
  assert.deepEqual(rows[1].ratings, { text_id: "B", scores: { faithful: 5, specific: 5, usable: 5 } });
  assert.deepEqual(rows[2].edited, { from_text_id: "A", text_id: "E", body: "corrected answer" });
  assert.equal(rows[2].meta.questionId, Q, "rows carry the question so the eval split applies");
});

check("curated questions: possible and consistent", () => {
  const combos = combinationQuestions();
  const realms = realmQuestions();
  assert.equal(realms.length, 120);
  assert.equal(new Set([...combos, ...realms].map((q) => q.prompt)).size, combos.length + realms.length, "no duplicate prompts");
  const STEPS: Record<string, number[]> = { conjunction: [0], semisextile: [1], semisquare: [1, 2], sextile: [2], square: [3], trine: [4], sesquisquare: [4, 5], quincunx: [5], opposition: [6] };
  const SIGNS_ = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
  let checked = 0;
  for (const q of combos) {
    for (const k of q.factorKeys) {
      const f = FACTOR_BY_KEY.get(k);
      assert.ok(f, `${k} in registry`);
      assert.ok(!f!.impossible && !f!.unobserved, `${q.prompt} uses ${k}`);
    }
    const asp = q.factorKeys.find((k) => k.startsWith("aspect:"));
    if (!asp || q.pattern === "aspect") continue;
    const [, a, b, type] = asp.split(":");
    const sa = q.factorKeys.find((k) => k.startsWith(`sign:${a}:`))?.split(":")[2];
    const sb = q.factorKeys.find((k) => k.startsWith(`sign:${b}:`))?.split(":")[2];
    if (!sa || !sb) continue;
    const d0 = Math.abs(SIGNS_.indexOf(sa) - SIGNS_.indexOf(sb));
    const d = Math.min(d0, 12 - d0);
    assert.ok(STEPS[type].includes(d), `${q.prompt}: ${sa}–${sb} is ${d} signs, not a ${type}`);
    checked++;
  }
  for (const q of combos) {
    for (const k of q.factorKeys) {
      if (k === "sign:pluto:aries" || k === "sign:pluto:pisces" || k === "sign:neptune:taurus") assert.fail(`${q.prompt}: nobody alive has ${k}`);
    }
  }
  const byPattern: Record<string, number> = {};
  for (const q of combos) byPattern[q.pattern] = (byPattern[q.pattern] ?? 0) + 1;
  console.log(`    ${combos.length} combinations + ${realms.length} realm questions; ${checked} two-sign aspects checked`, byPattern);
});

check("evaluation scoring", () => {
  // Candidate is A in the first order and B in the second.
  assert.equal(pairScore("A", "B"), 1, "wins both orders");
  assert.equal(pairScore("B", "A"), 0, "loses both");
  assert.equal(pairScore("A", "A"), 0.5, "position-driven: first answer both times");
  assert.equal(pairScore("tie", "tie"), 0.5);
  assert.ok(passes({ main_points: "most", contradicts_standard: false, specific: 3, fatalistic_or_prescriptive: false, reason: "" }));
  assert.ok(!passes({ main_points: "all", contradicts_standard: true, specific: 5, fatalistic_or_prescriptive: false, reason: "" }));
  assert.ok(!passes({ main_points: "some", contradicts_standard: false, specific: 5, fatalistic_or_prescriptive: false, reason: "" }));
  const [lo, hi] = wilson(120, 150)!;
  assert.ok(lo > 0.72 && hi < 0.86, `wilson ${lo} ${hi}`);
});

check("reasoning: sentences and review payloads", () => {
  assert.deepEqual(splitSentences("Sun in Aries leads. Mars squares it!\n\nSo: courage?  Yes."), [
    "Sun in Aries leads.",
    "Mars squares it!",
    "So: courage?",
    "Yes.",
  ]);
  assert.deepEqual(splitSentences('He said "enough." Then left.'), ['He said "enough."', "Then left."]);

  const I = "11111111-1111-4111-8111-111111111111";
  const C = "22222222-2222-4222-8222-222222222222";
  const S = "33333333-3333-4333-8333-333333333333";
  assert.deepEqual(cleanReasoningPayload("step-verdict", { interpretationId: I, chainId: C, stepId: S, verdict: "wrong-reference", comment: "  wrong book  ", extra: 1 }), {
    interpretationId: I,
    chainId: C,
    stepId: S,
    verdict: "wrong-reference",
    comment: "wrong book",
  });
  assert.deepEqual(cleanReasoningPayload("chain-pick", { interpretationId: I, chainId: C, comment: "   " }), { interpretationId: I, chainId: C });
  assert.deepEqual(cleanReasoningPayload("step-add", { interpretationId: I, kind: "infer", body: " Mars rules the 7th " }), {
    interpretationId: I,
    kind: "infer",
    body: "Mars rules the 7th",
  });
  const bad: [Parameters<typeof cleanReasoningPayload>[0], Record<string, unknown>][] = [
    ["step-verdict", { interpretationId: I, chainId: C, stepId: S, verdict: "maybe" }],
    ["chain-verdict", { interpretationId: I, chainId: "not-a-uuid", verdict: "plausible" }],
    ["step-verdict", { interpretationId: I, chainId: C, verdict: "right" }],
    ["step-add", { interpretationId: I, kind: "infer", body: "" }],
    ["step-add", { interpretationId: I, afterStepId: S, kind: "cite", body: "x" }],
    ["chain-pick", { chainId: C }],
    ["chain-verdict", { interpretationId: I, chainId: C, verdict: "plausible", comment: "x".repeat(2001) }],
    ["ref-mark", { interpretationId: I, chunkId: "abc:12", verdict: "maybe" }],
    ["ref-mark", { interpretationId: I, verdict: "mine" }],
    ["ref-mark", { interpretationId: I, chunkId: "abc:12", statementOrdinal: -1, verdict: "mine" }],
    ["ref-mark", { interpretationId: I, chunkId: "abc:12", statementOrdinal: "2", verdict: "not" }],
  ];
  for (const [action, payload] of bad) assert.throws(() => cleanReasoningPayload(action, payload), ReasoningError, `${action} ${JSON.stringify(payload).slice(0, 80)}`);
  assert.deepEqual(cleanReasoningPayload("ref-mark", { interpretationId: I, chunkId: " abc:12 ", verdict: "related", note: "  same idea  ", extra: 1 }), {
    interpretationId: I,
    chunkId: "abc:12",
    statementOrdinal: null,
    verdict: "related",
    note: "same idea",
  });
  assert.equal(cleanReasoningPayload("ref-mark", { interpretationId: I, chunkId: "abc:12", statementOrdinal: 3, verdict: "mine" }).statementOrdinal, 3);
  const refs = cleanReferences([
    { rid: "R1", chunkId: "abc:12", statementOrdinal: 3, book: "B", pages: [4, "x"], factors: ["house:mars:7"] },
    { rid: "R1 again", chunkId: "abc:12", statementOrdinal: 3 },
    { rid: "R2", chunkId: "abc:12", statementOrdinal: null },
    { rid: "no chunk" },
    "junk",
  ]);
  assert.deepEqual(refs.map((r) => r.rid), ["R1", "R2"], "dropped: no chunkId, junk, duplicates");
  assert.deepEqual(refs[0].pages, [4]);
  assert.deepEqual(cleanReferences(undefined), [], "results stored before references existed");
});

check("reasoning: export", () => {
  const step = (id: string, ordinal: number, kind: string, trainable: boolean | null, basedOn: number[] = []): ReasoningExportStep => ({
    id,
    ordinal,
    kind,
    body: `${kind} ${ordinal}`,
    basedOn,
    factorKeys: [],
    statementId: null,
    textId: null,
    statement: kind === "cite" ? "Mars in the 7th brings quarrels" : null,
    passage: kind === "cite" ? "the passage" : null,
    source: kind === "cite" ? { book: "B", statement: "Mars in the 7th brings quarrels", excerpt: "…" } : {},
    trainable,
  });
  const steps = new Map([
    ["c1", [step("s2", 2, "cite", false), step("s1", 1, "observe", null), step("s3", 3, "infer", null, [1, 2])]],
    ["c2", [step("s4", 1, "cite", true)]],
  ]);
  const at = (n: number) => `2026-09-28T10:00:0${n}Z`;
  const records = buildReasoning(
    [
      { id: "i1", body: "Quarrels at home.", sentences: ["Quarrels at home."], factorKeys: ["house:mars:7"] },
      { id: "i2", body: "No chains yet.", sentences: ["No chains yet."], factorKeys: [] },
    ],
    [
      { id: "c2", interpretationId: "i1", ordinal: 2, sentences: [0], summary: "second", model: "m", promptVersion: "v" },
      { id: "c1", interpretationId: "i1", ordinal: 1, sentences: [0], summary: "first", model: "m", promptVersion: "v" },
    ],
    steps,
    [
      { id: "r2", reviewerId: "u", action: "step-verdict", payload: { interpretationId: "i1", chainId: "c1", stepId: "s3", verdict: "right" }, createdAt: at(2) },
      { id: "r1", reviewerId: "u", action: "step-verdict", payload: { interpretationId: "i1", chainId: "c1", stepId: "s3", verdict: "wrong" }, createdAt: at(1) },
      { id: "r3", reviewerId: "u", action: "chain-pick", payload: { interpretationId: "i1", chainId: "c2" }, createdAt: at(3) },
      { id: "r4", reviewerId: "u", action: "step-add", payload: { interpretationId: "i1", kind: "observe", body: "Mars rules the 4th" }, createdAt: at(4) },
    ],
  );
  assert.equal(records.length, 1, "interpretations without chains are left out");
  const r = records[0];
  assert.deepEqual(r.chains.map((c) => c.id), ["c1", "c2"]);
  assert.deepEqual(r.chains[0].steps.map((s) => s.id), ["s1", "s2", "s3"]);
  assert.equal(r.chains[0].steps[2].verdict?.verdict, "right", "the latest verdict wins");
  assert.deepEqual(r.chains[0].steps[2].basedOn, [1, 2]);
  const withheld = r.chains[0].steps[1];
  assert.equal(withheld.statement, null);
  assert.equal(withheld.passage, null);
  assert.equal(withheld.source.statement, undefined);
  assert.equal(withheld.source.book, "B", "ids and bibliographic data stay");
  assert.equal(r.chains[1].steps[0].statement, "Mars in the 7th brings quarrels", "cleared citations keep their text");
  assert.equal(r.meta.withheldCitations, 1);
  assert.equal(r.pick?.chainId, "c2");
  assert.equal(r.added_steps.length, 1);
  assert.deepEqual(r.history.map((h) => h.id), ["r1", "r2", "r3", "r4"]);
  assert.ok(!JSON.stringify(r).includes("birth"), "no birth data");
});

check("reasoning: retrieval labels from ref-marks", () => {
  const ref = (chunkId: string, statementOrdinal: number | null, trainable: boolean | null) => ({
    rid: chunkId,
    chunkId,
    docHash: "d",
    statementOrdinal,
    book: "B",
    author: null,
    pages: [1],
    headings: [],
    statement: `statement ${chunkId}`,
    excerpt: `excerpt ${chunkId}`,
    factors: [],
    trainable,
  });
  const at = (n: number) => `2026-10-01T10:00:0${n}Z`;
  const mark = (id: string, n: number, chunkId: string, statementOrdinal: number | null, verdict: string, note?: string) => ({
    id,
    reviewerId: "u",
    action: "ref-mark",
    payload: { interpretationId: "i1", chunkId, statementOrdinal, verdict, ...(note ? { note } : {}) },
    createdAt: at(n),
  });
  const [r] = buildReasoning(
    [{ id: "i1", body: "Quarrels at home.", sentences: ["Quarrels at home."], factorKeys: ["house:mars:7"], questionId: "q1", references: [ref("a", 1, null), ref("b", null, true), ref("c", 2, false), ref("d", null, null)] }],
    [{ id: "c1", interpretationId: "i1", ordinal: 1, sentences: [0], summary: "s", model: "m", promptVersion: "v" }],
    new Map(),
    [mark("m1", 1, "a", 1, "not"), mark("m2", 2, "a", 1, "mine", "this is it"), mark("m3", 3, "b", null, "related"), mark("m4", 4, "c", 2, "not")],
  );
  assert.ok(r.retrieval, "marked interpretations carry labels");
  assert.deepEqual(r.retrieval.query, { body: "Quarrels at home.", factor_keys: ["house:mars:7"] });
  assert.deepEqual(r.retrieval.positives.map((l) => [l.chunkId, l.note]), [["a", "this is it"]], "the latest mark wins");
  assert.deepEqual(r.retrieval.weak_positives.map((l) => l.chunkId), ["b"]);
  assert.deepEqual(r.retrieval.negatives.map((l) => l.chunkId), ["c"], "unmarked passages are not labels");
  assert.equal(r.retrieval.negatives[0].statement, null, "uncleared books lose their text");
  assert.equal(r.retrieval.negatives[0].book, "B");
  assert.equal(r.retrieval.positives[0].excerpt, "excerpt a");
  assert.equal(r.meta.questionId, "q1");
  const [none] = buildReasoning(
    [{ id: "i1", body: "x", sentences: ["x"], factorKeys: [] }],
    [{ id: "c1", interpretationId: "i1", ordinal: 1, sentences: [0], summary: "s", model: "m", promptVersion: "v" }],
    new Map(),
    [],
  );
  assert.equal(none.retrieval, null);
  assert.equal(none.meta.questionId, null);
});


check("ref-vote: payload validation", () => {
  const S = "11111111-1111-4111-8111-111111111111";
  const T = "22222222-2222-4222-8222-222222222222";
  const C = "33333333-3333-4333-8333-333333333333";
  const ok = cleanRefVotePayload({ statementId: S, textId: T, factorKey: "sign:mars:leo", chartId: C, elementId: "point:mars", verdict: "helpful", note: " keep ", extra: 1 });
  assert.deepEqual(ok, { textId: T, statementId: S, factorKey: "sign:mars:leo", chartId: C, elementId: "point:mars", verdict: "helpful", note: "keep" });
  assert.deepEqual(cleanRefVotePayload({ textId: T, factorKey: "aspect:sun:mars:square", verdict: "not" }), {
    textId: T,
    factorKey: "aspect:sun:mars:square",
    verdict: "not",
  }, "a passage vote needs no statement");
  assert.equal(cleanRefVotePayload({ statementId: S, textId: T, factorKey: "pattern:t-square", elementId: "pattern:t-square:sun-mars-pluto", verdict: "clear" }).verdict, "clear");
  assert.equal(patternPhraseOf("pattern:grand-trine"), "grand trine");
  assert.equal(patternPhraseOf("pattern:nonsense"), null);
  assert.equal(patternPhraseOf("sign:mars:leo"), null);
  assert.ok(Object.keys(REF_PATTERN_PHRASES).every((slug) => /^[a-z-]+$/.test(slug)));
  const bad: [Record<string, unknown>, RegExp][] = [
    [{ statementId: S, textId: T, factorKey: "sign:mars:nowhere", verdict: "helpful" }, /factorKey/],
    [{ statementId: S, textId: T, factorKey: "pattern:nonsense", verdict: "helpful" }, /factorKey/],
    [{ statementId: "x", textId: T, factorKey: "sign:mars:leo", verdict: "helpful" }, /statementId/],
    [{ statementId: S, factorKey: "sign:mars:leo", verdict: "helpful" }, /textId/],
    [{ factorKey: "sign:mars:leo", verdict: "helpful" }, /textId/],
    [{ statementId: S, textId: T, factorKey: "sign:mars:leo", verdict: "mine" }, /verdict/],
    [{ statementId: S, textId: T, factorKey: "sign:mars:leo", verdict: "helpful", elementId: "<script>" }, /elementId/],
    [{ statementId: S, textId: T, factorKey: "sign:mars:leo", verdict: "helpful", chartId: "nope" }, /chartId/],
    [{ statementId: S, textId: T, factorKey: "sign:mars:leo", verdict: "clear", note: "why" }, /cleared/],
    [{ statementId: S, textId: T, factorKey: "sign:mars:leo", verdict: "helpful", note: "x".repeat(501) }, /note/],
  ];
  for (const [p, re] of bad) assert.throws(() => cleanRefVotePayload(p), (e: unknown) => e instanceof ReasoningError && re.test(e.message), JSON.stringify(p).slice(0, 80));
});

check("ref-vote: latest wins, clear retracts, export as retrieval labels", () => {
  const at = (n: number) => new Date(Date.UTC(2026, 9, 1, 12, n)).toISOString();
  const vote = (id: string, n: number, textId: string, factorKey: string, verdict: string, extra: Record<string, unknown> = {}, reviewerId = "u1") => ({
    id,
    reviewerId,
    action: "ref-vote",
    payload: { textId, factorKey, elementId: "point:mars", verdict, ...extra },
    createdAt: at(n),
  });
  const reviews = [
    vote("v1", 1, "a", "sign:mars:leo", "not", { statementId: "s-old" }),
    vote("v2", 2, "a", "sign:mars:leo", "helpful", { note: "this one" }), // later, same passage (no statement): wins
    vote("v3", 3, "b", "sign:mars:leo", "helpful"),
    vote("v4", 4, "b", "sign:mars:leo", "clear"), // retracted
    vote("v5", 5, "c", "sign:mars:leo", "not"),
    vote("v6", 6, "a", "house:mars:11", "not", { statementId: "s-6" }), // same passage, other key: separate
    { ...vote("x1", 7, "d", "sign:mars:leo", "helpful"), action: "ref-mark" }, // other actions ignored
  ];
  const latest = latestRefVotes(reviews);
  assert.deepEqual([...latest.keys()].sort(), ["a|house:mars:11", "a|sign:mars:leo", "c|sign:mars:leo"]);
  assert.equal(latest.get("a|sign:mars:leo")!.payload.verdict, "helpful");
  // Per reviewer: another reviewer's vote doesn't override.
  const two = latestRefVotes([vote("w1", 1, "a", "sign:mars:leo", "helpful"), vote("w2", 2, "a", "sign:mars:leo", "not", {}, "u2")], true);
  assert.equal(two.size, 2);

  const st = (id: string, trainable: boolean): RefVotePassage => ({
    textId: id,
    passage: `passage ${id}`,
    book: "Book",
    author: "Author",
    pages: [12],
    headings: ["Mars"],
    trainable,
  });
  const statements = new Map([["a", st("a", true)], ["c", st("c", false)]]);
  const all = buildRefVoteRetrieval(reviews, statements, { withholdUncleared: false });
  assert.deepEqual(all.map((r) => r.id), ["house:mars:11|point:mars", "sign:mars:leo|point:mars"]);
  const leo = all[1];
  assert.deepEqual(leo.query, { factor_key: "sign:mars:leo", factor_label: "Mars in Leo", element_id: "point:mars" });
  assert.deepEqual(leo.positives.map((l) => [l.textId, l.statementId, l.note, l.passage]), [["a", null, "this one", "passage a"]]);
  assert.deepEqual(leo.negatives.map((l) => [l.textId, l.passage]), [["c", "passage c"]]);
  assert.equal(all[0].negatives[0].statementId, "s-6", "a named statement travels as context");
  assert.equal(leo.meta.trainable, false, "an uncleared book makes the full record untrainable");
  const cleared = buildRefVoteRetrieval(reviews, statements, { withholdUncleared: true });
  const leoC = cleared[1];
  assert.equal(leoC.meta.trainable, true);
  assert.equal(leoC.meta.withheld, 1);
  assert.equal(leoC.negatives[0].passage, null, "uncleared books lose their text");
  assert.equal(leoC.negatives[0].book, "Book", "but keep their ids and citation");
  assert.equal(leoC.positives[0].passage, "passage a");
  // A vote on a passage no longer in the corpus is dropped, not exported half-empty.
  assert.equal(buildRefVoteRetrieval([vote("z", 1, "gone", "sign:mars:leo", "helpful")], statements, { withholdUncleared: false }).length, 0);
});

check("claims: review payloads and sentence matching", () => {
  const T = "44444444-4444-4444-8444-444444444444";
  const S = "55555555-5555-4555-8555-555555555555";
  assert.deepEqual(cleanClaimPayload("claim-verdict", { statementId: S, textId: T, verdict: "accurate", note: "  fine  ", extra: 1 }), {
    statementId: S,
    textId: T,
    verdict: "accurate",
    note: "fine",
  });
  assert.deepEqual(cleanClaimPayload("claim-verdict", { statementId: S, textId: T, verdict: "partly", tagsAdd: ["house:saturn:7", "house:saturn:7"], tagsRemove: ["planet:mars"] }), {
    statementId: S,
    textId: T,
    verdict: "partly",
    fixes: ["placement"],
    tagsAdd: ["house:saturn:7"],
    tagsRemove: ["planet:mars"],
  }, "tag changes imply the placement fix; duplicates dropped");
  assert.deepEqual(cleanClaimPayload("claim-verdict", { statementId: S, textId: T, verdict: "partly", condition: " only by night " }).fixes, ["missing-condition"]);
  assert.deepEqual(cleanClaimPayload("claim-add", { textId: T, body: " Saturn in the 7th delays marriage. ", factorKeys: ["house:saturn:7"] }), {
    textId: T,
    body: "Saturn in the 7th delays marriage.",
    factorKeys: ["house:saturn:7"],
  });
  assert.deepEqual(cleanClaimPayload("claim-skip", { textId: T }), { textId: T });
  const bad: [Parameters<typeof cleanClaimPayload>[0], Record<string, unknown>][] = [
    ["claim-verdict", { statementId: S, textId: T, verdict: "maybe" }],
    ["claim-verdict", { statementId: "x", textId: T, verdict: "wrong" }],
    ["claim-verdict", { statementId: S, textId: T, verdict: "partly", fixes: ["not-in-passage"] }],
    ["claim-verdict", { statementId: S, textId: T, verdict: "accurate", fixes: ["placement"] }],
    ["claim-verdict", { statementId: S, textId: T, verdict: "partly", tagsAdd: ["house:saturn:13"] }],
    ["claim-verdict", { statementId: S, textId: T, verdict: "partly", tagsAdd: ["planet:mars"], tagsRemove: ["planet:mars"] }],
    ["claim-verdict", { statementId: S, textId: T, verdict: "wrong", fixes: ["bogus"] }],
    ["claim-add", { textId: T, body: "  ", factorKeys: [] }],
    ["claim-add", { textId: T, body: "x", factorKeys: "house:saturn:7" }],
    ["claim-skip", {}],
  ];
  for (const [action, payload] of bad) assert.throws(() => cleanClaimPayload(action, payload), ClaimError, `${action} ${JSON.stringify(payload).slice(0, 80)}`);
  assert.ok(isClaimAction("claim-verdict") && !isClaimAction("ref-mark"));

  const sentences = ["Saturn in the seventh house brings obstacles in marriage till the age of 30.", "If with Mars the wife is very sexual.", "Eighth house: weak eyesight."];
  assert.deepEqual(matchClaimSentences(sentences, ["Saturn in the seventh house delays marriage until 30.", "Mars with Saturn makes a sexual wife.", "Jupiter brings wealth."]), [[0], [1], []]);
});

check("claims: export", () => {
  const st = (id: string, ordinal: number, keys: string[]) => ({
    id,
    ordinal,
    body: `claim ${id}`,
    factorKeys: keys.map((key) => ({ key, role: "subject" })),
    conditionKeys: [],
    condition: "if with Mars",
    valence: "negative",
    certainty: "usually",
    register: "predictive",
    frame: { zodiac: "tropical" },
    lifeArea: 7,
    because: "the 7th is marriage",
  });
  const passage = (textId: string, trainable: boolean) => ({
    textId,
    body: `passage ${textId}`,
    headings: ["Saturn in the houses"],
    pages: [102],
    book: "B",
    author: null,
    docHash: "d",
    trainable,
    statements: [st(`${textId}-s2`, 1, ["planet:mars"]), st(`${textId}-s1`, 0, ["house:saturn:7", "planet:mars"])],
  });
  const at = (n: number) => `2026-10-01T10:00:0${n}Z`;
  const rv = (id: string, n: number, action: string, payload: Record<string, unknown>) => ({ id, reviewerId: "u", action, payload, createdAt: at(n) });
  const reviews = [
    rv("r2", 2, "claim-verdict", { textId: "t1", statementId: "t1-s1", verdict: "partly", fixes: ["placement"], tagsRemove: ["planet:mars"], tagsAdd: ["sign:saturn:libra"] }),
    rv("r1", 1, "claim-verdict", { textId: "t1", statementId: "t1-s1", verdict: "wrong" }),
    rv("r3", 3, "claim-add", { textId: "t1", body: "Late marriage.", factorKeys: ["house:saturn:7"] }),
    rv("r4", 4, "claim-verdict", { textId: "t2", statementId: "t2-s2", verdict: "accurate" }),
    rv("r5", 5, "claim-skip", { textId: "t3" }),
  ];
  const passages = [passage("t1", true), passage("t2", false), passage("t3", true)];
  const all = buildClaims(passages, reviews, { withholdUncleared: false });
  assert.deepEqual(all.map((r) => r.id), ["t1", "t2"], "a skip alone is not a label");
  const t1 = all[0];
  assert.deepEqual(t1.claims.map((c) => c.id), ["t1-s1", "t1-s2"], "claims in ordinal order");
  assert.equal(t1.claims[0].verdict?.verdict, "partly", "the latest verdict wins");
  assert.deepEqual(t1.claims[0].corrected_keys, ["house:saturn:7", "sign:saturn:libra"]);
  assert.equal(t1.claims[1].verdict, null);
  assert.deepEqual(t1.added_claims, [{ body: "Late marriage.", factorKeys: ["house:saturn:7"], note: null }]);
  assert.deepEqual(t1.history.map((h) => h.id), ["r1", "r2", "r3"]);
  assert.equal(all[1].passage, "passage t2", "the full file keeps uncleared text");
  const cleared = buildClaims(passages, reviews, { withholdUncleared: true });
  const t2 = cleared[1];
  assert.equal(t2.passage, null);
  assert.equal(t2.claims[0].body, null);
  assert.equal(t2.claims[0].because, null);
  assert.equal(t2.claims[1].verdict?.verdict, "accurate", "verdicts stay");
  assert.deepEqual(t2.headings, ["Saturn in the houses"]);
  assert.equal(t2.meta.withheld, true);
  assert.equal(cleared[0].passage, "passage t1");
});

check("vocab: payloads and replay", () => {
  const A = "66666666-6666-4666-8666-666666666661";
  const B = "66666666-6666-4666-8666-666666666662";
  const C = "66666666-6666-4666-8666-666666666663";
  const D = "66666666-6666-4666-8666-666666666664";
  assert.deepEqual(cleanVocabPayload("vocab-sort", { cardId: A, verdict: "group", group: "  Points   and angles ", preferred: " South Node ", extra: 1 }), {
    cardId: A,
    verdict: "group",
    groups: ["Points and angles"],
    preferred: "South Node",
  }, "a legacy single group is read as groups");
  assert.deepEqual(cleanVocabPayload("vocab-sort", { cardId: A, verdict: "group", groups: ["Planets", " malefics", "planets", "Malefics "] }).groups, ["Planets", "malefics"], "duplicates ignoring case dropped");
  assert.deepEqual(cleanVocabPayload("vocab-sort", { cardId: B, verdict: "group", sameAs: A }), { cardId: B, verdict: "group", sameAs: A }, "a synonym needs no group");
  assert.deepEqual(cleanVocabPayload("vocab-sort", { cardId: C, verdict: "not-a-term", group: "ignored", note: " a name " }), { cardId: C, verdict: "not-a-term", note: "a name" });
  assert.deepEqual(cleanVocabPayload("vocab-group", { from: "Points", to: " Points and angles " }), { from: "Points", to: "Points and angles" });
  const bad: [Parameters<typeof cleanVocabPayload>[0], Record<string, unknown>][] = [
    ["vocab-sort", { cardId: A, verdict: "group" }],
    ["vocab-sort", { cardId: A, verdict: "group", group: "   " }],
    ["vocab-sort", { cardId: A, verdict: "group", sameAs: A }],
    ["vocab-sort", { cardId: A, verdict: "maybe", group: "x" }],
    ["vocab-sort", { cardId: "x", verdict: "skip" }],
    ["vocab-sort", { cardId: A, verdict: "group", group: "x".repeat(81) }],
    ["vocab-sort", { cardId: A, verdict: "group", groups: [] }],
    ["vocab-sort", { cardId: A, verdict: "group", groups: "Planets" }],
    ["vocab-sort", { cardId: A, verdict: "group", groups: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] }],
    ["vocab-group", { from: "A", to: "A" }],
    ["vocab-group", { from: "A" }],
    ["vocab-undo", { reviewId: "nope" }],
  ];
  for (const [action, payload] of bad) assert.throws(() => cleanVocabPayload(action, payload), VocabError, `${action} ${JSON.stringify(payload).slice(0, 80)}`);
  assert.ok(isVocabAction("vocab-undo") && !isVocabAction("claim-add"));

  const at = (n: number) => `2026-10-01T10:00:${String(n).padStart(2, "0")}Z`;
  const rv = (id: string, n: number, action: string, payload: Record<string, unknown>) => ({ id, action, payload, createdAt: at(n) });
  const reviews = [
    rv("r1", 1, "vocab-sort", { cardId: A, verdict: "group", group: "Points" }),
    rv("r2", 2, "vocab-sort", { cardId: B, verdict: "group", sameAs: A, preferred: "Ketu" }),
    rv("r3", 3, "vocab-sort", { cardId: C, verdict: "group", group: "Nodes" }),
    rv("r4", 4, "vocab-group", { from: "Points", to: "Points and angles" }),
    rv("r5", 5, "vocab-group", { from: "Nodes", to: "Points and angles" }), // a merge
    rv("r6", 6, "vocab-sort", { cardId: D, verdict: "skip" }),
    rv("r7", 7, "vocab-sort", { cardId: D, verdict: "not-a-term" }),
    rv("r8", 8, "vocab-undo", { reviewId: "r7" }), // back to skipped
    rv("r9", 9, "vocab-sort", { cardId: C, verdict: "group", group: "Later" }),
  ];
  const s = replayVocab(reviews);
  assert.equal(s.decisions.get(A)?.group, "Points and angles", "renames apply");
  assert.equal(s.decisions.get(B)?.group, "Points and angles", "a synonym follows its main card");
  assert.equal(s.decisions.get(B)?.mainId, A);
  assert.equal(s.decisions.get(C)?.group, "Later", "a later sort wins over a merge");
  assert.equal(s.decisions.get(D)?.verdict, "skip", "undo restores the earlier decision");
  assert.deepEqual(s.groups, [{ name: "Points and angles", cards: 2 }, { name: "Later", cards: 1 }]);
  assert.equal(s.last?.id, "r9");
  assert.deepEqual(s.history.map((h) => h.id), ["r9", "r6", "r5", "r4", "r3", "r2", "r1"], "undone rows leave the history");
  // A cycle of synonyms stops instead of looping.
  const loop = replayVocab([
    rv("c1", 1, "vocab-sort", { cardId: A, verdict: "group", sameAs: B }),
    rv("c2", 2, "vocab-sort", { cardId: B, verdict: "group", sameAs: A, group: "G" }),
  ]);
  assert.ok(loop.decisions.get(A)?.mainId);
});

check("vocab: export", () => {
  const card = (id: string, term: string, books: number) => ({ id, norm: term.toLowerCase(), term, also: [], kindHint: "body_or_point", groupHint: null, books, uses: books * 10 });
  const at = (n: number) => `2026-10-01T10:00:0${n}Z`;
  const { records, groups } = buildVocab(
    [card("a", "South Node", 60), card("b", "Ketu", 18), card("c", "Moksha", 3), card("d", "Lunar", 1)],
    [
      { id: "r1", action: "vocab-sort", payload: { cardId: "a", verdict: "group", group: "Points", preferred: "Moon's south node" }, createdAt: at(1) },
      { id: "r2", action: "vocab-sort", payload: { cardId: "b", verdict: "group", sameAs: "a" }, createdAt: at(2) },
      { id: "r3", action: "vocab-sort", payload: { cardId: "c", verdict: "not-a-term" }, createdAt: at(3) },
    ],
  );
  const by = new Map(records.map((r) => [r.id, r]));
  assert.equal(by.get("a")?.label, "Moon's south node");
  assert.deepEqual(by.get("b")?.same_as, { id: "a", label: "Moon's south node" }, "sameAs resolves to the main card's label");
  assert.equal(by.get("b")?.group, "Points");
  assert.equal(by.get("c")?.decision, "not-a-term");
  assert.equal(by.get("d")?.decision, null);
  assert.deepEqual(groups, [{ name: "Points", parent: null, path: ["Points"], cards: 2, terms: ["Moon's south node"] }]);
  assert.ok(records.every((r) => r.meta.trainable));
});

check("vocab: example ratings and added terms", () => {
  const A = "77777777-7777-4777-8777-777777777771";
  const N = "77777777-7777-4777-8777-777777777772";
  assert.deepEqual(cleanVocabPayload("vocab-example", { cardId: A, example: 1, text: "Ketu in the 12th gives moksha.", book: " Book ", rating: "wrong-sense", note: " means the node ", x: 1 }), {
    cardId: A,
    example: 1,
    text: "Ketu in the 12th gives moksha.",
    book: "Book",
    rating: "wrong-sense",
    note: "means the node",
  });
  assert.deepEqual(cleanVocabPayload("vocab-add", { cardId: N, term: "  moksha ", fromCardId: A, fromExample: 0 }), { cardId: N, term: "moksha", fromCardId: A, fromExample: 0 });
  assert.deepEqual(cleanVocabPayload("vocab-add", { cardId: N, term: "Part of Fortune" }), { cardId: N, term: "Part of Fortune" });
  const bad: [Parameters<typeof cleanVocabPayload>[0], Record<string, unknown>][] = [
    ["vocab-example", { cardId: A, example: 0, text: "x", rating: "great" }],
    ["vocab-example", { cardId: A, example: -1, text: "x", rating: "good" }],
    ["vocab-example", { cardId: A, example: 0, text: "  ", rating: "good" }],
    ["vocab-example", { cardId: A, example: 0, text: "x", rating: "clear", note: "why" }],
    ["vocab-add", { cardId: N, term: "  " }],
    ["vocab-add", { cardId: N, term: "“”" }],
    ["vocab-add", { cardId: N, term: "x", fromExample: 0 }],
  ];
  for (const [action, payload] of bad) assert.throws(() => cleanVocabPayload(action, payload), VocabError, `${action} ${JSON.stringify(payload).slice(0, 80)}`);
  assert.equal(normTerm("  “Part  of Fortune,” "), "part of fortune");

  const at = (n: number) => `2026-10-01T11:00:0${n}Z`;
  const rv = (id: string, n: number, action: string, payload: Record<string, unknown>) => ({ id, action, payload, createdAt: at(n) });
  const s = replayVocab([
    rv("e1", 1, "vocab-example", { cardId: A, example: 0, text: "s0", rating: "good" }),
    rv("e2", 2, "vocab-example", { cardId: A, example: 1, text: "s1", rating: "weak" }),
    rv("e3", 3, "vocab-example", { cardId: A, example: 1, text: "s1", rating: "wrong-sense", note: "other sense" }),
    rv("e4", 4, "vocab-example", { cardId: A, example: 0, text: "s0", rating: "clear" }),
    rv("a1", 5, "vocab-add", { cardId: N, term: "moksha", fromCardId: A, fromExample: 1 }),
  ]);
  assert.deepEqual([...(s.examples.get(A)?.values() ?? [])].map((e) => [e.text, e.rating, e.note]), [["s1", "wrong-sense", "other sense"]], "latest wins, clear withdraws");
  assert.deepEqual(s.added.map((a) => [a.cardId, a.fromCardId, a.fromExample]), [[N, A, 1]]);
  assert.deepEqual(s.history.map((h) => h.id), ["a1", "e4", "e3", "e2", "e1"], "ratings and additions are undoable too");

  const { records } = buildVocab(
    [
      { id: A, norm: "ketu", term: "Ketu", also: [], kindHint: null, groupHint: null, books: 18, uses: 300 },
      { id: N, norm: "moksha", term: "moksha", also: [], kindHint: null, groupHint: null, books: 3, uses: 9 },
    ],
    [...[rv("e3", 3, "vocab-example", { cardId: A, example: 1, text: "s1", book: "B", rating: "wrong-sense", note: "other sense" })], rv("a1", 5, "vocab-add", { cardId: N, term: "moksha", fromCardId: A, fromExample: 1 })],
  );
  const by = new Map(records.map((r) => [r.id, r]));
  assert.deepEqual(by.get(A)?.example_ratings, [{ example: 1, text: "s1", book: "B", rating: "wrong-sense", note: "other sense" }]);
  assert.equal(by.get(A)?.source, "generated");
  assert.equal(by.get(N)?.source, "owner");
  assert.deepEqual(by.get(N)?.added_from, { cardId: A, term: "Ketu", example: 1 });
});

check("vocab: several groups per card, legacy rows, undo of everything", () => {
  const S = "88888888-8888-4888-8888-888888888881"; // Saturn
  const F = "88888888-8888-4888-8888-888888888882"; // fire
  const K = "88888888-8888-4888-8888-888888888883"; // Kronos, same as Saturn
  const N = "88888888-8888-4888-8888-888888888884"; // an added term
  const at = (n: number) => `2026-10-01T12:00:${String(n).padStart(2, "0")}Z`;
  const rv = (id: string, n: number, action: string, payload: Record<string, unknown>) => ({ id, action, payload, createdAt: at(n) });
  const base = [
    rv("m1", 1, "vocab-sort", { cardId: F, verdict: "group", group: "Elements" }), // a legacy single-group row
    rv("m2", 2, "vocab-sort", { cardId: S, verdict: "group", groups: ["Planets", "Malefics"] }),
    rv("m3", 3, "vocab-sort", { cardId: K, verdict: "group", sameAs: S }),
    rv("m4", 4, "vocab-sort", { cardId: F, verdict: "group", groups: ["Elements", "Triplicities"] }),
    rv("m5", 5, "vocab-group", { from: "Malefics", to: "Planets" }), // a merge into a group the card is already in
    rv("m6", 6, "vocab-example", { cardId: S, example: 0, text: "s0", rating: "good" }),
    rv("m7", 7, "vocab-example", { cardId: S, example: 0, text: "s0", rating: "weak" }),
    rv("m8", 8, "vocab-add", { cardId: N, term: "Kronos" }),
  ];
  const s = replayVocab(base);
  assert.deepEqual(s.decisions.get(F)?.groups, ["Elements", "Triplicities"]);
  assert.deepEqual(s.decisions.get(S)?.groups, ["Planets"], "a merge into a group it is already in leaves one");
  assert.deepEqual(s.decisions.get(K)?.groups, ["Planets"], "a synonym has all of its main card's groups");
  assert.deepEqual(s.groups, [{ name: "Planets", cards: 2 }, { name: "Elements", cards: 1 }, { name: "Triplicities", cards: 1 }]);
  assert.equal(replayVocab(base.slice(0, 1)).decisions.get(F)?.groups[0], "Elements", "a legacy row alone");

  const undo = (id: string, n: number, target: string) => rv(id, n, "vocab-undo", { reviewId: target });
  const u = replayVocab([...base, undo("u1", 9, "m5"), undo("u2", 10, "m7"), undo("u3", 11, "m8"), undo("u4", 12, "m4")]);
  assert.deepEqual(u.decisions.get(S)?.groups, ["Planets", "Malefics"], "undoing a merge restores the group");
  assert.equal(u.examples.get(S)?.get("s0")?.rating, "good", "undoing a rating restores the previous one");
  assert.ok(u.withdrawn.has(N) && !u.added.length, "an undone addition is withdrawn");
  assert.deepEqual(u.decisions.get(F)?.groups, ["Elements"], "undoing a re-sort restores the earlier groups");
  assert.equal(u.last?.id, "m6");

  const { records, groups } = buildVocab(
    [
      { id: S, norm: "saturn", term: "Saturn", also: [], kindHint: null, groupHint: null, books: 150, uses: 9000 },
      { id: F, norm: "fire", term: "fire", also: [], kindHint: null, groupHint: null, books: 140, uses: 3000 },
      { id: N, norm: "kronos", term: "Kronos", also: [], kindHint: null, groupHint: null, books: 2, uses: 4 },
    ],
    [...base, undo("u3", 11, "m8")],
  );
  const by = new Map(records.map((r) => [r.id, r]));
  assert.deepEqual(by.get(F)?.groups, ["Elements", "Triplicities"]);
  assert.equal(by.get(F)?.group, "Elements");
  assert.equal(by.get(N)?.withdrawn, true);
  assert.deepEqual(groups.find((g) => g.name === "Triplicities")?.terms, ["fire"]);
});

check("vocab: group names, merge suggestions, nesting", () => {
  assert.equal(groupKey("Aspects"), groupKey("aspect"));
  assert.equal(groupKey("Points & Angles"), groupKey("points and angles."));
  assert.equal(groupKey("Triplicities"), "triplicity");
  assert.equal(groupKey("Houses"), "house");
  assert.notEqual(groupKey("Sign"), groupKey("Sun"));
  assert.equal(matchGroup("ASPECTS", ["Sign", "Aspect"]), "Aspect");
  assert.equal(matchGroup("Malefic", ["Planet"]), null);
  assert.deepEqual(
    similarGroups([{ name: "Aspect", cards: 5 }, { name: "Aspects", cards: 1 }, { name: "Sign", cards: 11 }, { name: "Sun", cards: 1 }, { name: "Elemnt", cards: 1 }, { name: "Element", cards: 4 }]),
    [["Aspect", "Aspects"], ["Element", "Elemnt"]],
  );

  const at = (n: number) => `2026-10-01T13:00:${String(n).padStart(2, "0")}Z`;
  const rv = (id: string, n: number, action: string, payload: Record<string, unknown>) => ({ id, action, payload, createdAt: at(n) });
  const C = "99999999-9999-4999-8999-999999999991";
  const rows = [
    rv("p0", 0, "vocab-sort", { cardId: C, verdict: "group", groups: ["Malefics", "Planets"] }),
    rv("p1", 1, "vocab-group-parent", { group: "Malefics", parent: "Planets" }),
    rv("p2", 2, "vocab-group-parent", { group: "Planets", parent: "Bodies" }),
    rv("p3", 3, "vocab-group-parent", { group: "Bodies", parent: "Malefics" }), // a cycle: skipped
    rv("p4", 4, "vocab-group", { from: "Planets", to: "Planet" }), // a rename keeps the tree
  ];
  const s = replayVocab(rows);
  assert.deepEqual(Object.fromEntries(s.parents), { Malefics: "Planet", Planet: "Bodies" });
  assert.ok(s.groups.some((g) => g.name === "Bodies" && g.cards === 0), "a parent with no cards of its own is still a group");
  assert.ok(wouldCycle(s.parents, "Bodies", "Malefics"));
  assert.ok(!wouldCycle(s.parents, "Malefics", "Bodies"));
  const u = replayVocab([...rows, rv("u1", 5, "vocab-undo", { reviewId: "p1" })]);
  assert.equal(u.parents.get("Malefics"), undefined, "undoing a nesting un-nests");
  const top = replayVocab([...rows, rv("p5", 6, "vocab-group-parent", { group: "Malefics", parent: null })]);
  assert.equal(top.parents.has("Malefics"), false);
  assert.deepEqual(cleanVocabPayload("vocab-group-parent", { group: " Malefics ", parent: null }), { group: "Malefics", parent: null });
  assert.throws(() => cleanVocabPayload("vocab-group-parent", { group: "Aspect", parent: "aspects" }), VocabError);
  const { groups } = buildVocab([], rows);
  assert.deepEqual(groups.find((g) => g.name === "Malefics")?.path, ["Bodies", "Planet", "Malefics"]);
  assert.equal(groups.find((g) => g.name === "Bodies")?.parent, null);
});

// ── Foundations (src/foundations-rules.ts) ─────────────────────────────────

const F = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const fAt = (n: number) => `2026-10-02T09:00:${String(n).padStart(2, "0")}Z`;
const frv = (id: string, n: number, action: string, payload: Record<string, unknown>) => ({ id, action, payload, createdAt: fAt(n) });
const fSource = { mention: "m1", book: "Book A", author: "Ann Author", where: "Ch. 1 > Fire", pages: [12], quote: "Fire is enthusiasm itself.", context: "Before. Fire is enthusiasm itself. After.", role: "describes_element", mode: "general", facet: "itself", why: "Says what fire is.", reader: "sonnet", phrase: "enthusiasm itself" };
const fSheet = {
  lesson: "elements",
  title: "The four elements",
  version: "test",
  shelf: [{ doc: "abc", book: "Book A", mentions: 3 }],
  concepts: [
    { id: "fire", label: "Fire", stats: { mentions: 10, books: 2, by_role: { describes_element: 4 }, by_mode: { general: 6, natal: 3, transit: 1 }, not_element: 2 } },
    { id: "water", label: "Water", stats: { mentions: 5, books: 1 } },
  ],
  items: [
    { id: "0000000000000001", concept: "fire", kind: "trait", text: "enthusiasm", books: 2, uses: 3, sources: [fSource, { quote: "" }] },
    { id: "0000000000000002", concept: "fire", kind: "trait", text: "enthusiastic", facet: "itself", books: 1, uses: 1, sources: [fSource] },
    { id: "0000000000000003", concept: "fire", kind: "trait", text: "burnt out", facet: "excess", books: 1, uses: 1, sources: [] },
    { id: "0000000000000004", concept: "fire", kind: "image", text: "a forge", meaning: "shapes by heat", books: 1, uses: 1, sources: [fSource] },
    { id: "0000000000000005", concept: "fire", kind: "passage", text: "Transiting Mars lights a fire.", role: "placement", mode: "natal", books: 1, uses: 1, sources: [fSource] },
    { id: "0000000000000006", concept: "fire", kind: "passage", text: "the flames of love", role: "figurative", mode: "other", books: 1, uses: 1, sources: [fSource] },
    { id: "0000000000000007", concept: "water", kind: "trait", text: "feeling", books: 1, uses: 1, sources: [] },
    { id: "0000000000000007", concept: "water", kind: "trait", text: "a duplicate id", books: 1, uses: 1, sources: [] },
    { id: "0000000000000008", concept: "ether", kind: "trait", text: "unknown concept" },
    { id: "0000000000000009", concept: "fire", kind: "rumour", text: "unknown kind" },
    { concept: "fire", kind: "trait", text: "no id" },
  ],
};

check("foundations: reading a sheet and a term catalogue", () => {
  const s = readFoundationSheet(fSheet);
  assert.equal(s.lesson, "elements");
  assert.equal(s.items.length, 7);
  assert.equal(s.duplicates, 1);
  assert.deepEqual(s.rejected, { "unknown concept": 1, "unknown kind": 1, "no usable id": 1 });
  assert.deepEqual(s.concepts[0].stats, { mentions: 10, books: 2, byRole: { describes_element: 4 }, byMode: { general: 6, natal: 3, transit: 1 }, notElement: 2 });
  const [enth, , burnt, forge, mars, flames] = s.items;
  assert.equal(enth.sources.length, 1, "a source without a quote is dropped");
  assert.equal(enth.facet, "itself", "no facet means the element itself");
  assert.equal(enth.sources[0].why, "Says what fire is.");
  assert.equal(enth.sources[0].reader, "sonnet");
  assert.equal(enth.sources[0].phrase, "enthusiasm itself");
  assert.deepEqual([burnt.facet, burnt.degree], ["dominant", "extreme"], "the old word excess is filed under dominant, extreme");
  assert.deepEqual(["lack", "weak", "Deficiency", "lacking", "emphasis", "predominant", "itself", "sideways"].map(normFacet), ["lacking", "lacking", "lacking", "lacking", "dominant", "dominant", "itself", null]);
  assert.equal(forge.meaning, "shapes by heat");
  assert.deepEqual([mars.role, mars.mode, flames.role], ["placement", "natal", "figurative"]);
  assert.throws(() => readFoundationSheet({ lesson: "Bad Name", concepts: [], items: [] }), FoundationError);
  assert.throws(() => readFoundationSheet({ lesson: "terms", concepts: fSheet.concepts, items: [] }), FoundationError, "a lesson can't shadow the terms page");
  assert.throws(() => readFoundationSheet({ lesson: "x", concepts: [], items: [] }), FoundationError);

  const c = readCatalogue({
    book: "The Art of Chart Interpretation",
    author: "Tracy Marks",
    terms: [
      { id: "t1", term: "fire", group: "element", facet: "itself", keywords: ["energy", "energy", " drive "], secondary: ["needs air"], definition: "d", how_to_weigh: "h", pages: [14], pdf_pages: [14], book_pages: [27, 28], quote: "q" },
      { id: "t1", term: "again", group: "element" },
      { id: "t2", term: "odd", group: "made-up" },
      { term: "no id" },
    ],
  });
  assert.equal(c.terms.length, 2);
  assert.equal(c.duplicates, 1);
  assert.deepEqual(c.terms[0].keywords, ["energy", "drive"]);
  assert.equal(c.terms[1].group, "other");
  assert.equal(termPagesText(c.terms[0].pages, c.terms[0].bookPages), "scan p. 14 (book pp. 27-28)");
});

/** The sheet's items as rows with ids F(1)…: what the importer would have stored. */
const fItems = (): FoundationItem[] =>
  readFoundationSheet(fSheet).items.map((it, i) => ({ id: F(i + 1), lesson: "elements", concept: it.concept, kind: it.kind, key: it.key, text: it.text, meaning: it.meaning, role: it.role, mode: it.mode, facet: it.facet, books: it.books, uses: it.uses, sources: it.sources, origin: "books", stale: false }));

const fReviews = [
  frv("f01", 1, "foundation-define", { lesson: "elements", concept: "fire", text: "Fire is the urge to act." }),
  frv("f02", 2, "foundation-verdict", { itemId: F(1), verdict: "fits" }),
  frv("f03", 3, "foundation-verdict", { itemId: F(1), verdict: "core", note: "the heart of it" }),
  frv("f04", 4, "foundation-merge", { itemId: F(2), intoItemId: F(1) }),
  frv("f05", 5, "foundation-verdict", { itemId: F(3), verdict: "not" }),
  frv("f06", 6, "foundation-verdict", { itemId: F(4), verdict: "apt", meaning: "heat that shapes" }),
  frv("f07", 7, "foundation-correct", { itemId: F(5), mode: "transit" }),
  frv("f08", 8, "foundation-verdict", { itemId: F(5), verdict: "good" }),
  frv("f09", 9, "foundation-verdict", { itemId: F(6), verdict: "figure" }),
  frv("f10", 10, "foundation-add", { itemId: F(50), lesson: "elements", concept: "fire", kind: "trait", text: "courage" }),
  frv("f11", 11, "foundation-add", { itemId: F(51), lesson: "elements", concept: "fire", kind: "note", text: "Fire needs fuel." }),
];
const fOwn = (id: string, kind: "trait" | "note", text: string): FoundationItem => ({ id, lesson: "elements", concept: "fire", kind, key: `own-${id}`, text, meaning: null, role: null, mode: null, facet: "itself", books: 0, uses: 0, sources: [], origin: "owner", stale: false });

check("foundations: payloads and replay", () => {
  assert.deepEqual(cleanFoundationPayload("foundation-verdict", { itemId: F(1), verdict: "core", note: "  the   heart ", extra: 1 }), { itemId: F(1), verdict: "core", note: "the heart" });
  assert.deepEqual(cleanFoundationPayload("foundation-verdict", { itemId: F(1), verdict: "clear", note: "dropped" }), { itemId: F(1), verdict: "clear" });
  assert.deepEqual(cleanFoundationPayload("foundation-merge", { itemId: F(2), intoItemId: F(1) }), { itemId: F(2), intoItemId: F(1) });
  assert.deepEqual(cleanFoundationPayload("foundation-merge", { itemId: F(2) }), { itemId: F(2), intoItemId: null });
  assert.deepEqual(cleanFoundationPayload("foundation-correct", { itemId: F(5), mode: "transit", role: null }), { itemId: F(5), mode: "transit" });
  assert.deepEqual(cleanFoundationPayload("foundation-define", { lesson: "elements", concept: "fire", text: "  Fire is\r\n\r\n\r\n\r\nheat.  " }), { lesson: "elements", concept: "fire", text: "Fire is\n\nheat." });
  assert.deepEqual(cleanFoundationPayload("foundation-add", { itemId: F(9), lesson: "elements", concept: "fire", kind: "image", text: " a forge ", meaning: " shapes ", facet: "itself" }), {
    itemId: F(9),
    lesson: "elements",
    concept: "fire",
    kind: "image",
    text: "a forge",
    meaning: "shapes",
  });
  assert.equal(cleanFoundationPayload("foundation-add", { itemId: F(9), lesson: "elements", concept: "fire", kind: "trait", text: "listless", facet: "lack" }).facet, "lacking");
  const bad: [Parameters<typeof cleanFoundationPayload>[0], Record<string, unknown>][] = [
    ["foundation-verdict", { itemId: "x", verdict: "core" }],
    ["foundation-verdict", { itemId: F(1), verdict: "maybe" }],
    ["foundation-merge", { itemId: F(1), intoItemId: F(1) }],
    ["foundation-correct", { itemId: F(1) }],
    ["foundation-correct", { itemId: F(1), mode: "horary" }],
    ["foundation-correct", { itemId: F(1), role: "nonsense" }],
    ["foundation-define", { lesson: "elements", text: "x" }],
    ["foundation-add", { itemId: F(1), lesson: "elements", concept: "fire", kind: "passage", text: "x" }],
    ["foundation-add", { itemId: F(1), lesson: "elements", concept: "fire", kind: "trait", text: "   " }],
    ["foundation-add", { itemId: F(1), lesson: "elements", concept: "fire", kind: "trait", text: "x", facet: "sideways" }],
    ["foundation-undo", { reviewId: "nope" }],
    ["foundation-term-verdict", { termId: F(1), verdict: "core" }],
    ["foundation-term-keyword", { termId: F(1), keyword: "x" }],
    ["foundation-term-add-keyword", { termId: F(1), keyword: " " }],
  ];
  for (const [action, payload] of bad) assert.throws(() => cleanFoundationPayload(action, payload), FoundationError, `${action} ${JSON.stringify(payload).slice(0, 80)}`);
  assert.ok(isFoundationAction("foundation-undo") && !isFoundationAction("vocab-sort"));
  assert.ok(verdictFits("trait", "core") && verdictFits("passage", "figure") && verdictFits("image", "clear") && !verdictFits("image", "core"));

  const s = replayFoundations(fReviews);
  assert.equal(s.definitions.get("elements/fire")?.text, "Fire is the urge to act.");
  assert.deepEqual([s.verdicts.get(F(1))?.verdict, s.verdicts.get(F(1))?.note], ["core", "the heart of it"], "the latest verdict wins");
  assert.equal(headOf(s, F(2)), F(1));
  assert.equal(s.verdicts.has(F(2)), false, "a merged trait has no verdict of its own");
  assert.deepEqual(s.corrections.get(F(5)), { role: null, mode: "transit" });
  assert.equal(s.verdicts.get(F(50))?.verdict, "core", "his own trait stands as core");
  assert.equal(s.history[0].id, "f11");

  const e = buildConceptEntry("elements", "fire", [...fItems(), fOwn(F(50), "trait", "courage"), fOwn(F(51), "note", "Fire needs fuel.")], s);
  assert.deepEqual(e.traits.core.map((t) => [t.text, t.synonyms.map((x) => x.text), t.yours]), [["enthusiasm", ["enthusiastic"], false], ["courage", [], true]]);
  assert.deepEqual(e.traits.rejected.map((t) => [t.text, t.facet]), [["burnt out", "dominant"]]);
  assert.deepEqual(e.images.apt.map((i) => [i.meaning, i.modelMeaning]), [["heat that shapes", "shapes by heat"]]);
  const [good] = e.passages.good;
  assert.deepEqual([good.mode, good.modelMode, good.role, good.corrected], ["transit", "natal", "placement", true], "his mode correction stands, the model's is kept");
  assert.equal(good.citation?.book, "Book A");
  assert.deepEqual([e.figurative.figure.length, e.figurative.counts.length, e.passages.unreviewed], [1, 0, 0], "figurative uses are their own group");
  assert.deepEqual(e.notes.map((n) => n.text), ["Fire needs fuel."]);
  assert.deepEqual(e.progress, { total: 7, reviewed: 7 });
  assert.equal(citeText(good.citation), "Book A, Ann Author · Ch. 1 > Fire · p. 12");
  const water = buildConceptEntry("elements", "water", fItems(), s);
  assert.deepEqual([water.definition, water.traits.unreviewed, water.progress.reviewed], [null, 1, 0]);

  // A merge loop stops where it would repeat; a verdict un-merges.
  const loop = replayFoundations([frv("l1", 1, "foundation-merge", { itemId: F(1), intoItemId: F(2) }), frv("l2", 2, "foundation-merge", { itemId: F(2), intoItemId: F(1) })]);
  assert.ok([F(1), F(2)].includes(headOf(loop, F(1))));
  const apart = replayFoundations([...fReviews, frv("f12", 12, "foundation-verdict", { itemId: F(2), verdict: "fits" })]);
  assert.equal(headOf(apart, F(2)), F(2));
  // A stale item stays only when he reviewed it.
  const stale = fItems().map((it) => ({ ...it, stale: true }));
  assert.deepEqual(stale.filter((it) => itemStands(it, s)).map((it) => it.text).sort(), ["Transiting Mars lights a fire.", "a forge", "burnt out", "enthusiasm", "enthusiastic", "the flames of love"]);
});

check("foundations: undo", () => {
  const undone = (reviewId: string, n = 20) => replayFoundations([...fReviews, frv(`u-${reviewId}`, n, "foundation-undo", { reviewId })]);
  assert.equal(undone("f03").verdicts.get(F(1))?.verdict, "fits", "undoing the latest verdict brings back the one before");
  assert.equal(headOf(undone("f04"), F(2)), F(2), "undoing a merge separates the traits");
  assert.equal(undone("f07").corrections.has(F(5)), false, "undoing a correction brings back the model's reading");
  assert.equal(undone("f01").definitions.size, 0);
  const noAdd = undone("f10");
  assert.ok(noAdd.withdrawn.has(F(50)) && !noAdd.verdicts.has(F(50)) && !noAdd.added.some((a) => a.itemId === F(50)), "undoing an add withdraws the item");
  assert.equal(buildConceptEntry("elements", "fire", [...fItems(), fOwn(F(50), "trait", "courage")], noAdd).traits.core.length, 1);
  assert.equal(undone("f03").history.some((r) => r.id === "f03"), false, "an undone action can't be undone again");
  const cleared = replayFoundations([...fReviews, frv("f12", 12, "foundation-verdict", { itemId: F(1), verdict: "clear" })]);
  assert.equal(cleared.verdicts.has(F(1)), false);
});

const fTerm = { id: F(70), key: "t1", term: "fire", group: "element", facet: "itself", code: null, keywords: ["energy", "drive", "impulse"], secondary: ["needs air"], definition: "d", howToWeigh: null, figure: null, related: [], pages: [14], bookPages: [27, 28], quote: "Fire is energy.", note: null };
const fTermReviews = [
  frv("t01", 30, "foundation-term-verdict", { termId: F(70), verdict: "fix", note: "too narrow" }),
  frv("t02", 31, "foundation-term-keyword", { termId: F(70), keyword: "Impulse", keep: false }),
  frv("t03", 32, "foundation-term-add-keyword", { termId: F(70), keyword: "will" }),
  frv("t04", 33, "foundation-term-keyword", { termId: F(70), keyword: "needs air", keep: false }),
  frv("t05", 34, "foundation-term-note", { termId: F(70), note: "Check the counting rule." }),
  frv("t06", 35, "foundation-term-verdict", { termId: F(70), verdict: "right" }),
];

check("foundations: term catalogue decisions", () => {
  const s = replayFoundations(fTermReviews);
  const t = buildTermEntry(fTerm, s);
  assert.deepEqual(t.keywords, ["energy", "drive", "will"]);
  assert.deepEqual([t.droppedKeywords, t.addedKeywords, t.secondary, t.droppedSecondary], [["impulse"], ["will"], [], ["needs air"]]);
  assert.deepEqual([t.verdict, t.verdictNote, t.note], ["right", null, "Check the counting rule."]);
  assert.ok(termTouched(s, F(70)) && !termTouched(s, F(71)));
  const back = buildTermEntry(fTerm, replayFoundations([...fTermReviews, frv("t07", 36, "foundation-term-keyword", { termId: F(70), keyword: "impulse", keep: true }), frv("t08", 37, "foundation-term-keyword", { termId: F(70), keyword: "will", keep: false })]));
  assert.deepEqual(back.keywords, ["energy", "drive", "impulse"], "a struck keyword comes back; dropping his own removes it");
  const undone = buildTermEntry(fTerm, replayFoundations([...fTermReviews, frv("t09", 38, "foundation-undo", { reviewId: "t06" }), frv("t10", 39, "foundation-undo", { reviewId: "t02" })]));
  assert.deepEqual([undone.verdict, undone.verdictNote, undone.droppedKeywords], ["fix", "too narrow", []]);
  assert.equal(buildTermEntry(fTerm, replayFoundations([])).verdict, null);
});

check("foundations: export", () => {
  const lessons = [{ lesson: "elements", title: "The four elements", version: "test", concepts: [{ id: "fire", label: "Fire" }, { id: "water", label: "Water" }] }];
  const items = [...fItems(), fOwn(F(50), "trait", "courage"), fOwn(F(51), "note", "Fire needs fuel.")];
  const cats = [{ slug: "marks", book: "The Art of Chart Interpretation", author: "Tracy Marks", terms: [fTerm, { ...fTerm, id: F(71), key: "t2", term: "untouched" }] }];
  const out = buildFoundations(lessons, items, cats, [...fReviews, ...fTermReviews], { withholdQuotes: false });
  const fire = out.lessons[0].concepts[0];
  assert.equal(fire.definition, "Fire is the urge to act.");
  assert.deepEqual(fire.core_traits.map((t) => [t.text, t.synonyms]), [["enthusiasm", ["enthusiastic"]], ["courage", []]]);
  assert.deepEqual(fire.rejected_traits.map((t) => t.text), ["burnt out"]);
  assert.equal(fire.apt_images[0].meaning, "heat that shapes");
  assert.deepEqual([fire.good_passages[0].text, fire.good_passages[0].mode, fire.good_passages[0].model_mode, fire.good_passages[0].citation?.pages], ["Transiting Mars lights a fire.", "transit", "natal", [12]]);
  assert.equal(fire.figurative_only.length, 1);
  assert.deepEqual(fire.notes, ["Fire needs fuel."]);
  assert.deepEqual(fire.additions.map((a) => a.text), ["courage", "Fire needs fuel."]);
  assert.equal(out.lessons[0].concepts[1].core_traits.length, 0);
  assert.equal(out.term_catalogues[0].terms.length, 1, "only terms he touched are exported");
  assert.deepEqual([out.term_catalogues[0].terms[0].verdict, out.term_catalogues[0].terms[0].keywords, out.term_catalogues[0].terms[0].book_pages], ["right", ["energy", "drive", "will"], [27, 28]]);
  const held = buildFoundations(lessons, items, cats, [...fReviews, ...fTermReviews], { withholdQuotes: true });
  const hp = held.lessons[0].concepts[0].good_passages[0];
  assert.deepEqual([hp.text, hp.citation?.book, hp.mode], [null, "Book A", "transit"], "the trainable copy keeps the citation and the reading, not the book's words");
  assert.equal(held.term_catalogues[0].terms[0].quote, null);
  assert.equal(held.lessons[0].concepts[0].core_traits[0].text, "enthusiasm");
});

check("foundations: correspondence table", () => {
  const file = readCorrespondences({
    book: "How To Use Astrology",
    author: "Michael Erlewine",
    rows: [
      { id: "c1", subject_type: "sign", subject: "Virgo", category: "Fall", value: "Venus", page: 10, source: "Erlewine", scheme: "traditional" },
      { id: "c2", subject_type: "sign", subject: "virgo", category: "Fall", value: "Uranus", page: 10, source: "Erlewine", scheme: "later addition" },
      { id: "c3", subject_type: "sign", subject: "aries", category: "Color", value: "Red", page: 3 },
      { id: "c4", subject_type: "element", subject: "fire", category: "Keywords (list)", value: "apathetic", facet: "lack" },
      { id: "c4", subject_type: "element", subject: "fire", category: "Keywords (list)", value: "again" },
      { id: "c5", subject_type: "Bad Type", subject: "x", category: "y", value: "z" },
      { id: "c6", subject_type: "sign", subject: "aries", category: "Color" },
    ],
  });
  assert.deepEqual([file.rows.length, file.duplicates, file.rejected], [4, 1, { "unknown subject type": 1, "subject, category or value missing": 1 }]);
  assert.deepEqual([file.rows[0].subject, file.rows[1].scheme, file.rows[3].facet], ["virgo", "later addition", "lacking"]);
  assert.deepEqual(["Color", "Keywords (list)", "Body Part", "Tarot Trump", "Hot/Cold", "Ruling Planet", "Apostle"].map(categoryGroup), ["Nature", "Keywords", "Body & health", "Occult", "Classical sign classes", "Basics", "Religion & myth"]);
  assert.deepEqual(orderSubjects("sign", ["virgo", "aries", "fire signs"]), ["aries", "virgo", "fire signs"]);
  const cells = [
    ...file.rows.map((r, i) => ({ ...r, id: F(80 + i), bookSlug: "erlewine", book: file.book, author: file.author, origin: "books" as const, stale: false })),
    { id: F(90), key: "own-1", bookSlug: "owner", book: null, author: null, subjectType: "sign", subject: "aries", category: "Color", value: "Scarlet", page: null, source: null, derivedFrom: null, scheme: null, facet: null, degree: null, origin: "owner" as const, stale: false },
  ];
  const reviews = [
    frv("k1", 40, "foundation-cell-verdict", { cellId: F(80), verdict: "right" }),
    frv("k2", 41, "foundation-cell-verdict", { cellId: F(81), verdict: "right", scheme: "traditional" }),
    frv("k3", 42, "foundation-cell-verdict", { cellId: F(82), verdict: "fixed", value: "Bright red" }),
    frv("k4", 43, "foundation-cell-add", { cellId: F(90), subjectType: "sign", subject: "aries", category: "Color", value: "Scarlet" }),
    frv("k5", 44, "foundation-category", { category: "Color", ruling: "lore" }),
    frv("k6", 45, "foundation-category-add", { subjectType: "sign", category: "Season" }),
    frv("k7", 46, "foundation-cell-verdict", { cellId: F(81), verdict: "wrong" }),
    frv("k8", 47, "foundation-undo", { reviewId: "k7" }),
  ];
  const state = replayFoundations(reviews);
  const table = buildCorrTable(cells, state, "sign");
  assert.deepEqual(table.subjects, ["aries", "virgo"]);
  const row = (name: string) => table.groups.flatMap((g) => g.categories).find((c) => c.category === name)!;
  assert.deepEqual(row("Fall").cells.virgo.map((v) => [v.value, v.scheme, v.bookScheme, v.verdict]), [["Venus", "traditional", "traditional", "right"], ["Uranus", "traditional", "later addition", "right"]], "two values in one cell both stand; undo brought back the earlier verdict");
  assert.deepEqual(row("Color").cells.aries.map((v) => [v.value, v.original, v.yours]), [["Bright red", "Red", false], ["Scarlet", null, true]]);
  assert.deepEqual([row("Color").ruling, row("Season").yours, row("Season").cells], ["lore", true, {}]);
  assert.deepEqual([table.total, table.judged], [4, 3]);
  const fire = buildSubjectView(cells, state, "element", "fire");
  assert.deepEqual(fire.facets.map((f) => [f.facet, f.categories.map((c) => c.values.map((v) => v.value))]), [["lacking", [["apathetic"]]]]);
  const out = buildCorrespondencesExport(cells, reviews);
  assert.deepEqual(out.confirmed_cells.map((c) => [c.value, c.verdict]).sort(), [["Bright red", "fixed"], ["Scarlet", "yours"], ["Uranus", "right"], ["Venus", "right"]]);
  assert.equal(out.categories.find((c) => c.category === "Color")?.ruling, "lore");
  assert.ok(out.categories.some((c) => c.category === "Season" && c.added_by_owner));
  const gone = replayFoundations([...reviews, frv("k9", 48, "foundation-undo", { reviewId: "k4" })]);
  assert.equal(buildCorrTable(cells, gone, "sign").groups.flatMap((g) => g.categories).find((c) => c.category === "Color")!.cells.aries.length, 1, "undoing his added value withdraws it");
  assert.throws(() => cleanFoundationPayload("foundation-cell-verdict", { cellId: F(1), verdict: "fixed" }), FoundationError);
  assert.throws(() => cleanFoundationPayload("foundation-category", { category: "Color", ruling: "maybe" }), FoundationError);
});

check("library: files, merged keywords, glossary", () => {
  const outline = readLibraryFile("outline", { book: "Woolfolk", sections: [{ key: "sign:jupiter:capricorn", kind: "planet_in_sign", text: "JUPITER IN CAPRICORN …", doc: "d", chunks: [1] }, { key: "sign:jupiter:capricorn", text: "again" }, { key: "nonsense", text: "x" }] });
  assert.deepEqual([outline.entries.length, outline.rejected, outline.entries[0].silo, outline.entries[0].kind], [1, 2, "sign:jupiter:capricorn", "section"]);
  assert.equal(readLibraryFile("people", { book: "B", people: [] }).entries.length, 0, "an empty people file is fine");
  assert.deepEqual(readLibraryFile("people", { book: "B", people: [{ id: "p1", name: "Elvis Presley", placement: "sign:sun:capricorn" }] }).entries.map((e) => [e.title, e.silo]), [["Elvis Presley", "sign:sun:capricorn"]]);
  assert.equal(placementLabel("sign:north_node:leo"), "North Node in Leo");
  const src = (book: string, where: string | null, via: "passages" | "keyword list" = "passages") => ({ book, author: null, pages: [], where, via });
  const kws = mergeKeywords([
    { text: "impulsive", facet: "itself", source: src("A", "ch 1"), itemId: "i1" },
    { text: "enthusiastic", facet: "itself", source: src("A", "ch 1"), itemId: "i2" },
    { text: "Enthusiastic", facet: "itself", source: src("B", null, "keyword list") },
    { text: "enthusiastic", facet: "itself", source: src("C", "ch 9"), itemId: "i2" },
    { text: "apathetic", facet: "lacking", source: src("B", null, "keyword list") },
  ]);
  assert.deepEqual(kws.map((k) => [k.text, k.facet, k.books, k.itemIds]), [["enthusiastic", "itself", 3, ["i2"]], ["impulsive", "itself", 1, ["i1"]], ["apathetic", "lacking", 1, []]], "most-agreed first; single-book words follow, nothing dropped");
  const gl = mergeGlossary([
    { term: "Midheaven", also: ["MC"], book: "Woolfolk", definition: "The highest point." },
    { term: "midheaven", also: ["Medium Coeli"], book: "Marks", definition: "", keywords: ["career"] },
    { term: "MC", also: [], book: "Woolfolk", definition: "See Midheaven." },
    { term: "Affliction", also: [], book: "Woolfolk", definition: "A hard aspect." },
  ]);
  assert.deepEqual(gl.map((t) => [t.term, t.definitions.length]), [["Affliction", 1], ["MC", 1], ["Midheaven", 2]]);
  assert.deepEqual([gl[2].also, gl[1].see], [["MC", "Medium Coeli"], { term: "Midheaven", slug: "midheaven" }]);
});

check("library: notes", () => {
  const silo = { type: "element", subject: "fire" };
  assert.deepEqual(cleanLibraryNote({ target_type: "keyword", target_id: "element/fire|itself|warm", silo, text: "  too vague\r\n\r\n\r\n\r\nsay more ", context: "Fire  keyword “warm”", extra: 1 }), {
    target_type: "keyword",
    target_id: "element/fire|itself|warm",
    silo,
    text: "too vague\n\nsay more",
    context: "Fire keyword “warm”",
  });
  assert.equal(cleanLibraryNote({ target_type: "silo", target_id: "element/fire", silo, text: "" }).text, "", "an empty note is allowed: it removes");
  for (const bad of [{ target_type: "verdict", target_id: "x", silo, text: "a" }, { target_type: "silo", silo, text: "a" }, { target_type: "silo", target_id: "x", text: "a" }, { target_type: "silo", target_id: "x", silo, text: "a".repeat(4001) }])
    assert.throws(() => cleanLibraryNote(bad), FoundationError);
  const row = (id: string, n: number, target_type: string, target_id: string, text: string) => ({ id, createdAt: fAt(n), payload: { target_type, target_id, silo, text, context: `about ${target_id}` } });
  const rows = [row("n1", 1, "silo", "element/fire", "first"), row("n2", 2, "keyword", "k1", "odd word"), row("n3", 3, "silo", "element/fire", "second"), row("n4", 4, "keyword", "k1", ""), row("n5", 5, "passage", "p1", "good one")];
  const notes = replayLibraryNotes(rows);
  assert.deepEqual([...notes.keys()], ["silo|element/fire", "passage|p1"], "the latest wins; an empty note removes");
  assert.deepEqual([notes.get("silo|element/fire")!.text, notes.get("silo|element/fire")!.history], ["second", [{ text: "first", createdAt: fAt(1) }]], "earlier wordings are kept");
  const back = replayLibraryNotes([...rows, row("n6", 6, "keyword", "k1", "back again")]).get("keyword|k1")!;
  assert.deepEqual([back.text, back.history.map((h) => h.text)], ["back again", ["odd word"]]);
  const out = buildLibraryNotes(rows);
  assert.deepEqual(out.map((n) => [n.note, n.about, n.target_type, n.silo.subject, n.earlier_versions.length]), [["good one", "about p1", "passage", "fire", 0], ["second", "about element/fire", "silo", "fire", 1]]);
});

check("library: keyword tone and label, readings matched to silos", () => {
  const src = (book: string, extra: Partial<KeywordSource> = {}): KeywordSource => ({ book, author: null, pages: [], where: null, via: "keyword list", ...extra });
  const kws = mergeKeywords([
    { text: "warm", facet: "itself", source: src("Bolton", { tone: "positive", label: "Heart", line: "Heart: warm, generous." }) },
    { text: "Warm", facet: "itself", source: src("Marks") },
    { text: "vain", facet: "itself", source: src("Bolton", { tone: "negative" }) },
    { text: "proud", facet: "itself", source: src("Marks") },
  ]);
  assert.deepEqual(kws.map((k) => [k.text, k.tones, k.label]), [["warm", ["positive"], "Heart"], ["proud", [], null], ["vain", ["negative"], null]], "tone only where a book gives one");
  assert.deepEqual(readingSilos("sun in leo", ["sun/leo square neptune", "capricorn", "mc/cancer", "ascendant libra", "sun/leo + moon/capricorn"]).sort(), [
    "placement/sign:ascendant:libra",
    "placement/sign:midheaven:cancer",
    "placement/sign:moon:capricorn",
    "placement/sign:sun:leo",
    "planet/moon",
    "planet/neptune",
    "planet/sun",
    "point/ascendant",
    "point/midheaven",
    "sign/cancer",
    "sign/capricorn",
    "sign/leo",
    "sign/libra",
  ]);
  const file = readLibraryFile("readings", { book: "Bolton", sentences: [{ page: 12, placement: "moon in capricorn", sentence: "She feels secure (Moon) when responsible (Capricorn).", parts: [{ says: "feels secure", because: "moon" }, { says: "responsible", because: "capricorn" }], note: "" }, { page: 12, sentence: "" }] });
  assert.deepEqual([file.entries.length, file.rejected, file.entries[0].kind, file.entries[0].key], [1, 1, "reading", "p12-1"]);
  assert.deepEqual((file.entries[0].payload.silos as string[]).sort(), ["placement/sign:moon:capricorn", "planet/moon", "sign/capricorn"]);
  const corr = readCorrespondences({ book: "B", rows: [{ id: "x1", subject_type: "planet", subject: "sun", category: "Keywords (list)", value: "ego", tone: "negative", label: "Self", note: "Self: ego." }, { id: "x2", subject_type: "planet", subject: "sun", category: "Keywords (list)", value: "vital", tone: "" }] });
  assert.deepEqual(corr.rows.map((r) => [r.tone, r.label, r.note]), [["negative", "Self", "Self: ego."], [null, null, null]]);
});

check("library: book outlines, sections filed into silos, kinds of reading", () => {
  const filed = (type: string, ...subjects: string[]) => sectionSilos(type, subjects);
  assert.deepEqual(filed("planet_in_sign", "jupiter in capricorn"), ["placement/sign:jupiter:capricorn"]);
  assert.deepEqual(filed("planet_in_house", "mars in house 7"), ["placement/house:mars:7"]);
  assert.deepEqual(filed("planet_aspect_planet", "sun square moon", "Moon Square Sun"), ["placement/aspect:sun:moon:square"]);
  assert.deepEqual(filed("ascendant_sign", "ascendant in leo"), ["placement/sign:ascendant:leo"]);
  assert.deepEqual(filed("sign_pair", "taurus with aries"), ["placement/compat:aries:taurus"]);
  assert.deepEqual(filed("cusp", "aries with pisces"), ["sign/aries", "sign/pisces"]);
  assert.deepEqual(filed("house", "house 7", "all planets in house 2"), ["house/7", "house/2"]);
  assert.deepEqual(filed("sign", "capricorn", "taurus with each other sign", "aries first decan"), ["sign/capricorn", "sign/taurus", "sign/aries"]);
  assert.deepEqual(filed("aspect", "trine", "conjunct"), ["aspect/trine", "aspect/conjunction"]);
  assert.deepEqual(filed("node", "north node", "south node in house 2"), ["point/north node"], "the registry has no south node placements: not guessed");
  assert.deepEqual(filed("aspect_pattern", "yod", "grand trine"), ["aspect_configuration/yod (finger of god)", "aspect_configuration/grand trine"]);
  assert.deepEqual([filed("sign", "all signs", "signs"), filed("planet", "planets", "moon pairs"), filed("people", "oprah winfrey"), filed("method", "saturn")], [[], [], [], []], "nothing is guessed");
  assert.deepEqual(["general", "natal", "synastry", "transit", "progression", "example", "technique", "front_back", null].map(readingGroup), ["general", "natal", "synastry", "transit", "progression", "example", "other", "other", "unknown"]);
  assert.ok(readingGroupRank("general") < readingGroupRank("natal") && readingGroupRank("natal") < readingGroupRank("synastry") && readingGroupRank("example") < readingGroupRank("other") && readingGroupRank("other") < readingGroupRank(null));
  const file = readSectionsFile({
    book: "B",
    doc: "abc",
    sections: [{ from: 3, to: 5, title: "Mars in the houses", level: 2, chapter: "Mars", kind: "natal", subject_type: "planet_in_house", subjects: ["mars in house 7"], layout: "prose" }, { from: 9, to: 2, title: "bad" }],
    passages: { "3": { kind: "natal", title: "Mars in the houses", chapter: "Mars", subject_type: "planet_in_house", subjects: ["mars in house 7"], layout: "prose" }, "4": { kind: "weird", subject_type: "none", subjects: [] }, x: {} },
  });
  assert.deepEqual([file.sections.length, file.stamps.length, file.rejected], [1, 2, 2]);
  assert.deepEqual([file.stamps[0].silos, file.stamps[1].kind, file.sections[0].silos], [["placement/house:mars:7"], "other", ["placement/house:mars:7"]]);
  assert.equal(placementLabel("house:mars:7").toLowerCase().includes("mars"), true);
});

check("library: book cards", () => {
  const { cards, rejected } = readBookCards({
    cards: [
      { slug: "a-book", title: "A Book", author: "An Author", passages: 100, sections: 12, tradition: "western_modern", type: "reference", shape: "Front matter, then twelve sign chapters.", kinds: { natal: 80, general: 20 }, basic_material: { glossary: [{ from: 90, to: 99, what: "glossary A-Z" }], signs: [{ from: 5, to: 60, what: "the twelve signs" }, { what: "no range" }], houses: [] }, also_has: ["a table of rulers", ""], text_quality: "damaged_headings; body clean", priority: "high", duplicate_of: "" },
      { slug: "a-book", title: "again" },
      { title: "no slug" },
      { slug: "b", title: "B", priority: "urgent", text_quality: "Good - clean" },
    ],
  });
  assert.deepEqual([cards.length, rejected], [2, 2]);
  assert.deepEqual([Object.keys(cards[0].basics), cards[0].basics.signs, cards[0].alsoHas, cards[0].quality, cards[0].priority, cards[0].duplicateOf], [["glossary", "signs"], [{ from: 5, to: 60, what: "the twelve signs" }], ["a table of rulers"], "damaged_headings", "high", null]);
  assert.deepEqual([cards[1].priority, cards[1].quality, cards[1].basics], [null, "good", {}]);
});

console.log(`\n${passed} checks passed`);
