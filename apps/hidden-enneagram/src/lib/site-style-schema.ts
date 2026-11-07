import type { SiteStyleSchema } from "@elkdonis/direct-edit/site";

// ============================================================================
// What an owner may change about this site's look, declared in code; the
// stored style only fills in values (elktours' and katie's pattern). No
// imports beyond a type, so the editor (browser) and the layout (server) can
// both read it.
//
// The colours are the shadcn HSL triplets in app/palette.css. Every --he-*
// token, the shared blocks' --eac-block-* and the surfaces' --eac-surface-*
// are derived from them there, so one colour here restyles the shell, the
// blocks, the figure and the Center together. Text colours carry `on`, so
// the editor warns about hard pairs. The defaults are the ÆON draft's.
// ============================================================================

const BODY = `var(--font-spectral), Georgia, serif`;
const HEADING = `var(--font-marcellus), "Palatino Linotype", serif`;

export const SITE_STYLE: SiteStyleSchema = {
  vars: [
    { name: "--background", label: "Night (page)", group: "Colours", kind: "hsl", default: "230 30% 4%" },
    { name: "--foreground", label: "Ink", group: "Colours", kind: "hsl", default: "45 34% 89%", on: "--background" },
    { name: "--muted-foreground", label: "Quiet ink", group: "Colours", kind: "hsl", default: "42 10% 62%", on: "--background" },
    { name: "--card", label: "Cards and panels", group: "Colours", kind: "hsl", default: "227 30% 9%" },
    { name: "--muted", label: "Wells (fields, quiet panels)", group: "Colours", kind: "hsl", default: "228 31% 6%" },
    { name: "--primary", label: "Gold (accent)", group: "Colours", kind: "hsl", default: "41 57% 61%", hint: "Links, the lit phrase, buttons, the growth line." },
    { name: "--primary-foreground", label: "Text on gold", group: "Colours", kind: "hsl", default: "230 30% 4%", on: "--primary" },
    { name: "--border", label: "Lines", group: "Colours", kind: "hsl", default: "226 25% 20%" },
    { name: "--gut", label: "Gut (8 · 9 · 1)", group: "Figure", kind: "hsl", default: "168 45% 57%", hint: "The figure's first hue: the gut centre and the poles that share its colour." },
    { name: "--heart", label: "Heart (2 · 3 · 4)", group: "Figure", kind: "hsl", default: "8 69% 71%" },
    { name: "--head", label: "Head (5 · 6 · 7)", group: "Figure", kind: "hsl", default: "250 59% 76%" },
    { name: "--stress", label: "Stress line", group: "Figure", kind: "hsl", default: "18 62% 65%" },
    { name: "--site-font-body", label: "Body text", group: "Type", kind: "font", default: BODY, applies: { sel: "body", prop: "font-family" } },
    { name: "--site-font-heading", label: "Headings", group: "Type", kind: "font", default: HEADING, applies: { sel: "h1, h2, h3, h4", prop: "font-family" } },
    { name: "--radius", label: "Corners", group: "Shape", kind: "length", default: "0.5rem", hint: "0 for square, 4px, 0.5rem, 1rem." },
  ],
  fonts: [
    { label: "Spectral (site)", stack: BODY },
    { label: "Marcellus (site)", stack: HEADING },
    { label: "Cormorant Garamond (the Silex pages)", stack: `"Cormorant Garamond", Georgia, serif`, google: "Cormorant Garamond" },
    { label: "EB Garamond", stack: `"EB Garamond", Georgia, serif`, google: "EB Garamond" },
    { label: "Georgia", stack: `Georgia, serif` },
    { label: "System sans", stack: `system-ui, sans-serif` },
    { label: "Jost", stack: `"Jost", system-ui, sans-serif`, google: "Jost" },
  ],
  chrome: {
    header: {
      label: "Header",
      parts: {
        brand: { label: "Site name" },
        links: { label: "Menu links" },
        account: { label: "Account / sign in" },
        menu: { label: "Phone menu" },
      },
    },
    footer: {
      label: "Footer",
      parts: {
        title: { label: "Name" },
        links: { label: "Links" },
        small: { label: "Bottom line" },
      },
    },
  },
};
