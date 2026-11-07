import type { SiteStyleSchema } from "@elkdonis/direct-edit/site";

// ============================================================================
// What an owner may change about this site's look (2026-11-06), declared here
// in code; the stored style only fills in values. No imports beyond a type, so
// the editor (browser) and the layout (server) can both read it.
//
// Colours are the shadcn HSL triplets globals.css already uses, so changing one
// restyles the site's own pages and every shared component together. Text
// colours carry `on`, so the editor warns when a pair gets hard to read.
// Fonts and the page colour are applied to body and headings directly, because
// globals.css sets those as literals (and the page as a gradient) rather than
// through the variables.
// ============================================================================

const BODY = `"Basteleur", Georgia, serif`;
const HEADING = `"Brothers", "Venture", Georgia, serif`;

export const SITE_STYLE: SiteStyleSchema = {
  vars: [
    { name: "--background", label: "Page", group: "Colours", kind: "hsl", default: "216 12% 19%", applies: { sel: "body", prop: "background" }, hint: "Replaces the page's soft gradient with this colour." },
    { name: "--foreground", label: "Text", group: "Colours", kind: "hsl", default: "40 33% 92%", on: "--background" },
    { name: "--muted-foreground", label: "Quiet text", group: "Colours", kind: "hsl", default: "37 12% 69%", on: "--background" },
    { name: "--card", label: "Cards and panels", group: "Colours", kind: "hsl", default: "216 11% 23%" },
    { name: "--primary", label: "Brass", group: "Colours", kind: "hsl", default: "40 50% 57%", hint: "Buttons, marks, the current page in the menu." },
    { name: "--primary-foreground", label: "Text on brass", group: "Colours", kind: "hsl", default: "216 13% 12%", on: "--primary" },
    { name: "--border", label: "Lines", group: "Colours", kind: "hsl", default: "216 9% 49%" },
    { name: "--eac-block-band", label: "Section banners", group: "Colours", kind: "background", default: "linear-gradient(135deg, #1f2227 0%, #2a2e35 100%)", hint: "Behind section titles on feed pages." },
    { name: "--site-font-body", label: "Body text", group: "Type", kind: "font", default: BODY, applies: { sel: "body", prop: "font-family" } },
    { name: "--site-font-heading", label: "Headings", group: "Type", kind: "font", default: HEADING, applies: { sel: "h1, h2, h3, h4, .font-serif", prop: "font-family" } },
    { name: "--radius", label: "Corners", group: "Shape", kind: "length", default: "0rem", hint: "0 for square, 4px, 0.5rem, 1rem." },
  ],
  fonts: [
    { label: "Basteleur (site)", stack: BODY },
    { label: "Brothers (site)", stack: HEADING },
    { label: "Venture (site)", stack: `"Venture", Georgia, serif` },
    { label: "Georgia", stack: `Georgia, serif` },
    { label: "System sans", stack: `system-ui, sans-serif` },
    { label: "Playfair Display", stack: `"Playfair Display", Georgia, serif`, google: "Playfair Display" },
    { label: "Cormorant Garamond", stack: `"Cormorant Garamond", Georgia, serif`, google: "Cormorant Garamond" },
    { label: "Inter", stack: `"Inter", system-ui, sans-serif`, google: "Inter" },
    { label: "Source Sans 3", stack: `"Source Sans 3", system-ui, sans-serif`, google: "Source Sans 3" },
  ],
  chrome: {
    header: {
      label: "Header",
      parts: {
        brand: { label: "Site name" },
        city: { label: "City line" },
        links: { label: "Menu links" },
        active: { label: "Current page link" },
        account: { label: "Account button" },
        menu: { label: "Phone menu" },
      },
    },
    footer: {
      label: "Footer",
      parts: {
        title: { label: "Name" },
        note: { label: "Note" },
        small: { label: "Bottom line" },
        links: { label: "Links" },
      },
    },
  },
};
