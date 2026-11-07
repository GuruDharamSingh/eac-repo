import { createElement, Fragment, type ReactNode } from "react";
import { googleFontsHref, loadFonts } from "@elkdonis/fonts";
import { cleanMorph, morphCss, type MorphParts } from "../block/morph";

// The morph helpers a Puck editor plugin writes with (page-builder's partsPlugin, 2026-11-06):
// page-builder does not depend on this package, so the host passes these.
export { partLookOf, setPartLook, partSafeDecls, setToken, tokenOf } from "../block/morph";

// ============================================================================
// Draws a node's `morph`: the marker the stylesheet is scoped by, right before the
// block's root, and the stylesheet (2026-11-04, stone 2). A host passes this as
// `morph` to buildPuckConfig in both its server and client configs; config.tsx keeps
// no dependency on this package. Server-safe: no hooks; the one DOM call, loadFonts,
// is a no-op on a server.
//
// Published: the sheet is hoisted to <head> by href and precedence, so nodes with one
// morph share one tag, and a font's <link> sits before the marker, because after the
// block it would stop being :last-child (blocks.css:423,1038).
// Editing: a plain <style> in place, because a hoisted sheet is not removed when its
// href changes and typing would add a tag per step. The same element shape with or
// without a look, so the first look set does not remount the block and lose its state.
// Fonts go to <head> through the panel's loader, once per family, so a stored look draws
// its font after a reload and before anything is selected.
// ============================================================================

export function MorphMark({ def, morph, editing, children }: { def: { parts?: MorphParts }; morph: unknown; editing: boolean; children?: ReactNode }): ReactNode {
  const clean = morph ? cleanMorph(morph) : null;
  const c = clean ? morphCss(clean, def.parts, { editor: editing }) : null;
  if (editing) {
    if (c) loadFonts(c.fonts);
    return createElement(Fragment, null,
      c ? createElement("style", null, c.css) : null,
      c ? createElement("template", { "data-morph": c.scope }) : null,
      children);
  }
  if (!c) return children;
  return createElement(Fragment, null,
    c.fonts.map((f) => {
      const href = googleFontsHref([f]);
      return href ? createElement("link", { key: f, rel: "stylesheet", href }) : null;
    }),
    createElement("style", { href: `m-${c.scope}`, precedence: "eac-morph" }, c.css),
    createElement("template", { "data-morph": c.scope }),
    children);
}
