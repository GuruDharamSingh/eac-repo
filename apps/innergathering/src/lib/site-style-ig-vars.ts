import type { SiteFont, SiteVar } from "@elkdonis/direct-edit/site";

// Generated 2026-11-20 from the literals landing.css, globals.css, offering-call.css and a few components
// used to write directly. Every default is that literal; see the :root block in app/globals.css.
// Palette groups are folded under "More colours". The translucent (--ig-a-*) colours live in site-style-ig-alpha.ts.

export const IG_COLOUR_VARS: readonly SiteVar[] = [
  { name: "--ig-c-navy-deep", label: "Deep navy (ink, dark grounds)", group: "Palette · Navy and ink", kind: "color", fold: "More colours", default: "#01124e", hint: "Used 62× in footer dialog, globals.css, landing page, landing.css, offering-call.css." },
  { name: "--ig-c-navy", label: "Navy", group: "Palette · Navy and ink", kind: "color", fold: "More colours", default: "#022278", hint: "Used 23× in globals.css, landing page, landing.css." },
  { name: "--ig-c-navy-soft", label: "Soft navy", group: "Palette · Navy and ink", kind: "color", fold: "More colours", default: "#063179", hint: "Used 8× in about page, globals.css, landing.css." },
  { name: "--ig-c-blue", label: "Blue (quiet text)", group: "Palette · Navy and ink", kind: "color", fold: "More colours", default: "#104b8c", hint: "Used 6× in globals.css." },
  { name: "--ig-c-slate", label: "Slate blue", group: "Palette · Navy and ink", kind: "color", fold: "More colours", default: "#4b5f85", hint: "Used 4× in landing.css." },
  { name: "--ig-c-mist", label: "Blue mist", group: "Palette · Navy and ink", kind: "color", fold: "More colours", default: "#c9d2e8", hint: "Used 2× in landing.css." },
  { name: "--ig-c-slate-3", label: "Slate shade 3", group: "Palette · Navy and ink", kind: "color", fold: "More colours", default: "#2c3d61", hint: "Used 1× in landing.css." },
  { name: "--ig-c-slate-2", label: "Slate shade 2", group: "Palette · Navy and ink", kind: "color", fold: "More colours", default: "#33456b", hint: "Used 1× in landing.css." },
  { name: "--ig-c-slate-4", label: "Slate shade 4", group: "Palette · Navy and ink", kind: "color", fold: "More colours", default: "#22325c", hint: "Used 1× in landing.css." },
  { name: "--ig-c-gold", label: "Gold", group: "Palette · Gold", kind: "color", fold: "More colours", default: "#b79a55", hint: "Used 20× in footer dialog, globals.css, landing page, landing.css." },
  { name: "--ig-c-gold-light", label: "Light gold", group: "Palette · Gold", kind: "color", fold: "More colours", default: "#d6c38e", hint: "Used 20× in footer dialog, globals.css, landing.css." },
  { name: "--ig-c-gold-dark", label: "Dark gold", group: "Palette · Gold", kind: "color", fold: "More colours", default: "#8f763c", hint: "Used 11× in globals.css, landing page, landing.css." },
  { name: "--ig-c-gold-deep", label: "Deep gold", group: "Palette · Gold", kind: "color", fold: "More colours", default: "#7a6431", hint: "Used 3× in landing.css." },
  { name: "--ig-c-gold-pale", label: "Pale gold", group: "Palette · Gold", kind: "color", fold: "More colours", default: "#f0db9d", hint: "Used 2× in globals.css." },
  { name: "--ig-c-gold-bright", label: "Bright gold", group: "Palette · Gold", kind: "color", fold: "More colours", default: "#c9a962", hint: "Used 1× in landing.css." },
  { name: "--ig-c-paper", label: "Paper", group: "Palette · Parchment and paper", kind: "color", fold: "More colours", default: "#fffdf8", hint: "Used 18× in footer dialog, globals.css, landing.css." },
  { name: "--ig-c-parchment", label: "Parchment", group: "Palette · Parchment and paper", kind: "color", fold: "More colours", default: "#fbf7ef", hint: "Used 12× in footer dialog, globals.css, landing.css." },
  { name: "--ig-c-section", label: "Section tint", group: "Palette · Parchment and paper", kind: "color", fold: "More colours", default: "#f3eadc", hint: "Used 8× in globals.css, landing.css." },
  { name: "--ig-c-oxblood", label: "Brown (oxblood)", group: "Palette · Parchment and paper", kind: "color", fold: "More colours", default: "#6e5f4d", hint: "Used 1× in landing.css." },
  { name: "--ig-c-red-dark", label: "Error red", group: "Palette · Violet, red and green", kind: "color", fold: "More colours", default: "#8b2e2e", hint: "Used 4× in footer dialog, globals.css." },
  { name: "--ig-c-violet-light", label: "Light violet", group: "Palette · Violet, red and green", kind: "color", fold: "More colours", default: "#a78bfa", hint: "Used 2× in landing.css." },
  { name: "--ig-c-moss", label: "Moss", group: "Palette · Violet, red and green", kind: "color", fold: "More colours", default: "#64726a", hint: "Used 1× in landing.css." },
  { name: "--ig-c-violet", label: "Violet", group: "Palette · Violet, red and green", kind: "color", fold: "More colours", default: "#7c3aed", hint: "Used 1× in landing.css." },
  { name: "--ig-c-grey-500", label: "Grey 500", group: "Palette · Greys", kind: "color", fold: "More colours", default: "#6b7280", hint: "Used 3× in landing.css." },
  { name: "--ig-c-grey-300", label: "Grey 300", group: "Palette · Greys", kind: "color", fold: "More colours", default: "#d1d5db", hint: "Used 2× in landing.css." },
  { name: "--ig-c-grey-100", label: "Grey 100", group: "Palette · Greys", kind: "color", fold: "More colours", default: "#f3f4f6", hint: "Used 1× in landing.css." },
  { name: "--ig-c-grey-400", label: "Grey 400", group: "Palette · Greys", kind: "color", fold: "More colours", default: "#9ca3af", hint: "Used 1× in landing.css." },
  { name: "--ig-c-black-soft", label: "Soft black", group: "Palette · Dark grounds and white", kind: "color", fold: "More colours", default: "#050505", hint: "Used 3× in landing.css." },
  { name: "--ig-c-black-warm", label: "Warm black", group: "Palette · Dark grounds and white", kind: "color", fold: "More colours", default: "#0a0a08", hint: "Used 2× in landing.css." },
  { name: "--ig-c-black", label: "Black", group: "Palette · Dark grounds and white", kind: "color", fold: "More colours", default: "#000", hint: "Used 1× in landing.css." },
  { name: "--ig-c-white-short", label: "White (short form)", group: "Palette · Dark grounds and white", kind: "color", fold: "More colours", default: "#fff", hint: "Used 1× in offering-call.css." },
  { name: "--ig-c-x-f6efe2", label: "Shade #f6efe2", group: "Palette · Other shades", kind: "color", fold: "More colours", default: "#f6efe2", hint: "Used 2× in landing.css, offering-call.css." },
  { name: "--ig-c-x-e8dcc8", label: "Shade #e8dcc8", group: "Palette · Other shades", kind: "color", fold: "More colours", default: "#e8dcc8", hint: "Used 1× in landing.css." },
  { name: "--ig-c-x-e9dfcc", label: "Shade #e9dfcc", group: "Palette · Other shades", kind: "color", fold: "More colours", default: "#e9dfcc", hint: "Used 1× in landing.css." },
  { name: "--ig-c-x-e3d3a6", label: "Shade #e3d3a6", group: "Palette · Other shades", kind: "color", fold: "More colours", default: "#e3d3a6", hint: "Used 1× in landing.css." },
  { name: "--ig-c-x-b9e0b0", label: "Shade #b9e0b0", group: "Palette · Other shades", kind: "color", fold: "More colours", default: "#b9e0b0", hint: "Used 1× in landing.css." },
  { name: "--ig-c-x-ffb4a8", label: "Shade #ffb4a8", group: "Palette · Other shades", kind: "color", fold: "More colours", default: "#ffb4a8", hint: "Used 1× in landing.css." },
  { name: "--ig-c-x-5a5240", label: "Shade #5a5240", group: "Palette · Other shades", kind: "color", fold: "More colours", default: "#5a5240", hint: "Used 1× in landing page." },
  { name: "--ig-c-x-2a5a2a", label: "Shade #2a5a2a", group: "Palette · Other shades", kind: "color", fold: "More colours", default: "#2a5a2a", hint: "Used 1× in landing page." },
  { name: "--ig-c-x-dde8d0", label: "Shade #dde8d0", group: "Palette · Other shades", kind: "color", fold: "More colours", default: "#dde8d0", hint: "Used 1× in landing page." },
  { name: "--ig-c-x-f4c430", label: "Shade #f4c430", group: "Palette · Other shades", kind: "color", fold: "More colours", default: "#f4c430", hint: "Used 1× in feed banner." },
];

export const IG_FONT_VARS: readonly SiteVar[] = [
  { name: "--ig-font-text", label: "Landing and workshop text", group: "Type", kind: "font", default: "\"Basteleur\", Georgia, serif" },
  { name: "--ig-font-brothers", label: "Landing section headings (Brothers)", group: "Type", kind: "font", default: "\"Brothers\", sans-serif" },
  { name: "--ig-font-display", label: "Display (Brothers over Venture)", group: "Type", kind: "font", default: "\"Brothers\", \"Venture\", sans-serif" },
  { name: "--ig-font-crimson", label: "Crimson text", group: "Type", kind: "font", default: "'Crimson Text', Georgia, serif" },
  { name: "--ig-font-mono", label: "Monospace", group: "Type", kind: "font", default: "ui-monospace, \"SF Mono\", Menlo, monospace" },
];

/** Faces the extra font variables may take, beside the schema's own list. */
export const IG_FONTS: readonly SiteFont[] = [
  { label: "Basteleur (short stack)", stack: "\"Basteleur\", Georgia, serif" },
  { label: "Brothers (sans fallback)", stack: "\"Brothers\", sans-serif" },
  { label: "Crimson Text", stack: "'Crimson Text', Georgia, serif", google: "Crimson Text" },
  { label: "Monospace", stack: "ui-monospace, \"SF Mono\", Menlo, monospace" },
];
