/**
 * Readers for the two Hugging Face datasets in $CORPUS_DIR/hf, shared by
 * extract-questions.ts (file output) and import-hf.ts (database).
 *
 * ocaklisemih/astrology_dialogs: 8,412 Q&A rows. A question is kept when it is
 * a question, is about astrology, does not depend on the text it was
 * extracted from (a trailing "according to the text" is stripped when what
 * remains stands alone), and is not a duplicate. Its answer comes along as a
 * candidate to grade.
 *
 * GuruDharamSingh/astrology-compatibility: 1,008 prompts (ordered sign pair ×
 * 7 life areas). Order does not matter for compatibility, so pairs are folded
 * to 78; five life areas become tradition-neutral questions and the two
 * dasha/dosha areas Vedic ones. Answers are not carried: they are template
 * fills that do not depend on the signs (profiled 2026-09-26).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { SIGNS, type SignKey } from "@elkdonis/astro";
import { compatKey, FACTOR_BY_KEY, signName } from "../src/factors";
import { tagText } from "../src/tagger";
import { normalizeQuestion, questionViability, stripSourceClause } from "../src/questions";
import type { ImportItem, SourceInput } from "../src/server";

export interface DatasetBatch {
  source: SourceInput;
  items: ImportItem[];
  report: Record<string, unknown>;
}

const readJsonl = (p: string) =>
  readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

export function dialogs(corpusDir: string): DatasetBatch {
  const slug = "hf:ocaklisemih/astrology_dialogs";
  const rows = readJsonl(path.join(corpusDir, "hf/ocaklisemih__astrology_dialogs/train.jsonl")) as {
    conversations: { from: string; value: string }[];
  }[];
  const dropped: Record<string, number> = {};
  const droppedExamples: Record<string, string[]> = {};
  const seen = new Map<string, ImportItem>();
  let duplicates = 0;
  let stripped = 0;

  rows.forEach((r, i) => {
    const raw = r.conversations.find((t) => t.from === "human")?.value?.trim() ?? "";
    const answer = r.conversations.find((t) => t.from === "gpt")?.value?.trim() ?? null;
    let prompt = raw;
    let v = questionViability(prompt);
    if (!v.ok && v.reason === "source-bound") {
      const s = stripSourceClause(raw);
      if (s) {
        prompt = s;
        v = { ok: true };
        stripped++;
      }
    }
    if (!v.ok) {
      dropped[v.reason] = (dropped[v.reason] ?? 0) + 1;
      const ex = (droppedExamples[v.reason] ??= []);
      if (ex.length < 5) ex.push(raw);
      return;
    }
    const norm = normalizeQuestion(prompt);
    const prev = seen.get(norm);
    if (prev) {
      (prev.meta!.duplicateRows as number[]).push(i);
      duplicates++;
      return;
    }
    const tags = tagText(prompt);
    seen.set(norm, {
      sourceRef: `row:${i}`,
      prompt,
      original: prompt !== raw ? raw : null,
      type: tags.length ? "interpret" : "ask",
      tradition: null,
      tags,
      answer,
      meta: { duplicateRows: [] as number[] },
    });
  });

  const items = [...seen.values()];
  const byKind: Record<string, number> = {};
  for (const it of items) {
    const kinds = new Set(it.tags.map((t) => t.key.split(":")[0]));
    if (!kinds.size) byKind.untagged = (byKind.untagged ?? 0) + 1;
    for (const k of kinds) byKind[k] = (byKind[k] ?? 0) + 1;
  }

  return {
    source: {
      slug,
      title: "astrology_dialogs",
      author: "ocaklisemih (Hugging Face)",
      kind: "dataset",
      licence: "unknown",
      trainable: false,
      url: "https://huggingface.co/datasets/ocaklisemih/astrology_dialogs",
      notes:
        "8,412 two-turn Q&A rows, English. No licence or creation method on the card. Short popular-astrology answers, apparently extracted from books by a model. Downloaded 2026-09-26.",
      meta: { rows: rows.length, file: "hf/ocaklisemih__astrology_dialogs/train.jsonl" },
      importer: "astro-corpus/hf-datasets.ts#dialogs",
    },
    items,
    report: { rows: rows.length, kept: items.length, duplicates, sourceClauseStripped: stripped, dropped, droppedExamples, keptByFactorKind: byKind },
  };
}

export function compatibility(corpusDir: string): DatasetBatch {
  const slug = "hf:GuruDharamSingh/astrology-compatibility";
  const dir = path.join(corpusDir, "hf/GuruDharamSingh__astrology-compatibility");
  const rows = ["train", "val", "test"].flatMap((s) => readJsonl(path.join(dir, `${s}.jsonl`))) as { instruction: string; input: string }[];

  const AREA: Record<string, { phrase: string; vedic: boolean }> = {
    "love and romance": { phrase: "in love and romance", vedic: false },
    "finance and wealth": { phrase: "in money and shared finances", vedic: false },
    "career and success": { phrase: "in career and work together", vedic: false },
    "marriage and children": { phrase: "in marriage and raising children", vedic: false },
    "social life": { phrase: "in social life and friendship", vedic: false },
    "dasha cycles": { phrase: "through their dasha periods", vedic: true },
    "dosha effects": { phrase: "when a dosha is present in either chart", vedic: true },
  };

  const groups = new Map<string, { a: SignKey; b: SignKey; area: string; rows: number[]; original: string }>();
  rows.forEach((r, i) => {
    const m = r.instruction.match(/between (\w+) and (\w+)/);
    const area = r.input.match(/^Focus on (.+?),/)?.[1];
    if (!m || !area || !AREA[area]) return;
    const a = m[1].toLowerCase() as SignKey;
    const b = m[2].toLowerCase() as SignKey;
    const key = `${compatKey(a, b)}|${area}`;
    const g = groups.get(key) ?? { a, b, area, rows: [], original: `${r.instruction} ${r.input}` };
    g.rows.push(i);
    groups.set(key, g);
  });

  const order = (s: SignKey) => SIGNS.findIndex((x) => x.key === s);
  const items: ImportItem[] = [];
  for (const [key, g] of groups) {
    const fk = key.split("|")[0];
    if (!FACTOR_BY_KEY.has(fk)) continue;
    const [x, y] = order(g.a) <= order(g.b) ? [g.a, g.b] : [g.b, g.a];
    const pair = x === y ? `two ${signName(x)} Suns` : `a ${signName(x)} Sun and a ${signName(y)} Sun`;
    const area = AREA[g.area];
    items.push({
      sourceRef: `${fk}|${g.area}`,
      prompt: `How compatible are ${pair} ${area.phrase}?`,
      original: g.original,
      type: "interpret",
      tradition: area.vedic ? "vedic" : null,
      tags: [{ key: fk, confidence: "explicit", match: g.original }],
      answer: null,
      meta: { rows: g.rows, area: g.area },
    });
  }

  return {
    source: {
      slug,
      title: "astrology-compatibility",
      author: "GuruDharamSingh (Hugging Face)",
      kind: "dataset",
      licence: "owner",
      trainable: false,
      url: "https://huggingface.co/datasets/GuruDharamSingh/astrology-compatibility",
      notes:
        "14,400 rows generated 2025-09-05: 144 ordered sign pairs × 7 life areas, template outputs filled independently of the signs. Imported as questions only; the outputs stay in the raw files for judge testing. Terms are the publisher's (an elastrocal owner) to set.",
      meta: { rows: rows.length, dir: "hf/GuruDharamSingh__astrology-compatibility" },
      importer: "astro-corpus/hf-datasets.ts#compatibility",
    },
    items,
    report: { rows: rows.length, distinctPrompts: groups.size, kept: items.length },
  };
}
