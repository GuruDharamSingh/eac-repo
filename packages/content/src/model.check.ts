// Unit check for groupTimeline on sample data. No test runner in this package; run:
//   sg docker -c "docker run --rm -v $PWD:/repo:ro -w /repo node:22-alpine node -e \"require('/repo/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild').buildSync({entryPoints:['packages/content/src/model.check.ts'],bundle:true,platform:'node',outfile:'/tmp/mc.js'});require('/tmp/mc.js')\""
import assert from "node:assert/strict";
import { groupTimeline, type ContentEvent, type ContentState } from "./model";

const NOW = "2026-11-08T15:00:00Z";
const ev = (id: string, at: string, state: ContentState): ContentEvent => ({ id, at, lane: "site", source: "thread", verb: state, outlet: "site", label: id, sub: "", state });

const sample = [
  ev("old", "2026-10-01T10:00:00Z", "published"),
  ev("yday", "2026-11-07T16:00:00Z", "published"), // 23 h ago: Now
  ev("2days", "2026-11-06T09:00:00Z", "published"),
  ev("later", "2026-11-12T09:00:00Z", "scheduled"),
  ev("soon", "2026-11-08T18:00:00Z", "scheduled"), // later today: Ahead
  ev("liveFuture", "2026-11-09T09:00:00Z", "live"), // live in the future: Ahead
  ev("liveNow", "2026-11-05T09:00:00Z", "live"), // live, started days ago: Now
  ev("failed", "2026-11-08T14:00:00Z", "failed"), // an hour ago: Now
  ev("edge", "2026-11-07T15:00:00Z", "published"), // exactly 24 h: Now
  ev("justOver", "2026-11-07T14:59:59Z", "published"), // just over 24 h: Past
  ev("draftFuture", "2026-11-20T09:00:00Z", "draft"), // not scheduled/live: not Ahead
];
const g = groupTimeline(sample, NOW);
const ids = (l: ContentEvent[]) => l.map((e) => e.id);
assert.deepEqual(ids(g.ahead), ["soon", "liveFuture", "later"]);
assert.deepEqual(ids(g.now), ["failed", "yday", "edge", "liveNow"]);
assert.deepEqual(ids(g.past), ["draftFuture", "justOver", "2days", "old"]);
assert.equal(g.ahead.length + g.now.length + g.past.length, sample.length);
assert.deepEqual(ids(groupTimeline([], NOW).ahead), []);
assert.equal(sample[0]!.id, "old"); // input untouched
assert.deepEqual(ids(groupTimeline(sample, new Date(NOW)).ahead), ids(g.ahead)); // Date and ms agree
assert.deepEqual(ids(groupTimeline(sample, Date.parse(NOW)).past), ids(g.past));
console.log("groupTimeline: ok");
