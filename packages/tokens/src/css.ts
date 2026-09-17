import type {
  DtcgColor,
  DtcgDimension,
  DtcgDuration,
  ImportIssue,
  ResolvedToken,
} from "./types";

// ============================================================================
// A resolved token becomes one or more CSS declarations.
//
// One token usually means one custom property. The COMPOSITE types are the
// exception: a `typography` token holds a family, a size, a weight and a line
// height, and squeezing those into a single `font:` shorthand would make them
// unusable individually — you could not set just the size on a heading. So
// composites EXPAND into several properties, suffixed by their part. That is
// also what Style Dictionary does, so a file round-trips recognisably.
//
// Anything we cannot faithfully express is dropped and reported. Never guessed:
// a colour we invent is worse than a colour that is visibly missing.
// ============================================================================

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Trim float noise: 0.30000000000000004 → 0.3 */
const num = (n: number): string => String(Math.round(n * 1e4) / 1e4);

/** Component ranges differ per space, so each space formats its own. */
function colorToCss(value: DtcgColor): string | null {
  const { colorSpace, components, alpha, hex } = value;
  if (!Array.isArray(components)) return hex ?? null;

  // "none" is legal in any component and means "not specified" — CSS Color 4
  // accepts the same keyword, so it passes straight through.
  const parts = components.map((c) => (c === "none" ? "none" : isNum(c) ? c : null));
  if (parts.some((p) => p === null)) return hex ?? null;

  const a = isNum(alpha) && alpha < 1 ? ` / ${num(alpha)}` : "";
  const f = (i: number, scale = 1) => {
    const p = parts[i];
    if (p === "none") return "none";
    const n = (p as number) * scale;
    // sRGB channels are conventionally whole numbers in CSS, and rounding is
    // not a loss here: 0.596 × 255 = 151.98 → 152 → 0x98, which reproduces the
    // file's own hex fallback exactly. Leaving the fraction in produces
    // `rgb(151.98 …)`, which is valid and reads like a bug.
    return num(scale === 255 ? Math.round(n) : n);
  };

  switch (colorSpace) {
    // sRGB components are 0–1 in DTCG but 0–255 in CSS rgb().
    case "srgb":
      return `rgb(${f(0, 255)} ${f(1, 255)} ${f(2, 255)}${a})`;
    case "hsl":
      return `hsl(${f(0)} ${f(1)}% ${f(2)}%${a})`;
    case "hwb":
      return `hwb(${f(0)} ${f(1)}% ${f(2)}%${a})`;
    case "lab":
      return `lab(${f(0)}% ${f(1)} ${f(2)}${a})`;
    case "lch":
      return `lch(${f(0)}% ${f(1)} ${f(2)}${a})`;
    case "oklab":
      return `oklab(${f(0)} ${f(1)} ${f(2)}${a})`;
    case "oklch":
      return `oklch(${f(0)} ${f(1)} ${f(2)}${a})`;
    // The predefined spaces all share the color() function.
    case "srgb-linear":
    case "display-p3":
    case "a98-rgb":
    case "prophoto-rgb":
    case "rec2020":
    case "xyz-d65":
    case "xyz-d50":
      return `color(${colorSpace} ${f(0)} ${f(1)} ${f(2)}${a})`;
    default:
      // An unrecognised space is exactly where the hex fallback earns its place.
      return hex ?? null;
  }
}

const dimensionToCss = (v: DtcgDimension): string | null =>
  isNum(v?.value) && (v.unit === "px" || v.unit === "rem") ? `${num(v.value)}${v.unit}` : null;

const durationToCss = (v: DtcgDuration): string | null =>
  isNum(v?.value) && (v.unit === "ms" || v.unit === "s") ? `${num(v.value)}${v.unit}` : null;

/**
 * A family name needs quoting unless it is a sequence of valid CSS identifiers.
 *
 * This matters more than it looks: the sanitizer that guards site_themes
 * rejects quote characters outright, so a quoted stack is silently dropped at
 * save time. Quoting only where CSS actually requires it keeps the common case
 * ("Georgia, serif") storable, and makes the unstorable case ("Source Sans 3")
 * visible rather than mysterious.
 */
function familyToCss(name: string): string {
  const safe = /^[A-Za-z_][A-Za-z0-9_-]*(\s+[A-Za-z_][A-Za-z0-9_-]*)*$/.test(name.trim());
  return safe ? name.trim() : `"${name.trim()}"`;
}

const fontFamilyToCss = (v: unknown): string | null => {
  const list = Array.isArray(v) ? v : typeof v === "string" ? [v] : null;
  if (!list || list.some((f) => typeof f !== "string")) return null;
  return list.map((f) => familyToCss(f as string)).join(", ");
};

const cubicBezierToCss = (v: unknown): string | null =>
  Array.isArray(v) && v.length === 4 && v.every(isNum)
    ? `cubic-bezier(${v.map(num).join(", ")})`
    : null;

function shadowToCss(v: unknown): string | null {
  const one = (s: Record<string, unknown>): string | null => {
    const color = colorToCss(s.color as DtcgColor);
    const x = dimensionToCss(s.offsetX as DtcgDimension);
    const y = dimensionToCss(s.offsetY as DtcgDimension);
    const blur = dimensionToCss(s.blur as DtcgDimension) ?? "0";
    const spread = dimensionToCss(s.spread as DtcgDimension) ?? "0";
    if (!color || !x || !y) return null;
    return `${s.inset ? "inset " : ""}${x} ${y} ${blur} ${spread} ${color}`;
  };
  // A shadow token may be one shadow or a stack of them.
  const list = Array.isArray(v) ? v : [v];
  const parts = list.map((s) => one(s as Record<string, unknown>));
  return parts.some((p) => p === null) ? null : parts.join(", ");
}

function borderToCss(v: unknown): string | null {
  const b = v as Record<string, unknown>;
  const width = dimensionToCss(b?.width as DtcgDimension);
  const color = colorToCss(b?.color as DtcgColor);
  // Only the keyword form of strokeStyle maps to a border-style. The object
  // form (dashArray + lineCap) has no border equivalent in CSS at all.
  const style = typeof b?.style === "string" ? b.style : null;
  return width && color && style ? `${width} ${style} ${color}` : null;
}

function gradientToCss(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const stops = v.map((s) => {
    const stop = s as Record<string, unknown>;
    const color = colorToCss(stop.color as DtcgColor);
    if (!color) return null;
    // DTCG positions are 0–1; CSS wants a percentage.
    return isNum(stop.position) ? `${color} ${num(stop.position * 100)}%` : color;
  });
  if (stops.some((s) => s === null)) return null;
  // DTCG gradients carry stops but NO direction, so a direction has to be
  // chosen. `to bottom` is CSS's own default and the least surprising.
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

function transitionToCss(v: unknown): string | null {
  const t = v as Record<string, unknown>;
  const duration = durationToCss(t?.duration as DtcgDuration);
  if (!duration) return null;
  const timing = cubicBezierToCss(t?.timingFunction) ?? "ease";
  const delay = durationToCss(t?.delay as DtcgDuration);
  // CSS order is duration, timing, delay — a delay written before the timing
  // function would be read as the duration.
  return [duration, timing, delay].filter(Boolean).join(" ");
}

/** The parts a typography token expands into, and their CSS property names. */
const TYPOGRAPHY_PARTS: Record<string, string> = {
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  lineHeight: "line-height",
  letterSpacing: "letter-spacing",
};

/**
 * One token → one or more `[suffix, value]` pairs.
 *
 * The suffix is empty for everything except composites, which expand.
 */
export function tokenToCss(
  token: ResolvedToken,
  issues: ImportIssue[]
): [suffix: string, value: string][] {
  const path = token.path.join(".");
  const fail = (message: string): [] => {
    issues.push({ path, kind: "bad-value", message });
    return [];
  };
  const one = (v: string | null, what: string) => (v === null ? fail(`Could not read ${what}.`) : [["", v] as [string, string]]);

  switch (token.type) {
    case "color":
      return one(colorToCss(token.value as DtcgColor), "colour");
    case "dimension":
      return one(dimensionToCss(token.value as DtcgDimension), "dimension");
    case "duration":
      return one(durationToCss(token.value as DtcgDuration), "duration");
    case "fontFamily":
      return one(fontFamilyToCss(token.value), "font family");
    case "cubicBezier":
      return one(cubicBezierToCss(token.value), "cubic bezier");
    case "shadow":
      return one(shadowToCss(token.value), "shadow");
    case "border":
      return one(borderToCss(token.value), "border");
    case "gradient":
      return one(gradientToCss(token.value), "gradient");
    case "transition":
      return one(transitionToCss(token.value), "transition");

    case "fontWeight":
      // Numeric 1–1000 or a keyword; both are valid CSS as-is.
      if (isNum(token.value)) return [["", num(token.value)]];
      if (typeof token.value === "string") return [["", token.value]];
      return fail("Font weight is neither a number nor a keyword.");

    case "number":
      return isNum(token.value) ? [["", num(token.value)]] : fail("Not a number.");

    case "strokeStyle":
      if (typeof token.value === "string") return [["", token.value]];
      issues.push({
        path,
        kind: "unsupported",
        message: "Only the keyword form of strokeStyle maps to CSS; the dashArray form has no border equivalent.",
      });
      return [];

    case "typography": {
      const v = token.value as Record<string, unknown>;
      if (!v || typeof v !== "object") return fail("Typography value is not an object.");
      const out: [string, string][] = [];
      for (const [key, prop] of Object.entries(TYPOGRAPHY_PARTS)) {
        if (!(key in v)) continue;
        const raw = v[key];
        let css: string | null = null;
        if (key === "fontFamily") css = fontFamilyToCss(raw);
        else if (key === "fontWeight") css = isNum(raw) ? num(raw) : typeof raw === "string" ? raw : null;
        else if (key === "lineHeight") css = isNum(raw) ? num(raw) : dimensionToCss(raw as DtcgDimension);
        else css = dimensionToCss(raw as DtcgDimension);
        if (css === null) {
          issues.push({ path, kind: "bad-value", message: `Could not read ${prop}.` });
          continue;
        }
        out.push([`-${prop}`, css]);
      }
      return out;
    }

    case "":
      issues.push({
        path,
        kind: "unknown-type",
        message: "No $type on the token, its groups, or anything it aliases.",
      });
      return [];

    default:
      issues.push({
        path,
        kind: "unknown-type",
        message: `Unrecognised $type "${token.type}".`,
      });
      return [];
  }
}
