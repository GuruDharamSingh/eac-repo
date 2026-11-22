// Tests for the word-art timeline (packages/studio/src/wordart/timeline.ts), 2026-11-18.
// Run: source ~/.nvm/nvm.sh && packages/blocks/node_modules/.bin/tsx packages/studio/scripts/timeline.test.mts
import assert from "node:assert/strict";
import { normHex } from "@elkdonis/gradients";
import { STARTERS, cleanDoc, type WordArtDoc } from "../src/wordart/doc";
import {
  MAX_TAKE_MS, docAt, applyEdit, addLookKey, removeLookKey, setLookEase, lookKeyTimes, animatedTracks,
  timelineEnd, shaderClock, cleanTimeline, diffTracks, applyOverrides, moveTrackKey, removeTrackKey, setTrackKeyEase, addTrackKey, type Timeline,
} from "../src/wordart/timeline";

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log("  ok", name); };

const base = (): WordArtDoc => {
  const d = STARTERS[0].make();
  return { ...d, fill: { ...d.fill, angle: 40, motion: 50 } };
};
/** edit at ms through the same path the editor uses */
const edit = (d: WordArtDoc, ms: number, f: (x: WordArtDoc) => WordArtDoc) => applyEdit(d, f(docAt(d, ms)), ms);
/** key at 0 = d, key at 5000 = d changed by f */
const twoKeys = (f: (x: WordArtDoc) => WordArtDoc, d0 = base()) => addLookKey(edit(addLookKey(d0, 0), 5000, f), 5000);

ok("docAt without timeline returns the same object", () => {
  const d = base();
  assert.equal(docAt(d, 1234), d);
});

ok("two look keys glide angle (linear and smooth)", () => {
  const d = twoKeys((x) => ({ ...x, fill: { ...x.fill, angle: 220 } }));
  assert.deepEqual(lookKeyTimes(d.timeline), [0, 5000]);
  assert.equal(docAt(d, 2500).fill.angle, 130, "smooth midpoint");
  assert.ok(docAt(d, 1000).fill.angle < 76, `smooth eases in (${docAt(d, 1000).fill.angle})`);
  const lin = setLookEase(d, 0, "linear");
  assert.equal(docAt(lin, 2500).fill.angle, 130);
  assert.equal(docAt(lin, 1000).fill.angle, 76);
});

ok("hold switches at the key", () => {
  const d = twoKeys((x) => ({ ...x, fill: { ...x.fill, shader: "silk" } }));
  assert.equal(docAt(d, 4999).fill.shader, "none");
  assert.equal(docAt(d, 5000).fill.shader, "silk");
});

ok("before first / after last hold the end keys", () => {
  const d = twoKeys((x) => ({ ...x, size: 90 }));
  assert.equal(docAt(d, -100).size, 72);
  assert.equal(docAt(d, 9e9).size, 90);
  assert.equal(timelineEnd(d.timeline), 5000);
});

ok("stops glide in OKLab with resampling", () => {
  const two = [{ color: "#1F4E9A", at: 0 }, { color: "#D45A1F", at: 100 }];
  const five = [{ color: "#407C83", at: 0 }, { color: "#6D8B6C", at: 25 }, { color: "#BA8A43", at: 50 }, { color: "#A85B38", at: 75 }, { color: "#8B2824", at: 100 }];
  const d0 = { ...base(), fill: { ...base().fill, stops: two } };
  const d = twoKeys((x) => ({ ...x, fill: { ...x.fill, stops: five } }), d0);
  assert.deepEqual(docAt(d, 0).fill.stops, two, "exactly key 1 at its own time");
  const mid = docAt(d, 2500).fill.stops;
  assert.equal(mid.length, 5);
  for (const s of mid) assert.equal(normHex(s.color), s.color, `hex ${s.color}`);
  assert.notDeepEqual(mid.map((s) => s.color), five.map((s) => s.color));
  assert.deepEqual(docAt(d, 5000).fill.stops, five, "exactly key 2 at its own time");
});

ok("transparent background holds", () => {
  const d = twoKeys((x) => ({ ...x, background: null }));
  assert.ok(docAt(d, 4999).background, "still a gradient");
  assert.equal(docAt(d, 5000).background, null);
});

ok("applyEdit: a still setting changes everywhere", () => {
  // only the angle moves; size has no keys
  const d: WordArtDoc = { ...base(), timeline: { v: 1, tracks: { "fill.angle": [{ t: 0, value: 40, ease: "smooth" }, { t: 5000, value: 220, ease: "smooth" }] } } };
  const tracksBefore = Object.keys(d.timeline!.tracks).length;
  const e = edit(d, 3000, (x) => ({ ...x, size: 50 }));
  assert.equal(docAt(e, 0).size, 50);
  assert.equal(docAt(e, 9000).size, 50);
  assert.ok(!animatedTracks(e.timeline).includes("size"));
  assert.equal(Object.keys(e.timeline!.tracks).length, tracksBefore);
});

ok("applyEdit: a moving setting keys at the playhead", () => {
  const d = setLookEase(twoKeys((x) => ({ ...x, fill: { ...x.fill, angle: 220 } })), 0, "linear");
  const e = edit(d, 2000, (x) => ({ ...x, fill: { ...x.fill, angle: 300 } }));
  const keys = e.timeline!.tracks["fill.angle"];
  assert.deepEqual(keys.map((k) => [k.t, k.value]), [[0, 40], [2000, 300], [5000, 220]]);
  assert.deepEqual(lookKeyTimes(e.timeline), [0, 2000, 5000]);
});

ok("addLookKey then removeLookKey restores the timeline", () => {
  const d = twoKeys((x) => ({ ...x, tilt: 30 }));
  const r = removeLookKey(addLookKey(d, 2500), 2500);
  assert.deepEqual(r.timeline, d.timeline);
});

ok("shaderClock integrates motion", () => {
  const d = addLookKey(base(), 0); // motion 50 throughout
  assert.ok(Math.abs(shaderClock(d, "fill", 2000) - 1) < 0.01, `constant ${shaderClock(d, "fill", 2000)}`);
  const ramp = setLookEase(addLookKey(edit(addLookKey({ ...base(), fill: { ...base().fill, motion: 0 } }, 0), 2000, (x) => ({ ...x, fill: { ...x.fill, motion: 100 } })), 2000), 0, "linear");
  assert.ok(Math.abs(shaderClock(ramp, "fill", 2000) - 1) < 0.01, `ramp ${shaderClock(ramp, "fill", 2000)}`);
  let last = -1;
  for (let t = 0; t <= 2000; t += 100) { const c = shaderClock(ramp, "fill", t); assert.ok(c >= last, `monotonic at ${t}`); last = c; }
  assert.equal(shaderClock(base(), "fill", 0), 0);
});

ok("cleanTimeline drops junk", () => {
  for (const bad of [null, "x", 3, [], {}]) assert.equal(cleanTimeline(bad), undefined);
  const tl = cleanTimeline({
    v: 1,
    tracks: {
      nope: [{ t: 0, value: 1, ease: "smooth" }],
      "fill.angle": [{ t: Number.NaN, value: 1, ease: "smooth" }, { t: 70000, value: 2, ease: "smooth" }, { t: 100, value: 3, ease: "bouncy" }, { t: 200, value: 9, ease: "linear" }],
      size: [{ t: 0, value: "big", ease: "smooth" }],
    },
  });
  assert.deepEqual(tl, { v: 1, tracks: { "fill.angle": [{ t: 200, value: 9, ease: "linear" }] } });
  const good = twoKeys((x) => ({ ...x, fill: { ...x.fill, angle: 220, stops: [{ color: "#111111", at: 0 }, { color: "#EEEEEE", at: 100 }] }, background: null })).timeline as Timeline;
  assert.deepEqual(cleanTimeline(JSON.parse(JSON.stringify(good))), good);
  assert.equal(MAX_TAKE_MS, 60000);
});

ok("cleanDoc keeps a valid timeline and drops a corrupt one", () => {
  const d = twoKeys((x) => ({ ...x, size: 90 }));
  const back = cleanDoc(JSON.parse(JSON.stringify(d)))!;
  assert.deepEqual(back.timeline, d.timeline);
  const bad = cleanDoc({ ...JSON.parse(JSON.stringify(d)), timeline: { v: 1, tracks: "garbage" } })!;
  assert.ok(bad, "the design still loads");
  assert.equal(bad.timeline, undefined);
  const old = cleanDoc(JSON.parse(JSON.stringify(base())))!;
  assert.equal(old.timeline, undefined, "designs from before today have none");
});

ok("diffTracks + applyOverrides: a take override sits on top of the timeline", () => {
  const d = setLookEase(twoKeys((x) => ({ ...x, fill: { ...x.fill, angle: 220 } })), 0, "linear");
  const ev = docAt(d, 2500);
  const o = diffTracks(ev, { ...ev, size: 30, fill: { ...ev.fill, mute: 40 } });
  assert.deepEqual(Object.keys(o).sort(), ["fill.mute", "size"]);
  const at = applyOverrides(docAt(d, 1000), o);
  assert.equal(at.size, 30);
  assert.equal(at.fill.mute, 40);
  assert.equal(at.fill.angle, docAt(d, 1000).fill.angle, "the moving angle keeps moving");
  assert.equal(applyOverrides(ev, null), ev);
});

ok("turning the background back on later doesn't rewrite earlier backgrounds", () => {
  const A = base().background!;
  const B = { ...A, angle: 7, stops: [{ color: "#111111", at: 0 }, { color: "#EEEEEE", at: 100 }] };
  const d: WordArtDoc = { ...base(), timeline: { v: 1, tracks: { background: [{ t: 0, value: A, ease: "smooth" }, { t: 5000, value: null, ease: "smooth" }] } } };
  const e = edit(d, 7000, (x) => ({ ...x, background: B }));
  assert.deepEqual(docAt(e, 0).background!.stops, docAt(d, 0).background!.stops, "A at 0 s is untouched");
  assert.equal(docAt(e, 0).background!.angle, docAt(d, 0).background!.angle);
  assert.equal(docAt(e, 5000).background, null);
  assert.equal(docAt(e, 7000).background!.angle, 7);
});

// ── shot 2: lanes ──
const angleAndSize = () => setLookEase(twoKeys((x) => ({ ...x, size: 90, fill: { ...x.fill, angle: 220 } })), 0, "linear");

ok("moveTrackKey retimes one lane only (stagger)", () => {
  const d = moveTrackKey(angleAndSize(), "fill.angle", 5000, 3000);
  assert.equal(docAt(d, 3000).fill.angle, 220, "the angle arrives at 3 s");
  assert.equal(docAt(d, 2500).size, (72 + 90) / 2, "size still glides to 5 s");
  assert.deepEqual(d.timeline!.tracks["fill.angle"].map((k) => k.t), [0, 3000]);
});

ok("moveTrackKey onto another key replaces it", () => {
  const d0 = addTrackKey(angleAndSize(), "fill.angle", 2000);
  const d = moveTrackKey(d0, "fill.angle", 5000, 2000);
  assert.deepEqual(d.timeline!.tracks["fill.angle"].map((k) => [k.t, k.value]), [[0, 40], [2000, 220]]);
});

ok("moveTrackKey clamps to the timeline range", () => {
  const d = moveTrackKey(angleAndSize(), "fill.angle", 5000, 99999);
  assert.deepEqual(d.timeline!.tracks["fill.angle"].map((k) => k.t), [0, MAX_TAKE_MS]);
});

ok("removeTrackKey removes one key; the last key leaves its value behind", () => {
  let d = removeTrackKey(angleAndSize(), "fill.angle", 5000);
  assert.deepEqual(d.timeline!.tracks["fill.angle"].map((k) => k.t), [0]);
  assert.equal(d.timeline!.tracks.size.length, 2, "other lanes keep their keys");
  const keyed = edit(addLookKey(base(), 0), 0, (x) => ({ ...x, fill: { ...x.fill, angle: 250 } }));
  d = removeTrackKey(keyed, "fill.angle", 0);
  assert.equal(d.timeline!.tracks["fill.angle"], undefined);
  assert.equal(docAt(d, 1234).fill.angle, 250, "no jump back to the old base");
});

ok("setTrackKeyEase changes one key on one lane", () => {
  const d = setTrackKeyEase(angleAndSize(), "fill.angle", 0, "hold");
  assert.equal(docAt(d, 4000).fill.angle, 40, "angle holds");
  assert.equal(docAt(d, 2500).size, 81, "size still linear");
});

ok("addTrackKey holds what the design shows there", () => {
  const d = addTrackKey(angleAndSize(), "fill.angle", 2500);
  assert.deepEqual(d.timeline!.tracks["fill.angle"].map((k) => [k.t, k.value]), [[0, 40], [2500, 130], [5000, 220]]);
  assert.equal(docAt(d, 2500).fill.angle, 130);
});

// ── the mark (text, font, logo) is never keyed: edits change the whole design ──
ok("a font or text edit after + Key changes the design everywhere", () => {
  const txt = { kind: "text" as const, text: "ELKDONIS", font: "cinzel", tracking: 20, leading: 1.05, align: "center" as const };
  const d0 = twoKeys((x) => ({ ...x, size: 90 }), { ...base(), source: txt });
  assert.equal(d0.timeline!.tracks.source, undefined, "+ Key does not snapshot the mark");
  const e = edit(d0, 0, (x) => ({ ...x, source: { ...txt, font: "brothers", text: "OM" } }));
  for (const t of [0, 2500, 5000, 9000]) {
    assert.equal((docAt(e, t).source as typeof txt).font, "brothers", `font at ${t}`);
    assert.equal((docAt(e, t).source as typeof txt).text, "OM", `text at ${t}`);
  }
});

ok("an older timeline with mark keys moves the mark onto the design", () => {
  const raw = JSON.parse(JSON.stringify(twoKeys((x) => ({ ...x, size: 90 }))));
  raw.source = { kind: "eac", id: "eac-classic", groups: [] };
  raw.timeline.tracks.source = [{ t: 0, value: { kind: "eac", id: "eac-rings", groups: [] }, ease: "smooth" }, { t: 5000, value: { kind: "eac", id: "eac-radiant", groups: [] }, ease: "smooth" }];
  const d = cleanDoc(raw)!;
  assert.equal(d.timeline!.tracks.source, undefined);
  assert.deepEqual(d.source, { kind: "eac", id: "eac-rings", groups: [] }, "the first key's mark (what the design opened on)");
});

console.log(`${n} ok`);
