// ============================================================================
// Showing a theme that has not been saved yet. Client-safe.
//
// Two ways, for two kinds of preview:
//
//   themePreviewVars   an inline style for a preview ELEMENT — every variable
//                      spelled out at its effective value, derived ones too
//                      (see previewColourVars for why).
//
//   applyThemeToDocument
//                      the same values on ANOTHER document's <html> — the live
//                      page in /studio/theme's frame, or Puck's canvas. Inline
//                      on <html> beats the saved `:root{}` <style>, so what the
//                      frame shows is the draft, drawn by the site's own CSS.
// ============================================================================

import { previewColourVars, type Palette } from "./theme";
import { fontsHrefFor, previewFontVars, type SiteFonts } from "./fonts";

export function themePreviewVars(palette: Palette, fonts: SiteFonts): Record<string, string> {
  const vars = { ...previewColourVars(palette), ...previewFontVars(fonts) };
  // One more layer of the same trap: blocks.css declares its own `--blk-*`
  // at :root FROM the `--eac-block-*` ones (`--blk-fg: var(--eac-block-fg…)`),
  // so those resolve at :root too. Each `--eac-block-x` has a `--blk-x` twin.
  for (const [name, value] of Object.entries(vars)) {
    if (name.startsWith("--eac-block-")) vars[`--blk-${name.slice("--eac-block-".length)}`] = value;
  }
  return vars;
}

const APPLIED = "data-dm-theme-draft";
const LINK_ID = "dm-theme-draft-fonts";
// Unset in the draft but perhaps set in the saved theme: `initial` makes the
// variable guaranteed-invalid, so each caption falls back to its own value.
const UNSET_TO_INITIAL = ["--dm-caption-size", "--dm-caption-style"];

export function applyThemeToDocument(doc: Document, palette: Palette, fonts: SiteFonts) {
  const root = doc.documentElement;
  const vars = themePreviewVars(palette, fonts);
  for (const name of UNSET_TO_INITIAL) if (!(name in vars)) vars[name] = "initial";
  clearThemeFromDocument(doc, false);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  root.setAttribute(APPLIED, Object.keys(vars).join(" "));

  const href = fontsHrefFor(fonts);
  let link = doc.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (href) {
    if (!link) {
      link = doc.createElement("link");
      link.id = LINK_ID;
      link.rel = "stylesheet";
      doc.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  } else {
    link?.remove();
  }
}

export function clearThemeFromDocument(doc: Document, removeLink = true) {
  const root = doc.documentElement;
  const names = root.getAttribute(APPLIED);
  if (names) for (const name of names.split(" ")) root.style.removeProperty(name);
  root.removeAttribute(APPLIED);
  if (removeLink) doc.getElementById(LINK_ID)?.remove();
}
