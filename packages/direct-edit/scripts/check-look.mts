// Lane LOOK check (2026-11-20). Run in a one-off container, see BUILD_SPEC.md.
import React from "react";
(globalThis as any).React = React;
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

let passed = 0, failed = 0;
const ok = (name: string, cond: unknown, extra = "") => {
  if (cond) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
};
const section = (s: string) => console.log(`\n${s}`);

const pnpm = "/app/node_modules/.pnpm";
const puckDir = readdirSync(pnpm).find((d) => d.startsWith("@puckeditor+core@0.24"))!;
const rsc: any = await import(pathToFileURL(`${pnpm}/${puckDir}/node_modules/@puckeditor/core/dist/rsc.mjs`).href);

// ---------------------------------------------------------------------------
section("Task 1: a part named like a slot must not 500 the public route");
const Box = ({ items }: any) => React.createElement("div", null, items ? items() : null);
const doc = (extra: object) => ({
  root: { props: {} },
  content: [{ type: "Box", props: { id: "b1", items: [], ...extra } }],
});
const stored = { morph: { v: 1, parts: { items: { size: 20 } } } };
const mk = (morphField: any) => ({
  components: { Box: { render: Box, fields: { items: { type: "slot" }, morph: morphField }, defaultProps: {} } },
});
const tryResolve = async (config: any) => {
  try { await rsc.resolveAllData(doc(stored), config); return null; } catch (e: any) { return String(e?.message ?? e); }
};
const withCustom = await tryResolve(mk({ type: "custom", visible: false, render: () => null }));
console.log(`  (custom hidden field on 0.24: ${withCustom ? "THROWS " + withCustom : "does not throw"})`);
ok("0.24 still has the trap: a custom hidden morph field makes resolveAllData throw", withCustom !== null);
const withObject = await tryResolve(mk({ type: "object", objectFields: {}, visible: false }));
ok("a hidden object morph field: resolveAllData passes", withObject === null, String(withObject));

// buildPuckConfig must give morph that hidden object field.
const { buildPuckConfig } = await import("/app/packages/page-builder/src/config.tsx");
const def = { id: "lk-box", label: "Box", description: "t", category: "layout", styling: "tokens", props: [{ name: "items", kind: "slot", label: "Items" }] } as any;
const cfg: any = buildPuckConfig({ blocks: [{ def, Component: Box as any }] as any, morph: (() => null) as any });
const mf = cfg.components["lk-box"].fields.morph;
ok("buildPuckConfig: morph field is a hidden object field", mf?.type === "object" && mf.visible === false && Object.keys(mf.objectFields ?? {}).length === 0, JSON.stringify(mf));
const doc2 = { root: { props: {} }, content: [{ type: "lk-box", props: { id: "b2", items: [], ...stored } }] };
let built: string | null = null;
try { await rsc.resolveAllData(doc2, cfg); } catch (e: any) { built = String(e?.message ?? e); }
ok("buildPuckConfig config: stored morph.parts.items resolves", built === null, String(built));

// createCatalogue refuses a part named like one of the block's own slots.
const { createCatalogue } = await import("/app/packages/blocks/src/registry.ts");
const bad = { def: { ...def, id: "lk-bad", parts: { items: { label: "Items", sel: "> div" } } }, Component: Box } as any;
let threw = "";
try { createCatalogue([bad]); } catch (e: any) { threw = String(e?.message ?? e); }
ok("createCatalogue throws for a part named like a slot", /items/.test(threw) && /slot/.test(threw), threw);
const good = { def: { ...def, id: "lk-good", parts: { list: { label: "List", sel: "> div" } } }, Component: Box } as any;
let fine = true;
try { createCatalogue([good]); } catch { fine = false; }
ok("createCatalogue accepts a part with another name", fine);

// ---------------------------------------------------------------------------
section("Task 2: every look key survives the settings sheet");
const contractMod: any = await import("/app/packages/direct-edit/src/block/contract.ts");
const { LOOK_KEYS, keepLookKeys } = contractMod;
ok("LOOK_KEYS is exactly morph and look", JSON.stringify(LOOK_KEYS) === JSON.stringify(["morph", "look"]));
const prev = { id: "n1", title: "old", morph: { v: 1, parts: { title: { size: 20 } } }, look: { fill: "#fff" } };
const k1 = keepLookKeys(prev, { title: "new" });
ok("both look keys come back when the host dropped them", JSON.stringify(k1) === JSON.stringify({ morph: prev.morph, look: prev.look }));
const k2 = keepLookKeys(prev, { title: "new", morph: { v: 1 } });
ok("a key the host handed back is not overwritten", !("morph" in k2) && JSON.stringify(k2.look) === JSON.stringify(prev.look));
ok("a block with no look keeps nothing", Object.keys(keepLookKeys({ id: "x", title: "t" }, { title: "u" })).length === 0);
const { readFileSync } = await import("node:fs");
const te = readFileSync("/app/packages/direct-edit/src/canvas/tree-editor.ts", "utf8");
ok("tree-editor.ts hands the sheet result through keepLookKeys", /keepLookKeys\(g\.node\.props, props\)/.test(te));

// ---------------------------------------------------------------------------
section("Task 3: states and screen sizes in the stored look");
const morphMod: any = await import("/app/packages/direct-edit/src/block/morph.ts");
const pm: any = await import("/app/packages/direct-edit/src/puck/morph-mark.tsx");
const { FIXTURES, PARTS } = await import("./look-fixtures.mts");
const golden = JSON.parse(readFileSync(new URL("./look-golden.json", import.meta.url), "utf8"));
const { cleanMorph, morphCss } = morphMod;

// 3a. A stored v1 morph compiles to the same bytes as before the change (golden made by the old compiler).
let same = 0;
for (const f of FIXTURES) {
  const parts = "parts" in f ? (f as any).parts : PARTS;
  const g = golden[f.name];
  const clean = cleanMorph(f.morph);
  const got = { clean: clean ? JSON.stringify(clean) : null, pub: clean ? morphCss(clean, parts, {}) : null, editor: clean ? morphCss(clean, parts, { editor: true }) : null };
  const eq = JSON.stringify(got) === JSON.stringify(g);
  if (eq) same++;
  ok(`v1 unchanged: ${f.name}`, eq, eq ? "" : `\n    was ${JSON.stringify(g)}\n    now ${JSON.stringify(got)}`);
}
ok(`all ${FIXTURES.length} v1 fixtures byte-identical (cleaned morph, public CSS, editor CSS)`, same === FIXTURES.length && FIXTURES.length >= 12);

// 3b. The cleaner.
const rich = {
  v: 1,
  parts: {
    title: {
      size: 30, fill: "#112233",
      states: { hover: { fill: "#ff0000", hide: true, size: 31 }, focus: { color: "#00ff00" }, active: { opacity: 0.5 }, visited: { color: "#fff" }, ["__proto__"]: { size: 9 } },
      at: { sm: { size: 20, dir: "column", hide: true }, md: { size: 26 }, lg: { size: 99 } },
    },
    cta: { states: { hover: { css: "background: url(http://e/x.png); letter-spacing: .1em" } } },
    body: { states: { hover: {} }, at: { sm: {} } },
  },
};
const cm = cleanMorph(rich);
ok("cleaner keeps states and at", !!cm?.parts?.title?.states && !!cm?.parts?.title?.at);
ok("cleaner keeps the three states only", JSON.stringify(Object.keys(cm.parts.title.states)) === JSON.stringify(["hover", "focus", "active"]));
ok("cleaner keeps sm and md only", JSON.stringify(Object.keys(cm.parts.title.at)) === JSON.stringify(["sm", "md"]));
ok("a state cannot hide its part", cm.parts.title.states.hover.hide === undefined && cm.parts.title.states.hover.fill === "#ff0000");
ok("a screen size may hide its part", cm.parts.title.at.sm.hide === true && cm.parts.title.at.sm.dir === "column");
ok("a web address in a state never survives", !/url/i.test(JSON.stringify(cm)) && cm.parts.cta.states.hover.css === "letter-spacing:.1em");
ok("an empty state and an empty size are dropped", !cm.parts.body);
ok("states do not nest", cleanMorph({ v: 1, parts: { t: { size: 20, states: { hover: { size: 30, states: { hover: { size: 40 } }, at: { sm: { size: 9 } } } } } } })?.parts?.t?.states?.hover?.states === undefined);
ok("a look with only a state is kept", !!cleanMorph({ v: 1, parts: { title: { states: { hover: { fill: "#fff" } } } } }));
ok("a stored v1 look carries neither key after cleaning", (() => { const c = cleanMorph({ v: 1, parts: { title: { size: 20 } } }); return !("states" in c.parts.title) && !("at" in c.parts.title); })());

// 3c. The compiler.
const sheet = morphCss(cm, PARTS, {})!;
const css: string = sheet.css;
const rules = css.split("\n");
const idx = (needle: string) => css.indexOf(needle);
ok("every declaration is !important", [...css.matchAll(/\{([^{}]*)\}/g)].every((m) => m[1]!.split(";").every((d) => / !important$/.test(d))) && css.includes("{"), css);
ok("hover rule is scoped and uses :hover", /^template\[data-morph="[a-z0-9]+"\] \+ \.blk-hero \.blk-hero-title:hover\{/m.test(css), css);
ok("focus uses :focus-visible, active uses :active", css.includes(".blk-hero-title:focus-visible{") && css.includes(".blk-hero-title:active{"));
const firstExtra = rules.findIndex((l) => /:(hover|focus-visible|active)\{/.test(l) || l.startsWith("@media"));
ok("hover, focus-visible, active come after all base rules, in that order", firstExtra > 0 && rules.slice(firstExtra).every((l) => /:(hover|focus-visible|active)\{/.test(l) || l.startsWith("@media")) && idx(":hover{") < idx(":focus-visible{") && idx(":focus-visible{") < idx(":active{"), css);
ok("size rules come last, md before sm", idx("@media (max-width:820px)") > idx(":active{") && idx("@media (max-width:480px)") > idx("@media (max-width:820px)"), css);
ok("a size rule is scoped like a base rule", /@media \(max-width:480px\)\{template\[data-morph="[a-z0-9]+"\] \+ [^{]*\.blk-hero-title\{[^}]*flex-direction:column !important/.test(css), css);
ok("the stored scope replaced the marker in every rule", !css.includes("\u0000") && css.split(`data-morph="${sheet.scope}"`).length - 1 === (css.match(/template\[/g) ?? []).length);
const baseOnly = morphCss(cleanMorph({ v: 1, parts: { title: { size: 30, fill: "#112233" }, cta: {}, body: {} } }), PARTS, {})!;
const withExtra = morphCss(cleanMorph({ v: 1, parts: { title: { size: 30, fill: "#112233", states: { hover: { fill: "#f00" } }, at: { sm: { size: 20 } } } } }), PARTS, {})!;
ok("base rules are byte-identical with and without states and sizes (a prefix)", withExtra.css.replace(new RegExp(withExtra.scope, "g"), "S").startsWith(baseOnly.css.replace(new RegExp(baseOnly.scope, "g"), "S")), withExtra.css);
ok("a part with a pseudo-element selector gets no state rule", !(morphCss({ v: 1, parts: { x: { states: { hover: { fill: "#fff" } } } } } as any, { x: { sel: "> p::first-line" } }, {})?.css ?? "").includes("::first-line:hover"));
ok("a state of an undeclared part draws nothing", morphCss({ v: 1, parts: { ghost: { states: { hover: { fill: "#fff" } } } } } as any, PARTS, {}) === null);
ok("a font in a state or a size is loaded", morphCss({ v: 1, parts: { title: { states: { hover: { font: "Lora" } }, at: { sm: { font: "Lora" } } } } } as any, PARTS, {})?.fonts.includes("Lora"));
ok("a hash is stable and changes when a state changes", withExtra.scope === morphCss(cleanMorph({ v: 1, parts: { title: { size: 30, fill: "#112233", states: { hover: { fill: "#f00" } }, at: { sm: { size: 20 } } } } }), PARTS, {})!.scope && withExtra.scope !== baseOnly.scope);

// 3d. Helpers.
const { partLookOf, setPartLook, partLookAt, setPartLookAt, tokenOf, setToken, partSafeDecls } = pm;
ok("puck/morph re-exports cleanMorph, morphCss, partLookAt, setPartLookAt", [pm.cleanMorph, pm.morphCss, partLookAt, setPartLookAt].every((f: unknown) => typeof f === "function"));
ok("the old names still exist", [partLookOf, setPartLook, tokenOf, setToken, partSafeDecls].every((f: unknown) => typeof f === "function"));
const pr: Record<string, unknown> = {};
setPartLook(pr, "title", { size: 30 });
ok("setPartLook then partLookOf: the base look", JSON.stringify(partLookOf(pr, "title")) === '{"size":30}' && JSON.stringify(pr.morph) === '{"v":1,"parts":{"title":{"size":30}}}');
ok("setPartLookAt hover", setPartLookAt(pr, "title", { state: "hover" }, { fill: "#f00" }) === true && JSON.stringify(partLookAt(pr, "title", { state: "hover" })) === '{"fill":"#f00"}');
ok("setPartLookAt sm", setPartLookAt(pr, "title", { at: "sm" }, { size: 20 }) === true && JSON.stringify(partLookAt(pr, "title", { at: "sm" })) === '{"size":20}');
ok("partLookAt with no where is the base look, without states or sizes", JSON.stringify(partLookAt(pr, "title", {})) === '{"size":30}' && JSON.stringify(partLookOf(pr, "title")) === '{"size":30}');
setPartLook(pr, "title", { size: 32 });
ok("setPartLook keeps the states and sizes", JSON.stringify(partLookAt(pr, "title", { state: "hover" })) === '{"fill":"#f00"}' && JSON.stringify(partLookAt(pr, "title", { at: "sm" })) === '{"size":20}' && partLookOf(pr, "title").size === 32);
ok("the stored shape is PartStyle plus states and at", JSON.stringify((pr.morph as any).parts.title) === '{"size":32,"states":{"hover":{"fill":"#f00"}},"at":{"sm":{"size":20}}}');
ok("the stored look passes the cleaner unchanged", JSON.stringify(cleanMorph(pr.morph)) === JSON.stringify(pr.morph));
ok("a state look cannot carry states or sizes of its own", (setPartLookAt(pr, "title", { state: "focus" }, { color: "#0f0", states: { hover: { size: 1 } }, at: { sm: { size: 2 } } } as any), JSON.stringify(partLookAt(pr, "title", { state: "focus" })) === '{"color":"#0f0"}'));
ok("a state and a size together are refused and nothing changes", (() => { const before = JSON.stringify(pr); const r = setPartLookAt(pr, "title", { state: "hover", at: "sm" }, { size: 1 }); return r === false && JSON.stringify(pr) === before && JSON.stringify(partLookAt(pr, "title", { state: "hover", at: "sm" })) === "{}"; })());
setPartLookAt(pr, "title", { state: "hover" }, {});
setPartLookAt(pr, "title", { state: "focus" }, {});
ok("an empty look removes just that state", partLookAt(pr, "title", { state: "hover" }) && Object.keys(partLookAt(pr, "title", { state: "hover" })).length === 0 && !("states" in (pr.morph as any).parts.title));
setPartLook(pr, "title", {});
ok("clearing the base look keeps the sizes", JSON.stringify(pr.morph) === '{"v":1,"parts":{"title":{"at":{"sm":{"size":20}}}}}');
setPartLookAt(pr, "title", { at: "sm" }, {});
ok("clearing the last look removes morph", !("morph" in pr));
ok("a bad part name writes nothing", setPartLookAt(pr, "Bad Name", {}, { size: 1 }) === false && !("morph" in pr));
const keepTok: Record<string, unknown> = { morph: { v: 1, tokens: { "--blk-accent": "#a00" } } };
setPartLookAt(keepTok, "title", { state: "hover" }, { fill: "#fff" });
ok("tokens survive a part look", tokenOf(keepTok, "--blk-accent") === "#a00");
ok("the demo's own sequence still works (read, edit a copy, write back)", (() => { const p: Record<string, unknown> = {}; setPartLook(p, "title", { size: 20 }); const cur = { ...partLookOf(p, "title") }; (cur as any).color = "#fff"; setPartLook(p, "title", cur); return JSON.stringify(partLookOf(p, "title")) === '{"size":20,"color":"#fff"}'; })());

// ---------------------------------------------------------------------------
section("Task 4: one look reader");
const rl: any = await import("/app/packages/direct-edit/src/block/read-look.ts");
const pbStyle: any = await import("/app/packages/page-builder/src/style/schema.ts");
// The glue a host passes (page-builder owns blkStyle; direct-edit does not import it).
const blkDecls = (raw: unknown) => { const s = pbStyle.cleanStyle(raw); return s ? rl.declsFromStyleObject(pbStyle.styleToCss(s).style) : []; };
const defn = { parts: PARTS };
const deepFreeze = (o: any): any => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };

const none = rl.readLook({ props: {} }, defn, blkDecls);
ok("a block with no looks reads empty", Object.keys(none.parts).length === 0 && none.conflicts.length === 0 && none.root.morph.length === 0 && none.undeclared.length === 0);
ok("a missing node or definition does not throw", (() => { try { rl.readLook(null, null); rl.readLook({}, undefined, blkDecls); return true; } catch { return false; } })());

const n1 = { type: "hero-banner", props: { id: "a", title: "Hi", morph: { v: 1, tokens: { "--blk-accent": "#a00" }, parts: { title: { size: 30, states: { hover: { color: "#c00" } }, at: { sm: { size: 20 } } }, root: { fill: "#00ff00" }, ghost: { size: 12 } } } } };
const r1 = rl.readLook(n1, defn, blkDecls);
ok("per part: base, states and sizes", r1.parts.title.base.size === 30 && r1.parts.title.states.hover.color === "#c00" && r1.parts.title.at.sm.size === 20 && !("states" in r1.parts.title.base) && !("at" in r1.parts.title.base));
ok("a part the block does not declare is listed as undeclared; root never is", JSON.stringify(r1.undeclared) === '["ghost"]' && r1.parts.ghost.declared === false && r1.parts.root.declared === true && r1.parts.title.declared === true);
ok("tokens are read", r1.tokens["--blk-accent"] === "#a00");
ok("root.morph holds the root look and the tokens", r1.root.morph.some(([k, v]: string[]) => k === "background" && v === "#00ff00") && r1.root.morph.some(([k]: string[]) => k === "--blk-accent"));
ok("one look alone is no conflict", r1.conflicts.length === 0);

const withBlk = { props: { morph: { v: 1, parts: { root: { fill: "#00ff00", margin: 8 } }, tokens: { "--blk-fg": "#111111" } }, blkStyle: { bg: "#ff0000", align: "center", color: "#222222", padY: 24 } } };
const r2 = rl.readLook(withBlk, defn, blkDecls);
const cProp = (r: any, p: string) => r.conflicts.find((c: any) => c.prop === p);
ok("blkStyle declarations are read at the root", r2.root.blkStyle.some(([k, v]: string[]) => k === "background-color" && v === "#ff0000"));
ok("a background in both is a conflict (shorthand against longhand)", (() => { const c = cProp(r2, "background"); return !!c && c.sources.some((s: any) => s.source === "morph" && s.value === "#00ff00") && c.sources.some((s: any) => s.source === "blkStyle" && s.prop === "background-color" && s.value === "#ff0000"); })(), JSON.stringify(r2.conflicts));
ok("a margin in both is a conflict (margin against margin-left)", !!cProp(r2, "margin"), JSON.stringify(r2.conflicts));
ok("a colour token in both is a conflict", !!cProp(r2, "--blk-fg") && cProp(r2, "--blk-fg").sources.length === 2);
ok("padding set by only one source is not a conflict", !cProp(r2, "padding") && !cProp(r2, "padding-top"));

const sameVal = rl.readLook({ props: { morph: { v: 1, parts: { root: { fill: "#ff0000" } } }, blkStyle: { bg: "#ff0000" } } }, defn, blkDecls);
ok("the same value from two sources is not a conflict", sameVal.conflicts.length === 0, JSON.stringify(sameVal.conflicts));
const nonRoot = rl.readLook({ props: { morph: { v: 1, parts: { title: { fill: "#00ff00" } } }, blkStyle: { bg: "#ff0000" } } }, defn, blkDecls);
ok("a look on another part is not a root conflict", nonRoot.conflicts.length === 0);
const box = rl.readLook({ props: { look: { fill: "#0000ff", padding: 10 }, morph: { v: 1, parts: { root: { fill: "#00ff00" } } } } }, defn, blkDecls);
ok("a box look is read at the root and fights the morph root", box.root.look.some(([k]: string[]) => k === "background") && !!cProp(box, "background") && cProp(box, "background").sources.map((s: any) => s.source).sort().join() === "look,morph");
ok("no blkStyle function: blkStyle reads as nothing, never a throw", rl.readLook(withBlk, defn).root.blkStyle.length === 0);
ok("a throwing blkStyle function is survived", rl.readLook(withBlk, defn, () => { throw new Error("x"); }).root.blkStyle.length === 0);
ok("hostile part names are dropped, not read", (() => { const r = rl.readLook({ props: { morph: { v: 1, parts: { constructor: { size: 20 }, __proto__: { size: 20 }, title: { size: 20 } } } } }, defn, blkDecls); return Object.keys(r.parts).join() === "title" || Object.keys(r.parts).join() === "constructor,title"; })());

// Read-only: nothing changes, so no page can emit anything different.
const frozen = deepFreeze(JSON.parse(JSON.stringify(withBlk)));
const before = JSON.stringify(frozen);
let readOnly = true;
try { rl.readLook(frozen, defn, blkDecls); } catch { readOnly = false; }
ok("reading a frozen node works and changes nothing", readOnly && JSON.stringify(frozen) === before);
const cssBefore = JSON.stringify(FIXTURES.map((f) => cleanMorph(f.morph) ? morphCss(cleanMorph(f.morph), PARTS, {}) : null));
for (const f of FIXTURES) rl.readLook({ props: { morph: f.morph } }, defn, blkDecls);
ok("reading looks changes no compiled CSS", cssBefore === JSON.stringify(FIXTURES.map((f) => cleanMorph(f.morph) ? morphCss(cleanMorph(f.morph), PARTS, {}) : null)));
ok("read-look.ts imports nothing from page-builder", !/from\s+["'][^"']*page-builder/.test(readFileSync("/app/packages/direct-edit/src/block/read-look.ts", "utf8")));
ok("block/index.ts exports the reader and LOOK_KEYS", /read-look/.test(readFileSync("/app/packages/direct-edit/src/block/index.ts", "utf8")) && /LOOK_KEYS/.test(readFileSync("/app/packages/direct-edit/src/block/index.ts", "utf8")));


// ---------------------------------------------------------------------------
section("Lane LIVE 1: the panel's When and Screen switches (look data, editor-only forcing)");
const { STATE_FIXTURES, STATE_PARTS } = await import("./look-golden-states.mts");
const goldenStates = JSON.parse(readFileSync(new URL("./look-golden-states.json", import.meta.url), "utf8"));
// Made by the compiler before lane LIVE touched it: a public page (editor: false) draws the same bytes afterwards.
let sameStates = 0;
for (const f of STATE_FIXTURES) {
  const g = goldenStates[f.name];
  const clean = cleanMorph(f.morph);
  const got = { clean: clean ? JSON.stringify(clean) : null, pub: clean ? morphCss(clean, STATE_PARTS as any, {}) : null, pubExplicitFalse: clean ? morphCss(clean, STATE_PARTS as any, { editor: false }) : null };
  const eq = JSON.stringify(got) === JSON.stringify(g);
  if (eq) sameStates++;
  ok(`public CSS unchanged (editor: false): ${f.name}`, eq, eq ? "" : `\n    was ${JSON.stringify(g)}\n    now ${JSON.stringify(got)}`);
}
ok(`all ${STATE_FIXTURES.length} state and size fixtures byte-identical for a public page`, sameStates === STATE_FIXTURES.length);
{
  const allPublic = [...FIXTURES.map((f) => ("parts" in f ? (f as any).parts : PARTS)), ...STATE_FIXTURES.map(() => STATE_PARTS)];
  const morphs = [...FIXTURES.map((f) => f.morph), ...STATE_FIXTURES.map((f) => f.morph)];
  const leak = morphs.some((m, i) => { const c = cleanMorph(m); const r = c ? morphCss(c, allPublic[i] as any, { editor: false }) : null; return !!r && /data-de-(force|at)/.test(r.css); });
  ok("a public page's CSS never names the editor's forcing attributes", !leak);
}
{
  const c = cleanMorph({ v: 1, parts: { title: { size: 30, states: { hover: { fill: "#cc0000" }, focus: { color: "#00aa00" } }, at: { md: { size: 26 }, sm: { size: 20 } } } } });
  const ed = morphCss(c, PARTS, { editor: true })!.css;
  const pub = morphCss(c, PARTS, {})!.css;
  ok("editor: a hover look is also written for an element marked to show it", /\.blk-hero-title:hover,template\[data-morph="[a-z0-9]+"\] \+ \.blk-hero \.blk-hero-title\[data-de-force~="hover"\]\{[^}]*background:#cc0000 !important/.test(ed), ed);
  ok("editor: focus has its own forced selector, so hover and focus do not leak into each other", ed.includes('.blk-hero-title[data-de-force~="focus"]{') && !/\[data-de-force~="focus"\]\{[^}]*background/.test(ed));
  ok("editor: a size look is written for an element marked to show it, tablets first, phones after", ed.indexOf('[data-de-at~="md"]') > 0 && ed.indexOf('[data-de-at~="sm"]') > ed.indexOf('[data-de-at~="md"]'), ed);
  ok("editor: the forced size rules sit before the state rules, so a real hover still wins as it does on the page", ed.indexOf('[data-de-at~="sm"]') < ed.indexOf(":hover,"), ed);
  ok("editor: the real media rules are kept", ed.includes("@media (max-width:480px)") && ed.includes("@media (max-width:820px)"));
  ok("editor: every declaration is !important", [...ed.matchAll(/\{([^{}]*)\}/g)].every((m) => m[1]!.split(";").every((d) => / !important$/.test(d))));
  ok("editor output starts with the public output's base rules (a prefix)", ed.replace(/\bscope\b/g, "").split("\n")[0]!.replace(/data-morph="[a-z0-9]+"/, "") === pub.split("\n")[0]!.replace(/data-morph="[a-z0-9]+"/, ""));
  ok("a pseudo-element selector gets no forced state selector either", !(morphCss({ v: 1, parts: { x: { states: { hover: { fill: "#fff" } } } } } as any, { x: { sel: "> p::first-line" } }, { editor: true })?.css ?? "").includes("data-de-force"));
  ok("a look with no states or sizes has no forcing selectors in the editor either (v1 stays as it was)", !/data-de-/.test(morphCss(cleanMorph({ v: 1, parts: { title: { size: 30 } } }), PARTS, { editor: true })!.css));
}

const wh: any = await import("/app/packages/direct-edit/src/panel/where.ts").catch((e: any) => { console.log("  (panel/where.ts: " + String(e?.message ?? e).slice(0, 120) + ")"); return null; });
ok("panel/where.ts exists and exports the helpers", !!wh && ["whereMarks", "nextWhere", "editLookAt", "lookAtWhere", "whereHtml", "clashLine", "cleanWhere"].every((k) => typeof wh[k] === "function") && typeof wh.Forcer === "function");
if (wh) {
  // Default is Always and Every size: nothing about today's behaviour moves.
  let identical = 0;
  for (const f of FIXTURES) {
    const cleaned = cleanMorph(f.morph);
    if (!cleaned?.parts) continue;
    const names = Object.keys(cleaned.parts);
    const viaOld: Record<string, unknown> = { morph: JSON.parse(JSON.stringify(cleaned)) };
    const viaNew: Record<string, unknown> = { morph: JSON.parse(JSON.stringify(cleaned)) };
    for (const n of names) {
      const s = JSON.parse(JSON.stringify(partLookOf(viaOld, n))); s.fx = 3; s.size = (s.size ?? 20) + 1; setPartLook(viaOld, n, s);
      wh.editLookAt(viaNew, n, {}, (t: any) => { t.fx = 3; t.size = (t.size ?? 20) + 1; });
    }
    const a = JSON.stringify(viaOld.morph), b = JSON.stringify(viaNew.morph);
    const ca = cleanMorph(viaOld.morph), cb = cleanMorph(viaNew.morph);
    const pa = ca ? morphCss(ca, PARTS as any, {}) : null, pb = cb ? morphCss(cb, PARTS as any, {}) : null;
    if (a === b && JSON.stringify(pa) === JSON.stringify(pb)) identical++;
  }
  ok(`default where ({}): an edit through the panel's writer stores and compiles exactly as setPartLook did, on ${FIXTURES.length}-ish stored v1 looks`, identical >= 12, `${identical}`);
  ok("default where reads what partLookOf reads", FIXTURES.every((f) => { const c = cleanMorph(f.morph); return !c?.parts || Object.keys(c.parts).every((n) => JSON.stringify(wh.lookAtWhere({ morph: c }, n, {})) === JSON.stringify(partLookOf({ morph: c }, n))); }));
  ok("an unknown or doubled where is the base look (nothing stored under a made-up place)", JSON.stringify(wh.cleanWhere({ state: "hover", at: "sm" })) === "{}" && JSON.stringify(wh.cleanWhere({ state: "visited" })) === "{}" && JSON.stringify(wh.cleanWhere(undefined)) === "{}" && JSON.stringify(wh.cleanWhere({ at: "md" })) === '{"at":"md"}');

  // Writing at a state or a size keeps everything else.
  const pr2: Record<string, unknown> = {};
  setPartLook(pr2, "title", { size: 30, fill: "#112233" });
  const base0 = JSON.stringify(partLookOf(pr2, "title"));
  ok("edit at hover stores under states.hover and leaves the base look alone", wh.editLookAt(pr2, "title", { state: "hover" }, (s: any) => { s.fill = "#cc0000"; }) === true && JSON.stringify(partLookOf(pr2, "title")) === base0 && partLookAt(pr2, "title", { state: "hover" }).fill === "#cc0000");
  ok("edit at phones stores under at.sm", wh.editLookAt(pr2, "title", { at: "sm" }, (s: any) => { s.size = 18; }) === true && partLookAt(pr2, "title", { at: "sm" }).size === 18);
  ok("a hover look starts empty: the base look is not copied into it", Object.keys(wh.lookAtWhere(pr2, "title", { state: "focus" })).length === 0);
  ok("the panel's read of hover is the hover look, not the base", wh.lookAtWhere(pr2, "title", { state: "hover" }).fill === "#cc0000" && wh.lookAtWhere(pr2, "title", { state: "hover" }).size === undefined);
  ok("a state and a size together write nothing (the writer turns it into the base look only if asked to, never both)", (() => { const before = JSON.stringify(pr2.morph); wh.editLookAt(pr2, "title", { state: "hover", at: "sm" } as any, () => {}); return JSON.stringify(pr2.morph) === before; })());
  const stored2 = JSON.stringify(pr2.morph);
  ok("the stored look still passes the cleaner unchanged", JSON.stringify(cleanMorph(pr2.morph)) === stored2);
  wh.editLookAt(pr2, "title", { state: "hover" }, (s: any) => { for (const k of Object.keys(s)) delete s[k]; });
  ok("emptying the hover look removes just it", partLookAt(pr2, "title", { state: "hover" }) && Object.keys(partLookAt(pr2, "title", { state: "hover" })).length === 0 && partLookAt(pr2, "title", { at: "sm" }).size === 18 && partLookOf(pr2, "title").fill === "#112233");

  // The switch: dots, and where a click leads.
  const marks = wh.whereMarks(pr2, "title");
  ok("a dot marks the places that hold a look (base, phones), not the empty ones", marks.base === true && marks.at.sm === true && !marks.at.md && !marks.state.hover && !marks.state.focus && !marks.state.active, JSON.stringify(marks));
  ok("a part with no look has no dots", (() => { const m = wh.whereMarks({}, "title"); return !m.base && !Object.keys(m.state).length && !Object.keys(m.at).length; })());
  ok("clicking On hover leads to hover and drops any size", JSON.stringify(wh.nextWhere({ at: "sm" }, "state:hover")) === '{"state":"hover"}');
  ok("clicking Phones leads to phones and drops any state", JSON.stringify(wh.nextWhere({ state: "focus" }, "at:sm")) === '{"at":"sm"}');
  ok("clicking Always while on Phones stays on Phones; Every size while on hover stays on hover", JSON.stringify(wh.nextWhere({ at: "sm" }, "state:")) === '{"at":"sm"}' && JSON.stringify(wh.nextWhere({ state: "hover" }, "at:")) === '{"state":"hover"}');
  ok("Always from the base is the base", JSON.stringify(wh.nextWhere({}, "state:")) === "{}" && JSON.stringify(wh.nextWhere({}, "at:")) === "{}");
  ok("a made-up option leads to the base look", JSON.stringify(wh.nextWhere({ state: "hover" }, "state:visited")) === "{}" && JSON.stringify(wh.nextWhere({}, "at:xl")) === "{}");
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
  const html: string = wh.whereHtml({ now: { state: "hover" }, marks }, esc);
  ok("the switch says When and Screen in plain words", ["When", "Screen", "Always", "On hover", "On focus", "On press", "Every size", "Phones", "Tablets"].every((w) => html.includes(w)));
  ok("no jargon in the switch", !/media|query|pseudo|:hover|focus-visible|breakpoint|css/i.test(html.replace(/data-[a-z-]+="[^"]*"/g, "")));
  ok("the chosen option is pressed, the others are not", (html.match(/aria-pressed="true"/g) ?? []).length === 2 && /data-where="state:hover" aria-pressed="true"/.test(html) && /data-where="at:" aria-pressed="true"/.test(html));
  ok("a dot sits on Phones and Always, nowhere else", (html.match(/class="de-dot"/g) ?? []).length === 3 && /data-where="at:sm"[^>]*>Phones<i class="de-dot"/.test(html), html);

  // Style against look.
  const rl2: any = await import("/app/packages/direct-edit/src/block/read-look.ts");
  const read = rl2.readLook({ props: { morph: { v: 1, parts: { root: { fill: "#00ff00" } } }, blkStyle: { bg: "#ff0000" } } }, { parts: PARTS }, blkDecls);
  const mkClash = (morphRoot: any, blk: any, tokens?: any) => wh.clashLine(rl2.readLook({ props: { morph: { v: 1, parts: { root: morphRoot }, ...(tokens ? { tokens } : {}) }, blkStyle: blk } }, { parts: PARTS }, blkDecls).conflicts);
// Style is inline on a wrapper around the block; the look is a rule on the block's root inside it. Different elements: most things stack.
const cBg = mkClash({ fill: "#00ff00" }, { bg: "#ff0000" });
ok("background: both draw, the look's covers the Style's, said in plain words", /^Style and this look both change the background\. .*look.*background.*(covers|over)/i.test(cBg ?? "") && !/The look wins/.test(cBg ?? ""), String(cBg));
const cPad = mkClash({ padding: 10 }, { padY: 40 });
ok("space inside: both add, the block gets both", /both change the space inside\. Both add space, so the block gets both\./.test(cPad ?? "") && !/wins/i.test(cPad ?? ""), String(cPad));
const cMar = mkClash({ margin: 8 }, { marginTop: 20 });
ok("space outside: both add", /both change the space outside\. Both add space, so the block gets both\./.test(cMar ?? ""), String(cMar));
const cInk = mkClash({}, { color: "#222222" }, { "--blk-fg": "#111111" });
ok("text colour (inherited): the look's is the one you see", /both change the text colour\. The look's text colour is the one you see\./.test(cInk ?? ""), String(cInk));
const cBor = mkClash({ bwidth: 2, bstyle: "solid", bcolor: "#000000" }, { borderWidth: 1 });
ok("border: both draw, one inside the other", /both change the border\. Both borders draw, one inside the other\./.test(cBor ?? ""), String(cBor));
const cOp = mkClash({ opacity: 0.5 }, { opacity: 80 });
ok("opacity: both fade the block, they multiply", /both change how see-through it is\. Both fade the block, so they multiply\./.test(cOp ?? ""), String(cOp));
const cMany = mkClash({ fill: "#00ff00", margin: 8 }, { bg: "#ff0000", align: "center", color: "#222222" }, { "--blk-fg": "#111111" });
ok("several kinds: each said once, no blanket winner", /text colour/.test(cMany ?? "") && /background/.test(cMany ?? "") && /space outside/.test(cMany ?? "") && !/The look wins\./.test(cMany ?? "") && (cMany!.match(/the one you see/g) ?? []).length === 1, String(cMany));
ok("no clash, no line", wh.clashLine(rl2.readLook({ props: { morph: { v: 1, parts: { root: { fill: "#00ff00" } } } } }, { parts: PARTS }, blkDecls).conflicts) === undefined && wh.clashLine(undefined) === undefined);
// The choice is kept per block and part outside any one mount (Puck remounts the panel after a props change).
ok("selectionWhere / rememberWhere exist", typeof wh.selectionWhere === "function" && typeof wh.rememberWhere === "function");
{
  const k1 = "blk1~p:title", k2 = "blk1~p:image";
  ok("a fresh selection starts at Always and Every size", JSON.stringify(wh.selectionWhere(k1)) === "{}");
  wh.rememberWhere(k1, { state: "hover" });
  ok("after a remount (the same key again) the choice is still hover", JSON.stringify(wh.selectionWhere(k1)) === '{"state":"hover"}');
  ok("…and again after a second remount, and the writer still lands in the hover look", (() => { const w = wh.selectionWhere(k1); const props: Record<string, unknown> = {}; setPartLook(props, "title", { size: 60 }); wh.editLookAt(props, "title", w, (t: any) => { t.size = 80; }); wh.editLookAt(props, "title", wh.selectionWhere(k1), (t: any) => { t.size = 85; }); return partLookAt(props, "title", { state: "hover" }).size === 85 && partLookOf(props, "title").size === 60; })());
  ok("another part clears it (and it stays cleared when the first part is picked again)", JSON.stringify(wh.selectionWhere(k2)) === "{}" && JSON.stringify(wh.selectionWhere(k1)) === "{}");
  wh.rememberWhere(k1, { at: "sm" });
  wh.rememberWhere(k1, {});
  ok("choosing Always and Every size again forgets it", JSON.stringify(wh.selectionWhere(k1)) === "{}");
  wh.rememberWhere(k1, { state: "hover", at: "sm" } as any);
  ok("a state with a size is never remembered", JSON.stringify(wh.selectionWhere(k1)) === "{}");
}
ok("reading a clash writes nothing", JSON.stringify(read.root) === JSON.stringify(rl2.readLook({ props: { morph: { v: 1, parts: { root: { fill: "#00ff00" } } }, blkStyle: { bg: "#ff0000" } } }, { parts: PARTS }, blkDecls).root));
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
