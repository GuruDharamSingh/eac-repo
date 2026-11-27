// Slice 4b check with an injected clock: tomorrow's material (planned by the guide) is hidden from a participant today and appears when tomorrow comes.
//   cd /app/packages/lms && npx tsx scripts/clock-plan.mts
import { getOngoingView } from "../src/index.ts";

const A = { userId: "e6bf54d9-ea1a-4549-b6d7-0df01f71d6f9", roles: {} };
const G = { userId: "bb77984c-0bdc-4e47-bb39-33dae6723794", roles: { sunjay: "guide" } };
const show = (v: Awaited<ReturnType<typeof getOngoingView>>) => (v ? { today: v.today, plannedDays: Object.keys(v.plans).sort() } : null);
// Toronto: 23 Nov 2026 at 10:00 and 24 Nov at 00:01 (05:01 UTC), and the next afternoon.
const t0 = new Date("2026-11-23T15:00:00Z"), t1 = new Date("2026-11-24T05:01:00Z");
console.log("participant, 23 Nov 10:00 Toronto:", JSON.stringify(show(await getOngoingView(A, "clay-and-breath", "five-minutes", "America/Toronto", t0))));
console.log("participant, 24 Nov 00:01 Toronto:", JSON.stringify(show(await getOngoingView(A, "clay-and-breath", "five-minutes", "America/Toronto", t1))));
const v = await getOngoingView(A, "clay-and-breath", "five-minutes", "America/Toronto", t1);
console.log("tomorrow's note once it is the 24th:", JSON.stringify(v?.plans["2026-11-24"]));
console.log("guide, 23 Nov (sees every planned day):", JSON.stringify(show(await getOngoingView(G, "clay-and-breath", "five-minutes", "America/Toronto", t0))));
process.exit(0);
