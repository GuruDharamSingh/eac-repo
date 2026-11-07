// Colour helpers for the panel: hex normalising and mixing, and the live
// contrast verdict. The WCAG ratio is the same formula as page-builder's style
// schema, repeated here because this package must not depend on page-builder:
// a host's Puck catalogue takes its box blocks from here.

function hexToRgb(hex: string): [number, number, number] | null {
  if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  let h = hex.slice(1);
  if (h.length <= 4) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
/** WCAG contrast of two literal hex colours; null when either is not one. */
export function contrastRatio(a: string | undefined, b: string | undefined): number | null {
  const ra = a ? hexToRgb(a) : null, rb = b ? hexToRgb(b) : null;
  if (!ra || !rb) return null;
  const la = luminance(ra), lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** `#abc` → `#aabbcc`, lower case; null when not a hex colour. */
export function normHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let s = v.trim().toLowerCase();
  if (!s.startsWith("#")) s = "#" + s;
  if (!HEX_RE.test(s)) return null;
  if (s.length === 4) s = "#" + [...s.slice(1)].map((c) => c + c).join("");
  return s.slice(0, 7);
}

/** `a` mixed with `b`: t = 0 gives a, 1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = normHex(a), pb = normHex(b);
  if (!pa || !pb) return a;
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(pa, i) * (1 - t) + ch(pb, i) * t).toString(16).padStart(2, "0"));
  return "#" + out.join("");
}

export interface ContrastVerdict { ratio: number; good: boolean; large: boolean; text: string }

/**
 * Text colour against its background: WCAG AA, 4.5:1, or 3:1 for large text
 * (24px, or 18.66px bold). null when either colour is unknown.
 */
export function contrastVerdict(fg: string | undefined, bg: string | undefined, sizePx = 16, weight = 400): ContrastVerdict | null {
  const r = contrastRatio(normHex(fg) ?? undefined, normHex(bg) ?? undefined);
  if (r == null) return null;
  const large = sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
  const good = r >= (large ? 3 : 4.5);
  return { ratio: r, good, large, text: `${good ? "Good" : "Poor"} contrast · ${r.toFixed(1)}:1` };
}
