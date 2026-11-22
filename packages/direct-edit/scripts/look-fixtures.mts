// Fixtures for check-look.mts: stored v1 morphs (no states, no sizes) and the part map they are drawn with.
// The golden CSS in look-golden.json was produced by the compiler as it was BEFORE lane LOOK's change
// (2026-11-20, see look-golden.mts); the check proves the new compiler still writes the same bytes.
export const PARTS = {
  root: { sel: "> .blk-hero" },
  title: { sel: ".blk-hero-title" },
  body: { sel: "> .blk-hero-body > p" },
  cta: { sel: ".blk-hero a.blk-btn" },
  media: { sel: "> figure img" },
  broken: { sel: ".a, .b" },
  inject: { sel: ".x{color:red}" },
};

export const FIXTURES: Array<{ name: string; morph: unknown; parts?: typeof PARTS | undefined }> = [
  { name: "root colour only", morph: { v: 1, parts: { root: { fill: "#102030", color: "#f0e0d0" } } } },
  { name: "title size and weight", morph: { v: 1, parts: { title: { size: 44, weight: 700, leading: 1.1, tracking: 0.02, case: "upper" } } } },
  { name: "big title is guarded for phones", morph: { v: 1, parts: { title: { size: 96 } } } },
  { name: "padding as a quad and margin", morph: { v: 1, parts: { body: { padding: [4, 8, 12, 16], margin: 10, align: "center" } } } },
  { name: "tokens only", morph: { v: 1, tokens: { "--blk-accent": "#a33", "--blk-radius": "12px" } } },
  { name: "colour tokens with derived values", morph: { v: 1, tokens: { "--blk-fg": "#111", "--blk-bg": "#fafafa" } } },
  { name: "font token and part font", morph: { v: 1, tokens: { "--blk-font-title": "Lora" }, parts: { title: { font: "Lora", italic: true } } } },
  { name: "tokens and several parts", morph: { v: 1, tokens: { "--blk-accent": "#00a" }, parts: { root: { radius: 8 }, cta: { fill: "#00a", color: "#fff", radius: [2, 2, 2, 2], bstyle: "solid", bcolor: "#000", bwidth: 2 }, media: { ratio: "16/9", fit: "cover" } } } },
  { name: "grid layout on the root", morph: { v: 1, parts: { root: { layout: "grid", gcols: 3, gap: 24, items: "center" } } } },
  { name: "stack layout, row, wrap", morph: { v: 1, parts: { root: { layout: "stack", dir: "row", wrap: true, justify: "space-between" } } } },
  { name: "hidden part and fixed width", morph: { v: 1, parts: { media: { hide: true }, cta: { w: 220, h: 48 } } } },
  { name: "raw css, one refused property", morph: { v: 1, parts: { title: { css: "text-shadow: 0 1px 2px rgba(0,0,0,.4); position: fixed; letter-spacing: .05em; z-index: 9" } } } },
  { name: "raw css with a url is dropped", morph: { v: 1, parts: { body: { css: "background: url(http://x/y.png); line-height: 1.7" } } } },
  { name: "absolute position is dropped", morph: { v: 1, parts: { cta: { pos: "absolute", x: 10, y: 10, fill: "#abc" } } } },
  { name: "part the block does not declare", morph: { v: 1, parts: { ghost: { size: 20 }, title: { size: 20 } } } },
  { name: "part with a broken selector", morph: { v: 1, parts: { broken: { size: 20 }, inject: { size: 20 }, title: { size: 22 } } } },
  { name: "effects", morph: { v: 1, parts: { media: { opacity: 0.8, blur: 2, rot: 3, sx: 1.1, sy: 1.1, tx: 4, ty: -4 } } } },
  { name: "no declared parts at all (generic root)", morph: { v: 1, parts: { root: { fill: "#eee" }, title: { size: 30 } } }, parts: undefined },
  { name: "hostile tokens and names", morph: { v: 1, parts: { "bad name": { size: 20 }, type: { size: 20 }, title: { size: 18 } }, tokens: { "--x": "url(http://e)", "--blk-ok": "red", "nope": "red" } } },
  { name: "wrong version", morph: { v: 2, parts: { title: { size: 20 } } } },
];
