/**
 * Keyword-system smoke test: `pnpm --filter @elkdonis/astro test:keywords`.
 *
 * 1. The book's worked example (Sun in Capricorn in the 7th sextile Saturn
 *    in Scorpio in the 5th) must choose the words the book chose.
 * 2. Every planet × sign × house × aspect combination must read without
 *    throwing, never repeat a word within a reading, and never let a
 *    positive word into an inharmonious reading or vice versa.
 * 3. The chart-level reading and the question retrieval must run on a real
 *    computed chart.
 */

import assert from "node:assert/strict";
import { SIGNS } from "../src/constants";
import type { AspectKey } from "../src/types";
import { ask, readAspect, readChart, ALL_KEYWORDS, PLANET_KEYS, aspectNature, type AspectSpec } from "../src/keywords";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const bookExample: AspectSpec = {
  a: { planet: "sun", sign: "capricorn", house: 7 },
  b: { planet: "saturn", sign: "scorpio", house: 5 },
  type: "sextile",
  exactness: 0.9,
};

console.log("lexicon");
check("every keyword has a usable noun form and at least one domain", () => {
  for (const k of ALL_KEYWORDS) {
    assert.ok(k.n.length > 0, k.id);
    assert.ok(k.domains.length > 0, k.id);
  }
});
check("ids are unique", () => {
  const ids = ALL_KEYWORDS.map((k) => k.id);
  assert.equal(new Set(ids).size, ids.length);
});
check("qualities carry adjectives", () => {
  const missing = ALL_KEYWORDS.filter((k) => k.role === "quality" && !k.adj);
  assert.deepEqual(missing.map((k) => k.id), []);
});

console.log("the book's example");
const r = readAspect(bookExample);
const text = r.steps.map((s) => [s.note ?? "", ...s.units.map((u) => u.learn)].join("\n")).join("\n");
console.log(text.split("\n").map((l) => "    " + l).join("\n"));
console.log("\n    CHARACTER: " + r.character + "\n    CIRCUMSTANCES: " + r.circumstances);
console.log("    ABBREVIATED:\n" + r.abbreviated.map((s) => "      " + s).join("\n"));

check("sextile is harmonious → positive sets only", () => {
  assert.equal(r.nature.nature, "harmonious");
  for (const u of r.units) for (const k of u.keywords) assert.notEqual(k.set, "neg", k.id);
});
check("step 4 pairs Sun's generosity with Capricorn's justice, and Saturn with the secret forces / healing of Scorpio", () => {
  const s4 = r.steps[3].units.map((u) => u.learn.toLowerCase()).join(" ");
  assert.ok(/justice|ambition/.test(s4), s4);
  assert.ok(/generosity|dignity|ambitions/.test(s4), s4);
  assert.ok(/secret forces|healing|secret investigations|regeneration/.test(s4), s4);
});
check("step 7 reads Saturn in the 5th as few children / conservative education / investments", () => {
  const s7 = r.steps[6].units.map((u) => u.learn.toLowerCase()).join(" ");
  assert.ok(/few \(saturn\) children/.test(s7), s7);
  assert.ok(/educational|investments|publishing|pleasures/.test(s7), s7);
  assert.ok(/partner|public|marriage/.test(s7), s7);
});
check("steps 8 and 9 each produce one sevenfold sentence naming all seven factors", () => {
  for (const step of [r.steps[7], r.steps[8]]) {
    assert.equal(step.units.length, 1, step.title);
    const t = step.units[0].learn;
    for (const factor of ["(Sun)", "(Saturn)", "(Capricorn)", "(Scorpio)", "(7th)", "(5th)", "(sextile)"]) assert.ok(t.includes(factor), `${factor} in ${t}`);
  }
});
/** A counting sentence ("few children") may share its house word with a describing one ("disciplined children"), as the book's example does. */
const isCounting = (u: { step: number; keywords: Array<{ det?: string }> }) => u.step === 7 && Boolean(u.keywords[0]?.det);
/** No repeats within a block: character (steps 4–5), circumstance (7), each sevenfold sentence. Across blocks the book itself repeats. */
function assertNoRepeats(units: Array<{ step: number; keywords: Array<{ id: string; det?: string; owner?: string; factor?: string }> }>, label: string) {
  // Steps 4 and 7 are per planet: the planet's own words may not repeat, the sign's/house's may (two planets in one sign).
  const block = (u: { step: number; keywords: Array<{ owner?: string; factor?: string }> }) => {
    const planet = u.keywords.find((k) => k.factor === "planet")?.owner ?? "";
    return u.step === 4 ? `s4:${planet}` : u.step === 5 ? "s5" : u.step === 7 ? `s7:${planet}` : `s${u.step}`;
  };
  const seen = new Map<string, Set<string>>();
  for (const u of units) {
    const set = seen.get(block(u)) ?? new Set<string>();
    seen.set(block(u), set);
    const ks = isCounting(u) ? u.keywords.slice(0, 1) : u.keywords;
    for (const k of ks) {
      assert.ok(!set.has(k.id), `${label}: ${k.id} repeated in ${block(u)}`);
      set.add(k.id);
    }
  }
}
check("no keyword is said twice in one block of the reading", () => assertNoRepeats(r.units, r.label));
check("plain summary names no planet, sign or house", () => {
  const plain = `${r.character} ${r.circumstances}`;
  assert.ok(!/\b(Sun|Saturn|Capricorn|Scorpio|sextile|7th|5th)\b/.test(plain), plain);
});

console.log("conjunction nature");
check("benefics harmonious, malefics inharmonious, mixed is softened", () => {
  assert.equal(aspectNature("conjunction", "venus", "jupiter").nature, "harmonious");
  assert.equal(aspectNature("conjunction", "mars", "saturn").nature, "inharmonious");
  const mixed = aspectNature("conjunction", "venus", "uranus");
  assert.equal(mixed.mixed, true);
  assert.equal(mixed.softenedBy, "venus");
  assert.equal(aspectNature("conjunction", "moon", "mercury").nature, "harmonious");
  assert.equal(aspectNature("conjunction", "moon", "saturn").nature, "inharmonious");
});
check("a mixed conjunction keeps the benefic's positive words and the malefic's negative ones", () => {
  const m = readAspect({ a: { planet: "venus", sign: "leo", house: 5 }, b: { planet: "pluto", sign: "leo", house: 5 }, type: "conjunction" });
  assert.equal(m.nature.mixed, true);
  for (const u of m.units) for (const k of u.keywords) {
    if (k.owner === "venus") assert.notEqual(k.set, "neg", k.id);
    if (k.owner === "pluto") assert.notEqual(k.set, "pos", k.id);
  }
});

console.log("exhaustive");
check("every planet pair × aspect reads, and set discipline holds", () => {
  const types: AspectKey[] = ["conjunction", "sextile", "square", "trine", "opposition"];
  let count = 0;
  for (const pa of PLANET_KEYS) for (const pb of PLANET_KEYS) {
    if (pa === pb) continue;
    for (const type of types) {
      const sa = SIGNS[(count * 7) % 12].key;
      const sb = SIGNS[(count * 5 + 3) % 12].key;
      const spec: AspectSpec = { a: { planet: pa, sign: sa, house: (count % 12) + 1 }, b: { planet: pb, sign: sb, house: ((count * 5) % 12) + 1 }, type };
      const rr = readAspect(spec);
      assert.ok(rr.steps[3].units.length >= 1, `${rr.label}: step 4 empty`);
      assert.ok(rr.steps[6].units.length >= 1, `${rr.label}: step 7 empty`);
      assert.ok(rr.steps[7].units.length === 1 && rr.steps[8].units.length === 1, `${rr.label}: sevenfold missing`);
      assertNoRepeats(rr.units, rr.label);
      for (const u of rr.units) for (const k of u.keywords) {
        if (!rr.nature.mixed) {
          if (rr.nature.nature === "harmonious") assert.notEqual(k.set, "neg", `${rr.label}: ${k.id}`);
          else assert.notEqual(k.set, "pos", `${rr.label}: ${k.id}`);
        }
      }
      count++;
    }
  }
  console.log(`    ${count} readings`);
});
check("every planet × sign × house placement reads on basic words", () => {
  let n = 0;
  for (const p of PLANET_KEYS) for (const s of SIGNS) for (let h = 1; h <= 12; h++) {
    const rr = readAspect({ a: { planet: p, sign: s.key, house: h }, b: { planet: p === "sun" ? "moon" : "sun", sign: "aries", house: 1 }, type: "trine" });
    assert.ok(rr.units.length > 0);
    n++;
  }
  console.log(`    ${n} placements`);
});

console.log("whole chart");
// The golden chart from engine-smoke, without the engine: positions typed by hand.
const chart = {
  engineVersion: "test",
  input: { date: "1990-05-15", time: "14:30", timezone: "America/New_York", latitude: 40.7, longitude: -74, houseSystem: "P" as const, timeKnown: true },
  utc: "1990-05-15T18:30:00Z",
  julianDayUt: 0,
  ephemeris: "swiss" as const,
  bodies: [
    { key: "sun" as const, longitude: 54.5, latitude: 0, speed: 1, retrograde: false, sign: "taurus" as const, signDegree: 24.5, house: 9 },
    { key: "moon" as const, longitude: 340, latitude: 0, speed: 13, retrograde: false, sign: "pisces" as const, signDegree: 10, house: 6 },
    { key: "mercury" as const, longitude: 40, latitude: 0, speed: 1.5, retrograde: false, sign: "taurus" as const, signDegree: 10, house: 8 },
    { key: "venus" as const, longitude: 15, latitude: 0, speed: 1.2, retrograde: false, sign: "aries" as const, signDegree: 15, house: 8 },
    { key: "mars" as const, longitude: 355, latitude: 0, speed: 0.7, retrograde: false, sign: "pisces" as const, signDegree: 25, house: 7 },
    { key: "jupiter" as const, longitude: 98, latitude: 0, speed: 0.2, retrograde: false, sign: "cancer" as const, signDegree: 8, house: 10 },
    { key: "saturn" as const, longitude: 294, latitude: 0, speed: -0.05, retrograde: true, sign: "capricorn" as const, signDegree: 24, house: 5 },
    { key: "uranus" as const, longitude: 279, latitude: 0, speed: -0.04, retrograde: true, sign: "capricorn" as const, signDegree: 9, house: 4 },
    { key: "neptune" as const, longitude: 284, latitude: 0, speed: -0.02, retrograde: true, sign: "capricorn" as const, signDegree: 14, house: 4 },
    { key: "pluto" as const, longitude: 226, latitude: 0, speed: -0.03, retrograde: true, sign: "scorpio" as const, signDegree: 16, house: 3 },
  ],
  houses: [],
  angles: { ascendant: 160, midheaven: 70, descendant: 340, imumCoeli: 250, vertex: 0 },
  aspects: [
    { a: "sun" as const, b: "saturn" as const, type: "trine" as const, separation: 120.5, orb: 0.5, exactness: 0.92, applying: false, major: true },
    { a: "moon" as const, b: "pluto" as const, type: "trine" as const, separation: 114, orb: 6, exactness: 0.1, applying: false, major: true },
    { a: "venus" as const, b: "uranus" as const, type: "square" as const, separation: 96, orb: 6, exactness: 0.1, applying: false, major: true },
    { a: "mars" as const, b: "pluto" as const, type: "trine" as const, separation: 129, orb: 9, exactness: 0.3, applying: false, major: true },
    { a: "uranus" as const, b: "neptune" as const, type: "conjunction" as const, separation: 5, orb: 5, exactness: 0.4, applying: false, major: true },
    { a: "sun" as const, b: "mars" as const, type: "sextile" as const, separation: 59.5, orb: 0.5, exactness: 0.9, applying: false, major: true },
    { a: "mercury" as const, b: "jupiter" as const, type: "sextile" as const, separation: 58, orb: 2, exactness: 0.5, applying: false, major: true },
    { a: "moon" as const, b: "mars" as const, type: "conjunction" as const, separation: 15, orb: 15, exactness: 0, applying: false, major: false },
  ],
  approximate: false,
  summary: { sun: "taurus" as const, moon: "pisces" as const, rising: "virgo" as const, elements: { fire: 1, earth: 5, air: 0, water: 4 }, modalities: { cardinal: 5, fixed: 3, mutable: 2 } },
  warnings: [],
};
const reading = readChart(chart);
console.log("    KEY: " + reading.key.summary);
console.log("    CHARACTER: " + reading.character);
console.log("    CIRCUMSTANCES: " + reading.circumstances);
check("key finds the tenanted houses and the ruler", () => {
  assert.equal(reading.key.groups[0].house, 8);
  assert.equal(reading.key.ruler?.planet, "mercury");
  assert.ok(reading.key.context.occult! > 0.3, JSON.stringify(reading.key.context));
});
check("reads every major planet aspect, strongest first", () => {
  assert.equal(reading.aspects.length, 7);
  assert.equal(reading.aspects[0].label.startsWith("Sun in Taurus"), true);
});
check("the 8th-house key tilts an 8th-house slot toward the occult", () => {
  // Venus in Aries in the 8th square Uranus: with the key's occult tilt the 8th-house word chosen should lean occult/regeneration, not taxes.
  const h8 = reading.units.flatMap((u) => u.keywords).filter((k) => k.owner === "h8").map((k) => k.text);
  console.log("    8th-house words chosen: " + h8.join(", "));
  assert.ok(h8.length > 0);
  assert.ok(h8.some((t) => /Occult|Regeneration/.test(t)), h8.join(", "));
  assert.ok(!h8.includes("Taxes"), "taxes should lose to the key");
});
check("questions retrieve sourced sentences", () => {
  const money = ask(reading, "What about my money and career?");
  console.log("    Q money/career → " + money.text);
  assert.ok(money.sources.length > 0);
  assert.ok(money.topics.includes("money"));
  const saturn = ask(reading, "Tell me about my Saturn");
  assert.ok(saturn.sources.every((s) => s.source.includes("Saturn")), saturn.sources.map((s) => s.source).join(" | "));
  const self = ask(reading, "Who am I?");
  assert.ok(self.text.length > 50);
  const none = ask(reading, "");
  assert.ok(none.text.includes("key to this chart"));
});

console.log(`\n${passed} checks passed`);
