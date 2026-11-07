/**
 * Runtime tests for the record kit (@elkdonis/blocks/record): placement rules
 * (slot rules, unknown parents, root, junk input), the three layout readers
 * agreeing, resolver-key stripping (nested slots, zones, immutability,
 * __proto__), looks, and the frame's markup.
 *
 *   pnpm --filter @elkdonis/blocks test      (runs smoke.mts, then this)
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  BASE_RULES,
  placementRules,
  layoutChoice,
  effectiveLayout,
  describeLayout,
  layoutProp,
  editingOf,
  RecordFrame,
  RecordEmpty,
  stripResolvedKeys,
  defineLooks,
} from "../src/record/index.js";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── placement ───────────────────────────────────────────────────────────────
console.log("\nplacement");
const place = placementRules({
  feature: ["ktp-quick-landing", "two-col:hero"],
  compact: ["ktp-split"],
  card: ["ktp-piece-row", "split-row:wall"],
  rowLabel: "in a row of pieces",
});
check("BASE_RULES has no feature parent (hero-banner has no slot)", BASE_RULES.feature.length === 0);
check("page itself (null)", same(place(null), { layout: "card", reason: "on the page itself", top: true, where: "page" }));
check("page itself (undefined)", place(undefined).where === "page");
check("page itself (parentType null)", place({ parentType: null, slot: null }).top === true);
check("'root' is the page itself", place({ parentType: "root", slot: "default-zone" }).where === "page");
check("junk input is the page itself", place("nonsense").where === "page" && place(42).where === "page" && place({ parentType: 7 }).where === "page");
check("app feature parent", same(place({ parentType: "ktp-quick-landing", slot: "feature" }), { layout: "feature", reason: "in a hero's slot", where: "hero" }));
check("hero-banner is no longer a feature parent", place({ parentType: "hero-banner", slot: null }).where === "other");
check("base compact parent", place({ parentType: "split-row", slot: "left" }).layout === "compact");
check("base card parent + rowLabel", same(place({ parentType: "grid", slot: "cells" }), { layout: "card", reason: "in a row of pieces", where: "row" }));
check("app compact parent", place({ parentType: "ktp-split", slot: "a" }).where === "column");
check("slot rule beats the plain parent rule", place({ parentType: "split-row", slot: "wall" }).where === "row", JSON.stringify(place({ parentType: "split-row", slot: "wall" })));
check("other slots of that parent keep the plain rule", place({ parentType: "split-row", slot: "right" }).where === "column");
check("slot-only rule for an unlisted parent", place({ parentType: "two-col", slot: "hero" }).layout === "feature");
check("slot-only parent, other slot: unknown", place({ parentType: "two-col", slot: "body" }).where === "other");
check("unknown parent", same(place({ parentType: "mystery", slot: "x" }), { layout: "card", reason: "inside mystery", where: "other" }));
check("default rowLabel", placementRules()({ parentType: "card-grid", slot: "c" }).reason === "in a row");

// ── layout choice ───────────────────────────────────────────────────────────
console.log("\nlayout choice");
for (const v of ["card", "compact", "row", "feature"]) check(`layoutChoice(${v})`, layoutChoice(v) === v);
for (const v of [undefined, null, "", "auto", "grid", "CARD", 3, {}]) check(`layoutChoice(${JSON.stringify(v)}) is auto`, layoutChoice(v) === "auto");
const feature = place({ parentType: "ktp-quick-landing", slot: "f" });
for (const v of [undefined, "", "bogus", "auto", "row", "compact"]) {
  const layout = effectiveLayout(v, feature);
  const line = describeLayout(v, layout, feature);
  const auto = layoutChoice(v) === "auto";
  check(`effective/describe agree for ${JSON.stringify(v)}`, auto ? layout === "feature" && line === "Auto: feature, in a hero's slot" : layout === v && line === `Layout: ${v}`, `${layout} / ${line}`);
}
check("auto without placement is card", effectiveLayout("auto", null) === "card");
check("layoutProp default + options", (() => { const p = layoutProp(); return p.name === "layout" && p.default === "auto" && p.options.map((o) => o.value).join() === "auto,card,compact,row,feature"; })());
check("layoutProp description", layoutProp("x").description === "x");

// ── editing ─────────────────────────────────────────────────────────────────
console.log("\nediting");
check("no puck", same(editingOf(undefined), { editing: false, drawn: false }));
check("canvas", same(editingOf({ isEditing: true }), { editing: true, drawn: true }));
check("Edit-look popup", same(editingOf({ boxEditing: true }), { editing: false, drawn: true }));

// ── frame markup ────────────────────────────────────────────────────────────
console.log("\nframe");
const html = renderToStaticMarkup(
  createElement(RecordFrame, { name: "ktp-piece", layout: "card", choice: "bogus", placement: { where: "row" }, why: "Auto: card" }, "X"),
);
check("root classes", html.includes('class="blk-rec ktp-piece"'), html);
check("frame classes", html.includes('class="blk-rec-frame ktp-piece-frame"'));
check("unknown choice draws data-choice=auto", html.includes('data-choice="auto"'));
check("data-in, no data-top", html.includes('data-in="row"') && !html.includes("data-top"));
check("why line, aria-hidden", html.includes('class="blk-rec-why ktp-piece-why" aria-hidden="true">Auto: card</p>'));
const noWhy = renderToStaticMarkup(createElement(RecordFrame, { layout: "feature", choice: "row", placement: { where: "page", top: true }, why: null }));
check("no why line when null; top drawn; choice kept", !noWhy.includes("blk-rec-why") && noWhy.includes('data-top="true"') && noWhy.includes('data-choice="row"'), noWhy);
const empty = renderToStaticMarkup(createElement(RecordEmpty, { title: "Choose a piece", body: createElement("p", null, "Pick one."), className: "ktp-piece-empty" }));
check("RecordEmpty is a div (block content allowed)", empty === '<div class="blk-rec-empty ktp-piece-empty"><b>Choose a piece</b><div><p>Pick one.</p></div></div>', empty);

// ── resolver keys ───────────────────────────────────────────────────────────
console.log("\nresolver keys");
const KEYS = { "ktp-piece": ["item", "placement"], "ktp-piece-row": ["rows"] } as const;
const doc = {
  root: { props: { title: "Home" } },
  content: [
    { type: "ktp-piece", props: { id: "a", artwork: "x", layout: "auto", item: { big: 1 }, placement: { layout: "card" } } },
    {
      type: "ktp-piece-row",
      props: {
        id: "r",
        heading: "Row",
        rows: [1, 2],
        pieces: [{ type: "ktp-piece", props: { id: "b", artwork: "y", item: {}, placement: {} } }],
      },
    },
    { type: "split-row", props: { id: "s", left: [{ type: "ktp-piece-row", props: { id: "r2", pieces: [{ type: "ktp-piece", props: { id: "c", item: 1 } }] } }] } },
  ],
  zones: { "s:legacy": [{ type: "ktp-piece", props: { id: "z", item: 2, layout: "row" } }] },
};
const before = JSON.stringify(doc);
const out = stripResolvedKeys(doc, KEYS);
check("input not mutated", JSON.stringify(doc) === before);
check("a new object", out !== doc && out.content !== doc.content);
const flat = JSON.stringify(out);
check("no resolved keys anywhere", !/"item"|"placement"|"rows"/.test(flat), flat);
check("top-level piece keeps its settings", same(out.content[0]!.props, { id: "a", artwork: "x", layout: "auto" }));
check("piece inside a row's slot cleaned", same((out.content[1]!.props as { pieces: Array<{ props: unknown }> }).pieces[0]!.props, { id: "b", artwork: "y" }));
check("two levels of slots cleaned", flat.includes('"id":"c"') && !flat.includes('"item":1'));
check("zones cleaned", same(out.zones["s:legacy"]![0]!.props, { id: "z", layout: "row" }));
check("root props untouched", same(out.root, doc.root));
check("a block type not in the table keeps everything", same(stripResolvedKeys({ type: "x", props: { item: 1 } }, KEYS), { type: "x", props: { item: 1 } }));
check("inherited table keys are not used (toString)", same(stripResolvedKeys({ type: "toString", props: { item: 1 } }, KEYS), { type: "toString", props: { item: 1 } }));
const proto = stripResolvedKeys(JSON.parse('{"type":"x","props":{"__proto__":{"polluted":true}}}'), KEYS) as { props: Record<string, unknown> };
check("__proto__ stays data", Object.prototype.hasOwnProperty.call(proto.props, "__proto__") && !("polluted" in {}));
check("primitives pass through", stripResolvedKeys(5, KEYS) === 5 && stripResolvedKeys(null, KEYS) === null);

// ── looks ───────────────────────────────────────────────────────────────────
console.log("\nlooks");
const looks = defineLooks(
  [
    { value: "house", label: "House" },
    { value: "ember", label: "Ember" },
    { value: "", label: "Empty (skipped)" },
    { value: "ember", label: "Ember again (skipped)" },
    { value: "glaze-lab", label: "Glaze Lab" },
  ],
  { siteVar: "--ktp-look", inheritLabel: "As around it (row, then the site)" },
);
check("empty and duplicate values skipped", looks.LOOKS.map((l) => l.value).join() === "house,ember,glaze-lab");
check("lookOf known", looks.lookOf("ember") === "ember");
check("lookOf unknown / empty / non-string is null", looks.lookOf("neon") === null && looks.lookOf("") === null && looks.lookOf(3) === null);
const lp = looks.lookProp("d");
check("lookProp: inherit first, then the looks", lp.name === "look" && lp.default === "" && lp.options.map((o) => o.value).join() === ",house,ember,glaze-lab" && lp.options[0]!.label === "As around it (row, then the site)");
check("SITE_LOOK_VAR", looks.SITE_LOOK_VAR === "--ktp-look");
check("default inherit label", defineLooks([{ value: "a", label: "A" }], { siteVar: "--x" }).lookProp("").options[0]!.label === "As around it");

console.log(failures ? `\n${failures} failed` : "\nall record checks passed");
process.exit(failures ? 1 : 0);
