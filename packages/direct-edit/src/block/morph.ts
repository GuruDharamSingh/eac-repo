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

/** The states a part's look may set: written as `:hover`, `:focus-visible` and `:active`. */
export const LOOK_STATES = ["hover", "focus", "active"] as const;
/** The screen sizes a part's look may set: `sm` is a viewport 480px wide or less, `md` 820px or less. */
export const LOOK_SIZES = ["sm", "md"] as const;
export type LookState = (typeof LOOK_STATES)[number];
export type LookSize = (typeof LOOK_SIZES)[number];
/** Where a look applies. Both absent = the base look. A state and a size together are not stored. */
export interface LookWhere { state?: LookState; at?: LookSize }

/** BUILD_SPEC C1: a part's look is PartStyle plus two optional reserved keys. A stored v1 look has neither. */
export type PartLook = PartStyle & {
  states?: Partial<Record<LookState, PartStyle>>;
  at?: Partial<Record<LookSize, PartStyle>>;
};

export interface NodeMorph {
  v: 1;
  /** Part name → look. */
  parts?: Record<string, PartLook>;
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
function cleanBase(raw: unknown): PartStyle | undefined {
  const s = cleanStyle(raw);
  if (!s) return undefined;
  if (s.pos === "absolute" || s.pos === "sticky") { delete s.pos; delete s.x; delete s.y; }
  if (s.css) {
    const kept = safeDecls(s.css).filter(([k, v]) => !REFUSED_PROPS.has(k) && !k.startsWith("--") && sheetSafe(v));
    if (kept.length) s.css = declsToString(kept); else delete s.css;
  }
  return Object.keys(s).length ? s : undefined;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * A part's look: the base look, plus its states and screen sizes. Each of those is the same vocabulary, cleaned the
 * same way, and holds no states or sizes of its own. A state cannot hide its part: a part that vanishes on hover loses
 * the hover and flickers. A screen size may (hide on phones).
 */
function cleanLook(raw: unknown): PartLook | undefined {
  const base = cleanBase(raw);
  const r = isObj(raw) ? raw : {};
  const out: PartLook = { ...(base ?? {}) };
  if (isObj(r.states)) {
    const states: Partial<Record<LookState, PartStyle>> = {};
    for (const k of LOOK_STATES) {
      const c = hasOwn(r.states, k) ? cleanBase(r.states[k]) : undefined;
      if (c) { delete c.hide; if (Object.keys(c).length) states[k] = c; }
    }
    if (Object.keys(states).length) out.states = states;
  }
  if (isObj(r.at)) {
    const at: Partial<Record<LookSize, PartStyle>> = {};
    for (const k of LOOK_SIZES) {
      const c = hasOwn(r.at, k) ? cleanBase(r.at[k]) : undefined;
      if (c) at[k] = c;
    }
    if (Object.keys(at).length) out.at = at;
  }
  return Object.keys(out).length ? out : undefined;
}

/** What a stored morph may be. Unknown shapes, names and values are dropped; past the byte cap the whole morph is. */
export function cleanMorph(raw: unknown): NodeMorph | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as { v?: unknown; parts?: unknown; tokens?: unknown };
  if (m.v !== 1) return null;
  const out: NodeMorph = { v: 1 };
  if (m.parts && typeof m.parts === "object" && !Array.isArray(m.parts)) {
    const parts: Record<string, PartLook> = {};
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

/** Screen sizes are viewport media queries, not container queries: a container query needs an ancestor with `container-type`, and a block's root has none the stylesheet could count on (it must not add one: size containment changes layout). */
const WIDTH: Record<LookSize, number> = { sm: 480, md: 820 };
const PSEUDO: Record<LookState, string> = { hover: ":hover", focus: ":focus-visible", active: ":active" };

const SCOPE_MARK = "\u0000";
const ruleOf = (tails: string[], decls: Decl[]) => `${tails.map((t) => `template[data-morph="${SCOPE_MARK}"] + ${t}`).join(",")}{${decls.map(([k, v]) => `${k}:${v} !important`).join(";")}}`;
const rule = (tail: string, decls: Decl[]) => ruleOf([tail], decls);
/** A pseudo-class cannot follow a pseudo-element, and an attribute cannot either. */
const PSEUDO_ELEMENT = /::|:(?:before|after|first-line|first-letter)\b/;

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

  const names = Object.keys(m.parts ?? {}).sort();
  const tailOf = (name: string, sel: string) => (name === ROOT_PART ? root : sel.startsWith(">") ? sel.replace(/^>\s*/, "") : `${root} ${sel}`);
  const declsOf = (look: PartStyle) => lookDecls(look, !!o.editor).map((d) => guarded(d, look));
  const addFont = (look: PartStyle) => { if (look.font && isKnownFont(look.font)) fonts.add(look.font); };

  // Base rules first, exactly as a v1 look compiled before states and sizes existed.
  for (const name of names) {
    const sel = name === ROOT_PART ? root : oneSel(declared(name)?.sel);
    if (!sel) continue;
    const look = m.parts![name]!;
    const decls = declsOf(look);
    if (!decls.length) continue;
    addFont(look);
    rules.push(rule(tailOf(name, sel), decls));
  }

  // Editor only (`editor: true`; lane LIVE): the panel shows the look it is editing by marking that part's elements, because a
  // hover or a phone look cannot be seen unless it is happening. `data-de-at` holds the sizes in force ("sm md": a phone is a
  // tablet too). Written before the states, so a real hover still wins, as it does on the page. A public page never has these.
  if (o.editor) {
    for (const size of [...LOOK_SIZES].reverse()) {
      for (const name of names) {
        const sel = name === ROOT_PART ? root : oneSel(declared(name)?.sel);
        const look = m.parts![name]!.at?.[size];
        if (!sel || !look || PSEUDO_ELEMENT.test(sel)) continue;
        const decls = declsOf(look);
        if (decls.length) rules.push(rule(`${tailOf(name, sel)}[data-de-at~="${size}"]`, decls));
      }
    }
  }

  // Then states (hover, focus, active: a later one wins a tie), then screen sizes (md, then sm, so the narrower wins).
  // A state rule is more specific than a base rule, so it wins over a size rule too, on purpose: hover stays hover.
  for (const state of LOOK_STATES) {
    for (const name of names) {
      const sel = name === ROOT_PART ? root : oneSel(declared(name)?.sel);
      const look = m.parts![name]!.states?.[state];
      // A pseudo-class cannot follow a pseudo-element.
      if (!sel || !look || /::|:(?:before|after|first-line|first-letter)\b/.test(sel)) continue;
      const decls = declsOf(look);
      if (!decls.length) continue;
      addFont(look);
      rules.push(ruleOf(o.editor ? [tailOf(name, sel) + PSEUDO[state], `${tailOf(name, sel)}[data-de-force~="${state}"]`] : [tailOf(name, sel) + PSEUDO[state]], decls));
    }
  }
  for (const size of [...LOOK_SIZES].reverse()) {
    const inner: string[] = [];
    for (const name of names) {
      const sel = name === ROOT_PART ? root : oneSel(declared(name)?.sel);
      const look = m.parts![name]!.at?.[size];
      if (!sel || !look) continue;
      const decls = declsOf(look);
      if (!decls.length) continue;
      addFont(look);
      inner.push(rule(tailOf(name, sel), decls));
    }
    if (inner.length) rules.push(`@media (max-width:${WIDTH[size]}px){${inner.join("")}}`);
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

const RESERVED = ["states", "at"] as const;
/** A look without the reserved keys: what a base, state or size look is made of. */
const bare = (look: PartStyle): PartStyle => {
  const out: Record<string, unknown> = { ...look };
  for (const k of RESERVED) delete out[k];
  return out as PartStyle;
};
const hasKeys = (o: object | undefined): o is object => !!o && Object.keys(o).length > 0;

/** A part's look at one place: the base look (no `where`, or an empty one), one state, or one screen size. `{}` when nothing is stored, or when both a state and a size are asked for. */
export function partLookAt(props: Props, part: string, where: LookWhere = {}): PartStyle {
  const parts = stored(props)?.parts;
  const look = parts && hasOwn(parts, part) ? parts[part]! : undefined;
  if (!look || (where.state && where.at)) return {};
  if (where.state) return (hasOwn(look.states ?? {}, where.state) ? look.states![where.state] : undefined) ?? {};
  if (where.at) return (hasOwn(look.at ?? {}, where.at) ? look.at![where.at] : undefined) ?? {};
  return look.states || look.at ? bare(look) : look;
}

/**
 * Writes one look: the base look, one state, or one screen size; the others are kept. An empty `look` removes just that one.
 * A state and a size together, or a bad part name, write nothing and return false. A given look's own `states` or `at` are ignored.
 */
export function setPartLookAt(props: Props, part: string, where: LookWhere, look: PartStyle): boolean {
  if (!PART_NAME.test(part) || (where.state && where.at)) return false;
  if (where.state && !(LOOK_STATES as readonly string[]).includes(where.state)) return false;
  if (where.at && !(LOOK_SIZES as readonly string[]).includes(where.at)) return false;
  const m: NodeMorph = stored(props) ?? { v: 1 };
  const parts = { ...(m.parts ?? {}) };
  const cur: PartLook = hasOwn(parts, part) ? parts[part]! : {};
  const given = bare(look);
  let base = bare(cur), states = cur.states, at = cur.at;
  if (where.state) {
    states = { ...(states ?? {}) };
    if (hasKeys(given)) states[where.state] = given; else delete states[where.state];
  } else if (where.at) {
    at = { ...(at ?? {}) };
    if (hasKeys(given)) at[where.at] = given; else delete at[where.at];
  } else base = given;
  const next: PartLook = { ...base };
  if (hasKeys(states)) next.states = states;
  if (hasKeys(at)) next.at = at;
  if (Object.keys(next).length) parts[part] = next; else delete parts[part];
  settle(props, { ...m, v: 1, parts });
  return true;
}

/** A part's base look as stored, or an empty one to write on. Its states and screen sizes are read with `partLookAt`. */
export function partLookOf(props: Props, part: string): PartStyle {
  return partLookAt(props, part, {});
}

/** Writes a part's base look; its states and screen sizes stay. An empty look removes the base look only (`clearPartLook` removes them all). */
export function setPartLook(props: Props, part: string, look: PartStyle): void {
  setPartLookAt(props, part, {}, look);
}

/** Removes a part's whole look: base, states and sizes. */
export function clearPartLook(props: Props, part: string): void {
  const m = stored(props);
  if (!m?.parts || !hasOwn(m.parts, part)) return;
  const parts = { ...m.parts };
  delete parts[part];
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
