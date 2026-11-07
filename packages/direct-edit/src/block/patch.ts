// ============================================================================
// Visual edits over a page (2026-11-02). The page keeps its own markup, whether
// React, Puck or hard-coded; an edit is a style for one box, addressed by a
// structural selector inside a declared section and drawn as a CSS rule. So the
// server can send the edits in the page's first response with no walk of its
// DOM, removing them restores the page, and the editor's preview and the public
// page draw from this one function.
//
// Words and data are not edited here: CSS cannot change them. They belong to
// declared fields.
//
// Pure, no DOM. Every stored document goes through cleanPatches on the server.
// ============================================================================

import { safeSrc } from "./bind";
import { googleFontsHref } from "@elkdonis/fonts";
import { cleanStyle, partDecls, type Decl, type PartStyle } from "./style";

export interface BoxPatch {
  style?: PartStyle;
  /** Background picture: http(s) or a path on the same site. */
  image?: string;
  /** How the picture fills the box. Default cover. */
  imageFit?: "cover" | "contain";
}

/** Keyed by selector, as selectorFor writes it. */
export interface PagePatches { v: 1; boxes: Record<string, BoxPatch> }

export const emptyPatches = (): PagePatches => ({ v: 1, boxes: {} });

const MAX_BOXES = 200;
const SELECTOR = /^\[data-edit-section="[A-Za-z][\w-]{0,63}"\](?: > [a-z][a-z0-9-]{0,31}:nth-child\(\d{1,4}\)){0,32}$/;
export const isBoxSelector = (s: unknown): s is string => typeof s === "string" && SELECTOR.test(s);

function cleanBox(v: unknown): BoxPatch | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const out: BoxPatch = {};
  const style = cleanStyle(r.style);
  if (style) out.style = style;
  const image = typeof r.image === "string" ? safeSrc(r.image) : null;
  if (image) {
    out.image = image;
    if (r.imageFit === "contain") out.imageFit = "contain";
  }
  return Object.keys(out).length ? out : null;
}

/** Server-side validation: valid selectors only, a known style vocabulary, safe pictures, a cap on size. */
export function cleanPatches(v: unknown): PagePatches {
  const out = emptyPatches();
  const boxes = v && typeof v === "object" ? (v as { boxes?: unknown }).boxes : null;
  if (!boxes || typeof boxes !== "object" || Array.isArray(boxes)) return out;
  let n = 0;
  for (const [sel, raw] of Object.entries(boxes)) {
    if (n >= MAX_BOXES) break;
    if (!isBoxSelector(sel)) continue;
    const box = cleanBox(raw);
    if (box) { out.boxes[sel] = box; n++; }
  }
  return out;
}

/** A background picture. `src` has already passed safeSrc, which rules out quotes. */
export function imageDecls(src: string, fit: "cover" | "contain"): Decl[] {
  return [["background-image", `url("${src}")`], ["background-size", fit], ["background-position", "center"], ["background-repeat", "no-repeat"]];
}

/** What a look draws. `editor` keeps hidden boxes visible and faint, so they can still be selected. */
export function lookDecls(s: PartStyle, editor = false): Decl[] {
  const d = partDecls(s, { editor });
  // A block host's CSS makes containers flex; a real page's box may not be.
  if (s.layout === "stack") d.unshift(["display", "flex"]);
  // A size is what the handle showed, padding and border included, whatever the page's box model.
  if (s.w !== undefined || s.h !== undefined) d.push(["box-sizing", "border-box"]);
  if (s.hide && editor) d.push(["opacity", ".3"]);
  return d;
}

function boxDecls(box: BoxPatch, editor: boolean): Decl[] {
  const d = box.style ? lookDecls(box.style, editor) : [];
  // After the style: its fill is the background shorthand, which would clear a picture set before it.
  if (box.image) d.push(...imageDecls(box.image, box.imageFit ?? "cover"));
  return d;
}

/**
 * The stylesheet for a document. Trusts nothing: runs on stored documents too.
 * Every declaration is !important because the layer overrides whatever the page
 * set, inline styles included. `editor` keeps hidden boxes visible and faint, so
 * they can still be selected.
 */
export function patchCss(doc: PagePatches | null | undefined, opts: { editor?: boolean } = {}): string {
  if (!doc?.boxes) return "";
  const rules: string[] = [];
  for (const [sel, raw] of Object.entries(doc.boxes)) {
    if (!isBoxSelector(sel)) continue;
    const box = cleanBox(raw);
    if (!box) continue;
    const d = boxDecls(box, !!opts.editor);
    if (d.length) rules.push(`${sel}{${d.map(([k, v]) => `${k}:${v.replace(/\s*!important\s*$/i, "")} !important`).join(";")}}`);
  }
  // A closing tag cannot occur in a selector or a cleaned value; this keeps it so if either rule ever widens.
  return rules.join("\n").replace(/<\/(style)/gi, "<\\/$1");
}

/** The stylesheet that loads the fonts a document uses, or null. Only fonts in the library pass cleanStyle. */
export function patchFontsHref(doc: PagePatches | null | undefined): string | null {
  return googleFontsHref(Object.values(doc?.boxes ?? {}).map((b) => b.style?.font));
}
