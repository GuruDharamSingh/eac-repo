import { createHash, randomInt } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ASPECTS, BODIES, SIGNS } from "@elkdonis/astro";
import { FACTOR_BY_KEY, aspectKey, isFactorKey } from "@elkdonis/astro-corpus";
import { ReviewError, recordReview, upsertSource } from "@elkdonis/astro-corpus/server";
import { db } from "@elkdonis/db";
import { ownerOrResponse } from "@/lib/owner-api";

/**
 * "Ask me": plain consultation questions for the owner to answer in his own
 * words, with his reason why (Justin, 2026-10-04). Not the digest's claims
 * restated: a person, an area of life, a placement.
 *
 *   Someone with Mars in Scorpio in the 2nd house is having trouble with money. What would you tell them?
 *   This person has the Sun in Leo square Mars in Taurus. What might you say?
 *
 * Made on demand from templates (houses × concerns × placements × aspects:
 * far more than a million), half of them from placements the library has
 * passages on, so an answer can be compared with the books. A question is
 * saved to astro_questions (origin 'generated', type 'scenario', source
 * "scenario-generator") when it is shown; the answer is a studio 'write'
 * review on it, like "Write your own" in the web deck, so it reaches the
 * same training export, with his reason, conviction (0-5) and voice memo.
 *
 * GET  → { question: { id, prompt, keys, house, form }, stats }
 * POST { questionId, answer, why?, voice?, conviction?, seconds? }      answer it
 * POST { questionId, action: "skip" | "flag", reason? }                pass, or "not a good question"
 */

const PLANETS = BODIES.filter((b) => b.group === "planet").map((b) => b.key);
const MAJOR = ASPECTS.filter((a) => a.major);
const NAME = Object.fromEntries(BODIES.map((b) => [b.key, b.name])) as Record<string, string>;
const SIGN = Object.fromEntries(SIGNS.map((s) => [s.key, s.name])) as Record<string, string>;
const ASPECT_WORD: Record<string, string> = { conjunction: "conjunct", sextile: "sextile", square: "square", trine: "trine", opposition: "opposite" };
const SIGN_STEPS: Record<string, number> = { conjunction: 0, sextile: 2, square: 3, trine: 4, opposition: 6 };
const ord = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const pick = <T,>(xs: readonly T[]): T => xs[randomInt(xs.length)];
const the = (p: string) => (p === "sun" || p === "moon" ? `the ${NAME[p]}` : NAME[p]);

/** What people bring to an astrologer, by the house that rules it. */
const CONCERNS: Record<number, string[]> = {
  1: ["is unsure who they really are", "worries about how they come across to others", "has been low on energy and vitality"],
  2: ["is having trouble with money", "struggles with their sense of self-worth", "can't seem to hold on to what they earn"],
  3: ["finds it hard to say what they mean", "is at odds with a brother or sister", "can't settle their restless mind to study"],
  4: ["has a difficult home life", "is struggling with a parent", "wants to know whether to move house"],
  5: ["wants to know about having children", "has lost their creative spark", "is looking for romance"],
  6: ["is unhappy in their daily job", "keeps running into health problems", "is overwhelmed by routine and duty"],
  7: ["is struggling in their marriage", "keeps attracting the wrong partners", "is caught up in a dispute with someone"],
  8: ["is going through a loss or a crisis", "is tangled up in debt or shared money", "is afraid of real intimacy"],
  9: ["is searching for meaning or a faith", "wonders whether to study further or travel abroad", "has lost their sense of direction in life"],
  10: ["wants to know what career to follow", "feels stuck in their career", "is worried about their reputation"],
  11: ["feels lonely and without real friends", "wonders whether their hopes will come true", "doesn't feel they belong to any group"],
  12: ["feels isolated and alone", "has anxieties they can't name", "keeps undermining themselves without knowing why"],
};
const ASKS = ["What would you tell them?", "What should they do?", "How would you respond?", "What might you say to them?"];

interface Draft {
  form: string;
  prompt: string;
  keys: string[];
  house: number | null;
}

/** A placement the library has passages on (sign and house of one planet tagged together, or a placement key). */
async function supportedPlacement(): Promise<{ planet: string; sign: string; house: number } | null> {
  const [r] = await db<{ factor_key: string }[]>`
    SELECT factor_key FROM astro_statement_factors
    WHERE factor_key LIKE 'placement:%' AND factor_key ~ '^placement:(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto):'
    OFFSET floor(random() * (SELECT count(*) FROM astro_statement_factors WHERE factor_key LIKE 'placement:%')) LIMIT 1
  `;
  if (!r) return null;
  const [, planet, sign, house] = r.factor_key.split(":");
  return { planet, sign, house: Number(house) };
}

async function supportedAspect(): Promise<{ a: string; b: string; aspect: string } | null> {
  const [r] = await db<{ factor_key: string }[]>`
    SELECT factor_key FROM astro_statement_factors TABLESAMPLE SYSTEM (2)
    WHERE factor_key ~ '^aspect:(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto):(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto):(conjunction|sextile|square|trine|opposition)$'
    LIMIT 1
  `;
  if (!r) return null;
  const [, a, b, aspect] = r.factor_key.split(":");
  return { a, b, aspect };
}

async function draft(): Promise<Draft> {
  const roll = randomInt(100);
  // Placement in a house, with the concern of that house (half from the library's own placements).
  if (roll < 55) {
    const p = (roll < 30 ? await supportedPlacement() : null) ?? { planet: pick(PLANETS), sign: pick(SIGNS).key, house: 1 + randomInt(12) };
    const concern = pick(CONCERNS[p.house]);
    const keys = [`placement:${p.planet}:${p.sign}:${p.house}`, `sign:${p.planet}:${p.sign}`, `house:${p.planet}:${p.house}`, `realm:${p.house}`];
    const prompt =
      randomInt(2) === 0
        ? `Someone with ${the(p.planet)} in ${SIGN[p.sign]} in the ${ord(p.house)} house ${concern}. ${pick(ASKS)}`
        : `Someone ${concern}. They have ${the(p.planet)} in ${SIGN[p.sign]} in their ${ord(p.house)} house. ${pick(ASKS)}`;
    return { form: "placement-concern", prompt, keys, house: p.house };
  }
  // Two planets in their signs, in aspect.
  if (roll < 85) {
    const s = (await supportedAspect()) ?? { a: pick(PLANETS), b: pick(PLANETS), aspect: pick(MAJOR).key };
    let { a, b } = s;
    if (a === b) b = PLANETS[(PLANETS.indexOf(a) + 1 + randomInt(PLANETS.length - 1)) % PLANETS.length];
    const key = aspectKey(a as never, b as never, s.aspect as never);
    if (FACTOR_BY_KEY.get(key)?.impossible) return draft();
    const i = randomInt(12);
    const signA = SIGNS[i].key;
    const signB = SIGNS[(i + (randomInt(2) ? 1 : -1) * SIGN_STEPS[s.aspect] + 12) % 12].key;
    const prompt =
      randomInt(3) === 0
        ? `This person has ${the(a)} in ${SIGN[signA]} ${ASPECT_WORD[s.aspect]} ${the(b)} in ${SIGN[signB]}. What might you say?`
        : `Someone comes to you with ${the(a)} in ${SIGN[signA]} ${ASPECT_WORD[s.aspect]} ${the(b)} in ${SIGN[signB]}. What would you tell them about it?`;
    return { form: "aspect-signs", prompt, keys: [key, `sign:${a}:${signA}`, `sign:${b}:${signB}`], house: null };
  }
  // A planet in a house, asked about that area of life.
  const planet = pick(PLANETS);
  const house = 1 + randomInt(12);
  const concern = pick(CONCERNS[house]);
  return {
    form: "planet-house",
    prompt: `Someone ${concern}, and they have ${the(planet)} in the ${ord(house)} house. ${pick(ASKS)}`,
    keys: [`house:${planet}:${house}`, `realm:${house}`],
    house,
  };
}

let sourceId: string | null = null;
async function scenarioSource(): Promise<string> {
  sourceId ??= await upsertSource({
    slug: "scenario-generator",
    title: "Consultation questions (generated)",
    author: "Jerusalem app, templates",
    kind: "generated",
    licence: "owner",
    trainable: true,
    notes: "House concerns × placements × aspects; answered by the owner in his own words with his reasons.",
    importer: "elastrocal /api/mobile/v1/deck/scenarios",
  });
  return sourceId;
}

export async function GET() {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const source = await scenarioSource();
  for (let tries = 0; tries < 8; tries++) {
    const d = await draft();
    const keys = d.keys.filter(isFactorKey);
    const ref = `scn:${createHash("sha1").update(d.prompt).digest("hex").slice(0, 16)}`;
    const [q] = await db<{ id: string; answered: boolean }[]>`
      WITH ins AS (
        INSERT INTO astro_questions (org_id, type, prompt, factor_keys, priority, origin, source_id, source_ref, meta)
        VALUES ('elastrocal', 'scenario', ${d.prompt}, ${keys}, 0, 'generated', ${source}, ${ref}, ${db.json({ form: d.form, house: d.house, generator: "scenario-v1" } as never)})
        ON CONFLICT (source_id, source_ref) DO NOTHING
        RETURNING id
      )
      SELECT id, FALSE AS answered FROM ins
      UNION ALL
      SELECT q.id, EXISTS (SELECT 1 FROM astro_reviews r WHERE r.question_id = q.id AND r.reviewer_id = ${viewer.userId}) AS answered
      FROM astro_questions q WHERE q.source_id = ${source} AND q.source_ref = ${ref}
      LIMIT 1
    `;
    if (q && !q.answered) {
      const [st] = await db<{ answered: number }[]>`
        SELECT count(DISTINCT r.question_id)::int AS answered FROM astro_reviews r JOIN astro_questions q ON q.id = r.question_id
        WHERE q.source_id = ${source} AND r.reviewer_id = ${viewer.userId} AND r.action = 'write'
      `;
      return NextResponse.json({ question: { id: q.id, prompt: d.prompt, keys, house: d.house, form: d.form }, stats: { answered: st?.answered ?? 0 } });
    }
  }
  return NextResponse.json({ error: "No new question this time; try again" }, { status: 503 });
}

export async function POST(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const questionId = typeof b?.questionId === "string" ? b.questionId : "";
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  const seconds = typeof b?.seconds === "number" && b.seconds >= 0 && b.seconds < 86400 ? b.seconds : null;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const action = b?.action === "skip" ? "skip" : b?.action === "flag" ? "flag" : "write";
  const payload: Record<string, unknown> = {};
  if (action === "flag") payload.reason = text(b?.reason, 300) || "not a good question";
  if (action === "write") {
    const answer = text(b?.answer, 6000);
    const voice = typeof b?.voice === "string" && b.voice.startsWith("Private/Jerusalem/") && !b.voice.includes("..") ? b.voice : null;
    if (!answer && !voice) return NextResponse.json({ error: "Say or write an answer" }, { status: 400 });
    // The answer text is the training target; a voice-only answer is kept by path until it is transcribed.
    payload.body = answer || "(answered by voice; transcript to follow)";
    payload.tradition = null;
    const why = text(b?.why, 3000);
    if (why) payload.why = why;
    if (voice) payload.voice = voice;
    if (typeof b?.conviction === "number" && Number.isInteger(b.conviction) && b.conviction >= 0 && b.conviction <= 5) payload.conviction = b.conviction;
    payload.app = "jerusalem";
  }
  try {
    const r = await recordReview({ reviewerId: viewer.userId, questionId, action, payload, candidateIds: [], shownOrder: [], stance: null, seconds, device: "android" });
    return NextResponse.json({ ok: true, reviewId: r.reviewId });
  } catch (e) {
    if (e instanceof ReviewError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[mobile] scenario answer failed", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
