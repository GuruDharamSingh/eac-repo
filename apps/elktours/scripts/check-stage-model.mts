// Proves the neutral stage model loses nothing: for real published tours, tourToStageModel(page) fed back through
// stageModelToIndexModel gives the same props the phone index gets from buildModel today, byte for byte
// (JSON.stringify in insertion order, and a key-sorted comparison as the fallback). Reads only; writes nothing.
//   cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/apps/elktours admin node \
//     /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-stage-model.mts
import React from "react";
(globalThis as any).React = React;

process.env.BOOKING_TABLES = "1"; // as the live site runs
const { listTours } = await import("../src/lib/tours");
const { loadTourPageData } = await import("../src/lib/tour-page-data");
const { buildModel } = await import("../src/components/tours/stage/phone/index/data");
const { tourToStageModel, stageModelToIndexModel, STAGE_VOCABULARY, countOf } = await import("../src/lib/stage-model");

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : detail ? `  -> ${detail}` : ""}`);
}

const sortKeys = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as object).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sortKeys(x)])) : v;
const canon = (v: unknown) => JSON.stringify(sortKeys(v));

function firstDiff(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `at ${i}: ${a.slice(Math.max(0, i - 40), i + 60)}  vs  ${b.slice(Math.max(0, i - 40), i + 60)}`;
}

const now = Date.now();
// Published tours first; drafts are added (read only) when fewer than three are published, so three real tours are compared.
const everyTour = await listTours({ includeDrafts: true });
const published = everyTour.filter((t) => t.status === "published");
const tours = [...published, ...everyTour.filter((t) => t.status !== "published")].slice(0, Math.max(3, published.length));
console.log(`published tours: ${published.length}; compared tours: ${tours.length} (${tours.filter((t) => t.status !== "published").length} draft)`);
check("at least three real tours to compare", tours.length >= 3, `found ${tours.length}`);
const comparedTours = new Set<string>();

let compared = 0;
for (const base of tours) {
  const { data: page } = await loadTourPageData(base, null, { others: false });
  if (!page.stage) {
    console.log(`SKIP  ${base.slug}: no stage data`);
    continue;
  }
  // Two inputs: nothing chosen, and the second open departure chosen (the visitor picked a date in the index).
  const open = page.tour.departures.filter((d) => d.status === "scheduled" && d.seatsLeft > 0 && new Date(d.startsAt).getTime() > now);
  const choices: (string | null)[] = [null, ...(open[1] ? [open[1].id] : [])];
  for (const chosen of choices) {
    const label = `${base.slug} [${base.status}] (${page.stage.stops.length} stops, ${open.length} open dates, chosen=${chosen ? "2nd" : "none"})`;
    const want = buildModel(page, chosen, now);
    const neutral = tourToStageModel(page, chosen, now);
    check(`${label}: neutral model exists`, !!want && !!neutral);
    if (!want || !neutral) continue;
    const got = stageModelToIndexModel(neutral);
    const a = JSON.stringify(want);
    const b = JSON.stringify(got);
    check(`${label}: byte-identical (${a.length} bytes)`, a === b, firstDiff(a, b));
    check(`${label}: same when keys are sorted`, canon(want) === canon(got));
    // the neutral model is plain JSON (survives a server -> client hop unchanged)
    check(`${label}: neutral model survives JSON`, JSON.stringify(JSON.parse(JSON.stringify(neutral))) === JSON.stringify(neutral));
    // the neutral model carries no tour words of its own: ids and field names only
    check(`${label}: neutral section ids are generic`, neutral.sections.every((s) => ["about", "sequence", "occasions", "gathering", "included", "host", "notes"].includes(s.id)));
    compared++;
    comparedTours.add(base.id);
  }
}
check("compared at least three distinct tours", comparedTours.size >= 3, `compared ${comparedTours.size} (${compared} cases)`);

// Vocabulary: the workshop row renders and differs where it should; the tour row reproduces today's words.
check("tour vocabulary counts", countOf("tour", 1) === "1 stop" && countOf("tour", 3) === "3 stops");
check("workshop vocabulary counts", countOf("workshop", 1) === "1 session" && countOf("workshop", 3) === "3 sessions");
check("workshop row has every key the tour row has", JSON.stringify(Object.keys(STAGE_VOCABULARY.workshop)) === JSON.stringify(Object.keys(STAGE_VOCABULARY.tour)));
check("workshop row words differ from tour", STAGE_VOCABULARY.workshop.stepMarker("II") === "Session II" && STAGE_VOCABULARY.tour.stepMarker("II") === "Stop II");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
