// Stone 2's delivery checks, in a real browser (2026-11-04). Every group runs in the page and returns its results;
// smoke-morph.cjs runs each from a fresh load and prints `pass N fail M`. Bundled by hb.sh, development React so a
// hydration mismatch is logged. The parts checks are S1 §3.3's, moved here (note 1): its `smoke.mts` waits for the
// stone 15a install. Numbers cite 2-specialist-contract-and-overlay.md.
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { Render } from "@puckeditor/core/rsc";
import { FONT_LIBRARY, fontStack } from "/app/packages/fonts/src/index";
import { createCatalogue, defineBlock, SHARED_BLOCKS, toDefaultProps } from "/app/packages/blocks/src/index";
import { BLOCK_TOKENS, contractOf } from "/app/packages/blocks/src/contract";
import { buildPuckConfig } from "/app/packages/page-builder/src/config";
import { cleanMorph, isFontToken, morphCss, partLookOf, partSafeDecls, setPartLook, setToken, sheetSafe, tokenOf } from "/app/packages/direct-edit/src/block/morph";
import { hasOwn, PART_NAME, ROOT_PART } from "/app/packages/direct-edit/src/block/contract";
import { balancedCss, safeDecls } from "/app/packages/direct-edit/src/block/style";
import { patchCss } from "/app/packages/direct-edit/src/block/patch";
import { cleanBoxDoc, duplicatePuckNode, findPuckNode, mayPlace, movePuckNode, nodeLevels, slotList, walkDoc, type PuckDoc } from "/app/packages/direct-edit/src/block/puck-tree";
import { drawnParts, partEls } from "/app/packages/direct-edit/src/canvas/parts";
import { BOX_BLOCKS, BOX_ROOT } from "/app/packages/direct-edit/src/puck/blocks";
import { MorphMark } from "/app/packages/direct-edit/src/puck/morph-mark";
import { slotsOf } from "/app/packages/direct-edit/src/puck/mount";
import { TreeCanvas } from "/app/packages/direct-edit/src/puck/TreeCanvas";
import { banner as ptBanner } from "/app/apps/sunjay/src/blocks/layout-blocks";
import { classifieds } from "./sample";

const blocks: any[] = [...SHARED_BLOCKS, ptBanner, ...(BOX_BLOCKS as any)];
const config: any = buildPuckConfig({ blocks: blocks as any, root: BOX_ROOT as any, morph: MorphMark as any });
const contract: any = contractOf(blocks as any);
const blockOf = (id: string) => blocks.find((b) => b.def.id === id);
const slots = slotsOf(config);
const FIRST = ["hero-banner", "section-heading", "prose", "picture-wall", "feature-card", "pt-banner"];
const heroParts = blockOf("hero-banner").def.parts;
const FONT = "Playfair Display";

type Result = [name: string, ok: boolean, detail?: unknown];
let out: Result[] = [];
const ok = (name: string, cond: unknown, detail?: unknown) => { out.push([name, !!cond, cond ? undefined : detail]); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newHost = () => { const h = document.createElement("div"); document.getElementById("host")!.appendChild(h); return h; };
const rulesOf = (css: string) => { const s = new CSSStyleSheet(); s.replaceSync(css); return s.cssRules; };
const hosted: Array<() => void> = [];
const clear = () => { hosted.splice(0).forEach((f) => f()); document.getElementById("host")!.replaceChildren(); };

/** The published path, through Puck's <Render>. */
function pub(content: any[]) {
  const h = newHost(), root = createRoot(h);
  flushSync(() => root.render(createElement(Render as any, { config, data: { root: { props: {} }, content } })));
  hosted.push(() => root.unmount());
  return h;
}
/** The editor's path, through TreeCanvas. */
function tree(content: any[], o: { samples?: Record<string, Record<string, unknown>>; config?: any } = {}) {
  const h = newHost(), root = createRoot(h), zones = new Map();
  const doc = { root: { props: {} }, content };
  const c = o.config ?? config, s = slotsOf(c);
  let version = 1;
  const draw = () => flushSync(() => root.render(createElement(TreeCanvas as any, { config: c, doc, slots: s, version: version++, zones, samples: o.samples })));
  draw();
  hosted.push(() => root.unmount());
  return { h, doc, draw };
}
const css = (decl: string, extra: object = {}) => ({ v: 1, parts: { title: { css: decl, ...extra } } });
const look = (l: unknown) => ({ v: 1, parts: { title: l } });
const propsFor = (b: any, extra?: object) => ({ ...toDefaultProps(b.def), ...(b.sample ? b.sample() : {}), ...(extra ?? {}) });
async function useCss(mode: "plain" | "layered" | "sunjay" | "none") {
  document.querySelectorAll("[data-t-css]").forEach((e) => e.remove());
  if (mode === "none") return;
  const text = await (await fetch("blocks.css")).text();
  const s = document.createElement("style");
  s.dataset.tCss = mode;
  // Tailwind hosts import blocks.css with layer(components); the rest load it unlayered.
  s.textContent = mode === "layered" ? `@layer components{${text}}` : text;
  document.head.prepend(s);
  if (mode === "sunjay") {
    const j = document.createElement("style");
    j.dataset.tCss = mode;
    j.textContent = await (await fetch("sunjay-banner.css")).text();
    s.after(j);
  }
}

// ---------------------------------------------------------------- the 35 hostile inputs of S1 §6.3
function hostile() {
  const proto = JSON.parse('{"v":1,"parts":{"__proto__":{"fill":"#111111"}}}');
  const thirty = Array.from({ length: 30 }, () => "letter-spacing: 1px").join(";");
  const inputs: Array<[string, unknown]> = [
    // Shape
    ["a string", "morph"],
    ["an array", [{ v: 1, parts: { title: { fill: "#111111" } } }]],
    ["null", null],
    ["x{}body as a part name", { v: 1, parts: { "x{}body": { fill: "#111111" } } }],
    ["a.b as a part name", { v: 1, parts: { "a.b": { fill: "#111111" } } }],
    ["__proto__ as a part name", proto],
    ["a colour written as two declarations", look({ color: "red;background:url(x)" })],
    ["a numeric row key", { v: 1, rows: { title: { 3: { fill: "#111111" } } }, parts: { 3: { fill: "#111111" } } }],
    ["r3,body as a row key", { v: 1, rows: { title: { "r3,body": { fill: "#111111" } } }, parts: { "r3,body": { fill: "#111111" } } }],
    ["30 declarations in each of 64 parts", { v: 1, parts: Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`p${i}`, { css: thirty }])) }],
    // Escape
    ["a comment opened", css("color: red /*")],
    ["a comment closed", css("color: red */")],
    ["a bracket left open", css("color: rgb(1,2")],
    ["a quote left open", css('font-family: "x')],
    ["!important in a value", css("color: red !important")],
    ["a rule closed in a value", css("color: red } body { display:none")],
    ["a style tag closed in a value", css("color: </style><script>alert(1)</script>")],
    // Loading
    ["url(", css("background: url(x)")],
    ["URL(", css("background: URL(x)")],
    ["an escaped url(", css("background: u\\72l(x)")],
    ["image-set(", css('background: image-set("x" 1x)')],
    ["src(", css('background: src("x")')],
    ["paint(", css("background: paint(x)")],
    ["attr(", css("color: attr(x)")],
    // Variables
    ["a variable of the host", css("color: var(--secret)")],
    ["a fallback that loads", css("color: var(--blk-accent, url(x))")],
    // Traps
    ["position: fixed", css("position: fixed")],
    ["z-index", css("z-index: 9")],
    ["pointer-events", css("pointer-events: none")],
    ["transform: scale(50)", css("transform: scale(50)")],
    ["pos: absolute", look({ pos: "absolute", x: 1, y: 2 })],
    // Tokens
    ["url(x) as a token's value", { v: 1, tokens: { "--blk-accent": "url(x)" } }],
    ["x:y;--z as a token's name", { v: 1, tokens: { "x:y;--z": "red" } }],
    ["a rule closed in a token", { v: 1, tokens: { "--blk-accent": "red;}body{display:none" } }],
    // Fonts
    ["a font not in the library", look({ font: "Evil Sans" })],
  ];
  ok("hostile: all 35 listed", inputs.length === 35, inputs.length);
  for (const [name, raw] of inputs) ok(`hostile: ${name} is refused`, cleanMorph(raw) === null, cleanMorph(raw));

  // Beside a harmless look: the look survives, the hostile value does not, and the sheet parses to the one rule.
  for (const [name, decl] of [
    ["comment", "color: red /*"], ["end comment", "color: red */"], ["bracket", "color: rgb(1,2"], ["quote", 'font-family: "x'], ["important", "color: red !important"],
    ["rule", "color: red } body { display:none"], ["tag", "color: </style><script>alert(1)</script>"], ["url", "background: url(x)"], ["attr", "color: attr(x)"], ["variable", "color: var(--secret)"], ["trap", "transform: scale(50)"],
  ] as const) {
    const m = cleanMorph(css(decl, { fill: "#123456" }));
    const c = m && morphCss(m, heroParts);
    ok(`hostile beside a look: ${name}: the look stays`, c && c.css.includes("background:#123456 !important"), c);
    ok(`hostile beside a look: ${name}: the sheet is one rule`, c && rulesOf(c.css).length === 1, c?.css);
    ok(`hostile beside a look: ${name}: nothing of it is written`, c && !/url\(|attr\(|var\(|<|\/\*|\*\/|scale|}\s*body|"x/.test(c.css.slice(c.css.indexOf("{"))), c?.css);
    ok(`hostile: ${name}: the Code tab's filter refuses it`, partSafeDecls(decl).length === 0, partSafeDecls(decl));
  }

  ok("hostile: nothing landed on Object.prototype", (({}) as any).fill === undefined);
  // The refused keys of a part must not come back through the box vocabulary.
  const pos = cleanMorph(look({ pos: "absolute", x: 1, y: 2, fill: "#123456" }));
  ok("hostile: pos absolute goes with its x and y", same(pos, { v: 1, parts: { title: { fill: "#123456" } } }), pos);
  // A hostile declaration among good ones does not take the good ones with it.
  const mixed = cleanMorph(css("color: #123; background: url(x); opacity: .5; z-index: 9; text-transform: uppercase"));
  ok("hostile: only the bad declarations go", mixed?.parts?.title?.css === "color:#123;opacity:.5;text-transform:uppercase", mixed);
  // A font token holds a library family; a length that says font in its name is not a font token.
  ok("hostile: a font token outside the library is refused", cleanMorph({ v: 1, tokens: { "--blk-font-title": "Evil Sans" } }) === null);
  ok("hostile: a font token in the library is kept", same(cleanMorph({ v: 1, tokens: { "--blk-font-title": FONT } }), { v: 1, tokens: { "--blk-font-title": FONT } }));
  ok("hostile: --x-font-size is a length", same(cleanMorph({ v: 1, tokens: { "--x-font-size": "14px" } }), { v: 1, tokens: { "--x-font-size": "14px" } }));
  ok("hostile: a part called type is refused", cleanMorph({ v: 1, parts: { type: { fill: "#111111" } } }) === null);

  const bad = morphCss({ v: 1, parts: { a: { fill: "#111111" } }, tokens: { "--blk-accent": "#222222" } }, { root: { sel: "> .x, body" }, a: { sel: ".y, body" } });
  ok("hostile: a declared selector with a comma writes nothing of itself", bad && !/body/.test(bad.css) && rulesOf(bad.css).length === 1, bad?.css);
}

// ---------------------------------------------------------------- what must keep working
function ordinary() {
  const values: Array<[string, string]> = [
    ["width", "calc((1px + 2px) * 2)"], ["width", "calc(100% - (2 * 8px))"], ["color", "var(--blk-accent)"], ["color", "rgb(1, 2, 3)"], ["color", "hsl(10 20% 30% / .5)"],
    ["font-family", '"Playfair Display", Georgia, serif'], ["font-family", "'Noto Sans', sans-serif"], ["grid-template-columns", "repeat(2, minmax(0, 1fr))"], ["max-width", "clamp(10px, 2vw, 300px)"],
    ["background", "linear-gradient(to right, #000, #fff)"], ["box-shadow", "0 1px 2px rgba(0, 0, 0, .2)"], ["color", "color-mix(in srgb, var(--blk-accent) 60%, black)"], ["filter", "blur(2px)"],
    ["margin", "0 auto"], ["line-height", "1.4"], ["grid-column", "span 2"],
  ];
  for (const [k, v] of values) {
    ok(`ordinary: ${k}: ${v}: a valid declaration`, CSS.supports(k, v));
    ok(`ordinary: ${k}: ${v}: sheetSafe`, sheetSafe(v));
    ok(`ordinary: ${k}: ${v}: safeDecls keeps it whole`, same(safeDecls(`${k}: ${v}`), [[k, v]]), safeDecls(`${k}: ${v}`));
    const m = cleanMorph(css(`${k}: ${v}`));
    ok(`ordinary: ${k}: ${v}: a morph keeps it`, m?.parts?.title?.css === `${k}:${v}`, m);
    const c = m && morphCss(m, heroParts);
    const rule = c && (rulesOf(c.css)[0] as CSSStyleRule);
    ok(`ordinary: ${k}: ${v}: the sheet draws it`, rule && rule.style.getPropertyValue(k) !== "" && rule.style.getPropertyPriority(k) === "important", c?.css);
  }
  // Every family of the library, as a look and as a token.
  let badFont: string[] = [];
  for (const f of FONT_LIBRARY) {
    const a = morphCss(cleanMorph(look({ font: f.family }))!, heroParts);
    const b = morphCss(cleanMorph({ v: 1, tokens: { "--blk-font-title": f.family } })!, heroParts);
    const ra = a && rulesOf(a.css)[0] as CSSStyleRule, rb = b && rulesOf(b.css)[0] as CSSStyleRule;
    if (!ra || !rb || !ra.style.getPropertyValue("font-family") || rb.style.getPropertyValue("--blk-font-title").trim() !== fontStack(f.family)) badFont.push(f.family);
  }
  ok(`ordinary: all ${FONT_LIBRARY.length} library fonts compile`, FONT_LIBRARY.length > 10 && badFont.length === 0, badFont.slice(0, 5));
  // The Code tab round-trips a look through text: a font's stack must come back.
  const lostStack = FONT_LIBRARY.filter((f: any) => !same(safeDecls(`font-family: ${fontStack(f.family)}`), [["font-family", fontStack(f.family)]]) || partSafeDecls(`font-family: ${fontStack(f.family)}`).length !== 1).map((f: any) => f.family);
  ok("ordinary: every font's stack survives the Code tab", lostStack.length === 0, lostStack.slice(0, 5));
  for (const t of BLOCK_TOKENS) ok(`ordinary: ${t.name} is ${t.type === "font" ? "" : "not "}read as a font`, isFontToken(t.name) === (t.type === "font"));
  for (const b of blocks) for (const t of b.def.tokens ?? []) ok(`ordinary: ${b.def.id} ${t.name} is ${t.type === "font" ? "" : "not "}read as a font`, isFontToken(t.name) === (t.type === "font"));
}

// ---------------------------------------------------------------- R-a: a box's raw CSS in a shared stylesheet
function repair() {
  // The check itself: a value that opens a comment does lose the next rule when it reaches a sheet.
  ok("R-a control: the broken form loses the next rule", rulesOf("a{color:red /* !important}\nb{color:blue !important}").length === 0 || rulesOf("a{color:red /* !important}\nb{color:blue !important}").length === 1);
  for (const v of ["color: red /*", "color: red */", "color: red !important", "color: rgb(1,2", "color: rgb(1,2))", 'font-family: "x', "font-family: 'x", "grid-template-columns: [a", `width: ${"1".repeat(161)}px`, `--x: ${"a".repeat(161)}`]) ok(`R-a: safeDecls refuses ${v.slice(0, 30)}`, safeDecls(v).length === 0, safeDecls(v));
  const at160 = `calc(${"1".repeat(146)}px + 1px)`;
  ok("R-a: a whole value of 160 characters is kept", at160.length === 160 && same(safeDecls(`width: ${at160}`), [["width", at160]]), at160.length);
  const just160 = "a".repeat(160), just161 = "a".repeat(161);
  ok("R-a: 160 kept, 161 refused, nothing cut", same(safeDecls(`--x: ${just160}`), [["--x", just160]]) && same(safeDecls(`--x: ${just161}`), []));
  ok("R-a: the rest of a box's css stays", same(safeDecls("color: red /*; margin: 0; width: calc(1px"), [["margin", "0"]]), safeDecls("color: red /*; margin: 0; width: calc(1px"));
  ok("R-a: balancedCss reads strings as strings", balancedCss('"a(" b') && balancedCss("calc((1px))") && !balancedCss("a)") && !balancedCss("(]"));

  const sel = (n: string) => `[data-edit-section="s${n}"]`;
  const doc: any = { v: 1, boxes: {
    [sel("1")]: { style: { fill: "#111111", css: "color: red /*" } },
    [sel("2")]: { style: { fill: "#222222", css: "color: rgb(1,2" } },
  } };
  const text = patchCss(doc);
  ok("R-a: patchCss, 2 of 2 rules", rulesOf(text).length === 2, text);
  const el = document.createElement("style"); el.textContent = text; document.head.appendChild(el);
  ok("R-a: patchCss, 2 of 2 in a real <style>", el.sheet!.cssRules.length === 2, el.sheet!.cssRules.length);
  document.getElementById("host")!.innerHTML = '<div data-edit-section="s1" id="a">one</div><div data-edit-section="s2" id="b">two</div>';
  ok("R-a: the second box draws", getComputedStyle(document.getElementById("b")!).backgroundColor === "rgb(34, 34, 34)", getComputedStyle(document.getElementById("b")!).backgroundColor);
  ok("R-a: the broken declaration is not drawn", getComputedStyle(document.getElementById("a")!).color !== "rgb(255, 0, 0)");
  el.remove();
  // What classifieds holds: tree.html#classifieds draws this document, so nothing in it may be refused.
  const lost: string[] = []; let seen = 0;
  walkDoc(classifieds as unknown as PuckDoc, slotsOf(config), (f) => {
    const raw = (f.node.props.look as { css?: string } | undefined)?.css;
    if (!raw) return;
    seen++;
    const pieces = raw.split(";").map((d) => d.trim()).filter(Boolean);
    if (safeDecls(raw).length !== pieces.length) lost.push(raw.slice(0, 80));
  });
  ok(`R-a: classifieds, ${seen} boxes' css: every declaration kept`, seen > 10 && lost.length === 0, lost.slice(0, 3));
  ok("R-a: nothing else about a box's css changed", same(safeDecls("--x-y: 1px; display: flex; position: relative; position: fixed; color: #123"), [["--x-y", "1px"], ["display", "flex"], ["position", "relative"], ["color", "#123"]]), safeDecls("--x-y: 1px; display: flex; position: relative; position: fixed; color: #123"));
}

// ---------------------------------------------------------------- cleanMorph, morphCss, the reads and writes, cleanBoxDoc
function clean() {
  const seeds: unknown[] = [
    look({ color: "#FF0000", size: 9999, css: "color: red; background: url(x); margin: 0" }),
    { v: 1, parts: { title: { font: FONT, weight: 700, italic: true, case: "upper", padding: [1, 2, 3, 4], radius: 4 }, root: { fill: "#AABBCC", hide: true } }, tokens: { "--blk-accent": "#123456", "--blk-font-body": FONT } },
    { v: 1, parts: { a: {} , b: { unknown: 1 } } },
    { v: 1, parts: { title: { pos: "relative", x: 9000, y: -9000, tx: 999 } } },
    { v: 1, parts: { constructor: { fill: "#123456" }, toString: { fill: "#654321" } } },
    { v: 1, tokens: { "--blk-accent": "var(--blk-fg)", "--blk-radius": "4px", "--BAD": "x" } },
  ];
  // Seeded, so a failure repeats.
  let seed = 7; const rnd = (n: number) => { seed = (seed * 16807) % 2147483647; return seed % n; };
  const keys = ["color", "fill", "size", "weight", "font", "align", "padding", "margin", "opacity", "radius", "bstyle", "bcolor", "bwidth", "hide", "css", "pos", "x", "y", "tx", "ty", "layout", "gcols", "gap", "w", "h"];
  const vals: unknown[] = ["#ABCDEF", "#12", 3, 700, -1, 99999, FONT, "center", [1, 2, 3, 4], true, "solid", "grid", "relative", "absolute", "color: red; margin: 0; z-index: 9", "width: calc(1px + (2px))", "color: red /*"];
  for (let i = 0; i < 300; i++) { const l: Record<string, unknown> = {}; for (let k = 0; k < 6; k++) l[keys[rnd(keys.length)]!] = vals[rnd(vals.length)]; seeds.push({ v: 1, parts: { [`p${rnd(5)}`]: l } }); }
  let notStable = 0, sheetBad = 0;
  for (const s of seeds) {
    const once = cleanMorph(s);
    if (!same(once, once && cleanMorph(once))) notStable++;
    const c = once && morphCss(once, { p0: { sel: ".a" }, p1: { sel: "> .b" }, title: { sel: ".t" }, root: { sel: "> .r" } });
    if (c && rulesOf(c.css).length !== c.css.split("\n").length) sheetBad++;
  }
  ok(`clean: idempotent over ${seeds.length} inputs`, notStable === 0, notStable);
  ok("clean: each written rule parses as one rule", sheetBad === 0, sheetBad);

  // Names that are not this block's.
  const ctor = cleanMorph({ v: 1, parts: { constructor: { fill: "#123456" } } });
  ok("clean: constructor is a storable name", !!ctor?.parts);
  ok("clean: constructor finds nothing in morphCss", ctor && morphCss(ctor, heroParts) === null, ctor && morphCss(ctor, heroParts));
  ok("clean: nor with no parts declared", ctor && morphCss(ctor, undefined) === null);
  ok("clean: a stale part draws nothing", morphCss({ v: 1, parts: { gone: { fill: "#123456" } } }, heroParts) === null);
  const staleKept = morphCss({ v: 1, parts: { gone: { fill: "#123456" }, title: { fill: "#654321" } } }, heroParts);
  ok("clean: a stale part beside a live one writes the live one", staleKept && rulesOf(staleKept.css).length === 1 && staleKept.css.includes(".blk-hero-title"), staleKept);

  // Caps.
  const line = Array.from({ length: 30 }, () => "letter-spacing: 1px").join(";");
  const sized = (n: number) => ({ v: 1, parts: Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, { css: line }])) });
  const under = cleanMorph(sized(25)), over = cleanMorph(sized(40));
  ok("clean: under 16 KB is kept whole", under && Object.keys(under.parts!).length === 25 && JSON.stringify(under).length < 16384, under && JSON.stringify(under).length);
  ok("clean: past 16 KB the morph is dropped whole", over === null);
  const many = cleanMorph({ v: 1, parts: Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`p${i}`, { fill: "#123456" }])), tokens: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`--t${i}`, "1px"])) });
  ok("clean: 64 parts, 24 tokens at most", many && Object.keys(many.parts!).length === 64 && Object.keys(many.tokens!).length === 24, many && [Object.keys(many.parts!).length, Object.keys(many.tokens!).length]);
  const fonts = FONT_LIBRARY.filter((f: any) => f.source === "google").slice(0, 6).map((f: any) => f.family);
  const compiled = morphCss(cleanMorph({ v: 1, parts: Object.fromEntries(fonts.map((f: string, i: number) => [`p${i}`, { font: f }])) })!, Object.fromEntries(fonts.map((_: string, i: number) => [`p${i}`, { sel: `.p${i}` }])));
  ok("clean: 4 fonts per node at most", compiled?.fonts.length === 4, compiled?.fonts);

  // The compile.
  const a = morphCss(cleanMorph(look({ color: "#123456", size: 72 }))!, heroParts)!;
  ok("clean: the scope is a plain token", /^[a-z0-9]+$/.test(a.scope), a.scope);
  ok("clean: the same morph, the same scope", a.scope === morphCss(cleanMorph(look({ size: 72, color: "#123456" }))!, heroParts)!.scope);
  ok("clean: another morph, another scope", a.scope !== morphCss(cleanMorph(look({ color: "#123457", size: 72 }))!, heroParts)!.scope);
  ok("clean: a large title cannot overflow a phone", a.css.includes("font-size:min(72px, 11vw) !important"), a.css);
  ok("clean: every declaration is important", a.css.split("{")[1]!.split(";").every((d) => d.includes("!important")), a.css);
  ok("clean: nothing of the editor reaches the sheet", !/data-tree/.test(a.css));
  const pubHide = morphCss({ v: 1, parts: { title: { hide: true } } }, heroParts)!, edHide = morphCss({ v: 1, parts: { title: { hide: true } } }, heroParts, { editor: true })!;
  ok("clean: hidden is display none, published", pubHide.css.includes("display:none !important"), pubHide.css);
  ok("clean: hidden is faint, in the editor", edHide.css.includes("opacity:.3 !important") && !edHide.css.includes("display:none"), edHide.css);
  const notes = morphCss({ v: 1, tokens: { "--blk-accent": "#123456", "--blk-fg": "#111111", "--blk-bg": "#eeeeee" } }, heroParts)!;
  ok("clean: a token rewrites what is derived from it", ["--blk-accent-ink", "--blk-bg-soft", "--blk-faint", "--blk-field-bg", "--blk-field-fg"].every((k) => notes.css.includes(`${k}:`)), notes.css);
  ok("clean: a derived value is written once", (notes.css.match(/--blk-bg-soft:/g) ?? []).length === 1, notes.css);
  const set = morphCss({ v: 1, tokens: { "--blk-accent": "#123456", "--blk-accent-ink": "#000000" } }, heroParts)!;
  ok("clean: a token set by hand beats its derivation", (set.css.match(/--blk-accent-ink:/g) ?? []).length === 1 && set.css.includes("--blk-accent-ink:#000000"), set.css);
  const rootForm = morphCss({ v: 1, parts: { root: { fill: "#123456" } } }, { root: { sel: ".x" } })!;
  ok("clean: a root declared without > is still the root", /\+ \.x\{/.test(rootForm.css) && !/\.x \.x/.test(rootForm.css), rootForm.css);
  const generic = morphCss({ v: 1, parts: { root: { fill: "#123456" } } }, undefined)!;
  ok("clean: a block with no parts has a generic root", generic.css.includes("+ :not(template){"), generic.css);

  // Reading and writing a node's props.
  const p: Record<string, unknown> = { title: "T" };
  ok("clean: no morph reads as an empty look", same(partLookOf(p, "title"), {}) && tokenOf(p, "--blk-accent") === undefined);
  setPartLook(p, "title", { color: "#123456" });
  const first = p.morph;
  ok("clean: a look writes parts", same(p.morph, { v: 1, parts: { title: { color: "#123456" } } }), p.morph);
  setToken(p, "--blk-accent", "#654321");
  ok("clean: a token writes tokens", same(p.morph, { v: 1, parts: { title: { color: "#123456" } }, tokens: { "--blk-accent": "#654321" } }), p.morph);
  ok("clean: an earlier state is not changed", same(first, { v: 1, parts: { title: { color: "#123456" } } }), first);
  setPartLook(p, "title", {});
  ok("clean: an empty look removes its key", same(p.morph, { v: 1, tokens: { "--blk-accent": "#654321" } }), p.morph);
  setToken(p, "--blk-accent", undefined);
  ok("clean: the last removal removes morph", !("morph" in p), p);
  setPartLook(p, "__proto__", { color: "#123456" });
  ok("clean: a bad name writes nothing", !("morph" in p) && (({}) as any).color === undefined, p);
  ok("clean: constructor reads as nothing", same(partLookOf({ morph: { v: 1, parts: {} } }, "constructor"), {}) && tokenOf({ morph: { v: 1, tokens: {} } }, "constructor") === undefined);
  const junk: Record<string, unknown> = { morph: ["x"] };
  setPartLook(junk, "title", { color: "#123456" });
  ok("clean: writing over junk starts clean", same(junk.morph, { v: 1, parts: { title: { color: "#123456" } } }), junk.morph);

  // A2: a save cleans a sealed node's morph, at any depth, and drops one that holds nothing.
  const big = { v: 1, parts: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`p${i}`, { css: line }])) };
  const doc: any = { root: { props: { title: "x" } }, content: [
    { type: "hero-banner", props: { id: "a", title: "T", morph: { v: 1, parts: { title: { color: "#FF0000", wild: 1 } } } } },
    { type: "hero-banner", props: { id: "b", morph: "junk" } },
    { type: "hero-banner", props: { id: "c", morph: { v: 2, parts: { title: { color: "#ff0000" } } } } },
    { type: "hero-banner", props: { id: "d", morph: { v: 1, parts: { title: { css: "background: url(x)" } } } } },
    { type: "hero-banner", props: { id: "e", morph: null } },
    { type: "hero-banner", props: { id: "f", morph: { v: 1, parts: { title: { color: "#00ff00" } }, rows: { x: 1 }, evil: "y" } } },
    { type: "hero-banner", props: { id: "g", morph: big } },
    { type: "hero-banner", props: { id: "n", title: "Nothing set" } },
    { type: "constructor", props: { id: "ctor", morph: "junk" } },
    { type: "grid", props: { id: "h", items: [
      { type: "prose", props: { id: "i", body: "x", morph: { v: 1, evil: true } } },
      { type: "prose", props: { id: "j", body: "x", morph: { v: 1, parts: { root: { fill: "#112233" } } } } },
      { type: "box", props: { id: "k", tag: "div", morph: { v: 1, parts: { root: { fill: "#112233" } } }, items: [
        { type: "words", props: { id: "l", tag: "p", html: "x", morph: { v: 1, parts: { root: { fill: "#112233" } } } } },
        { type: "hero-banner", props: { id: "m", morph: 12 } },
      ] } },
    ] } },
  ] };
  const done = cleanBoxDoc(doc) as any;
  const at = (id: string) => findPuckNode(done, slots, id)?.node.props as any;
  ok("cleanBoxDoc: a valid morph is cleaned and kept", same(at("a").morph, { v: 1, parts: { title: { color: "#ff0000" } } }), at("a").morph);
  for (const id of ["b", "c", "d", "e", "g", "n", "i", "k", "l", "m"]) ok(`cleanBoxDoc: ${id} holds no morph`, !("morph" in at(id)), at(id));
  ok("cleanBoxDoc: only parts and tokens survive", same(at("f").morph, { v: 1, parts: { title: { color: "#00ff00" } } }), at("f").morph);
  ok("cleanBoxDoc: inside a slot", same(at("j").morph, { v: 1, parts: { root: { fill: "#112233" } } }), at("j").morph);
  ok("cleanBoxDoc: an unknown type too", !("morph" in done.content.find((n: any) => n.props.id === "ctor").props));
  ok("cleanBoxDoc: the input is not changed", doc.content[1].props.morph === "junk");
  ok("cleanBoxDoc: idempotent", same(cleanBoxDoc(done), done));
  ok("cleanBoxDoc: another block's props pass through", at("a").title === "T");

  // The name is taken: a catalogue declaring it refuses to load, and says which block.
  let thrown = "";
  try { createCatalogue([defineBlock({ id: "t-morph", label: "T", description: "T", props: [{ name: "morph", kind: "string", label: "M" }] as const, memberSafe: true, styling: "tokens", category: "content" }, () => null) as any]); } catch (e) { thrown = String(e); }
  ok("reserved: a prop named morph throws, naming the block", thrown.includes("t-morph") && thrown.includes("morph"), thrown);
  ok("reserved: no block declares one", blocks.every((b) => !b.def.props.some((q: any) => q.name === "morph")));
}

// ---------------------------------------------------------------- the parts of the first blocks (S1 §3.3)
function parts() {
  ok("parts: six first blocks", FIRST.every((id) => blockOf(id)?.def.parts));
  for (const id of FIRST) {
    const b = blockOf(id), def = b.def, map = def.parts as Record<string, any>;
    const hasSlot = def.props.some((q: any) => q.kind === "slot");
    ok(`${id}: declares a root`, hasOwn(map, ROOT_PART));
    ok(`${id}: the contract carries the parts`, contract[id].parts === map);
    for (const [name, part] of Object.entries(map)) {
      ok(`${id}.${name}: a storable name`, PART_NAME.test(name) && name !== "type", name);
      ok(`${id}.${name}: has a label`, typeof part.label === "string" && part.label.length > 0);
      ok(`${id}.${name}: one selector`, !/[,{};<]/.test(part.sel), part.sel);
      if (name === ROOT_PART) ok(`${id}.${name}: the > form`, part.sel.startsWith(">"), part.sel);
      if (hasSlot) ok(`${id}.${name}: anchored, cannot reach a slot's nodes`, part.sel.startsWith(">"), part.sel);
      // "<rows prop>.<field>" names one field of a row (2026-11-06).
      if (part.prop) { const [pn, pf] = part.prop.split("."); const q = def.props.find((x: any) => x.name === pn); ok(`${id}.${name}: ${part.prop} is a declared prop`, !!q && (pf === undefined || (q.kind === "rows" && (q.fields ?? []).some((x: any) => x.name === pf))), part.prop); }
      const props = propsFor(b, part.draws?.props);
      const morph = { v: 1, parts: { [name]: { fill: "#123456" } } };
      const c = morphCss(cleanMorph(morph)!, map)!;
      ok(`${id}.${name}: compiles`, !!c && rulesOf(c.css).length === 1, c);
      const selector = c.css.slice(0, c.css.indexOf("{"));

      // Published.
      const h = pub([{ type: id, props: { id: "n", ...props, morph } }]);
      const tpl = h.querySelector(`template[data-morph="${c.scope}"]`);
      const rootEl = tpl?.nextElementSibling as HTMLElement | null;
      ok(`${id}.${name}: published: a marker right before a root`, rootEl && rootEl.tagName !== "TEMPLATE", h.innerHTML.slice(0, 200));
      if (!rootEl) { clear(); continue; }
      rootEl.dataset.treeNode = "n";
      const bySheet = Array.from(document.querySelectorAll(selector)), byEditor = partEls(rootEl, part.sel);
      ok(`${id}.${name}: published: the sheet and partEls select the same`, name === ROOT_PART ? bySheet.length === 1 && bySheet[0] === rootEl : bySheet.length === byEditor.length && bySheet.every((e, i) => e === byEditor[i]), [bySheet.length, byEditor.length, selector]);
      ok(`${id}.${name}: published: ${part.repeat ? "at least one" : "exactly one"}`, part.repeat ? bySheet.length >= 1 : bySheet.length === 1, [bySheet.length, selector]);
      ok(`${id}.${name}: published: the rule reaches it`, bySheet.length > 0 && bySheet.every((e) => getComputedStyle(e).backgroundColor === "rgb(18, 52, 86)"), bySheet.map((e) => getComputedStyle(e).backgroundColor).slice(0, 2));
      clear();

      // In the editor, marked by TreeCanvas, the marker and sheet in place.
      const t = tree([{ type: id, props: { id: "n", ...props, morph } }]);
      const node = t.h.querySelector<HTMLElement>('[data-tree-node="n"]');
      ok(`${id}.${name}: editor: the mark is on the root`, node && node.previousElementSibling?.tagName === "TEMPLATE", node?.tagName);
      if (!node) { clear(); continue; }
      const edSel = morphCss(cleanMorph(morph)!, map, { editor: true })!;
      const edBySheet = Array.from(document.querySelectorAll(edSel.css.slice(0, edSel.css.indexOf("{")))), edByEditor = partEls(node, part.sel);
      ok(`${id}.${name}: editor: the sheet and partEls select the same`, name === ROOT_PART ? edBySheet.length === 1 && edBySheet[0] === node : edBySheet.length === edByEditor.length && edBySheet.every((e, i) => e === edByEditor[i]), [edBySheet.length, edByEditor.length]);
      if (name !== ROOT_PART) {
        const drawn = drawnParts(node, contract[id]);
        ok(`${id}.${name}: editor: drawnParts lists it`, drawn.some((d) => d.name === name), drawn.map((d) => d.name));
        ok(`${id}.${name}: editor: drawnParts leaves the root out`, !drawn.some((d) => d.name === ROOT_PART));
      }
      clear();
    }
  }

  // A part of a nested node is not the outer node's; the outer root's rule does not reach it.
  const nested = { v: 1, parts: { title: { color: "#00aa00" } } }, outer = { v: 1, parts: { root: { fill: "#123456" } } };
  const t = tree([{ type: "grid", props: { id: "g", columns: "2", minWidth: 220, gap: "regular", align: "stretch", morph: outer, items: [{ type: "hero-banner", props: { id: "inner", title: "In a grid", align: "left", height: 0, morph: nested } }] } }]);
  const grid = t.h.querySelector<HTMLElement>('[data-tree-node="g"]')!, inner = t.h.querySelector<HTMLElement>('[data-tree-node="inner"]')!;
  ok("nesting: a slot block has a generic root", grid.classList.contains("blk-grid"), grid.className);
  ok("nesting: partEls leaves a nested node's element out", partEls(grid, "> .blk-grid .blk-hero-title").length === 0 && partEls(inner, ".blk-hero-title").length === 1);
  ok("nesting: the outer look stays on the outer root", getComputedStyle(grid).backgroundColor === "rgb(18, 52, 86)" && getComputedStyle(inner).backgroundColor !== "rgb(18, 52, 86)", [getComputedStyle(grid).backgroundColor, getComputedStyle(inner).backgroundColor]);
  ok("nesting: the inner look reaches its part", getComputedStyle(inner.querySelector(".blk-hero-title")!).color === "rgb(0, 170, 0)");
  clear();
  ok("nesting: partEls with a selector the browser refuses selects nothing", (() => { const h = newHost(); h.innerHTML = "<div data-tree-node=x><p></p></div>"; return partEls(h.firstElementChild as HTMLElement, ":bad(").length === 0; })());
  clear();

  // One morph reaches one block; two nodes with one morph share a tag.
  const look1 = { v: 1, parts: { title: { color: "#aa0000" } } };
  const h = pub([
    { type: "hero-banner", props: { id: "a", title: "A", align: "left", height: 0, morph: look1 } },
    { type: "hero-banner", props: { id: "b", title: "B", align: "left", height: 0 } },
    { type: "hero-banner", props: { id: "c", title: "C", align: "left", height: 0, morph: look1 } },
    { type: "hero-banner", props: { id: "d", title: "D", align: "left", height: 0, morph: { v: 1, parts: { gone: { fill: "#123456" } } } } },
  ]);
  const titles = Array.from(h.querySelectorAll(".blk-hero-title")).map((e) => getComputedStyle(e).color);
  ok("isolation: the first and third change, the second does not", titles[0] === "rgb(170, 0, 0)" && titles[2] === "rgb(170, 0, 0)" && titles[1] !== "rgb(170, 0, 0)", titles);
  const scope = morphCss(cleanMorph(look1)!, heroParts)!.scope;
  ok("isolation: one sheet for one morph", document.head.querySelectorAll(`style[data-href~="m-${scope}"]`).length === 1, document.head.querySelectorAll("style[data-precedence]").length);
  ok("isolation: none in the body", h.querySelectorAll("style").length === 0);
  ok("isolation: a morph that draws nothing leaves no marker", h.querySelectorAll("template").length === 2, h.querySelectorAll("template").length);
  ok("isolation: no editor marks published", !h.querySelector("[data-tree-node],[data-tree-wrap],[data-tree-sealed]"));
  clear();
}

// ---------------------------------------------------------------- what beats what (S1 §5.3), per stylesheet
const wall = (over: object, pictures?: any[]) => ({ min: 220, shape: "auto", gap: "regular", captionPlace: "on", captionAt: "bottom-left", captionShow: "always", captionWeight: "regular", captionFont: "caption", captionSize: "theme", captionColor: "", captionScrim: "soft", pictures: pictures ?? [
  { src: "/pic.png", alt: "One", caption: "One", href: "", at: "", color: "" },
  { src: "/pic.png", alt: "Two", caption: "Two", href: "", at: "", color: "#ffeecc" },
], ...over });
const TARGETS = [
  { name: ".blk-hero-copy text-align (inline)", type: "hero-banner", props: { title: "T", subtitle: "S", align: "center", height: 0 }, morph: { copy: { align: "right" } }, el: ".blk-hero-copy", read: "textAlign", want: "right" },
  { name: "pt-banner title colour (inline)", type: "pt-banner", props: { title: "T", subtitle: "S", inkColor: "#111111", align: "left", size: "compact", height: 0, scrim: 60 }, morph: { title: { color: "#ff0000" } }, el: "h1", read: "color", want: "rgb(255, 0, 0)" },
  { name: "pt-banner button fill", type: "pt-banner", props: { title: "T", ctaLabel: "Go", ctaHref: "/", align: "left", size: "compact", height: 0, scrim: 60 }, morph: { button: { fill: "#ff0000" } }, el: "a", read: "backgroundColor", want: "rgb(255, 0, 0)" },
  { name: "caption, specificity chain", type: "picture-wall", props: wall({}), morph: { caption: { color: "#00ff00" } }, el: ".blk-wall-caption", read: "color", want: "rgb(0, 255, 0)" },
  { name: "caption row with an inline tint", type: "picture-wall", props: wall({}), morph: { caption: { color: "#00ff00" } }, el: ".blk-wall-cell:nth-child(2) .blk-wall-caption", read: "color", want: "rgb(0, 255, 0)" },
  { name: ".blk-hero padding", type: "hero-banner", props: { title: "T", align: "left", height: 0 }, morph: { root: { padding: 33 } }, el: ".blk-hero", read: "paddingTop", want: "33px" },
  { name: ".blk-hero fill", type: "hero-banner", props: { title: "T", align: "left", height: 0 }, morph: { root: { fill: "#0a0b0c" } }, el: ".blk-hero", read: "backgroundColor", want: "rgb(10, 11, 12)" },
  { name: "title colour", type: "hero-banner", props: { title: "T", align: "left", height: 0 }, morph: { title: { color: "#00aa00" } }, el: ".blk-hero-title", read: "color", want: "rgb(0, 170, 0)" },
  { name: "title size", type: "hero-banner", props: { title: "T", align: "left", height: 0 }, morph: { title: { size: 21 } }, el: ".blk-hero-title", read: "fontSize", want: "21px" },
  { name: "wash hidden", type: "hero-banner", props: { title: "T", align: "left", height: 0 }, morph: { wash: { hide: true } }, el: ".blk-hero-wash", read: "display", want: "none" },
];
async function cascade(mode: "plain" | "layered" | "sunjay") {
  await useCss(mode);
  for (const t of TARGETS) {
    const base = pub([{ type: t.type, props: { id: "n", ...t.props } }]);
    const was = (getComputedStyle(base.querySelector(t.el)!) as any)[t.read];
    clear();
    const h = pub([{ type: t.type, props: { id: "n", ...t.props, morph: { v: 1, parts: t.morph } } }]);
    const now = (getComputedStyle(h.querySelector(t.el)!) as any)[t.read];
    ok(`cascade ${mode}: ${t.name}: wins`, now === t.want, [was, now]);
    ok(`cascade ${mode}: ${t.name}: the check is live`, was !== t.want, was);
    clear();
  }
  // Tokens reach the block's own rules and nothing else.
  const h = pub([
    { type: "hero-banner", props: { id: "a", title: "A", subtitle: "S", align: "left", height: 0, morph: { v: 1, tokens: { "--blk-band": "#010203", "--blk-band-fg": "#ffeeaa" } } } },
    { type: "hero-banner", props: { id: "b", title: "B", align: "left", height: 0 } },
    { type: "contact-form", props: { id: "f", heading: "Write", morph: { v: 1, tokens: { "--blk-fg": "#0000aa", "--blk-bg": "#eeeeff" } } } },
  ]);
  const [a, b] = Array.from(h.querySelectorAll<HTMLElement>(".blk-hero"));
  ok(`cascade ${mode}: --blk-band moves this hero's ground`, getComputedStyle(a!).backgroundColor === "rgb(1, 2, 3)", getComputedStyle(a!).backgroundColor);
  ok(`cascade ${mode}: and not the next hero's`, getComputedStyle(b!).backgroundColor !== "rgb(1, 2, 3)");
  ok(`cascade ${mode}: --blk-band-fg moves its subtitle`, getComputedStyle(a!.querySelector(".blk-hero-sub")!).color === "rgb(255, 238, 170)", getComputedStyle(a!.querySelector(".blk-hero-sub")!).color);
  const input = h.querySelector<HTMLElement>(".blk-contact-input")!;
  ok(`cascade ${mode}: --blk-fg reaches a form field's ink`, getComputedStyle(input).color === "rgb(0, 0, 170)", getComputedStyle(input).color);
  clear();
}

function phone() {
  const h = pub([{ type: "hero-banner", props: { id: "n", title: "T", align: "left", height: 0, morph: { v: 1, parts: { title: { size: 72 } } } } }]);
  ok(`phone: a 72px title at ${innerWidth}px wide is ${(innerWidth * 0.11).toFixed(1)}px`, Math.abs(parseFloat(getComputedStyle(h.querySelector(".blk-hero-title")!).fontSize) - innerWidth * 0.11) < 0.5, getComputedStyle(h.querySelector(".blk-hero-title")!).fontSize);
  clear();
}

// ---------------------------------------------------------------- spacing: a font look moves nothing
const FIX = ".t-fix .blk, .t-fix .blk *{font-size:16px !important;line-height:24px !important;width:auto}";
const fontLook = { v: 1, parts: { root: { font: FONT } } };
const p = (id: string, m: unknown) => ({ type: "prose", props: { id, body: "<p>One line.</p><p>Another line.</p>", size: "regular", align: "start", measure: false, ...(m ? { morph: m } : {}) } });
const hd = (id: string, m: unknown) => ({ type: "section-heading", props: { id, title: "A heading", level: "h2", align: "start", rule: false, ...(m ? { morph: m } : {}) } });
const SPACED: Array<[string, (m: unknown) => any[]]> = [
  ["flow-column, :1038", (m) => [{ type: "flow-column", props: { id: "f", width: "wide", content: [p("a", m), hd("b", m), p("c", m)] } }]],
  ["split-row flowing, :423", (m) => [{ type: "split-row", props: { id: "s", ratio: "50-50", align: "start", columns: "flowing", gap: "regular", minHeight: 0, start: [p("a", m), hd("b", m), p("c", m)], end: [hd("d", m), p("e", m)] } }]],
  ["prose, :848", (m) => [p("a", m)]],
  ["text-image, :848", (m) => [{ type: "text-image", props: { id: "t", src: "/pic.png", alt: "", body: "<p>One line.</p><p>Another line.</p>", place: "left", size: "medium", offsetY: 0, wrap: "tight", align: "start", ratio: "auto", gap: "regular", ...(m ? { morph: m } : {}) } }]],
  ["grid, the cells", (m) => [{ type: "grid", props: { id: "g", columns: "2", minWidth: 220, gap: "regular", align: "stretch", items: [p("a", m), hd("b", m), p("c", m)] } }]],
  ["page root", (m) => [hd("a", m), p("b", m), hd("c", m)]],
];
const offsets = (h: HTMLElement) => {
  const o = h.getBoundingClientRect();
  return Array.from(h.querySelectorAll<HTMLElement>("*")).filter((e) => !["TEMPLATE", "LINK", "STYLE"].includes(e.tagName)).map((e) => {
    const r = e.getBoundingClientRect();
    return [e.tagName, e.className, Math.round(r.top - o.top), Math.round(r.left - o.left), Math.round(r.height), getComputedStyle(e).marginBottom];
  });
};
async function spacing() {
  await useCss("plain");
  const fix = document.createElement("style"); fix.textContent = FIX; document.head.appendChild(fix);
  document.getElementById("host")!.className = "t-fix";
  for (const [name, content] of SPACED) {
    const plain = pub(content(null));
    const a = offsets(plain);
    clear();
    const h = pub(content(fontLook));
    const b = offsets(h);
    ok(`spacing: ${name}: identical offsets`, same(a, b), a.map((x, i) => (same(x, b[i]) ? null : [x, b[i]])).filter(Boolean).slice(0, 3));
    ok(`spacing: ${name}: there were offsets to compare`, a.length > 2, a.length);
    ok(`spacing: ${name}: the font look is on`, h.querySelector("template[data-morph]") && getComputedStyle(h.querySelector("template[data-morph]")!.nextElementSibling!).fontFamily.includes(FONT), h.querySelector("template")?.outerHTML);
    ok(`spacing: ${name}: its link sits before the marker`, Array.from(h.querySelectorAll("link[rel=stylesheet]")).every((l) => l.nextElementSibling?.tagName === "TEMPLATE") && h.querySelectorAll("link[rel=stylesheet]").length > 0, h.querySelectorAll("link").length);
    ok(`spacing: ${name}: each marker is right before its block`, Array.from(h.querySelectorAll("template")).every((t) => t.nextElementSibling && !["LINK", "TEMPLATE"].includes(t.nextElementSibling.tagName)));
    // The check tells: S1 §5.2's rejected wrapper takes the region's margin off the block, so what follows moves.
    if (name.startsWith("flow-column") || name.startsWith("split-row")) {
      const region = h.querySelector<HTMLElement>(".blk-flow-body, .blk-split-col")!;
      const block = region.querySelector("template")!.nextElementSibling!;
      const wrapper = document.createElement("div");
      wrapper.style.display = "contents";
      region.insertBefore(wrapper, block);
      wrapper.appendChild(block);
      ok(`spacing: ${name}: control, a wrapper moves what follows`, !same(offsets(h).filter((x) => x[0] !== "DIV" || x[1] !== ""), a.filter((x) => x[0] !== "DIV" || x[1] !== "")), a.length);
      // blocks.css:423,1038: the :last-child rule is (0,2,0) or (0,4,0) against (0,3,0) or (0,5,0) above it, so it loses today and the last block keeps its margin.
      const last = region.lastElementChild!;
      console.log(`spacing: ${name}: the last block's margin-block-end is ${getComputedStyle(last).marginBlockEnd} (the :last-child rule loses on specificity)`);
    }
    clear();
  }
  fix.remove();
}

// ---------------------------------------------------------------- a font that cannot load (S1 finding a)
async function fonts() {
  const content = [{ type: "hero-banner", props: { id: "n", title: "Still drawn", align: "left", height: 0, morph: { v: 1, parts: { title: { font: FONT } } } } }];
  await useCss("plain");
  // Not flushSync: a normal render is what a suspended stylesheet could hold.
  const h = newHost(), root = createRoot(h);
  root.render(createElement(Render as any, { config, data: { root: { props: {} }, content } }));
  hosted.push(() => root.unmount());
  await wait(300);
  ok("fonts: published: the canvas draws while the font cannot load", h.querySelector(".blk-hero-title")?.textContent === "Still drawn", h.innerHTML.slice(0, 200));
  const link = h.querySelector<HTMLLinkElement>("link[rel=stylesheet]");
  ok("fonts: published: a plain link, in place", link && link.href.includes("fonts.googleapis.com") && !link.hasAttribute("data-precedence"), link?.outerHTML);
  clear();

  // The check tells: the same link with a precedence holds the commit. Recorded, not required: it depends on React's timing.
  const h2 = newHost(), root2 = createRoot(h2);
  root2.render(createElement("div", null, createElement("link", { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Nope", precedence: "x" }), createElement("p", null, "held")));
  hosted.push(() => root2.unmount());
  await wait(50);
  console.log(`fonts: control, a link with a precedence at 50 ms: ${h2.querySelector("p") ? "drawn" : "held"}`);
  clear();

  // In the editor, a stored look loads its font with nothing selected.
  document.head.querySelectorAll("link[data-font-loader]").forEach((l) => l.remove());
  const t = tree(content);
  ok("fonts: editor: draws", t.h.querySelector(".blk-hero-title")?.textContent === "Still drawn");
  ok("fonts: editor: no link in the canvas", t.h.querySelectorAll("link").length === 0);
  const loaded = Array.from(document.head.querySelectorAll<HTMLLinkElement>("link[data-font-loader]")).map((l) => l.href);
  ok("fonts: editor: a stored font is loaded", loaded.some((u) => u.includes("Playfair")), loaded);
  t.draw();
  ok("fonts: editor: once, however often it draws", Array.from(document.head.querySelectorAll<HTMLLinkElement>("link[data-font-loader]")).filter((l) => l.href.includes("Playfair")).length === 1);
  clear();
}

// ---------------------------------------------------------------- server HTML, then hydrateRoot (S1 §15, synthesis §13)
async function hydrate() {
  await useCss("plain");
  const page = {
    root: { props: {} },
    content: [
      { type: "hero-banner", props: { id: "a", title: "Server", subtitle: "Then client", align: "left", height: 0, morph: { v: 1, parts: { title: { color: "#aa0000", font: FONT } } } } },
      { type: "contact-form", props: { id: "b", heading: "Write", morph: { v: 1, parts: { root: { fill: "#eeeeff" } }, tokens: { "--blk-fg": "#0000aa" } } } },
      { type: "faq", props: { id: "c", look: "divided", openFirst: true, items: [{ question: "Q?", answer: "A." }], morph: { v: 1, parts: { root: { fill: "#ffeeee" } } } } },
      { type: "grid", props: { id: "d", columns: "2", minWidth: 220, gap: "regular", align: "stretch", morph: { v: 1, parts: { root: { fill: "#eeffee" } } }, items: [{ type: "prose", props: { id: "e", body: "<p>In a slot.</p>", morph: { v: 1, parts: { paragraph: { color: "#00aa00" } } } } }] } },
      { type: "section-heading", props: { id: "f", title: "No look", level: "h2", align: "start", rule: true } },
    ],
  };
  for (const moved of [false, true]) {
    const label = moved ? "styles in <head>, as a stream sends them" : "styles where Fizz wrote them";
    const element = createElement(Render as any, { config, data: page });
    const html = renderToString(element);
    ok(`hydrate: ${label}: server HTML holds the markers`, (html.match(/<template data-morph/g) ?? []).length === 5, (html.match(/<template/g) ?? []).length);
    ok(`hydrate: ${label}: the sheets are hoistable`, /<style data-precedence="eac-morph"/.test(html), html.slice(0, 200));
    ok(`hydrate: ${label}: the link stays in place, before the marker`, /<link rel="stylesheet" href="[^"]*Playfair[^"]*"\/><template data-morph/.test(html), html.slice(0, 400));
    const h = newHost();
    h.innerHTML = html;
    if (moved) h.querySelectorAll("style[data-precedence]").forEach((s) => document.head.appendChild(s));
    const before = h.querySelector(".blk-hero-title"), form = h.querySelector("form");
    const recoverable: string[] = [], logged: string[] = [];
    const real = console.error;
    console.error = (...a: unknown[]) => { logged.push(a.map(String).join(" ").slice(0, 300)); };
    const root = hydrateRoot(h, element, { onRecoverableError: (e) => recoverable.push(String(e).slice(0, 300)) });
    await wait(150);
    console.error = real;
    ok(`hydrate: ${label}: 0 recoverable errors`, recoverable.length === 0, recoverable.slice(0, 2));
    ok(`hydrate: ${label}: 0 logged errors`, logged.length === 0, logged.slice(0, 2));
    ok(`hydrate: ${label}: the server's elements were kept`, h.querySelector(".blk-hero-title") === before && h.querySelector("form") === form);
    ok(`hydrate: ${label}: markers still right before their roots`, Array.from(h.querySelectorAll("template[data-morph]")).every((t) => t.nextElementSibling && !["LINK", "TEMPLATE"].includes(t.nextElementSibling.tagName)));
    ok(`hydrate: ${label}: the look draws`, getComputedStyle(h.querySelector(".blk-hero-title")!).color === "rgb(170, 0, 0)");
    ok(`hydrate: ${label}: the form draws its look`, getComputedStyle(h.querySelector(".blk-contact")!).backgroundColor === "rgb(238, 238, 255)", getComputedStyle(h.querySelector(".blk-contact")!).backgroundColor);
    ok(`hydrate: ${label}: a look in a slot draws`, getComputedStyle(h.querySelector(".blk-prose p")!).color === "rgb(0, 170, 0)");
    const input = h.querySelector<HTMLInputElement>('input[name="name"]')!;
    input.focus(); input.value = "Typed"; input.dispatchEvent(new Event("input", { bubbles: true }));
    h.querySelector<HTMLButtonElement>('button[type="submit"]')?.blur();
    await wait(20);
    ok(`hydrate: ${label}: the client block is live`, input.isConnected && input.value === "Typed");
    root.unmount();
    h.remove();
    document.head.querySelectorAll('style[data-precedence="eac-morph"]').forEach((s) => s.remove());
  }
  clear();
}

// ---------------------------------------------------------------- A3: a stored type named like a built-in
function stored() {
  const weird = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"];
  const content = () => [...weird.map((t, i) => ({ type: t, props: { id: `w${i}`, morph: { v: 1, parts: { root: { fill: "#123456" } } } } })), { type: "hero-banner", props: { id: "hero", title: "Still here", align: "left", height: 0 } }];
  const errs: string[] = [];
  const real = console.error; console.error = (...a: unknown[]) => { errs.push(a.map(String).join(" ").slice(0, 200)); };
  const t = tree(content());
  console.error = real;
  for (const [i, type] of weird.entries()) {
    const el = t.h.querySelector<HTMLElement>(`[data-tree-node="w${i}"]`);
    ok(`stored ${type}: draws as an unknown block`, el?.textContent === `Unknown block: ${type}`, el?.textContent);
    ok(`stored ${type}: selectable`, el?.dataset.treeSealed === "" && el?.dataset.treeType === type, el?.outerHTML);
  }
  ok("stored: its neighbour still draws", t.h.querySelector(".blk-hero-title")?.textContent === "Still here");
  ok("stored: nothing was logged", errs.length === 0, errs.slice(0, 2));
  clear();

  const doc = { root: { props: {} }, content: content() } as unknown as PuckDoc;
  const seen: string[] = [];
  walkDoc(doc, slots, (f) => seen.push(f.node.props.id));
  ok("stored: walkDoc passes over them", seen.length === 6, seen);
  ok("stored: findPuckNode finds one", findPuckNode(doc, slots, "w0")?.node.type === "constructor");
  ok("stored: nodeLevels", doc.content.every((n) => nodeLevels(n, slots) === 1));
  for (const slot of ["constructor", "__proto__", "items", "length"]) {
    ok(`stored: slotList on it, ${slot}, finds none`, slotList(doc, slots, { parent: "w0", slot }) === null);
    ok(`stored: mayPlace into it, ${slot}, refuses`, mayPlace(doc, slots, "box", 1, { parent: "w0", slot }) === false);
  }
  ok("stored: it can move", movePuckNode(doc, slots, "w1", { parent: "root", slot: "content" }, 0) && doc.content[0]!.props.id === "w1");
  ok("stored: it can be duplicated", !!duplicatePuckNode(doc, slots, "w2", () => "dup") && !!findPuckNode(doc, slots, "dup"));
  const cleaned = cleanBoxDoc(doc) as PuckDoc;
  ok("stored: cleanBoxDoc keeps them", cleaned.content.length === 7);

  // A node whose id is a built-in's name: resolved rows are by id.
  const byId = tree([{ type: "hero-banner", props: { id: "constructor", title: "Stored", align: "left", height: 0 } }], { samples: { "hero-banner": { subtitle: "From the sample" } } });
  ok("stored: a node with the id constructor still draws its sample", byId.h.querySelector(".blk-hero-sub")?.textContent === "From the sample", byId.h.innerHTML.slice(0, 200));
  clear();
}

// ---------------------------------------------------------------- the editor's shape
function editorShape() {
  const childrenOf = (el: Element) => Array.from(el.children).map((k) => k.tagName).join();
  const props = { id: "n", title: "T", subtitle: "S", align: "left", height: 0 };
  const node: any = { type: "hero-banner", props: { ...props } };
  const t = tree([node]);
  const wrap = t.h.querySelector('[data-tree-wrap="n"]')!;
  const first = t.h.querySelector<HTMLElement>('[data-tree-node="n"]')!;
  ok("editor: no look, the block alone", childrenOf(wrap) === "SECTION", childrenOf(wrap));
  node.props.morph = { v: 1, parts: { title: { color: "#aa0000" }, subtitle: { hide: true } } };
  t.draw();
  ok("editor: with a look, sheet, marker, block", childrenOf(wrap) === "STYLE,TEMPLATE,SECTION", childrenOf(wrap));
  ok("editor: the first look does not remount the block", t.h.querySelector('[data-tree-node="n"]') === first);
  ok("editor: the mark stays on the root", first.tagName === "SECTION" && !wrap.querySelector("template[data-tree-node],style[data-tree-node]"));
  ok("editor: the look draws", getComputedStyle(first.querySelector(".blk-hero-title")!).color === "rgb(170, 0, 0)");
  ok("editor: a hidden part is faint, not gone", getComputedStyle(first.querySelector(".blk-hero-sub")!).opacity === "0.3" && getComputedStyle(first.querySelector(".blk-hero-sub")!).display !== "none");
  node.props.morph = { v: 1, parts: { title: { color: "#00aa00" } } };
  t.draw();
  ok("editor: one sheet after an edit", wrap.querySelectorAll("style").length === 1 && getComputedStyle(first.querySelector(".blk-hero-title")!).color === "rgb(0, 170, 0)");
  delete node.props.morph;
  t.draw();
  ok("editor: the look gone, the block alone, same element", childrenOf(wrap) === "SECTION" && t.h.querySelector('[data-tree-node="n"]') === first);
  clear();

  // A client block keeps its state across the first look.
  const faq: any = { type: "faq", props: { id: "q", look: "divided", openFirst: false, items: [{ question: "Q?", answer: "A." }] } };
  const f = tree([faq]);
  const details = f.h.querySelector("details")!;
  details.open = true;
  faq.props.morph = { v: 1, parts: { root: { fill: "#ffeeee" } } };
  f.draw();
  ok("editor: a client block's state survives the first look", f.h.querySelector("details") === details && details.open);
  clear();

  // Drawing nothing: the marker does not take the node's mark.
  const empty: any = { type: "prose", props: { id: "e", body: "", morph: { v: 1, parts: { root: { fill: "#123456" } } } } };
  const e = tree([empty]);
  const mark = e.h.querySelector<HTMLElement>('[data-tree-node="e"]');
  ok("editor: a morphed block that draws nothing has its name to select", mark?.classList.contains("de-tree-empty"), e.h.innerHTML.slice(0, 300));
  clear();
}

// ---------------------------------------------------------------- the adapter (page-builder/src/config.tsx)
function adapter() {
  const seen: string[][] = [];
  const decl = (id: string, interactive: boolean) => ({ id, label: id, description: id, props: [{ name: "word", kind: "string", label: "Word" }] as const, memberSafe: true, styling: "tokens", category: "content", ...(interactive ? { interactive: true } : {}) });
  const Probe = (p: Record<string, unknown>) => { seen.push(Object.keys(p)); return createElement("section", { className: "t-probe" }, "drawn"); };
  const list: any[] = [defineBlock(decl("t-plain", false) as any, Probe as any), defineBlock(decl("t-client", true) as any, Probe as any)];
  const Wrap = ({ children }: { children?: unknown }) => createElement("div", { className: "t-wrap" }, children as never);
  const wired: any = buildPuckConfig({ blocks: list as any, morph: MorphMark as any });
  const bare: any = buildPuckConfig({ blocks: list as any });
  const styled: any = buildPuckConfig({ blocks: list as any, blockStyle: { name: "textStyle", wrap: Wrap as any }, morph: MorphMark as any });
  const morph = { v: 1, parts: { root: { fill: "#123456" } } };
  const draw = (c: any, content: any[]) => { const h = newHost(), root = createRoot(h); flushSync(() => root.render(createElement(Render as any, { config: c, data: { root: { props: {} }, content } }))); hosted.push(() => root.unmount()); return h; };

  for (const [type, label] of [["t-plain", "a block"], ["t-client", "an interactive block"]] as const) {
    seen.length = 0;
    const a = draw(bare, [{ type, props: { id: "n", word: "w", morph } }]);
    ok(`adapter: no option, ${label}: morph is stripped`, seen.length > 0 && seen.every((k) => !k.includes("morph")), seen);
    ok(`adapter: no option, ${label}: nothing is drawn for it`, a.querySelectorAll("template,style,link").length === 0, a.innerHTML);
    clear(); seen.length = 0;
    const b = draw(wired, [{ type, props: { id: "n", word: "w", morph } }]);
    ok(`adapter: wired, ${label}: morph does not reach the block`, seen.length > 0 && seen.every((k) => !k.includes("morph")), seen);
    ok(`adapter: wired, ${label}: the marker is right before the root`, b.querySelector("template[data-morph]")?.nextElementSibling?.className === "t-probe", b.innerHTML);
    if (type === "t-client") ok("adapter: an interactive block still gets no editor context", seen.every((k) => !k.includes("puck")), seen);
    clear(); seen.length = 0;
    const c = draw(wired, [{ type, props: { id: "n", word: "w" } }]);
    ok(`adapter: wired, nothing set, ${label}: the block alone`, c.querySelectorAll("template,style,link").length === 0, c.innerHTML);
    clear();
  }
  const d = draw(wired, [{ type: "t-plain", props: { id: "n", word: "w", morph: { v: 9, parts: {} } } }]);
  ok("adapter: wired, a morph of no known shape: the block alone", d.querySelectorAll("template,style,link").length === 0, d.innerHTML);
  clear();
  const e = draw(styled, [{ type: "t-plain", props: { id: "n", word: "w", textStyle: { font: "serif" }, morph } }]);
  ok("adapter: the marker stays inside a site's wrapper, next to the root", e.querySelector(".t-wrap > template[data-morph] + .t-probe"), e.innerHTML);
  clear();
  const f = draw(wired, [{ type: "t-plain", props: { id: "n", word: "w", blkStyle: { padX: 24, bg: "#112233" }, morph } }]);
  ok("adapter: the marker stays inside the generic style's wrapper", f.querySelector("template[data-morph] + .t-probe"), f.innerHTML);
  clear();
}

// ---------------------------------------------------------------- pictures to read
const LOOKS = {
  hero: { v: 1, parts: { title: { color: "#ffd166", size: 64, font: FONT }, subtitle: { hide: true }, root: { fill: "#1b2a4a", padding: 48 } }, tokens: { "--blk-band": "#1b2a4a" } },
  wall: { v: 1, parts: { caption: { color: "#b3261e", size: 18, weight: 700 }, cell: { radius: 12 } } },
  head: { v: 1, parts: { title: { color: "#0a7ea4", size: 40 }, eyebrow: { color: "#b3261e" }, rule: { fill: "#0a7ea4", w: 160, h: 6 } } },
  card: { v: 1, parts: { title: { color: "#16a34a" }, root: { fill: "#f4efe6", radius: 16 } } },
  ptb: { v: 1, parts: { title: { color: "#ffd166", size: 56 }, button: { fill: "#ffd166", color: "#111111" } } },
};
const showDoc = () => [
  { type: "hero-banner", props: { id: "hero", title: "The Ambrosial Hours", subtitle: "Rise with the sun", imageUrl: "", imageAlt: "", align: "center", height: 0, morph: LOOKS.hero } },
  { type: "section-heading", props: { id: "head", title: "Recent work", eyebrow: "This season", subtitle: "", level: "h2", align: "start", rule: true, morph: LOOKS.head } },
  { type: "picture-wall", props: { id: "wall", ...wall({ captionPlace: "below", min: 180 }, ["Nightjar", "Three Vessels", "Low Winter Sun"].map((c, i) => ({ src: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${["#39475a", "#6d5a44", "#8c6f5a"][i]}"/></svg>`)}`, alt: c, caption: c, href: "", at: "", color: "" }))), morph: LOOKS.wall } },
  { type: "feature-card", props: { id: "card", title: "Three Vessels", body: "Fired in the old kiln over two winters.", kicker: "Work", meta: "2026", marker: "01", image: "", href: "", record: "", tone: "panel", morph: LOOKS.card } },
  { type: "pt-banner", props: { id: "ptb", title: "Para Theater", subtitle: "Rock balancing", body: "We meet on the first Sunday.", ctaLabel: "Come along", ctaHref: "#", imageUrl: "", imageAlt: "", scrim: 60, align: "center", size: "compact", height: 0, morph: LOOKS.ptb } },
];
async function show(kind: "published" | "editor") {
  await useCss("sunjay");
  if (kind === "published") pub(showDoc()); else tree(showDoc());
  return { marks: document.querySelectorAll("[data-tree-node]").length, markers: document.querySelectorAll("template[data-morph]").length };
}

const GROUPS: Record<string, () => unknown> = {
  hostile, ordinary, repair, clean, parts, phone, spacing, fonts, hydrate, stored, editorShape, adapter,
  "cascade-plain": () => cascade("plain"), "cascade-layered": () => cascade("layered"), "cascade-sunjay": () => cascade("sunjay"),
  "show-published": () => show("published"), "show-editor": () => show("editor"),
};
(window as any).kit = {
  groups: Object.keys(GROUPS),
  async run(name: string) {
    out = [];
    try { await GROUPS[name]!(); } catch (e) { out.push([`${name}: threw`, false, String(e instanceof Error ? e.stack ?? e.message : e).slice(0, 500)]); }
    return out;
  },
};
