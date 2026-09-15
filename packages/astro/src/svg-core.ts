/**
 * Chart drawing, independent of how type is produced.
 *
 * Everything geometric lives here; letters and glyphs come from a Typesetter:
 *  - the server one (svg.ts) converts type to outlines with real fonts, for a
 *    self-contained file that renders identically anywhere;
 *  - the client one (wheel.ts) emits <text> in the fonts the page already
 *    loads, for a small SVG the browser can redraw once a second.
 *
 * Layouts: "sheet" (title, wheel, tables — the printable page) and "wheel"
 * (the round chart alone). Variants: "full", and "compact" — the same chart
 * drawn tighter and bolder for small sizes.
 *
 * Drawing conventions (settled with the user, 2026-09-11):
 *  - Ascendant on the left, zodiac counter-clockwise, upright glyphs.
 *  - Each planet has a faint radial at its TRUE longitude from the zodiac band
 *    in to the aspect circle, so band tick, glyph and aspect line sit on one
 *    line. A crowded glyph slides sideways along its lane, joined to its
 *    radial by a thin diagonal — nothing heavier.
 *  - Aspects: trine dark blue, sextile light blue, square red, opposition red
 *    dashed; weight grows with tightness of orb; glyph at the midpoint.
 *  - Bi-wheel (opts.transits): natal inside and owning the houses, the second
 *    chart in a ring between the house ring and the zodiac, and only the
 *    cross aspects drawn — applying solid, separating dotted. Conventions and
 *    orbs live in transits.ts.
 */

import { BODY_BY_KEY, HOUSE_SYSTEMS, SIGN_BY_KEY, SIGNS } from "./constants";
import { formatLatitude, formatLongitude } from "./format";
import { transitAspects } from "./transits";
import type { AspectKey, AspectPoint, BodyKey, BodyPosition, ChartResult, Element, SignKey } from "./types";

export type FontRole = "serif" | "sans";

export interface TextOptions {
  anchor?: "start" | "middle" | "end";
  fill?: string;
  tracking?: number;
  /** CSS weight; typesetters that can't vary weight ignore it. */
  weight?: number;
}

/** Produces the markup for type. Positions are baselines; sizes in user units. */
export interface Typesetter {
  text(font: FontRole, str: string, x: number, y: number, size: number, opts?: TextOptions): string;
  /** Advance width of a run, for side-by-side layout. An estimate is fine. */
  measure(font: FontRole, str: string, size: number, tracking?: number): number;
  /** A sign, planet or aspect glyph centred on (cx, cy) with height h. */
  glyph(key: string, cx: number, cy: number, h: number, fill: string, weight?: number): string;
}

export interface RenderOptions {
  layout?: "sheet" | "wheel";
  variant?: "full" | "compact";
  /** Heading (sheet only). Default "NATAL CHART". */
  title?: string;
  /** Person or event name (sheet only). */
  name?: string;
  /** Place name for the subtitle (sheet only); coordinates are always shown. */
  locationName?: string;
  /** Draw minor aspects too (default: majors only). */
  minorAspects?: boolean;
  /**
   * What sits on the left of the wheel, and therefore what holds still.
   *
   * "ascendant" (default) is the natal convention: the Ascendant on the left,
   * the houses square to the page, the zodiac turning behind them. Right for
   * one chart, read once.
   *
   * "aries" pins 0° Aries there instead. Nothing about the chart changes —
   * the same drawing, rotated — but the signs stop moving, so a wheel being
   * scrubbed through time no longer spins. At a fixed clock time the
   * Ascendant advances about a degree a day, which is a whole revolution over
   * a year; with the zodiac pinned it is the houses that visibly sweep, which
   * is what is actually moving.
   */
  orient?: "ascendant" | "aries";
  /**
   * Draw the chart stripped to what reads while it is moving.
   *
   * A full wheel is about 610 SVG elements and 348 of those are the one-degree
   * ticks — more than half the drawing, and all of it re-parsed every time the
   * markup is replaced. When a dial is being dragged nobody is reading a tick,
   * a degree label, or an aspect glyph, so `lite` leaves them out along with
   * the aspects to the Ascendant and Midheaven (which move fastest and mean
   * least in motion). What stays is the shape: the signs, the houses, the
   * planets and the major aspects between them.
   *
   * The full drawing comes back the moment the dial settles.
   */
  lite?: boolean;
  /**
   * Draw as a BI-WHEEL: this second chart's planets in a ring outside the
   * natal ones, with transit-to-natal aspect lines in the centre. The natal
   * chart keeps the houses — a transiting planet is read in the natal house
   * it falls in — and the natal chart's own aspects are hidden, because both
   * webs at once is unreadable. See transits.ts for the conventions.
   */
  transits?: ChartResult;
  /** Extra attributes on the root <svg>, e.g. a class. */
  rootAttrs?: string;
  /**
   * The colour the wheel will sit on (wheel layouts only). Used for the
   * halos that keep axis labels legible over sign names — pass the card or
   * page colour so the halo is invisible.
   */
  background?: string;
}

// ── palette ────────────────────────────────────────────────────────────────

export const PALETTE = {
  paper: "#f9f6ef", ink: "#231e2b", ink2: "#6a6474", hair: "#d5cfc3",
  fire: "#c4503a", earth: "#8b6b3c", air: "#3d9a93", water: "#4667ad", gold: "#b08a33",
  retro: "#c9453d",
  /** The transiting ring of a bi-wheel: clearly not the natal ink, but not a shout. */
  transit: "#4a3f7a",
};
const C = PALETTE;
const ELEMENT: Record<Element, string> = { fire: C.fire, earth: C.earth, air: C.air, water: C.water };
export const ASPECT_STYLE: Partial<Record<AspectKey, { color: string; dash?: string }>> = {
  trine: { color: "#274f9e" },
  sextile: { color: "#6f9fe0" },
  square: { color: "#c9453d" },
  opposition: { color: "#a52a2a", dash: "6 4" },
  quincunx: { color: "#8a6bb5", dash: "2 3" },
  semisextile: { color: "#9aa4b8", dash: "2 3" },
  semisquare: { color: "#d08a7a", dash: "2 3" },
  sesquisquare: { color: "#d08a7a", dash: "2 3" },
};
/** Unicode for every glyph a typesetter may be asked for (Sun, trine and square are drawn by the core). */
export const GLYPH_CHARS: Record<string, string> = {
  aries: "♈", taurus: "♉", gemini: "♊", cancer: "♋", leo: "♌", virgo: "♍", libra: "♎", scorpio: "♏",
  sagittarius: "♐", capricorn: "♑", aquarius: "♒", pisces: "♓",
  moon: "☽", mercury: "☿", venus: "♀", mars: "♂", jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
  northNode: "☊", chiron: "⚷",
  conjunction: "☌", opposition: "☍", sextile: "⚹", quincunx: "⚻", semisextile: "⚺", semisquare: "∠", sesquisquare: "⚼",
};

// ── geometry per layout/variant ────────────────────────────────────────────

interface Geometry {
  W: number; H: number; CX: number; CY: number;
  R_OUT: number; R_Z: number; R_H: number; R_P: number; R_C: number;
  /** Stroke multiplier. */
  k: number;
  signGlyph: number; planetGlyph: number; halo: number;
  label: number; houseNumber: number; aspectGlyph: number;
  /**
   * The transit lane: where the outer chart's glyphs sit, between the house
   * ring and the zodiac band. 0 when this geometry is not a bi-wheel.
   */
  R_T: number;
  /**
   * Draw the degree/sign label beside each planet. Off in a bi-wheel: two
   * rings of glyphs plus two rings of labels is more type than the drawing
   * can hold, and the tables underneath carry the numbers anyway.
   */
  labels: boolean;
  /** Draw 1° ticks (5° and 10° always). */
  fineTicks: boolean;
  /** Sign names outside the band. */
  signNames: boolean;
  /** Axis labels: distance beyond R_OUT, font size, and whether the degree goes under them. */
  axisOffset: number; axisSize: number; axisDegrees: boolean;
  /** Minimum angular separation of planet glyphs, degrees. */
  spread: number;
  /** Type weight for all labels. */
  weight: number;
  /** Weight for symbol glyphs — kept lighter than the labels. */
  glyphWeight: number;
  /** Sign-name size outside the band. */
  signName: number;
  sheet: boolean;
}

function geometry(layout: "sheet" | "wheel", variant: "full" | "compact", biwheel = false): Geometry {
  // R_C sits just inside the planet lane (R_P − halo − gap), so aspect lines reach the glyphs.
  const radii = { R_OUT: 474, R_Z: 402, R_H: 350, R_P: 296, R_C: 266 };
  // A bi-wheel has to find room for a whole second ring of planets. The
  // zodiac band is the frame and does not move, so everything inside it is
  // drawn in tighter and the freed band between the house ring and the
  // zodiac becomes the transit lane.
  // Lanes, outward: aspects 220 · natal glyphs 258±22 · house numbers ~300
  // · house ring 322 · transit glyphs 364±22 · zodiac 402–474. Every gap is at
  // least 15px so a glyph, its halo and a house number never share space.
  const biRadii = { R_OUT: 474, R_Z: 402, R_T: 364, R_H: 322, R_P: 258, R_C: 220 };
  // The printed sheet: fine type, read at full page size.
  if (layout === "sheet") {
    return {
      W: 1200, H: 1520, CX: 600, CY: 690, ...(biwheel ? biRadii : { ...radii, R_T: 0 }),
      k: 1, signGlyph: 32, planetGlyph: biwheel ? 26 : 30, halo: biwheel ? 20 : 20, label: 10.5, houseNumber: 17, aspectGlyph: 9,
      labels: !biwheel,
      fineTicks: true, signNames: true, signName: 10.5, axisOffset: 48, axisSize: 20, axisDegrees: true,
      spread: 11, weight: 500, glyphWeight: 400, sheet: true,
    };
  }
  // The compact wheel: same drawing, tighter rings, heavier type, no 1° ticks or sign names.
  if (variant === "compact") {
    return {
      W: 680, H: 680, CX: 340, CY: 340,
      ...(biwheel
        ? { R_OUT: 292, R_Z: 248, R_T: 222, R_H: 194, R_P: 152, R_C: 128 }
        : { R_OUT: 292, R_Z: 248, R_H: 214, R_P: 178, R_C: 156, R_T: 0 }),
      k: 1.7, signGlyph: 28, planetGlyph: biwheel ? 20 : 26, halo: biwheel ? 13 : 16, label: 12, houseNumber: 14, aspectGlyph: 8,
      labels: !biwheel,
      fineTicks: false, signNames: false, signName: 0, axisOffset: 17, axisSize: 14, axisDegrees: false,
      spread: 12, weight: 650, glyphWeight: 400, sheet: false,
    };
  }
  // The on-screen wheel: the sheet's rings, but type scaled for ~500–600px display.
  return {
    W: 1180, H: 1180, CX: 590, CY: 590, ...(biwheel ? biRadii : { ...radii, R_C: 262, R_T: 0 }),
    k: 1.15, signGlyph: 40, planetGlyph: biwheel ? 30 : 36, halo: biwheel ? 22 : 25, label: 15, houseNumber: 22, aspectGlyph: 12,
    labels: !biwheel,
    fineTicks: true, signNames: true, signName: 14, axisOffset: 70, axisSize: 26, axisDegrees: true,
    spread: 12, weight: 600, glyphWeight: 400, sheet: false,
  };
}

const f2 = (n: number) => Number(n.toFixed(2));
const rad = (d: number) => (d * Math.PI) / 180;

export function renderChartSvg(chart: ChartResult, ts: Typesetter, opts: RenderOptions = {}): string {
  const layout = opts.layout ?? "sheet";
  const variant = opts.variant ?? "full";
  const biwheel = Boolean(opts.transits);
  const G = geometry(layout, variant, biwheel);
  const { W, H, CX, CY, R_OUT, R_Z, R_H, R_P, R_C, k } = G;

  const ASC = chart.angles.ascendant;
  const MC = chart.angles.midheaven;
  const cusps = chart.houses.map((h) => h.longitude);

  // Whatever is pinned to the left of the drawing.
  const origin = opts.orient === "aries" ? 0 : ASC;
  const pt = (lon: number, r: number): [number, number] => {
    const phi = rad(180 + (lon - origin));
    return [CX + r * Math.cos(phi), CY - r * Math.sin(phi)];
  };
  const P = (lon: number, r: number) => pt(lon, r).map(f2) as [number, number];
  const line = (lon: number, r0: number, r1: number, attrs: string) => {
    const [x0, y0] = P(lon, r0), [x1, y1] = P(lon, r1);
    return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" ${attrs}/>`;
  };
  /** Annular sector; increasing longitude is counter-clockwise on screen (sweep flag 0). */
  const annulus = (a0: number, a1: number, r0: number, r1: number) => {
    const [sx, sy] = P(a0, r1), [ix, iy] = P(a1, r1), [ex, ey] = P(a1, r0), [jx, jy] = P(a0, r0);
    const big = a1 - a0 > 180 ? 1 : 0;
    return `M ${sx} ${sy} A ${r1} ${r1} 0 ${big} 0 ${ix} ${iy} L ${ex} ${ey} A ${r0} ${r0} 0 ${big} 1 ${jx} ${jy} Z`;
  };
  const text = (font: FontRole, str: string, x: number, y: number, size: number, o: TextOptions = {}) =>
    ts.text(font, str, x, y, size, { fill: C.ink, weight: G.weight, ...o });
  /** Sun, trine and square are geometry; everything else is a font glyph. */
  const glyph = (key: string, cx: number, cy: number, h: number, fill = C.ink): string => {
    if (key === "sun") {
      return `<g fill="none" stroke="${fill}" stroke-width="${f2(h * 0.09)}"><circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(h * 0.42)}"/><circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(h * 0.09)}" fill="${fill}" stroke="none"/></g>`;
    }
    if (key === "trine") {
      const r = h * 0.5;
      const p = [0, 120, 240].map((a) => `${f2(cx + r * Math.sin(rad(a)))},${f2(cy - r * Math.cos(rad(a)))}`).join(" ");
      return `<polygon points="${p}" fill="none" stroke="${fill}" stroke-width="${f2(h * 0.1)}" stroke-linejoin="round"/>`;
    }
    if (key === "square") {
      const s = h * 0.78;
      return `<rect x="${f2(cx - s / 2)}" y="${f2(cy - s / 2)}" width="${f2(s)}" height="${f2(s)}" fill="none" stroke="${fill}" stroke-width="${f2(h * 0.1)}"/>`;
    }
    return ts.glyph(key, cx, cy, h, fill, G.glyphWeight);
  };
  const dms = (lon: number) => {
    const inSign = lon % 30;
    let d = Math.floor(inSign), m = Math.round((inSign - d) * 60);
    if (m === 60) { d += 1; m = 0; }
    return `${d}°${String(m).padStart(2, "0")}′`;
  };
  const signOfLon = (lon: number): SignKey => SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)].key;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"${opts.rootAttrs ? ` ${opts.rootAttrs}` : ""}>`);
  const uid = layout === "sheet" ? "sheet" : variant;
  out.push(`<defs>
  <radialGradient id="vignette-${uid}" cx="50%" cy="46%" r="70%"><stop offset="60%" stop-color="${C.paper}"/><stop offset="100%" stop-color="#efeadf"/></radialGradient>
  <radialGradient id="centre-${uid}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#f4f0e6"/></radialGradient>
</defs>`);
  if (G.sheet) out.push(`<rect width="${W}" height="${H}" fill="url(#vignette-${uid})"/>`);

  // ── title block (sheet) ──
  if (G.sheet) {
    const { date, time, timezone, latitude, longitude, houseSystem } = chart.input;
    const hs = HOUSE_SYSTEMS.find((h) => h.code === houseSystem)?.name ?? houseSystem;
    out.push(text("serif", (opts.title ?? "NATAL CHART").toUpperCase(), CX, 66, 34, { anchor: "middle", tracking: 8 }));
    out.push(`<line x1="${CX - 60}" y1="82" x2="${CX + 60}" y2="82" stroke="${C.gold}" stroke-width="1"/>`);
    const where = `${opts.locationName ? `${opts.locationName} · ` : ""}${formatLatitude(latitude)} ${formatLongitude(longitude)}`;
    const when = `${date} · ${chart.input.timeKnown === false ? "time unknown (noon)" : time} (${timezone})`;
    if (opts.name) out.push(text("serif", opts.name, CX, 108, 20, { anchor: "middle" }));
    out.push(text("sans", `${when} · ${where}`, CX, opts.name ? 130 : 106, 14, { anchor: "middle", fill: C.ink2 }));
    out.push(text("sans", `Tropical zodiac · ${hs} houses · Geocentric · ${chart.ephemeris === "swiss" ? "Swiss Ephemeris" : "Moshier ephemeris"}`, CX, opts.name ? 150 : 126, 12, { anchor: "middle", fill: C.ink2 }));
  }

  // ── zodiac band ──
  const strip = G.sheet || variant === "full" ? 7 : 6;
  for (let i = 0; i < 12; i++) {
    const a0 = i * 30, a1 = a0 + 30, col = ELEMENT[SIGNS[i].element];
    out.push(`<path d="${annulus(a0, a1, R_Z, R_OUT)}" fill="${col}" opacity="0.13"/>`);
    out.push(`<path d="${annulus(a0, a1, R_OUT - strip, R_OUT)}" fill="${col}"/>`);
  }
  out.push(`<circle cx="${CX}" cy="${CY}" r="${R_OUT}" fill="none" stroke="${C.ink}" stroke-width="${f2(1.2 * k)}"/>`);
  out.push(`<circle cx="${CX}" cy="${CY}" r="${R_OUT - strip}" fill="none" stroke="${C.ink}" stroke-width="${f2(0.6 * k)}"/>`);
  out.push(`<circle cx="${CX}" cy="${CY}" r="${R_Z}" fill="none" stroke="${C.ink}" stroke-width="${f2(1.2 * k)}"/>`);
  for (let i = 0; i < 12; i++) out.push(line(i * 30, R_Z, R_OUT, `stroke="${C.ink}" stroke-width="${f2(0.9 * k)}"`));
  const fineTicks = G.fineTicks && !opts.lite;
  for (let a = 0; a < 360; a += fineTicks ? 1 : 5) {
    if (a % 30 === 0) continue;
    const len = (a % 10 === 0 ? 12 : a % 5 === 0 ? 8 : 4) * (fineTicks ? 1 : 0.8);
    out.push(line(a, R_Z, R_Z + len, `stroke="${C.ink}" stroke-width="${f2((a % 5 === 0 ? 0.8 : 0.45) * k)}"`));
  }
  for (let i = 0; i < 12; i++) {
    const mid = i * 30 + 15;
    const [gx, gy] = pt(mid, (R_Z + 14 + R_OUT - strip - 1) / 2);
    out.push(glyph(SIGNS[i].key, gx, gy, G.signGlyph, C.ink));
    if (G.signNames && !opts.lite) {
      const [nx, ny] = pt(mid, R_OUT + 12 + G.signName * 0.8);
      out.push(text("sans", SIGNS[i].name.toUpperCase(), nx, ny + 4, G.signName, { anchor: "middle", fill: C.ink2, tracking: 1.4 }));
    }
  }

  // ── house band ──
  out.push(`<circle cx="${CX}" cy="${CY}" r="${R_H}" fill="none" stroke="${C.ink}" stroke-width="${f2(0.8 * k)}"/>`);
  const houseNumbers: string[] = [];
  // Normally the house numbers sit just outside the house ring. In a bi-wheel
  // that band is the transit lane, so they move inside it instead — otherwise
  // a transiting planet and a house number land on the same spot.
  const hnR = biwheel
    ? R_H - (variant === "compact" ? 14 : 22)
    : R_H + (variant === "compact" ? 18 : 26);
  for (let i = 0; i < 12; i++) {
    const angular = i % 3 === 0;
    out.push(line(cusps[i], angular ? R_C : R_H, R_Z, `stroke="${C.ink}" stroke-width="${f2((angular ? 1.4 : 0.7) * k)}"${angular ? "" : ' opacity="0.7"'}`));
    const span = (((cusps[(i + 1) % 12] - cusps[i]) % 360) + 360) % 360;
    const [hx, hy] = pt(cusps[i] + span / 2, hnR);
    houseNumbers.push(
      `<circle cx="${f2(hx)}" cy="${f2(hy)}" r="${f2(G.houseNumber * 0.7)}" fill="${C.paper}"/>` +
        text("serif", String(i + 1), hx, hy + G.houseNumber * 0.35, G.houseNumber, { anchor: "middle", fill: C.ink2 }),
    );
  }
  const axis = (lon: number, label: string) => {
    out.push(line(lon, R_OUT, R_OUT + (G.axisDegrees ? 14 : 8), `stroke="${C.ink}" stroke-width="${f2(1.4 * k)}"`));
    const [x, y] = pt(lon, R_OUT + G.axisOffset);
    if (!G.sheet) {
      // Sits over a sign name whenever a sign's middle falls near an axis.
      const cy = y + (G.axisDegrees ? G.axisSize * 0.45 : 0);
      out.push(`<circle cx="${f2(x)}" cy="${f2(cy)}" r="${f2(G.axisSize * (G.axisDegrees ? 1.35 : 0.9))}" fill="${opts.background ?? C.paper}"/>`);
    }
    out.push(text("serif", label, x, y + G.axisSize * 0.15, G.axisSize, { anchor: "middle", fill: C.gold, tracking: 1 }));
    if (G.axisDegrees) out.push(text("sans", dms(lon), x, y + G.axisSize * 0.95, G.label * 1.05, { anchor: "middle", fill: C.ink2 }));
  };
  axis(ASC, "AC"); axis(MC, "MC"); axis(chart.angles.descendant, "DC"); axis(chart.angles.imumCoeli, "IC");

  // ── centre ──
  out.push(`<circle cx="${CX}" cy="${CY}" r="${R_C}" fill="url(#centre-${uid})" stroke="${C.ink}" stroke-width="${f2(0.8 * k)}"/>`);

  // ── planets ──
  // One ring, drawn twice when this is a bi-wheel. `spread` keeps glyphs from
  // overlapping by walking the sorted list and nudging each one that sits too
  // close to its neighbour; `lon` stays the true longitude, so the pointer
  // and every aspect line still leave from the real degree.
  type Placed = { key: BodyKey; lon: number; retro: boolean; disp: number };
  const spreadRing = (bodies: readonly BodyPosition[]): Placed[] => {
    const sorted = [...bodies].sort((a, b) => a.longitude - b.longitude);
    const placed: Placed[] = [];
    for (const b of sorted) {
      let disp = b.longitude;
      const prev = placed[placed.length - 1];
      if (prev && disp - prev.disp < G.spread) disp = prev.disp + G.spread;
      placed.push({ key: b.key, lon: b.longitude, retro: b.retrograde, disp });
    }
    if (placed.length > 1) {
      const first = placed[0], last = placed[placed.length - 1];
      if (first.lon + 360 - last.disp < G.spread) first.disp = last.disp + G.spread - 360;
    }
    return placed;
  };

  /**
   * The pointer: a faint radial at the true longitude, ending in a heavier
   * tick on the ring that owns this set of planets. In a bi-wheel the natal
   * pointers stop at the house ring and the transit pointers run out to the
   * zodiac, so the two rings read as two charts rather than one crowd.
   */
  const drawPointers = (placed: Placed[], rInner: number, rOuter: number) => {
    for (const { lon } of placed) {
      out.push(line(lon, rInner, rOuter, `stroke="${C.ink}" stroke-width="${f2(0.55 * k)}" opacity="0.45"`));
      out.push(line(lon, rOuter - 12 * (variant === "compact" ? 0.8 : 1), rOuter, `stroke="${C.ink}" stroke-width="${f2(1.4 * k)}"`));
    }
  };

  const drawRing = (
    placed: Placed[],
    rGlyph: number,
    o: { labels: boolean; glyph: number; halo: number; ink?: string },
  ) => {
    const labelR = rGlyph + (variant === "compact" ? 32 : 44);
    for (const { key, lon, retro, disp } of placed) {
      const [gx, gy] = pt(disp, rGlyph);
      // A glyph nudged off its degree gets a leader back to where it belongs.
      if (Math.abs(disp - lon) > 0.3) {
        const [x0, y0] = P(lon, rGlyph + o.halo + 6);
        const dx = gx - x0, dy = gy - y0, len = Math.hypot(dx, dy);
        const [x1, y1] = [gx - (dx / len) * o.halo, gy - (dy / len) * o.halo].map(f2);
        out.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${C.ink}" stroke-width="${f2(0.55 * k)}" opacity="0.6"/>`);
      }
      out.push(`<circle cx="${f2(gx)}" cy="${f2(gy)}" r="${o.halo}" fill="${C.paper}"/>`);
      out.push(glyph(key, gx, gy, o.glyph, o.ink ?? C.ink));
      if (o.labels) {
        const [lx, ly] = pt(disp, labelR);
        const label = dms(lon);
        const lw = ts.measure("sans", label, G.label);
        const sk = signOfLon(lon);
        const gsz = G.label * 0.86;
        const total = lw + 4 + gsz;
        out.push(`<rect x="${f2(lx - total / 2 - 3)}" y="${f2(ly - G.label * 0.8)}" width="${f2(total + 6)}" height="${f2(G.label * 1.45)}" fill="${C.paper}" opacity="0.85"/>`);
        out.push(text("sans", label, lx - total / 2, ly + G.label * 0.38, G.label));
        out.push(glyph(sk, lx - total / 2 + lw + 4 + gsz / 2, ly, gsz, ELEMENT[SIGN_BY_KEY[sk].element]));
      }
      if (retro) out.push(text("sans", "R", gx + o.halo * 0.85, gy - o.halo * 0.6, G.label * 0.9, { fill: C.retro }));
    }
  };

  const natal = spreadRing(chart.bodies);
  const outer = opts.transits ? spreadRing(opts.transits.bodies) : null;

  drawPointers(natal, R_C, biwheel ? R_H : R_Z);
  // The transit radial runs the whole way in: its aspect chords start at the
  // centre circle, and without the line there is no way to see which glyph an
  // chord belongs to.
  if (outer) drawPointers(outer, R_C, R_Z);
  out.push(...houseNumbers);
  drawRing(natal, R_P, { labels: G.labels && !opts.lite, glyph: G.planetGlyph, halo: G.halo });
  if (outer) {
    // The transit ring sits on its own band of paper so its glyphs never read
    // as part of the natal chart.
    const bandW = (G.halo + 6) * 2;
    out.push(`<circle cx="${CX}" cy="${CY}" r="${f2(G.R_T)}" fill="none" stroke="${C.transit}" stroke-width="${f2(bandW)}" opacity="0.07"/>`);
    out.push(`<circle cx="${CX}" cy="${CY}" r="${f2(G.R_T + G.halo + 6)}" fill="none" stroke="${C.hair}" stroke-width="${f2(0.6 * k)}"/>`);
    out.push(`<circle cx="${CX}" cy="${CY}" r="${f2(G.R_T - G.halo - 6)}" fill="none" stroke="${C.hair}" stroke-width="${f2(0.6 * k)}"/>`);
    drawRing(outer, G.R_T, { labels: false, glyph: G.planetGlyph, halo: G.halo, ink: C.transit });
  }

  // ── aspects: the engine's list; weight by exactness; glyph at the midpoint ──
  const lonOf = {
    ...(Object.fromEntries(chart.bodies.map((b) => [b.key, b.longitude])) as Record<BodyKey, number>),
    ascendant: ASC,
    midheaven: MC,
  } as Record<AspectPoint, number>;
  const glyphs: string[] = [];
  /** One chord across the centre, plus its glyph at the midpoint. */
  const drawAspect = (
    lonA: number,
    lonB: number,
    type: AspectKey,
    exactness: number,
    o: { dash?: string; opacity?: number } = {},
  ) => {
    const st = ASPECT_STYLE[type];
    if (!st) return;
    const [x0, y0] = P(lonA, R_C - 4), [x1, y1] = P(lonB, R_C - 4);
    const w = f2((0.5 + exactness * 2.0) * k);
    const dash = o.dash ?? st.dash;
    out.push(
      `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${st.color}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""} opacity="${o.opacity ?? 0.9}"/>`,
    );
    if (opts.lite) return; // the glyph on the line is detail, not shape
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    glyphs.push(
      `<circle cx="${f2(mx)}" cy="${f2(my)}" r="${f2(G.aspectGlyph * 0.85)}" fill="${C.paper}" opacity="0.92"/>` +
        glyph(type, mx, my, G.aspectGlyph, st.color),
    );
  };

  if (opts.transits) {
    // A bi-wheel shows the CROSS aspects only. The natal chart's own aspects
    // are a fact of the person, not of this moment, and drawing both webs
    // over one another leaves neither readable.
    //
    // Conjunctions ARE drawn here, unlike in the natal wheel: between two
    // rings the two glyphs sit at different radii, so a line between them is
    // the only thing that shows the contact at all. (In a single wheel a
    // conjunction is two glyphs side by side and the line would be a dot.)
    const outerLon = Object.fromEntries(
      opts.transits.bodies.map((b) => [b.key, b.longitude]),
    ) as Record<AspectPoint, number>;
    const crossed = transitAspects(chart, opts.transits, { minorAspects: opts.minorAspects });
    for (const a of [...crossed].sort((x, y) => x.exactness - y.exactness)) {
      const from = outerLon[a.moving];
      const to = lonOf[a.fixed];
      if (from === undefined || to === undefined) continue;
      // Applying solid, separating dotted — the one piece of transit notation
      // that is near-universal, and the thing a reader most wants: what is
      // still building against what has already passed.
      drawAspect(from, to, a.type, a.exactness, a.applying ? {} : { dash: "2 4", opacity: 0.75 });
    }
  } else {
    const isAngle = (k: AspectPoint) => k === "ascendant" || k === "midheaven";
    const aspects = chart.aspects.filter(
      (a) =>
        a.type !== "conjunction" &&
        (a.major || opts.minorAspects) &&
        // In motion the angles sweep a degree a day and their aspects flicker
        // in and out; the lines are noise rather than information.
        !(opts.lite && (isAngle(a.a) || isAngle(a.b))),
    );
    for (const a of [...aspects].sort((x, y) => x.exactness - y.exactness)) {
      drawAspect(lonOf[a.a], lonOf[a.b], a.type, a.exactness);
    }
  }
  out.push(...glyphs);

  // ── tables (sheet) ──
  if (G.sheet) {
    const T = 1225;
    const rule = (x: number, y: number, w: number) => `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${C.hair}" stroke-width="0.8"/>`;
    out.push(text("serif", "PLANETS", 100, T, 15, { tracking: 3 }));
    out.push(rule(100, T + 10, 460));
    chart.bodies.forEach((b, i) => {
      const y = T + 34 + i * 23;
      out.push(glyph(b.key, 112, y - 5, 14));
      out.push(text("sans", BODY_BY_KEY[b.key].name, 134, y, 12.5));
      out.push(glyph(b.sign, 250, y - 5, 12, ELEMENT[SIGN_BY_KEY[b.sign].element]));
      out.push(text("sans", `${dms(b.longitude)} ${SIGN_BY_KEY[b.sign].name}`, 264, y, 12.5));
      out.push(text("sans", `House ${b.house}`, 430, y, 12, { fill: C.ink2 }));
      if (b.retrograde) out.push(text("sans", "retrograde", 500, y, 11, { fill: C.retro }));
    });
    out.push(text("serif", "HOUSES", 660, T, 15, { tracking: 3 }));
    out.push(rule(660, T + 10, 440));
    chart.houses.forEach((h, i) => {
      const y = T + 34 + i * 19.5;
      out.push(text("serif", String(h.house), 672, y, 14, { anchor: "middle", fill: C.ink2 }));
      out.push(glyph(h.sign, 700, y - 5, 11, ELEMENT[SIGN_BY_KEY[h.sign].element]));
      out.push(text("sans", `${dms(h.longitude)} ${SIGN_BY_KEY[h.sign].name}`, 714, y, 12));
      if (i % 3 === 0) out.push(text("sans", ["AC", "IC", "DC", "MC"][i / 3], 900, y, 10.5, { fill: C.gold, tracking: 1 }));
    });
    const KY = T + 34 + 12 * 19.5 + 4;
    (["trine", "sextile", "square", "opposition"] as AspectKey[]).forEach((key, i) => {
      const st = ASPECT_STYLE[key]!;
      const x = 660 + i * 108;
      out.push(`<line x1="${x}" y1="${KY - 4}" x2="${x + 26}" y2="${KY - 4}" stroke="${st.color}" stroke-width="1.6"${st.dash ? ` stroke-dasharray="${st.dash}"` : ""}/>`);
      out.push(glyph(key, x + 36, KY - 4, 9, st.color));
      out.push(text("sans", key[0].toUpperCase() + key.slice(1), x + 46, KY, 11, { fill: C.ink2 }));
    });
    out.push(text("sans", "Line weight follows the orb: tighter aspects are heavier.", 660, KY + 18, 10, { fill: C.ink2 }));
  }

  out.push(`</svg>`);
  return out.join("\n");
}
