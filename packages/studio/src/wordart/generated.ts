// ============================================================================
// Generated word art (2026-11-27): one resolved design → one canvas, drawn with
// the Studio's own mark and painter, so a generated picture looks like a Studio
// export. The design is resolved server-side (@elkdonis/services
// wordart-catalog); the renderer is the reel-render worker
// (packages/reels/src/wordart-still.tsx). Browser-only. 2D.
// ============================================================================

import { cleanGradient, DEFAULT_GRADIENT, PRESETS, stopsFrom, type GradientSpec } from "@elkdonis/gradients";
import { newDoc, type Frame, type WordArtDoc } from "./doc";
import { parseFont, textMark, type Font, type Mark } from "./mark";
import { layout, renderCanvas2D } from "./render2d";

export type GeneratedPaint = { preset: string } | { colors: string[]; angle: number };

/** The shape the renderer needs from wordart_jobs.input (WordArtDesign in the services catalog). */
export interface GeneratedDesign {
  text: string;
  frame: Frame;
  width: number;
  height: number;
  fonts: Array<{ id: string; label: string; file: string }>;
  look: { id: string; fill: GeneratedPaint; background: GeneratedPaint };
}

const SIZE = 86;
const SHADOW = 35;
const MAX_LINES = 4;
const TRACKING = 20;
const LEADING = 1.08;
/** An extra line is used only when it makes the letters this much bigger. */
const LINE_GAIN = 1.1;

/** A paint as a painted gradient: no shader, no paper layer (a still has neither). */
function paintSpec(paint: GeneratedPaint): GradientSpec {
  let spec: GradientSpec | null | undefined;
  if ("preset" in paint) spec = PRESETS.find((p) => p.id === paint.preset)?.spec;
  else spec = cleanGradient({ ...DEFAULT_GRADIENT, kind: "linear", stops: stopsFrom(paint.colors), angle: paint.angle, mute: 0, light: 0, grain: 0 });
  if (!spec) throw new Error("That colour pair is not available.");
  return { ...spec, shader: "none", paper: 0 };
}

/** The split of `words` into k lines whose widest line is narrowest. */
function bestSplit(words: string[], k: number, width: (s: string) => number): string[] {
  let best: string[] = [], bestWidth = Infinity;
  const walk = (from: number, lines: string[], widest: number) => {
    if (widest >= bestWidth) return;
    const left = k - lines.length;
    if (left === 1) {
      const last = words.slice(from).join(" ");
      const w = Math.max(widest, width(last));
      if (w < bestWidth) { bestWidth = w; best = [...lines, last]; }
      return;
    }
    for (let to = from + 1; to <= words.length - left + 1; to++) {
      const line = words.slice(from, to).join(" ");
      walk(to, [...lines, line], Math.max(widest, width(line)));
    }
  };
  walk(0, [], 0);
  return best;
}

/** True when the font draws every character (index 0 is its "missing" box). */
const covers = (font: Font, text: string) => [...text].every((ch) => /\s/.test(ch) || font.charToGlyph(ch).index > 0);

export async function renderGenerated(
  design: GeneratedDesign,
  loadFont: (file: string) => Promise<ArrayBuffer>,
): Promise<{ canvas: HTMLCanvasElement; doc: WordArtDoc; lines: string[] }> {
  const { width: W, height: H, text } = design;
  let picked: { font: Font; id: string } | null = null;
  for (const f of design.fonts) {
    const font = parseFont(await loadFont(f.file));
    if (covers(font, text)) { picked = { font, id: f.id }; break; }
  }
  if (!picked) {
    const only = design.fonts.length === 1 ? design.fonts[0].label : null;
    throw new Error(only ? `${only} has no letters for some of these characters.` : "No font here has letters for some of these characters.");
  }
  const { font, id } = picked;

  const base = newDoc({ kind: "text", text, font: id, tracking: TRACKING, leading: LEADING, align: "center" }, text.split("\n")[0].slice(0, 80));
  let doc: WordArtDoc = { ...base, frame: design.frame, size: SIZE, shadow: SHADOW, fill: paintSpec(design.look.fill), background: paintSpec(design.look.background) };
  const markFor = (lines: string[]): Mark => textMark(font, { text: lines.join("\n"), tracking: TRACKING, leading: LEADING, align: "center" });

  // typed line breaks are kept; otherwise one to four balanced lines, whichever fills the frame best
  let pick: { lines: string[]; mark: Mark; scale: number } | null = null;
  if (text.includes("\n")) {
    const lines = text.split("\n");
    pick = { lines, mark: markFor(lines), scale: 0 };
  } else {
    const words = text.split(/\s+/);
    const measure = (s: string) => font.getAdvanceWidth(s, 200, { kerning: true, letterSpacing: TRACKING / 1000 });
    for (let k = 1; k <= Math.min(MAX_LINES, words.length); k++) {
      const lines = bestSplit(words, k, measure);
      const mark = markFor(lines);
      const scale = layout(doc, mark, W, H).s;
      if (!pick || scale > pick.scale * LINE_GAIN) pick = { lines, mark, scale };
    }
  }
  if (!pick || !pick.mark.paths.length) throw new Error("Those characters draw nothing.");
  doc = { ...doc, source: { kind: "text", text: pick.lines.join("\n"), font: id, tracking: TRACKING, leading: LEADING, align: "center" } };
  return { canvas: await renderCanvas2D(doc, pick.mark, W, H), doc, lines: pick.lines };
}
