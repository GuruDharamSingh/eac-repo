import assert from "node:assert/strict";
import { placeSection, SECTION_MARK } from "../src/templates/insert";
import { SHARED_SECTIONS } from "../../blocks/src/templates/sections";

const node = (type: string, id: string, extra: Record<string, unknown> = {}) => ({ type, props: { id, ...extra } });
const page = () =>
  ({
    root: { props: {} },
    content: [
      node("a", "a"),
      node("band", "band", { content: [node("x", "x"), node("y", "y")], other: "keep" }),
      node("c", "c"),
    ],
  }) as never as import("@puckeditor/core").Data;
const ids = (list: any[]) => list.map((n) => n.props.id);
const sec = SHARED_SECTIONS[0];

// nothing selected: at the end
let r = placeSection(page(), sec, null);
assert.deepEqual(ids(r.data.content).slice(0, 3), ["a", "band", "c"]);
assert.equal(r.data.content.length, 3 + sec.blocks.length);
assert.equal(r.firstId, (r.data.content[3].props as any).id);

// after the selected top-level block: order a, new..., band, c
r = placeSection(page(), sec, { index: 0, zone: "root:default-zone" });
assert.equal(r.data.content[0].props.id, "a");
assert.deepEqual(r.data.content.slice(3).map((n) => n.props.id), ["band", "c"].map((x) => x));
assert.equal(r.data.content[1].props.id, r.firstId);
assert.equal(r.data.content.length, 3 + sec.blocks.length);

// fresh ids, every node marked, none shared with the page or with a second insert
const r2 = placeSection(page(), sec, null);
const mine = r.data.content.filter((n) => (n.props as any)[SECTION_MARK] === sec.id);
assert.equal(mine.length, sec.blocks.length);
assert.equal(new Set([...r.ids, ...r2.ids]).size, r.ids.length + r2.ids.length);
assert.ok(!r.ids.some((i) => ["a", "band", "c", "x", "y"].includes(i)));

// inside a slot: after x, band's other props and sibling y intact
r = placeSection(page(), sec, { index: 0, zone: "band:content" });
const band = r.data.content[1].props as any;
assert.equal(band.other, "keep");
assert.equal(band.content[1].props.id, r.firstId);
assert.equal(band.content[0].props.id, "x");
assert.equal(band.content.at(-1).props.id, "y");
assert.equal(band.content.length, 2 + sec.blocks.length);
assert.equal(r.data.content.length, 3);

// unknown slot falls back to the end of the page; input is not mutated
const p = page();
const before = JSON.stringify(p);
r = placeSection(p, sec, { index: 0, zone: "nope:content" });
assert.equal(r.data.content.length, 3 + sec.blocks.length);
assert.equal(JSON.stringify(p), before);

// the section list itself is not mutated by inserting (the source nodes carry no id or mark)
for (const s of SHARED_SECTIONS) for (const b of s.blocks) assert.ok(!(SECTION_MARK in b.props) && !("id" in b.props));

// wrapIn: bands. All top-level nodes bands, nothing selected: end of the LAST band's slot.
const bands = () =>
  ({
    root: { props: {} },
    content: [node("band", "b1", { content: [node("x", "x")] }), node("band", "b2", { content: [node("y", "y")] })],
  }) as never as import("@puckeditor/core").Data;
const wrap = { types: ["band"], slot: "content" };
r = placeSection(bands(), sec, null, wrap);
assert.equal(r.data.content.length, 2);
assert.equal((r.data.content[0].props as any).content.length, 1);
let last = (r.data.content[1].props as any).content;
assert.equal(last.length, 1 + sec.blocks.length);
assert.equal(last[0].props.id, "y");
assert.equal(last[1].props.id, r.firstId);
// unresolvable selection behaves the same
r = placeSection(bands(), sec, { index: 0, zone: "nope:content" }, wrap);
assert.equal((r.data.content[1].props as any).content.length, 1 + sec.blocks.length);
// a selected top-level band: into its own slot, at the end
r = placeSection(bands(), sec, { index: 0, zone: "root:default-zone" }, wrap);
assert.equal(r.data.content.length, 2);
assert.equal((r.data.content[0].props as any).content.length, 1 + sec.blocks.length);
assert.equal((r.data.content[0].props as any).content[1].props.id, r.firstId);
assert.equal((r.data.content[1].props as any).content.length, 1);
// mixed top level (not all bands), nothing selected: end of the page
r = placeSection(page(), sec, null, { types: ["band"], slot: "content" });
assert.equal(r.data.content.length, 3 + sec.blocks.length);
// a title block then a band (the last top-level block is a band), nothing selected: into that band
{
  const d = bands();
  (d.content as any[]).unshift({ type: "title", props: { id: "t0" } });
  const rr = placeSection(d, sec, null, wrap);
  assert.equal(rr.data.content.length, 3);
  assert.equal((rr.data.content[2].props as any).content.length, 1 + sec.blocks.length);
}
// empty page: end of the page; selected non-band top-level block: after it
r = placeSection({ root: { props: {} }, content: [] } as never, sec, null, wrap);
assert.equal(r.data.content.length, sec.blocks.length);
r = placeSection(page(), sec, { index: 0, zone: "root:default-zone" }, wrap);
assert.equal(r.data.content[1].props.id, r.firstId);
// a selected block inside a band slot is unchanged by wrapIn
r = placeSection(bands(), sec, { index: 0, zone: "b1:content" }, wrap);
assert.equal((r.data.content[0].props as any).content[1].props.id, r.firstId);
// input untouched
const bp = bands();
const bb = JSON.stringify(bp);
placeSection(bp, sec, null, wrap);
assert.equal(JSON.stringify(bp), bb);

console.log("check-sections: all passed");
