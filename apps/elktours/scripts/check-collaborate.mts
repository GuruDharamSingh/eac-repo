// Pure checks for the Collaborate rules in src/lib/collaborate.ts: no database, no network.
//   sudo -n docker compose run --rm --no-deps -w /app/apps/elktours admin node \
//     /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-collaborate.mts
//
// collaborate.ts imports the app's database and auth modules, so this script cannot import it. It reads the source
// text of the three pure functions and transpiles them, so the check runs against the real code, not a copy.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "../src/lib/collaborate.ts"), "utf8");

function grab(name: string): string {
  const start = src.indexOf(`export function ${name}`);
  if (start < 0) throw new Error(`${name} not found in collaborate.ts`);
  const end = src.indexOf("\n}\n", start);
  return src.slice(start, end + 3).replace("export function", "function");
}

const ts = (await import("typescript")).default;
const js = ts.transpileModule([grab("stopOffsetMinutes"), grab("stopArrivalTimes"), grab("slotOf")].join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const siteConfig = { timeZone: "Europe/Paris" };
const mod = new Function("siteConfig", `${js}\nreturn { stopOffsetMinutes, stopArrivalTimes, slotOf };`)(siteConfig) as {
  stopOffsetMinutes(d: number | null, i: number, n: number): number;
  stopArrivalTimes(t: { durationMinutes: number | null; stops: { id: string; position: number }[] }, d: { startsAt: string }): Array<{ stopId: string; index: number; offsetMinutes: number; arrivalAt: string }>;
  slotOf(at: string): { weekday: number; part: string };
};

let failed = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `  got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`}`);
}

// 150 minutes, 5 stops: 0, 30, 60, 90, 120 (Stop IV = +1h30, as on the design's "Stop IV . +1h 30").
eq("150 min / 5 stops offsets", [0, 1, 2, 3, 4].map((i) => mod.stopOffsetMinutes(150, i, 5)), [0, 30, 60, 90, 120]);
// Rounding to 5 minutes: 100 min / 3 stops -> 0, 33.3 -> 35, 66.7 -> 65.
eq("rounding to 5 min", [0, 1, 2].map((i) => mod.stopOffsetMinutes(100, i, 3)), [0, 35, 65]);
eq("no duration", mod.stopOffsetMinutes(null, 2, 5), 0);
eq("no stops", mod.stopOffsetMinutes(150, 0, 0), 0);

const stops = [4, 0, 2, 1, 3].map((p) => ({ id: `s${p}`, position: p }));
const arr = mod.stopArrivalTimes({ durationMinutes: 150, stops }, { startsAt: "2026-11-21T09:00:00.000Z" });
eq("arrival sorted by position", arr.map((a) => a.stopId), ["s0", "s1", "s2", "s3", "s4"]);
eq("Stop IV arrival (10:00 Paris start + 90 min)", arr[3]!.arrivalAt, "2026-11-21T10:30:00.000Z");

// Parts of the day, Paris wall clock (winter UTC+1).
eq("Sat 10:00 Paris (09:00Z) is morning", mod.slotOf("2026-11-21T09:00:00Z"), { weekday: 5, part: "morning" });
eq("11:59 Paris is morning", mod.slotOf("2026-11-21T10:59:00Z").part, "morning");
eq("12:00 Paris is afternoon", mod.slotOf("2026-11-21T11:00:00Z").part, "afternoon");
eq("16:59 Paris is afternoon", mod.slotOf("2026-11-21T15:59:00Z").part, "afternoon");
eq("17:00 Paris is evening", mod.slotOf("2026-11-21T16:00:00Z").part, "evening");
eq("Sun 22:30 Paris (21:30Z) is Sunday evening", mod.slotOf("2026-11-22T21:30:00Z"), { weekday: 6, part: "evening" });

// DST: spring forward Sun 29 Mar 2026 02:00 -> 03:00 (UTC+1 -> UTC+2); fall back Sun 25 Oct 2026 03:00 -> 02:00.
eq("28 Mar 2026 23:30Z = Sun 00:30 CET (before the change)", mod.slotOf("2026-03-28T23:30:00Z"), { weekday: 6, part: "morning" });
eq("29 Mar 2026 09:59Z = 11:59 CEST morning", mod.slotOf("2026-03-29T09:59:00Z").part, "morning");
eq("29 Mar 2026 10:00Z = 12:00 CEST afternoon", mod.slotOf("2026-03-29T10:00:00Z").part, "afternoon");
eq("24 Oct 2026 22:30Z = Sun 00:30 CEST (date rolls over in Paris)", mod.slotOf("2026-10-24T22:30:00Z"), { weekday: 6, part: "morning" });
eq("25 Oct 2026 10:59Z = 11:59 CET morning", mod.slotOf("2026-10-25T10:59:00Z").part, "morning");
eq("25 Oct 2026 11:00Z = 12:00 CET afternoon", mod.slotOf("2026-10-25T11:00:00Z").part, "afternoon");
eq("25 Oct 2026 16:00Z = 17:00 CET evening", mod.slotOf("2026-10-25T16:00:00Z").part, "evening");

// Arrivals are elapsed minutes (UTC arithmetic), so a run that starts at 23:00 Paris on 28 Mar 2026 keeps them across the change.
const night = mod.stopArrivalTimes(
  { durationMinutes: 150, stops: [0, 1, 2, 3, 4].map((p) => ({ id: `n${p}`, position: p })) },
  { startsAt: "2026-03-28T22:00:00.000Z" }
);
eq("elapsed-minute arrivals across the spring change", night.map((a) => a.arrivalAt.slice(11, 16)), ["22:00", "22:30", "23:00", "23:30", "00:00"]);

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) FAILED`);
process.exit(failed === 0 ? 0 : 1);
