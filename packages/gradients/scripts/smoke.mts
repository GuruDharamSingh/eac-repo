// Smoke tests for @elkdonis/gradients. Run: pnpm -F @elkdonis/gradients test (or tsx scripts/smoke.mts)
import assert from "node:assert/strict";
import {
  hexToOklab, oklabToHex, mix, contrast, normHex,
  ELEMENTAL, LOGO_INK, RAMPS, BON_MINERAL,
  cleanGradient, DEFAULT_GRADIENT, PRESETS, KINDS,
  ramp, harmony, HARMONIES, generate, meshBlobs,
  gradientCss, gradientStyle, isSafeGradientCss,
  shaderUniforms, SHADER_SOURCES, MAX_STOPS,
  PAPER_SHADERS, paperRender, paperTextureProps, cssColorToHex,
} from "../src/index";
// The editors' own sanitizers: the CSS must pass them where it fits their length caps.
import { cleanCustomCss } from "../../page-builder/src/style/schema";

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log("  ok", name); };

ok("hex -> OKLab -> hex is exact for every palette colour", () => {
  for (const h of [...ELEMENTAL.map((p) => p.hex), ...LOGO_INK.map((p) => p.hex), ...RAMPS.flatMap((r) => r.colors), ...BON_MINERAL.flatMap((c) => [c.ground, c.light, c.mark])]) {
    assert.equal(oklabToHex(hexToOklab(h)), normHex(h), h);
  }
});

ok("mix: ends are exact; OKLCH midpoint of blue->orange is not grey", () => {
  assert.equal(mix("#1F4E9A", "#D45A1F", 0), "#1F4E9A");
  assert.equal(mix("#1F4E9A", "#D45A1F", 1), "#D45A1F");
  const [, a, b] = hexToOklab(mix("#1F4E9A", "#D45A1F", 0.5, "oklch"));
  const [, sa, sb] = hexToOklab(mix("#1F4E9A", "#D45A1F", 0.5, "srgb"));
  assert.ok(Math.hypot(a, b) > Math.hypot(sa, sb) * 1.5, "oklch keeps chroma through the middle");
});

ok("contrast matches WCAG for black/white", () => {
  assert.equal(Math.round(contrast("#000000", "#FFFFFF")), 21);
});

ok("cleanGradient rejects non-gradients and keeps only safe values", () => {
  for (const bad of [null, 1, "x", [], {}, { stops: [] }, { stops: [{ color: "#fff", at: 0 }] }]) assert.equal(cleanGradient(bad), null);
  const g = cleanGradient({
    kind: "nope", angle: 725, cx: -40, mute: 900, shader: "<script>", base: "red",
    stops: [{ color: "url(javascript:alert(1))", at: 0 }, { color: "#123", at: 300 }, { color: "#ABCDEF", at: -5 }, ...Array(20).fill({ color: "#000", at: 50 })],
    extra: "dropped",
  })!;
  assert.equal(g.kind, "linear");
  assert.equal(g.angle, 5);
  assert.equal(g.cx, 0);
  assert.equal(g.mute, 100);
  assert.equal(g.shader, "none");
  assert.equal(g.base, undefined);
  assert.ok(g.stops.length <= 8);
  assert.ok(g.stops.every((s) => /^#[0-9A-F]{6}$/.test(s.color) && s.at >= 0 && s.at <= 100));
  assert.equal((g as unknown as Record<string, unknown>).extra, undefined);
});

const specs = [...PRESETS.map((p) => p.spec), ...KINDS.map((kind) => ({ ...DEFAULT_GRADIENT, kind })), ...Array.from({ length: 300 }, (_, i) => generate(i))];

ok(`every preset, kind and 300 generated specs write safe, deterministic CSS (${specs.length})`, () => {
  for (const s of specs) {
    const css = gradientCss(s);
    assert.ok(css.length > 20, `empty css for ${s.kind}`);
    assert.ok(isSafeGradientCss(css), `unsafe: ${css.slice(0, 120)}`);
    assert.equal(gradientCss(JSON.parse(JSON.stringify(s))), css, "same spec, same css");
    assert.ok(!/NaN|undefined|Infinity/.test(css), css.slice(0, 160));
    assert.ok(gradientStyle(s).backgroundColor);
  }
});

ok("compact CSS fits page-builder's custom-CSS box and is accepted by its sanitizer", () => {
  let fitted = 0;
  for (const s of specs.filter((x) => ["linear", "radial", "conic", "bands"].includes(x.kind))) {
    const css = gradientCss(s, { maxLength: 188 });
    if (!css) continue; // too many stops for 200 chars: that is what the structured prop is for
    fitted++;
    const r = cleanCustomCss(`background: ${css}`);
    assert.equal(r.rejected.length, 0, `${r.rejected[0]?.reason} :: ${css}`);
    assert.equal(r.kept[0]?.[1], css);
  }
  assert.ok(fitted > 50, `only ${fitted} fitted`);
});

ok("isSafeGradientCss refuses injection", () => {
  for (const bad of ["url(x)", "linear-gradient(red, url(a))", "var(--x)", "expression(alert(1))", "linear-gradient(#fff 0%, #000 100%); color: red", "linear-gradient(#fff, #000", "image-set(a)", "#fff !important"]) {
    assert.equal(isSafeGradientCss(bad), false, bad);
  }
  assert.ok(isSafeGradientCss("linear-gradient(90deg, #FFFFFF 0%, #000000 100%), #112233"));
});

ok("ramp: softness 0 gives hard edges, steps give flat bands", () => {
  // softness 0: each colour holds flat and switches at the midpoint (no blended samples between)
  const hard = ramp({ ...DEFAULT_GRADIENT, softness: 0 });
  const palette = new Set(DEFAULT_GRADIENT.stops.map((s) => s.color));
  assert.ok(hard.every((s) => palette.has(s.color)), "no in-between colours");
  assert.ok(hard.length <= DEFAULT_GRADIENT.stops.length * 3);
  const b = ramp({ ...DEFAULT_GRADIENT, kind: "bands", steps: 4 });
  assert.equal(b.length, 8);
  assert.equal(b[0].color, b[1].color);
});

ok("harmonies return valid colours of the expected size", () => {
  for (const h of HARMONIES) {
    const p = harmony("#2CA6A4", h);
    assert.ok(p.length >= 3 && p.every((c) => /^#[0-9A-F]{6}$/.test(c)), h);
  }
});

ok("mesh blobs are seeded and stay near the box", () => {
  const a = meshBlobs({ ...DEFAULT_GRADIENT, kind: "mesh", seed: 5 });
  assert.deepEqual(a, meshBlobs({ ...DEFAULT_GRADIENT, kind: "mesh", seed: 5 }));
  assert.notDeepEqual(a, meshBlobs({ ...DEFAULT_GRADIENT, kind: "mesh", seed: 6 }));
  assert.ok(a.every((b) => b.x > -20 && b.x < 120 && b.y > -20 && b.y < 120));
});

ok("shader uniforms are packed for every shader and stop count", () => {
  for (const k of Object.keys(SHADER_SOURCES)) assert.ok(SHADER_SOURCES[k as keyof typeof SHADER_SOURCES].includes("void main"), k);
  const u = shaderUniforms({ ...DEFAULT_GRADIENT, shader: "mineral" });
  assert.equal(u.lab.length, MAX_STOPS * 3);
  assert.equal(u.n, DEFAULT_GRADIENT.stops.length);
  assert.ok(u.pos[u.n - 1] === 1);
});

ok("Paper Shaders: every Paper shader maps to a component with the spec's colours; frame makes it deterministic", () => {
  for (const shader of PAPER_SHADERS) {
    const spec = { ...DEFAULT_GRADIENT, shader, grain: 30 };
    const r = paperRender(spec)!;
    assert.ok(r && r.component, shader);
    assert.deepEqual((r.props.colors as string[]).slice(0, 2), DEFAULT_GRADIENT.stops.slice(0, 2).map((s) => s.color));
    assert.ok((r.props.speed as number) > 0, "animated by default");
    const f = paperRender(spec, 1500)!;
    assert.equal(f.props.speed, 0);
    assert.equal(f.props.frame, (r.props.frame as number) + 1500, "render frame = start offset + frame");
    assert.deepEqual(paperRender(spec, 1500), f, "deterministic");
    assert.equal(f.props.minPixelRatio, 1, "our pixel budget, not Paper's 2");
  }
  assert.equal(paperRender({ ...DEFAULT_GRADIENT, shader: "mineral" }), null);
  assert.equal(paperTextureProps({ ...DEFAULT_GRADIENT, paper: 0 }), null);
  assert.ok(paperTextureProps({ ...DEFAULT_GRADIENT, paper: 60 }));
  assert.equal(cleanGradient({ ...DEFAULT_GRADIENT, paper: 400 })!.paper, 100);
  assert.equal(cleanGradient({ ...DEFAULT_GRADIENT, shader: "smoke-ring" })!.shader, "smoke-ring");
});

ok("cssColorToHex reads what the Grapick colour picker hands back", () => {
  assert.equal(cssColorToHex("rgb(255, 0, 0)"), "#FF0000");
  assert.equal(cssColorToHex("#abc"), "#AABBCC");
  assert.equal(cssColorToHex("hsl(240 100% 50%)"), "#0000FF");
  assert.equal(cssColorToHex("url(x)"), null);
  assert.equal(cssColorToHex(5), null);
});

console.log(`\n${n} checks passed`);
