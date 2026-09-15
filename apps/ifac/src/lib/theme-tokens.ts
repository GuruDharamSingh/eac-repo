import type { CssVarDef } from "@elkdonis/live-editor";

/**
 * The variables an IFAC admin (whole site) or a member (their own pages) may
 * change.
 *
 * IFAC has its own palette vocabulary (--ink/--paper/--oxide), not the shadcn
 * set the other apps use — which is exactly why site_themes.vars is an untyped
 * map. These are the tokens defined at the top of globals.css and consumed by
 * every panel, card and rule in the sheet.
 *
 * Hex values, so the panel gives a colour picker. --ink-soft and the remaining
 * accents are deliberately left out: they exist to stay in relation to the
 * ones above, and exposing every colour is how a site ends up unreadable.
 *
 * `group` is only a heading in the full panel. Which variables a given
 * section offers through its style pin is declared on the element
 * (data-theme-vars="--frame,--frame-width") — see StyleOverlay.
 */
export const IFAC_THEME_VARS: CssVarDef[] = [
  { name: "--paper", label: "Page background", type: "color", default: "#f8f5ef", group: "Palette",
    hint: "The warm ground behind everything." },
  { name: "--surface", label: "Panel background", type: "color", default: "#fffdf8", group: "Palette" },
  { name: "--ink", label: "Text", type: "color", default: "#171615", group: "Palette" },
  { name: "--line", label: "Rules & borders", type: "color", default: "#d8d0c2", group: "Palette" },
  { name: "--oxide", label: "Accent (rust)", type: "color", default: "#9a3f2f", group: "Palette",
    hint: "Links, emphasis, the sign-out action." },
  { name: "--gold", label: "Accent (gold)", type: "color", default: "#c79a42", group: "Palette" },
  { name: "--blue", label: "Accent (blue)", type: "color", default: "#273d54", group: "Palette" },
  { name: "--moss", label: "Accent (moss)", type: "color", default: "#596b55", group: "Palette" },
  { name: "--frame", label: "Frame colour", type: "color", default: "#9c40d8", group: "Frames",
    hint: "The border around panels, sidebars, galleries and the footer." },
  { name: "--frame-soft", label: "Inner rule colour", type: "color", default: "#40215c", group: "Frames",
    hint: "The thinner rule inside frames — around portraits and cards." },
  { name: "--frame-width", label: "Frame width", type: "length", default: "2px", min: 0, max: 8, step: 1, unit: "px", group: "Frames" },
];

/** The frame variables, for elements that carry a style pin. */
export const FRAME_THEME_VARS = "--frame,--frame-width,--frame-soft";

/** Scopes an admin can theme. Keys match the `pageKey` each page renders with. */
export const IFAC_THEMEABLE_PAGES: Array<{ key: string; label: string }> = [
  { key: "", label: "Whole site" },
  { key: "hub", label: "Members' hub" },
];
