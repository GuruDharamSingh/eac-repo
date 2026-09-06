import type { CssVarDef } from "@elkdonis/live-editor";

/**
 * The variables an IFAC admin may change.
 *
 * IFAC has its own palette vocabulary (--ink/--paper/--oxide), not the shadcn
 * set the other apps use — which is exactly why site_themes.vars is an untyped
 * map. These are the tokens defined at the top of globals.css and consumed by
 * every panel, card and rule in the sheet.
 *
 * Hex values, so the panel gives a colour picker. --ink-soft and the remaining
 * accents are deliberately left out: they exist to stay in relation to the
 * ones above, and exposing every colour is how a site ends up unreadable.
 */
export const IFAC_THEME_VARS: CssVarDef[] = [
  { name: "--paper", label: "Page background", type: "color", default: "#f8f5ef",
    hint: "The warm ground behind everything." },
  { name: "--surface", label: "Panel background", type: "color", default: "#fffdf8" },
  { name: "--ink", label: "Text", type: "color", default: "#171615" },
  { name: "--line", label: "Rules & borders", type: "color", default: "#d8d0c2" },
  { name: "--oxide", label: "Accent (rust)", type: "color", default: "#9a3f2f",
    hint: "Links, emphasis, the sign-out action." },
  { name: "--gold", label: "Accent (gold)", type: "color", default: "#c79a42" },
  { name: "--blue", label: "Accent (blue)", type: "color", default: "#273d54" },
  { name: "--moss", label: "Accent (moss)", type: "color", default: "#596b55" },
];

/** Scopes an admin can theme. Keys match the `pageKey` each page renders with. */
export const IFAC_THEMEABLE_PAGES: Array<{ key: string; label: string }> = [
  { key: "", label: "Whole site" },
  { key: "hub", label: "Members' hub" },
];
