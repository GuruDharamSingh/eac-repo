// ============================================================================
// The look of a sealed block on one page (2026-11-04, stone 2): `props.morph` on
// the node, in the style vocabulary a box uses (style.ts), compiled to one
// stylesheet scoped by a <template data-morph> marker right before the block's
// root. The block's own code is not touched: it lists its elements as parts.
//
// Pure and server-safe: imported by published pages, the editor and the harness.
// Nothing stored is trusted: the morph is cleaned at render and on save, every
// declaration carries !important because a block's own inline styles and a site's
// layered CSS would otherwise win differently per host, and selectors come from
// the block's declaration, never from the document.
// ============================================================================

import { fontStack, isKnownFont } from "@elkdonis/fonts";
import { GENERIC_ROOT_SEL, hasOwn, PART_NAME, ROOT_PART } from "./contract";
import { lookDecls } from "./patch";
import { balancedCss, cleanStyle, declsToString, safeDecls, type Decl, type PartStyle } from "./style";

export interface NodeMorph {
  v: 1;
  /** Part name → look. */
  parts?: Record<string, PartStyle>;
  /** Custom property → value, on the block's root. A font token holds a library family's name. */
  tokens?: Record<string, string>;
}

/** Structural: BlockDef.parts satisfies it, and direct-edit does not depend on blocks. */
export type MorphParts = Readonly<Record<string, { sel: string }>>;

export interface CompiledMorph {
  /** Hash of the compiled rules: a changed morph cannot leave an old rule matching, and no node id reaches CSS. */
  scope: string;
  css: string;
  /** Library families to load, at most MAX_FONTS. */
  fonts: string[];
}

const MAX_PARTS = 64;
const MAX_TOKENS = 24;
const MAX_FONTS = 4;
const MAX_BYTES = 16 * 1024;
const MAX_VALUE = 160;
const TOKEN_NAME = /^--[a-z][\w-]{0,40}$/;
/** `--blk-font-title`, not `--x-font-size`. A font token holds a library family's name, which the stylesheet writes as a stack and loads. */
export const isFontToken = (name: string) => /-font(?!-(?:size|weight|style|stretch|variant|feature))(?:-|$)/.test(name);

/** Traps a raw `css` string could set on a part: an invisible link could cover the page or catch every click. `safeDecls` keeps these for own boxes, by a decision of 2026-11-02. */
const REFUSED_PROPS = new Set(["position", "z-index", "pointer-events", "cursor", "transform", "rotate"]);
/** `cleanCustomCss`'s list (`page-builder/src/style/schema.ts:175`), plus what a grid needs. Anything else that looks like a function is refused. */
const FUNCTIONS = new Set([
  "calc", "min", "max", "clamp", "rgb", "rgba", "hsl", "hsla", "color-mix", "var",
  "linear-gradient", "radial-gradient", "conic-gradient", "repeating-linear-gradient", "repeating-radial-gradient",
  "translate", "translatex", "translatey", "scale", "scalex", "scaley", "rotate", "skew", "skewx", "skewy",
  "blur", "brightness", "contrast", "saturate", "grayscale", "hue-rotate", "sepia", "invert", "drop-shadow",
  "polygon", "inset", "circle", "ellipse",
  "repeat", "minmax", "fit-content", "span",
]);
const FORBIDDEN = /url\s*\(|image-set|expression|javascript:|attr\s*\(|env\s*\(|src\s*\(|paint\s*\(|@|\\|[{};<>!]|\/\*|\*\/|[\u0000-\u001f\u007f]/i;

/** A value that may sit in a shared stylesheet: it cannot end its rule, load anything, or read a variable it was not given. */
export function sheetSafe(value: string): boolean {
  if (typeof value !== "string" || !value || value.length > MAX_VALUE || FORBIDDEN.test(value) || !balancedCss(value)) return false;
  for (const m of value.matchAll(/([a-z-][a-z0-9-]*)?\s*\(/gi)) {
    const name = (m[1] ?? "").toLowerCase();
    // No name, or calc()'s minus: a bracket inside calc().
    if (name && name !== "-" && !FUNCTIONS.has(name)) return false;
    if (name === "var" && !/^\s*--(blk|eac|dv)-[\w-]+\s*\)/.test(value.slice(m.index! + m[0].length))) return false;
  }
  return true;
}

/** A look as a morph may hold it: the box vocabulary, minus what would take a part out of its block. */
function cleanLook(raw: unknown): PartStyle | undefined {
  const s = cleanStyle(raw);
  if (!s) return undefined;
  if (s.pos === "absolute" || s.pos === "sticky") { delete s.pos; delete s.x; delete s.y; }
  if (s.css) {
    const kept = safeDecls(s.css).filter(([k, v]) => !REFUSED_PROPS.has(k) && !k.startsWith("--") && sheetSafe(v));
    if (kept.length) s.css = declsToString(kept); else delete s.css;
  }
  return Object.keys(s).length ? s : undefined;
}

/** What a stored morph may be. Unknown shapes, names and values are dropped; past the byte cap the whole morph is. */
export function cleanMorph(raw: unknown): NodeMorph | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as { v?: unknown; parts?: unknown; tokens?: unknown };
  if (m.v !== 1) return null;
  const out: NodeMorph = { v: 1 };
  if (m.parts && typeof m.parts === "object" && !Array.isArray(m.parts)) {
    const parts: Record<string, PartStyle> = {};
    let n = 0;
    for (const [name, look] of Object.entries(m.parts as Record<string, unknown>)) {
      if (n >= MAX_PARTS) break;
      // `type`: page walkers (validatePage, stripResolved) take an object with `type` and `props` for a node.
      if (!PART_NAME.test(name) || name === "type") continue;
      const clean = cleanLook(look);
      if (clean) { parts[name] = clean; n++; }
    }
    if (n) out.parts = parts;
  }
  if (m.tokens && typeof m.tokens === "object" && !Array.isArray(m.tokens)) {
    const tokens: Record<string, string> = {};
    let n = 0;
    for (const [name, value] of Object.entries(m.tokens as Record<string, unknown>)) {
      if (n >= MAX_TOKENS) break;
      if (!TOKEN_NAME.test(name) || typeof value !== "string" || !sheetSafe(value)) continue;
      if (isFontToken(name) && !isKnownFont(value)) continue;
      tokens[name] = value;
      n++;
    }
    if (n) out.tokens = tokens;
  }
  if (!out.parts && !out.tokens) return null;
  return JSON.stringify(out).length > MAX_BYTES ? null : out;
}

/** FNV-1a, twice, base 36: the same in a browser and on a server, and no crypto import in a client bundle. */
function hash(text: string): string {
  let a = 0x811c9dc5, b = 0x1505;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b, 33) ^ c;
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

/** A fixed title must not overflow a phone. Only this guard: `textDecls` is unchanged, because classifieds relies on it. */
const guarded = ([k, v]: Decl, s: PartStyle): Decl => (k === "font-size" && s.size !== undefined && s.size > 32 ? [k, `min(${s.size}px, 11vw)`] : [k, v]);

/** These are computed at `:root` from a token (`blocks.css:41-101`), so redefining the token below `:root` does not move them. */
const BG_SOFT = ["--blk-bg-soft", "color-mix(in srgb, var(--blk-fg) 4%, var(--blk-bg))"] as const;
const FIELD_BG = ["--blk-field-bg", "var(--blk-bg-soft)"] as const;
const DERIVED: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = {
  "--blk-accent": [["--blk-accent-ink", "color-mix(in srgb, var(--blk-accent) 60%, black)"]],
  "--blk-fg": [BG_SOFT, FIELD_BG, ["--blk-field-fg", "var(--blk-fg)"]],
  "--blk-bg": [BG_SOFT, FIELD_BG, ["--blk-faint", "color-mix(in srgb, var(--blk-muted) 60%, var(--blk-bg))"]],
};

const SCOPE_MARK = "\u0000";
const rule = (tail: string, decls: Decl[]) => `template[data-morph="${SCOPE_MARK}"] + ${tail}{${decls.map(([k, v]) => `${k}:${v} !important`).join(";")}}`;

/**
 * The stylesheet for one node. A stored part the block no longer declares draws nothing; a block with no declared
 * root has a generic one, so every block has a root look. `editor` keeps a hidden part visible and faint, so it can
 * still be selected. Returns null when nothing would be written.
 */
export function morphCss(m: NodeMorph, parts: MorphParts | undefined, o: { editor?: boolean } = {}): CompiledMorph | null {
  const declared = (name: string) => (parts && hasOwn(parts, name) ? parts[name] : undefined);
  // One complex selector, per the declaration; a broken one must not take the sheet with it.
  const oneSel = (sel: string | undefined) => (sel && !/[,{};<]/.test(sel) ? sel : undefined);
  const root = (oneSel(declared(ROOT_PART)?.sel) ?? GENERIC_ROOT_SEL).replace(/^>\s*/, "");
  const rules: string[] = [];
  const fonts = new Set<string>();

  const tokenDecls: Decl[] = [];
  const set = new Set(Object.keys(m.tokens ?? {}));
  for (const name of [...set].sort()) {
    const value = m.tokens![name]!;
    const font = isFontToken(name) && isKnownFont(value);
    if (font) fonts.add(value);
    tokenDecls.push([name, font ? fontStack(value) : value]);
    for (const [derived, formula] of DERIVED[name] ?? []) {
      if (!set.has(derived) && !tokenDecls.some(([k]) => k === derived)) tokenDecls.push([derived, formula]);
    }
  }
  if (tokenDecls.length) rules.push(rule(root, tokenDecls));

  for (const name of Object.keys(m.parts ?? {}).sort()) {
    const sel = name === ROOT_PART ? root : oneSel(declared(name)?.sel);
    if (!sel) continue;
    const look = m.parts![name]!;
    const decls = lookDecls(look, !!o.editor).map((d) => guarded(d, look));
    if (!decls.length) continue;
    if (look.font && isKnownFont(look.font)) fonts.add(look.font);
    rules.push(rule(name === ROOT_PART ? root : sel.startsWith(">") ? sel.replace(/^>\s*/, "") : `${root} ${sel}`, decls));
  }
  if (!rules.length) return null;

  const body = rules.join("\n");
  const scope = hash(body);
  return { scope, css: body.split(SCOPE_MARK).join(scope), fonts: [...fonts].slice(0, MAX_FONTS) };
}

// ---------------------------------------------------------------------------
// Reading and writing a node's props. An empty morph is removed, not left empty,
// so that a block with no looks publishes as if morph did not exist.
// ---------------------------------------------------------------------------
type Props = Record<string, unknown>;
const stored = (props: Props) => (props.morph && typeof props.morph === "object" && !Array.isArray(props.morph) ? (props.morph as NodeMorph) : null);

function settle(props: Props, m: NodeMorph): void {
  if (m.parts && !Object.keys(m.parts).length) delete m.parts;
  if (m.tokens && !Object.keys(m.tokens).length) delete m.tokens;
  if (m.parts || m.tokens) props.morph = m; else delete props.morph;
}

/** A part's look as stored, or an empty one to write on. */
export function partLookOf(props: Props, part: string): PartStyle {
  const parts = stored(props)?.parts;
  return parts && hasOwn(parts, part) ? parts[part]! : {};
}

export function setPartLook(props: Props, part: string, look: PartStyle): void {
  if (!PART_NAME.test(part)) return;
  const m: NodeMorph = stored(props) ?? { v: 1 };
  const parts = { ...(m.parts ?? {}) };
  if (Object.keys(look).length) parts[part] = look; else delete parts[part];
  settle(props, { ...m, v: 1, parts });
}

export function tokenOf(props: Props, name: string): string | undefined {
  const tokens = stored(props)?.tokens;
  return tokens && hasOwn(tokens, name) ? tokens[name] : undefined;
}

/** undefined removes it. */
export function setToken(props: Props, name: string, value: string | undefined): void {
  const m: NodeMorph = stored(props) ?? { v: 1 };
  const tokens = { ...(m.tokens ?? {}) };
  if (value === undefined) delete tokens[name]; else tokens[name] = value;
  settle(props, { ...m, v: 1, tokens });
}

/** The raw CSS a part's Code tab keeps: the same filter the stylesheet applies. */
export const partSafeDecls = (css: string | undefined): Decl[] => safeDecls(css).filter(([k, v]) => !REFUSED_PROPS.has(k) && !k.startsWith("--") && sheetSafe(v));
