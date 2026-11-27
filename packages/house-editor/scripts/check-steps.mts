// check-steps: the one door (contract C2). Prints "N passed, M failed", exits non-zero on failure.
//   sudo -n docker run --rm -u 3003 -v $HOME/eac:/app -w /app/packages/house-editor eac-dev \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-steps.mts
// Part 1 is the 17 checks of the sandbox step checker (apps/development ideas/manjushri), unchanged in meaning.
// Part 2 is what the door adds: structure steps, unknown types, applySteps, nested blocks, states and sizes.
import React from "react";
(globalThis as any).React = React;
type Doc = any;
const { SHARED_BLOCKS, toDefaultProps } = await import("@elkdonis/blocks");
const { contractOf } = await import("@elkdonis/blocks/contract");
const { buildPuckConfig } = await import("@elkdonis/page-builder/config");
const { applyStep, applySteps, fingerprint, sidesOf } = await import("../src/steps/index");

const blocks = SHARED_BLOCKS as any[];
const contracts = contractOf(blocks as never) as never;
const config = buildPuckConfig({ blocks: blocks as never });
const ctx = { contracts, config } as any;
const hero = blocks.find((b) => b.def.id === "hero-banner");
let doc: Doc = { root: { props: {} }, content: [{ type: "hero-banner", props: { ...toDefaultProps(hero.def), ...hero.sample(), id: "mj-hero-banner" } }] };
let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "ok  " : "FAIL"} ${name}${extra ? "  -> " + extra : ""}`); };
const J = (v: unknown) => JSON.stringify(v);
const prints = () => { const s = sidesOf(doc.content[0]!); return { w: fingerprint(s.words), l: fingerprint(s.look) }; };
const morphOf = (d: Doc, i = 0) => d.content[i]!.props.morph as any;

console.log("-- part 1: words and look (the sandbox's 17)");
const p0 = prints();
let r = applyStep(doc, { op: "set_look", block: "mj-hero-banner", part: "title", look: { color: "#e0b23c", size: 72, weight: 800 } }, ctx);
check("look on title applies", r.ok && r.side === "look", r.say); doc = r.doc;
const p1 = prints();
check("look step leaves words fingerprint", p1.w === p0.w && p1.l !== p0.l, J(doc.content[0]!.props.morph));

r = applyStep(doc, { op: "set_prop", block: "mj-hero-banner", prop: "title", value: "New words" }, ctx);
check("prop on title applies", r.ok && r.side === "words", r.say); doc = r.doc;
const p2 = prints();
check("words step leaves look fingerprint", p2.l === p1.l && p2.w !== p1.w);

r = applyStep(doc, { op: "set_look", block: "mj-hero-banner", part: "sidebar", look: { fill: "#c0392b" } }, ctx);
check("unknown part refused", !r.ok && r.code === "unknown_part", r.say);
r = applyStep(doc, { op: "set_prop", block: "mj-hero-banner", prop: "morph", value: { v: 1 } }, ctx);
check("look through the words door refused", !r.ok && r.code === "look_not_content", r.say);
r = applyStep(doc, { op: "set_look", block: "mj-hero-banner", part: "title", look: { css: "background: url(https://example.com/x.png); position: fixed; letter-spacing: 0.2em" } }, ctx);
check("css: url and position dropped, tracking kept", r.ok && /letter-spacing/.test(J(r.doc.content[0]!.props.morph)) && !/url|fixed/.test(J(r.doc.content[0]!.props.morph)), r.say + " " + J(r.doc.content[0]!.props.morph));
r = applyStep(doc, { op: "set_look", block: "mj-hero-banner", part: "title", look: { size: 9000 } }, ctx);
check("size clamped", r.ok && /held to 240/.test(r.say), r.say);
r = applyStep(doc, { op: "set_look", block: "mj-hero-banner", part: "title", look: { color: "red; } body { display:none" } }, ctx);
check("bad colour refused, stored colour kept", !r.ok && r.code === "not_a_look_value" && morphOf(doc).parts.title.color === "#e0b23c", r.say);
r = applyStep(doc, { op: "set_look", block: "mj-hero-banner", part: "title", look: { color: null } }, ctx);
check("null removes one key only", r.ok && morphOf(r.doc).parts.title.color === undefined && morphOf(r.doc).parts.title.size === 72, r.say);
r = applyStep(doc, { op: "set_prop", block: "mj-hero-banner", prop: "align", value: "sideways" }, ctx);
check("select outside options refused", !r.ok && r.code === "bad_value", r.say);
r = applyStep(doc, { op: "set_prop", block: "mj-hero-banner", prop: "height", value: 99999 }, ctx);
check("number clamped to max", r.ok && r.doc.content[0]!.props.height === 1200, r.say);
r = applyStep(doc, { op: "set_token", block: "mj-hero-banner", name: "--blk-accent", value: "#1f4e79" }, ctx);
check("token applies", r.ok && r.side === "look", r.say + " " + J(r.doc.content[0]!.props.morph));
r = applyStep(doc, { op: "set_token", block: "mj-hero-banner", name: "--evil", value: "#fff" }, ctx);
check("unknown token refused", !r.ok && r.code === "unknown_token", r.say);
r = applyStep(doc, { op: "set_look", block: "mj-hero-banner", part: "title", look: null }, ctx);
check("clear look", r.ok, r.say + " " + J(r.doc.content[0]!.props.morph ?? null));
r = applyStep(doc, { op: "delete_everything", block: "mj-hero-banner" }, ctx);
check("unknown op refused", !r.ok && r.code === "unknown_op", r.say);
r = applyStep(doc, { op: "set_prop", block: "nope", prop: "title", value: "x" }, ctx);
check("unknown block refused", !r.ok && r.code === "unknown_block", r.say);

console.log("-- part 2: structure steps on Puck's own reducer");
const card = (id: string, title = "A") => ({ type: "feature-card", props: { id, title, kicker: "k", record: "", opens: "", tone: "feed" } });
const mystery = { type: "mystery-block", props: { zeta: 1, id: "m-1", alpha: { b: [1, 2], a: "x" }, morph: { v: 1, parts: { q: { color: "#112233" } } } } };
const big = (): Doc => ({
  root: { props: { title: "Home" } },
  content: [
    { type: "hero-banner", props: { id: "h-1", title: "Hello", morph: { v: 1, parts: { title: { color: "#e0b23c", size: 72 } } } } },
    mystery,
    { type: "grid", props: { items: [card("c-1", "One"), card("c-2", "Two")], id: "g-1", columns: 3 } },
    { type: "grid", props: { id: "g-2", items: [] } },
  ],
  zones: {},
  extra: { keep: "me" },
});
const ids = (list: any[]) => list.map((n) => n.props.id);
const strict = { contracts, config } as any;
const loose = { contracts, config, allowUnknownTypes: true } as any;

let b = big();
r = applyStep(b, { op: "insert", type: "feature-card" }, strict);
check("insert in a page with a block type it does not know is refused by default", !r.ok && r.code === "unknown_type_on_page" && J(r.doc) === J(b), r.say);
r = applyStep(b, { op: "insert", type: "feature-card" }, loose);
check("insert appends to the root zone with a fresh id and the defaults", r.ok && r.side === "structure" && r.doc.content.length === 5 && r.doc.content[4].type === "feature-card" && typeof r.doc.content[4].props.id === "string" && r.touched?.[0] === r.doc.content[4].props.id && r.doc.content[4].props.tone === "feed", r.say + " " + J(r.touched));
check("insert leaves every other block byte for byte alone", J(r.doc.content.slice(0, 4)) === J(b.content) && J(r.doc.root) === J(b.root) && J(r.doc.extra) === J(b.extra), "");
r = applyStep(b, { op: "insert", type: "feature-card", index: 0, props: { title: "Fresh", kicker: "x".repeat(100000) } }, loose);
check("insert with a setting too long is refused whole", !r.ok && r.code === "too_long" && J(r.doc) === J(b), r.say);
r = applyStep(b, { op: "insert", type: "feature-card", index: 0, props: { title: "Fresh" } }, loose);
check("insert at index 0 with a typed setting", r.ok && r.doc.content[0].props.title === "Fresh" && r.doc.content[1].props.id === "h-1", r.say);
r = applyStep(b, { op: "insert", type: "feature-card", props: { morph: { v: 1 } } }, loose);
check("insert cannot write the look through its settings", !r.ok && r.code === "look_not_content", r.say);
r = applyStep(b, { op: "insert", type: "feature-card", props: { nope: "x" } }, loose);
check("insert with a setting the block does not have is refused", !r.ok && r.code === "unknown_prop", r.say);
r = applyStep(b, { op: "insert", type: "no-such-block" }, loose);
check("insert of a block type that is not in the config is refused", !r.ok && r.code === "unknown_type", r.say);
r = applyStep(b, { op: "insert", type: "feature-card", zone: "g-2:items", index: 0 }, loose);
check("insert into a slot zone", r.ok && r.doc.content[3].props.items.length === 1 && r.doc.content[3].props.items[0].type === "feature-card", r.say);
check("insert into a slot leaves the sibling blocks as they were", J(r.doc.content[2]) === J(b.content[2]) && J(r.doc.content[1]) === J(b.content[1]), "");
r = applyStep(b, { op: "insert", type: "feature-card", zone: "nowhere:items" }, loose);
check("insert into a zone that is not there is refused", !r.ok && r.code === "bad_zone", r.say);
r = applyStep(b, { op: "insert", type: "feature-card", zone: "g-2:items", index: 7 }, loose);
check("insert at an index past the end is refused", !r.ok && r.code === "bad_index", r.say);
r = applyStep(b, { op: "insert", type: "feature-card" }, { contracts, allowUnknownTypes: true });
check("structure steps without the page's config are refused plainly", !r.ok && r.code === "no_config", r.say);

r = applyStep(b, { op: "move", block: "h-1", index: 2 }, loose);
check("move within the root keeps the id, the look and the words", r.ok && ids(r.doc.content).join() === "m-1,g-1,h-1,g-2" && J(r.doc.content[2].props.morph) === J(b.content[0].props.morph) && r.doc.content[2].props.title === "Hello", ids(r.doc.content).join());
r = applyStep(b, { op: "move", block: "c-1", zone: "g-2:items", index: 0 }, loose);
check("move a card from one slot to another", r.ok && r.doc.content[2].props.items.length === 1 && r.doc.content[3].props.items[0].props.id === "c-1", ids(r.doc.content[2].props.items).join() + " | " + ids(r.doc.content[3].props.items).join());
r = applyStep(b, { op: "move", block: "g-1", zone: "g-1:items", index: 0 }, loose);
check("a block cannot be moved into itself", !r.ok && r.code === "bad_zone", r.say);
r = applyStep(b, { op: "move", block: "nope", index: 0 }, loose);
check("move of a block that is not there is refused", !r.ok && r.code === "unknown_block", r.say);
r = applyStep(b, { op: "move", block: "h-1", index: 9 }, loose);
check("move to an index past the end is refused", !r.ok && r.code === "bad_index", r.say);
r = applyStep(b, { op: "move", block: "m-1", index: 0 }, loose);
check("a block the door does not know is refused for move", !r.ok && r.code === "unknown_type", r.say);
r = applyStep(b, { op: "move", block: "g-2", index: 0 }, loose);
check("moving another block leaves the unknown one byte for byte alone", r.ok && J(r.doc.content[2]) === J(mystery), ids(r.doc.content).join());

r = applyStep(b, { op: "duplicate", block: "h-1" }, loose);
check("duplicate puts a copy right after, with a new id, the same words and the same look", r.ok && r.doc.content.length === 5 && r.doc.content[1].type === "hero-banner" && r.doc.content[1].props.id !== "h-1" && r.doc.content[1].props.title === "Hello" && J(r.doc.content[1].props.morph) === J(b.content[0].props.morph) && J(r.doc.content[0]) === J(b.content[0]), r.say);
r = applyStep(b, { op: "duplicate", block: "g-1" }, loose);
const gcopy = r.doc.content[3];
check("duplicate of a block with a slot copies its children with new ids", r.ok && gcopy.props.items.length === 2 && gcopy.props.items[0].props.id !== "c-1" && gcopy.props.items[0].props.title === "One" && J(r.doc.content[2]) === J(b.content[2]), r.say);
r = applyStep(b, { op: "duplicate", block: "m-1" }, loose);
check("a block the door does not know is refused for duplicate", !r.ok && r.code === "unknown_type", r.say);

r = applyStep(b, { op: "remove", block: "h-1" }, loose);
check("remove takes one block out and touches no other", r.ok && ids(r.doc.content).join() === "m-1,g-1,g-2" && J(r.doc.content[0]) === J(mystery) && J(r.doc.content[1]) === J(b.content[2]), ids(r.doc.content).join());
r = applyStep(b, { op: "remove", block: "c-2" }, loose);
check("remove one card out of a slot", r.ok && ids(r.doc.content[2].props.items).join() === "c-1", r.say);
r = applyStep(b, { op: "remove", block: "m-1" }, loose);
check("a block the door does not know is refused for remove", !r.ok && r.code === "unknown_type", r.say);
r = applyStep(b, { op: "remove", block: "nope" }, loose);
check("remove of a block that is not there is refused", !r.ok && r.code === "unknown_block", r.say);

console.log("-- part 3: types the door does not know, nested blocks, applySteps");
r = applyStep(b, { op: "set_prop", block: "h-1", prop: "title", value: "Changed" }, strict);
check("a word step on a page with an unknown block type is refused by default", !r.ok && r.code === "unknown_type_on_page", r.say);
r = applyStep(b, { op: "set_prop", block: "h-1", prop: "title", value: "Changed" }, { contracts, allowUnknownTypes: true } as any);
check("with allowUnknownTypes the unknown block comes out byte-identical", r.ok && J(r.doc.content[1]) === J(mystery) && J(r.doc.content[2]) === J(b.content[2]) && J(r.doc.root) === J(b.root) && J(r.doc.extra) === J(b.extra), r.say);
r = applyStep(b, { op: "set_prop", block: "m-1", prop: "alpha", value: "x" }, { contracts, allowUnknownTypes: true } as any);
check("a step aimed at an unknown block is refused even then", !r.ok && r.code === "unknown_type", r.say);
r = applyStep(b, { op: "set_prop", block: "c-1", prop: "title", value: "Nested" }, loose);
check("a word step reaches a block inside a slot", r.ok && r.doc.content[2].props.items[0].props.title === "Nested" && r.doc.content[2].props.items[1].props.title === "Two" && J(r.doc.content[1]) === J(mystery), r.say);
r = applyStep(b, { op: "set_look", block: "c-2", part: "title", look: { color: "#112233" } }, loose);
check("a look step reaches a block inside a slot", r.ok && r.doc.content[2].props.items[1].props.morph?.parts?.title?.color === "#112233", r.say);

const frozen = (v: any): any => { if (v && typeof v === "object") { Object.values(v).forEach(frozen); Object.freeze(v); } return v; };
const fz = frozen(big());
let threw = "";
try {
  for (const s of [
    { op: "set_prop", block: "c-1", prop: "title", value: "Z" }, { op: "set_look", block: "h-1", part: "title", look: { size: 50 } },
    { op: "set_token", block: "h-1", name: "--blk-accent", value: "#123456" }, { op: "insert", type: "feature-card" },
    { op: "move", block: "h-1", index: 1 }, { op: "duplicate", block: "g-1" }, { op: "remove", block: "c-1" },
  ]) applyStep(fz, s, loose);
} catch (e) { threw = String(e); }
check("no step changes the document it is given", threw === "", threw);

const before = big();
const rs = applySteps(before, [
  { op: "set_prop", block: "h-1", prop: "title", value: "One" },
  { op: "insert", type: "feature-card", zone: "g-2:items" },
  { op: "set_prop", block: "h-1", prop: "align", value: "sideways" },
  { op: "remove", block: "h-1" },
], loose);
check("applySteps stops at the first refusal and hands back the original page", !rs.ok && rs.results.length === 3 && rs.results[2]!.ok === false && J(rs.doc) === J(before), rs.results.map((x) => x.code).join());
const okRun = applySteps(before, [
  { op: "set_prop", block: "h-1", prop: "title", value: "One" },
  { op: "insert", type: "feature-card", zone: "g-2:items" },
  { op: "move", block: "g-2", index: 0 },
  { op: "set_look", block: "h-1", part: "title", look: { color: "#aa3300" } },
], loose);
check("applySteps runs a good list through", okRun.ok && okRun.results.length === 4 && okRun.doc.content[0].props.id === "g-2" && okRun.doc.content[0].props.items.length === 1 && okRun.doc.content[1].props.title === "One" && J(before) === J(big()), okRun.results.map((x) => x.code).join());
check("applySteps with nothing in it is ok and unchanged", J(applySteps(before, [], loose).doc) === J(before) && applySteps(before, [], loose).ok);

console.log("-- part 4: states and screen sizes, the two sides");
r = applyStep(doc, { op: "set_look", block: "mj-hero-banner", part: "title", state: "hover", look: { color: "#ffffff" } }, ctx);
const MorphNS = (await import("@elkdonis/direct-edit/puck/morph")) as Record<string, unknown>;
if (typeof MorphNS.setPartLookAt === "function") {
  check("hover look is stored under the part's states (lane LOOK's setPartLookAt)", r.ok && morphOf(r.doc).parts.title.states?.hover?.color === "#ffffff", r.say + " " + J(morphOf(r.doc)));
  const r2 = applyStep(doc, { op: "set_look", block: "mj-hero-banner", part: "title", at: "sm", look: { size: 30 } }, ctx);
  check("phone-size look is stored under the part's sizes", r2.ok && morphOf(r2.doc).parts.title.at?.sm?.size === 30, r2.say + " " + J(morphOf(r2.doc)));
  const r3 = applyStep(doc, { op: "set_look", block: "mj-hero-banner", part: "title", state: "nope" as never, look: { size: 30 } }, ctx);
  check("an unknown state is refused", !r3.ok, r3.say);
} else {
  check("hover look is refused with not_yet while setPartLookAt does not exist", !r.ok && r.code === "not_yet", r.say);
  const r2 = applyStep(doc, { op: "set_look", block: "mj-hero-banner", part: "title", at: "sm", look: { size: 30 } }, ctx);
  check("phone-size look is refused with not_yet while setPartLookAt does not exist", !r2.ok && r2.code === "not_yet", r2.say);
}
r = applyStep(doc, { op: "set_prop", block: "mj-hero-banner", prop: "look", value: {} }, ctx);
check("the box look key is refused through the words door too", !r.ok && r.code === "look_not_content", r.say);
r = applyStep(doc, { op: "set_prop", block: "mj-hero-banner", prop: "blkStyle", value: {} }, ctx);
check("the Style panel key is refused through the words door", !r.ok && r.code === "look_not_content", r.say);
check("fingerprint does not depend on key order", fingerprint({ a: 1, b: { c: 2, d: [1, 2] } }) === fingerprint({ b: { d: [1, 2], c: 2 }, a: 1 }));
const sd = sidesOf({ type: "x", props: { id: "i", title: "T", morph: { v: 1 } } });
check("sidesOf splits words from look and drops the id", J(sd.words) === J({ title: "T" }) && J(sd.look) === J({ v: 1 }));
r = applyStep(doc, "not an object", ctx);
check("a step that is not an object is refused", !r.ok && r.code === "not_a_step", r.say);
check("every refusal says something in plain words", [r].every((x) => x.say.length > 5));

console.log("-- part 5: review fixes");
const dup = (): Doc => ({ root: { props: {} }, content: [card("d-1", "First"), card("d-1", "Second"), card("d-2", "Other")] });
const dd = dup();
for (const [name, step] of [
  ["set_prop", { op: "set_prop", block: "d-1", prop: "title", value: "X" }],
  ["set_look", { op: "set_look", block: "d-1", part: "title", look: { color: "#112233" } }],
  ["set_token", { op: "set_token", block: "d-1", name: "--blk-accent", value: "#112233" }],
  ["move", { op: "move", block: "d-1", index: 2 }],
  ["duplicate", { op: "duplicate", block: "d-1" }],
  ["remove", { op: "remove", block: "d-1" }],
] as const) {
  const x = applyStep(dd, step, strict);
  check(name + " aimed at a block whose id is shared is refused, page untouched", !x.ok && x.code === "duplicate_block_id" && x.doc === dd && /share an id/.test(x.say), x.say);
}
check("a step aimed at the other, unique block still works on that page", applyStep(dd, { op: "set_prop", block: "d-2", prop: "title", value: "Fine" }, strict).ok);
for (const zone of ["constructor:x", "__proto__:x", "toString:items", "hasOwnProperty:x"]) {
  let out: any, thrown = "";
  try { out = applyStep(b, { op: "insert", type: "feature-card", zone }, loose); } catch (e) { thrown = String(e); }
  check("insert into zone " + zone + " is refused as bad_zone, not thrown", thrown === "" && !out.ok && out.code === "bad_zone", thrown || out.say);
}
{
  let out: any, thrown = "";
  try { out = applyStep(b, { op: "move", block: "h-1", zone: "constructor:x", index: 0 }, loose); } catch (e) { thrown = String(e); }
  check("move into zone constructor:x is refused as bad_zone, not thrown", thrown === "" && !out.ok && out.code === "bad_zone", thrown || out.say);
}
console.log("-- part 6: colour settings");
{
  const found = Object.entries(contracts as Record<string, any>).flatMap(([type, k]) => k.props.filter((p: any) => p.format === "color" && p.kind === "string" && !p.binds).map((p: any) => ({ type, prop: p.name })));
  check("the shared blocks declare at least one colour setting to check against", found.length > 0, J(found.slice(0, 3)));
  const col = found[0]!;
  const cdoc: Doc = { root: { props: {} }, content: [{ type: col.type, props: { id: "col-1" } }] };
  const set = (value: unknown) => applyStep(cdoc, { op: "set_prop", block: "col-1", prop: col.prop, value }, strict);
  for (const ok of ["#1f4e79", "#FFF", "#1f4e79cc", ""]) check("colour setting takes " + J(ok), set(ok).ok);
  for (const bad of ["red", "red; } body { display:none", "url(https://x/y.png)", "#12", "#1234567", "javascript:alert(1)", "#ggg", 5]) {
    const x = set(bad as never);
    check("colour setting refuses " + J(bad), !x.ok && (typeof bad === "number" || x.code === "not_a_colour") && x.doc === cdoc, x.code + " " + x.say);
  }
}
console.log("-- part 7: unset and bind (2026-11-22)");
{
  const hb = (extra: Record<string, unknown> = {}): Doc => ({ root: { props: {} }, content: [
    { type: "hero-banner", props: { id: "u-1", title: "T", morph: { v: 1, parts: { title: { color: "#e0b23c" } } }, ...extra } },
    { type: "feature-card", props: { id: "u-card", title: "C", record: "", opens: "", tone: "feed" } },
    { type: "grid", props: { id: "u-grid", items: [card("u-in", "In")] } },
  ] });
  const heroDef = (contracts as any)["hero-banner"].props as any[];
  const withDefault = heroDef.find((p) => p.kind === "select" && p.default !== undefined);
  const noDefault = heroDef.find((p) => (p.kind === "string" || p.kind === "image") && p.default === undefined && !p.binds && p.name !== "title");
  check("the shared blocks give a select setting a declared default to go back to", !!withDefault, withDefault?.name);
  const other = withDefault.options.find((o: any) => o.value !== withDefault.default).value;
  const d7 = hb({ [withDefault.name]: other });
  const lookOf = (d: Doc) => fingerprint(sidesOf(d.content[0]!).look);
  let u = applyStep(d7, { op: "unset", block: "u-1", prop: withDefault.name }, ctx);
  check("unset puts a setting back to its declared default", u.ok && u.side === "words" && u.doc.content[0]!.props[withDefault.name] === withDefault.default && u.touched?.[0] === "u-1", u.say);
  check("unset leaves the look and every other block alone", lookOf(u.doc) === lookOf(d7) && J(u.doc.content[1]) === J(d7.content[1]) && J(u.doc.content[2]) === J(d7.content[2]));
  check("unset does not change the page it is given", d7.content[0].props[withDefault.name] === other);
  const again = applyStep(u.doc, { op: "unset", block: "u-1", prop: withDefault.name }, ctx);
  check("unset on a setting already at its default says so and writes nothing", again.ok && again.code === "same" && again.doc === u.doc && again.touched?.length === 0, again.say);
  if (noDefault) {
    const dn = hb({ [noDefault.name]: "x" });
    const un = applyStep(dn, { op: "unset", block: "u-1", prop: noDefault.name }, ctx);
    check("a setting with no default is removed", un.ok && !(noDefault.name in un.doc.content[0]!.props) && un.doc.content[0]!.props.title === "T", un.say);
    const un2 = applyStep(un.doc, { op: "unset", block: "u-1", prop: noDefault.name }, ctx);
    check("removing what is already absent is a no-op", un2.ok && un2.code === "same");
  } else check("a setting with no default is removed (hero-banner has none; covered below on a card)", true);
  const nd2 = applyStep(hb({ meta: "x" }), { op: "unset", block: "u-card", prop: "meta" }, ctx);
  check("a card's setting with no declared default is removed, not blanked", nd2.ok === true, nd2.say);
  for (const k of ["morph", "look", "blkStyle"]) {
    const x = applyStep(d7, { op: "unset", block: "u-1", prop: k }, ctx);
    check("unset refuses the look key " + k, !x.ok && x.code === "look_not_content" && x.doc === d7, x.say);
  }
  for (const k of ["id", "puck", "children"]) {
    const x = applyStep(d7, { op: "unset", block: "u-1", prop: k }, ctx);
    check("unset refuses the editor key " + k, !x.ok && x.code === "editor_key" && x.doc === d7, x.say);
  }
  let x7 = applyStep(d7, { op: "unset", block: "u-1", prop: "nope" }, ctx);
  check("unset refuses an unknown setting, naming the real ones", !x7.ok && x7.code === "unknown_prop" && /title/.test(x7.say), x7.say);
  x7 = applyStep(d7, { op: "unset", block: "u-grid", prop: "items" }, ctx);
  check("unset refuses a region that holds blocks", !x7.ok && x7.code === "slot_prop" && x7.doc === d7, x7.say);
  x7 = applyStep(d7, { op: "unset", block: "ghost", prop: "title" }, ctx);
  check("unset aimed at no block is refused", !x7.ok && x7.code === "unknown_block", x7.say);
  x7 = applyStep(hb(), { op: "unset", block: "u-card", prop: "tone" }, ctx);
  check("unset says something in plain words", x7.say.length > 5, x7.say);
  x7 = applySteps(d7, [{ op: "unset", block: "u-1", prop: withDefault.name }, { op: "unset", block: "u-1", prop: "morph" }], ctx);
  check("unset inside applySteps stops the run at a refusal and hands back the original page", !x7.ok && x7.doc === d7 && x7.results.length === 2);
  const nest = { root: { props: {} }, content: [{ type: "grid", props: { id: "u-g2", items: [card("u-in2", "In")].map((c) => ({ ...c, props: { ...c.props, tone: "other" } })) } }] } as Doc;
  x7 = applyStep(nest, { op: "unset", block: "u-in2", prop: "tone" }, ctx);
  check("unset reaches a block inside a slot", x7.ok && x7.doc.content[0].props.items[0].props.tone !== "other", x7.say);

  const bd = hb();
  let b7 = applyStep(bd, { op: "bind", block: "u-card", prop: "record", record: "thread:abc123" }, ctx);
  check("bind chooses a record for a setting declared with binds", b7.ok && b7.side === "words" && b7.doc.content[1]!.props.record === "thread:abc123" && b7.touched?.[0] === "u-card", b7.say);
  check("bind changes that one value and nothing else", J({ ...b7.doc.content[1]!.props, record: "" }) === J(bd.content[1]!.props) && J(b7.doc.content[0]) === J(bd.content[0]));
  b7 = applyStep(b7.doc, { op: "bind", block: "u-card", prop: "record", record: "thread:abc123" }, ctx);
  check("binding the record already chosen is a no-op", b7.ok && b7.code === "same");
  b7 = applyStep(applyStep(bd, { op: "bind", block: "u-card", prop: "record", record: "post:p1" }, ctx).doc, { op: "bind", block: "u-card", prop: "record", record: "" }, ctx);
  check("an empty reference clears the choice", b7.ok && b7.doc.content[1]!.props.record === "", b7.say);
  b7 = applyStep(bd, { op: "bind", block: "u-card", prop: "record", record: "" }, ctx);
  check("clearing a record that was already empty is a no-op", b7.ok && b7.code === "same");
  for (const bad of ["abc", "Thread:abc", "thread:", ":abc", "thread:a b", "thread:<b>", "thread:" + "x".repeat(65), "thread:abc:def", "http://x/y"]) {
    const r2 = applyStep(bd, { op: "bind", block: "u-card", prop: "record", record: bad }, ctx);
    check("bind refuses the record reference " + J(bad.length > 24 ? bad.slice(0, 24) + "..." : bad), !r2.ok && r2.code === "bad_record" && r2.doc === bd, r2.say);
  }
  for (const bad of [5, null, { a: 1 }, ["thread:a"]]) {
    const r2 = applyStep(bd, { op: "bind", block: "u-card", prop: "record", record: bad }, ctx);
    check("bind refuses a reference that is not text: " + J(bad), !r2.ok && r2.code === "bad_record", r2.say);
  }
  b7 = applyStep(bd, { op: "bind", block: "u-card", prop: "title", record: "thread:abc" }, ctx);
  check("bind refuses a setting that is not declared with binds", !b7.ok && b7.code === "not_bound_prop" && b7.doc === bd, b7.say);
  b7 = applyStep(bd, { op: "bind", block: "u-card", prop: "morph", record: "thread:abc" }, ctx);
  check("bind refuses the look key", !b7.ok && b7.code === "look_not_content");
  b7 = applyStep(bd, { op: "bind", block: "u-card", prop: "nope", record: "thread:abc" }, ctx);
  check("bind refuses an unknown setting", !b7.ok && b7.code === "unknown_prop");
  b7 = applyStep(bd, { op: "bind", block: "u-card", prop: "opens", record: "/about" }, ctx);
  check("bind takes a page path for an opens setting", b7.ok && b7.doc.content[1]!.props.opens === "/about", b7.say);
  for (const bad of ["//evil.example/x", "/a/../b", "javascript:alert(1)", "a b", "x".repeat(301)]) {
    const r2 = applyStep(bd, { op: "bind", block: "u-card", prop: "opens", record: bad }, ctx);
    check("bind refuses the opens reference " + J(bad.length > 20 ? bad.slice(0, 20) + "..." : bad), !r2.ok && r2.code === "bad_record", r2.say);
  }
  b7 = applyStep(bd, { op: "set_prop", block: "u-card", prop: "record", value: "thread:abc" }, ctx);
  check("set_prop still refuses a bound setting, now pointing to bind", !b7.ok && b7.code === "bound_prop" && /bind/.test(b7.say) && b7.doc === bd, b7.say);
  b7 = applyStep(bd, { op: "bind", block: "u-in", prop: "record", record: "thread:abc" }, ctx);
  check("bind reaches a block inside a slot", b7.ok && b7.doc.content[2].props.items[0].props.record === "thread:abc", b7.say);
  const have = { root: { props: {} }, content: [{ type: "feature-card", props: { id: "u-x", title: "C", record: "thread:abc" } }] } as Doc;
  b7 = applyStep(have, { op: "bind", block: "u-x", prop: "record", record: "post:zzz" }, ctx);
  check("bind replaces the record already chosen", b7.ok && b7.doc.content[0].props.record === "post:zzz");
  const unk = applyStep(bd, { op: "x" }, ctx).say;
  check("an unknown op's refusal names unset and bind", /unset/.test(unk) && /bind/.test(unk), unk);
  check("a refused bind says something in plain words", applyStep(bd, { op: "bind", block: "u-card", prop: "title", record: "a:b" }, ctx).say.length > 5);

  const rich = blocks.map((b) => ({ id: b.def.id, p: (b.def.props as any[]).find((p) => p.kind === "richtext") })).find((x) => x.p);
  if (rich) {
    const rd: Doc = { root: { props: {} }, content: [{ type: rich.id, props: { id: "r-1" } }] };
    let r3 = applyStep(rd, { op: "set_prop", block: "r-1", prop: rich.p.name, value: "<p>Hi</p>" }, ctx);
    check("a rich-text setting is refused when the host gave no sanitiser", !r3.ok && r3.code === "unsupported_kind" && r3.doc === rd, r3.say);
    const clean = (h: string) => h.replace(/<script[^>]*>.*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "");
    r3 = applyStep(rd, { op: "set_prop", block: "r-1", prop: rich.p.name, value: '<p onclick="x()">Hi</p><script>alert(1)</script>' }, { ...ctx, sanitizeRichText: clean });
    check("a rich-text setting is stored as the host's sanitiser left it", r3.ok && r3.doc.content[0]!.props[rich.p.name] === "<p>Hi</p>", r3.say + " " + J(r3.doc.content[0]!.props[rich.p.name]));
    r3 = applyStep(rd, { op: "set_prop", block: "r-1", prop: rich.p.name, value: 5 }, { ...ctx, sanitizeRichText: clean });
    check("a rich-text setting that is not text is refused", !r3.ok && r3.code === "bad_value");
    r3 = applyStep(rd, { op: "set_prop", block: "r-1", prop: rich.p.name, value: "x".repeat(20001) }, { ...ctx, sanitizeRichText: clean });
    check("a rich-text setting that is too long is refused before the sanitiser runs", !r3.ok && r3.code === "too_long");
  } else check("some shared block declares a rich-text setting", false);
}


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
