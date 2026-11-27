// ============================================================================
// Fade (gradient) fill for the look panel, 2026-11-22 (lane GRADIENT).
//
// The data and the CSS come from the gradient lab (`@elkdonis/gradients`): its cleaner narrows a stored fade (block/style.ts
// `cleanGrad`), its writer compiles it (`gradCss`), and its presets are the row of choices below. The lab's own control is a React
// island (generators, shaders, grain); the look panel is plain DOM, so this file is the small control on the lab's data
// functions: presets, shape, 2 to 5 colours each with a place, an angle. Pure strings and plain functions, no DOM.
// ============================================================================

import { PRESETS, adjustedStops } from "@elkdonis/gradients";
import { cleanGrad, gradCss, GRAD_KINDS, GRAD_MAX_STOPS, type Grad, type PartStyle } from "../block/style";

export type { Grad };

/** Plain words for the three shapes. */
export const FADE_SHAPES: ReadonlyArray<readonly [Grad["kind"], string]> = [["linear", "Straight"], ["radial", "Round"], ["conic", "Sweep"]];

export interface FadePreset { id: string; label: string; grad: Grad }

/** The lab's presets that a CSS fade can draw: no shader or mesh, 2 to 5 colours. Its softening (mute, light) is baked into the colours. */
export const FADE_PRESETS: readonly FadePreset[] = PRESETS
  .filter((p) => p.spec.shader === "none" && (GRAD_KINDS as readonly string[]).includes(p.spec.kind) && p.spec.stops.length <= GRAD_MAX_STOPS)
  .map((p) => ({
    id: p.id,
    label: p.label,
    grad: cleanGrad({ kind: p.spec.kind, angle: p.spec.angle, stops: adjustedStops(p.spec) }),
  }))
  .filter((p): p is FadePreset => !!p.grad);

/** A first fade for a part with none: from its colour (when known) to white, else the first preset. */
export function startFade(from?: string): Grad {
  const c = cleanGrad({ kind: "linear", angle: 180, stops: [{ color: from ?? "", at: 0 }, { color: "#FFFFFF", at: 100 }] });
  return c ?? FADE_PRESETS[0]!.grad;
}

const clone = (g: Grad): Grad => JSON.parse(JSON.stringify(g));
const fix = (g: Grad): Grad => cleanGrad(g) ?? g;

export const fadeShape = (g: Grad, kind: Grad["kind"]): Grad => fix({ ...clone(g), kind });
export const fadeAngle = (g: Grad, angle: number): Grad => fix({ ...clone(g), angle });
export function fadeColour(g: Grad, i: number, color: string): Grad {
  const n = clone(g); if (n.stops[i]) n.stops[i]!.color = color; return fix(n);
}
export function fadePlace(g: Grad, i: number, at: number): Grad {
  const n = clone(g); if (n.stops[i]) n.stops[i]!.at = at; return fix(n);
}
/** Adds a colour in the widest gap, halfway between its neighbours, in the colour of the stop before it. Nothing past the fifth. */
export function fadeAdd(g: Grad): Grad {
  if (g.stops.length >= GRAD_MAX_STOPS) return g;
  const n = clone(g);
  let at = 0, gap = -1;
  for (let i = 0; i < n.stops.length - 1; i++) {
    const w = n.stops[i + 1]!.at - n.stops[i]!.at;
    if (w > gap) { gap = w; at = i; }
  }
  const a = n.stops[at]!, b = n.stops[at + 1]!;
  n.stops.splice(at + 1, 0, { color: a.color, at: Math.round((a.at + b.at) / 2) });
  return fix(n);
}
/** Removes one colour; two always stay. */
export function fadeRemove(g: Grad, i: number): Grad {
  if (g.stops.length <= 2) return g;
  const n = clone(g); n.stops.splice(i, 1); return fix(n);
}

/** Store a fade on a look: a fade replaces the flat colour, and only one of the two is kept. `null` takes the fade away. */
export function setFade(s: PartStyle, g: unknown): void {
  const c = g ? cleanGrad(g) : undefined;
  if (c) { s.grad = c; delete s.fill; } else delete s.grad;
}
/** Store a flat colour on a look: it replaces any fade. */
export function setFlat(s: PartStyle, hex: string | undefined): void {
  if (hex) { s.fill = hex; delete s.grad; } else delete s.fill;
}

type Esc = (s: unknown) => string;

/** Fill: Colour / Fade. */
export function fadeModeHtml(on: boolean, esc: Esc): string {
  const b = (mode: string, label: string, pressed: boolean) => `<button type="button" data-fade-mode="${mode}" aria-pressed="${pressed}" data-f="fade-mode-${mode}">${esc(label)}</button>`;
  return `<div class="de-row c-fademode" data-sync="fade-mode"><span class="de-label">Fill</span><div class="de-ctl"><div class="de-seg" role="group" aria-label="Fill type">${b("colour", "Colour", !on)}${b("fade", "Fade", on)}</div></div></div>`;
}

/** The fade's controls: the strip, presets, shape, colours with places, angle. */
export function fadeHtml(g: Grad, esc: Esc): string {
  const css = (x: Grad) => esc(gradCss(x));
  const presets = FADE_PRESETS.map((p) => `<button type="button" class="de-fade-preset" data-fade-preset="${esc(p.id)}" style="background:${css(p.grad)}" title="${esc(p.label)}" aria-label="${esc(p.label)}" data-f="fade-preset-${esc(p.id)}"></button>`).join("");
  const shapes = FADE_SHAPES.map(([k, label]) => `<button type="button" data-fade-shape="${k}" aria-pressed="${g.kind === k}" data-f="fade-shape-${k}">${esc(label)}</button>`).join("");
  const stops = g.stops.map((s, i) =>
    `<div class="de-fade-stop"><input type="color" data-fade-stop="${i}" data-fade-colour value="${esc(s.color.toLowerCase())}" aria-label="Colour ${i + 1}" data-f="fade-colour-${i}">` +
    `<input type="text" inputmode="numeric" class="de-fade-at" data-fade-stop="${i}" data-fade-at value="${s.at}" aria-label="Where colour ${i + 1} sits, percent" data-f="fade-at-${i}"><span class="de-fade-unit">%</span>` +
    (g.stops.length > 2 ? `<button type="button" class="de-icon" data-fade-remove="${i}" title="Remove this colour" aria-label="Remove colour ${i + 1}" data-f="fade-remove-${i}">&times;</button>` : "") + `</div>`).join("");
  const angle = g.kind === "radial" ? "" :
    `<div class="de-row"><label class="de-label" for="de-fade-angle">${g.kind === "conic" ? "Start" : "Angle"}</label><div class="de-ctl"><input type="text" inputmode="numeric" id="de-fade-angle" data-fade-angle value="${g.angle}" aria-label="${g.kind === "conic" ? "Where the sweep starts" : "Angle"}, degrees" data-f="fade-angle"><span class="de-fade-unit">&deg;</span></div></div>`;
  return `<div class="de-fade" data-sync="fade">` +
    `<div class="de-fade-strip" data-sync="fade-strip" style="background:${css(g)}" aria-hidden="true"></div>` +
    `<div class="de-fade-presets" role="group" aria-label="Fades to start from">${presets}</div>` +
    `<div class="de-row"><span class="de-label">Shape</span><div class="de-ctl"><div class="de-seg" role="group" aria-label="Shape">${shapes}</div></div></div>` +
    `<div class="de-fade-stops" role="group" aria-label="Colours">${stops}</div>` +
    (g.stops.length < GRAD_MAX_STOPS ? `<button type="button" class="de-fade-add" data-fade-add data-f="fade-add">Add a colour</button>` : "") +
    angle +
    `<p class="de-note">A fade replaces the colour.</p></div>`;
}
