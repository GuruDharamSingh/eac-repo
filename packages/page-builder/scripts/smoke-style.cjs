// Smoke test for the generic "Style" (src/style/schema.ts): what survives
// cleaning, what the custom-CSS box refuses, and what CSS comes out.
// Run: node scripts/smoke-style.cjs   (transpiles the TypeScript in memory)
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "../src/style/schema.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: "commonjs", target: "es2020" } }).outputText;
const m = { exports: {} };
new Function("module", "exports", js)(m, m.exports);
const { cleanStyle, cleanCustomCss, styleToCss, colorCss, contrastRatio, STYLE_PRESETS } = m.exports;

let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : "  → " + detail}`);
  if (!ok) failed++;
};
const j = (v) => JSON.stringify(v);

// ── cleanStyle ──
check("nothing set is null", cleanStyle({}) === null && cleanStyle(null) === null && cleanStyle([]) === null && cleanStyle("x") === null);
check("zero and negative are dropped", cleanStyle({ padX: 0, padY: -5, marginTop: 0 }) === null);
check("out of range is dropped", cleanStyle({ padX: 99999, borderWidth: 99, opacity: 1 }) === null);
check("unknown keys are dropped", cleanStyle({ evil: "x", position: "fixed", padX: 8 }) && !("evil" in cleanStyle({ evil: "x", padX: 8 })));
check("unknown enum is dropped", cleanStyle({ shadow: "huge", hideOn: "tablet", borderStyle: "ridge" }) === null);
check("token and hex colours are kept", j(cleanStyle({ bg: "accent", color: "#fff", borderColor: "#a1b2c3d4" })) === j({ bg: "accent", color: "#fff", borderColor: "#a1b2c3d4" }));
check("a css colour string is refused", cleanStyle({ bg: "red; background:url(x)", color: "rgb(0,0,0)" }) === null);
check("radius theme and number", cleanStyle({ radius: "theme" }).radius === "theme" && cleanStyle({ radius: 12 }).radius === 12);
check("class names are tokenised", cleanStyle({ className: "a-b  c_d <script> x:y 9z" }).className === "a-b c_d");
check("anchor must start with a letter", cleanStyle({ anchor: "9bad" }) === null && cleanStyle({ anchor: "visiting" }).anchor === "visiting");
check("custom text is capped", cleanStyle({ custom: "a".repeat(5000) }).custom.length === 1500);

// ── custom CSS ──
const ok = cleanCustomCss("border-bottom: 2px solid var(--blk-accent);\nbackground: linear-gradient(135deg, #222, #444); transform: rotate(-1deg) scale(1.02)");
check("good declarations are kept", ok.kept.length === 3 && ok.rejected.length === 0, j(ok));
const bad = [
  "background: url(https://x/y.png)",
  "background-image: image-set('a' 1x)",
  "position: fixed",
  "z-index: 9999",
  "top: 0",
  "pointer-events: none",
  "display: none",
  "width: expression(alert(1))",
  "color: red !important",
  "color: var(--secret)",
  "color: var(--blk-accent, red)",
  "behavior: url(x)",
  "background: javascript:alert(1)",
  "content: 'x'",
  "margin: calc(1px",
  "filter: foo(1)",
  "color: red } body { display:none",
  "@import 'x'",
  "background: attr(data-x)",
  "no colon here",
];
for (const line of bad) {
  const r = cleanCustomCss(line);
  check(`refuses: ${line}`, r.kept.length === 0, j(r));
}
check("a long value is refused", cleanCustomCss(`color: ${"a".repeat(300)}`).kept.length === 0);
check("property names are case-insensitive", cleanCustomCss("BORDER-RADIUS: 4px").kept[0]?.[0] === "border-radius");

// ── CSS out ──
const out = styleToCss(cleanStyle({ padX: 24, padY: 16, bg: "soft", bgOpacity: 20, borderWidth: 2, borderSides: "left", borderColor: "accent", radius: "theme", shadow: "soft", opacity: 90, maxWidth: 600, align: "center", hideOn: "mobile", hover: "lift", anchor: "x", className: "foo" }));
check("padding", out.style.paddingLeft === "24px" && out.style.paddingTop === "16px");
check("background blends with transparency", /color-mix\(in srgb, var\(--blk-bg-soft\) 20%, transparent\)/.test(out.style.backgroundColor), out.style.backgroundColor);
check("one border side", out.style.borderLeft === "2px solid var(--blk-accent)" && !out.style.border, j(out.style));
check("theme radius", out.style.borderRadius === "var(--blk-radius, 0)");
check("centred max width", out.style.maxWidth === "600px" && out.style.marginLeft === "auto" && out.style.marginRight === "auto");
check("data attributes, id and class", out.attrs["data-hide"] === "mobile" && out.attrs["data-hover"] === "lift" && out.id === "x" && out.className === "foo");
const custom = styleToCss(cleanStyle({ padX: 8, custom: "padding-left: 40px; position: fixed" }));
check("the box wins over the controls and is fenced", custom.style.paddingLeft === "40px" && !("position" in custom.style));

const inked = styleToCss(cleanStyle({ color: "band-ink" }));
check("text colour also repoints the blocks' own ink", inked.style["--blk-fg"] === "var(--blk-band-fg)" && /--blk-band-fg/.test(inked.style["--blk-muted"]), j(inked.style));

// ── palette and contrast ──
check("tokens resolve to --blk variables", colorCss("accent") === "var(--blk-accent)" && colorCss("nope") === undefined);
check("contrast of black on white is 21", Math.round(contrastRatio("#000000", "#ffffff")) === 21);
check("tokens give no ratio", contrastRatio("accent", "#fff") === null);
check("every preset survives cleaning intact", STYLE_PRESETS.every((p) => j(cleanStyle(p.style)) === j(p.style) || Object.keys(cleanStyle(p.style)).length === Object.keys(p.style).length));

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
