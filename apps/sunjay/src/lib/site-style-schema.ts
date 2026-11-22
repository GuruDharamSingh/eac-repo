import type { SiteStyleSchema } from "@elkdonis/direct-edit/site";
import { SHARED_ACCENTS } from "@elkdonis/direct-edit/site/shared-accents";

// ============================================================================
// What an owner may change about Para Theater's look (round 2, 2026-11-14, from
// elktours' Site style of 2026-11-06), declared here in code; the stored style
// only fills in values. No imports beyond a type, so the editor (browser) and the
// layout (server) can both read it.
//
// Colours are the shadcn HSL triplets globals.css sets on :root, so changing one
// restyles the site's own pages and every shared component together. Defaults are
// globals.css's values (2026-11-14). Text colours carry `on`, so the editor warns
// when a pair gets hard to read. Fonts are applied to body and headings directly,
// because globals.css sets those through next/font variables, not these.
//
// Nothing is drawn for a visitor until a style is saved: an org with no stored
// style gets no <style> at all (siteStyleCss returns "").
// ============================================================================

const BODY = `var(--font-spectral), Georgia, serif`;
const HEADING = `var(--font-fraunces), Palatino, Georgia, serif`;

export const SITE_STYLE: SiteStyleSchema = {
  vars: [
    { name: "--background", label: "Page", group: "Colours", kind: "hsl", default: "204 8% 12%" },
    { name: "--foreground", label: "Text", group: "Colours", kind: "hsl", default: "40 21% 89%", on: "--background" },
    { name: "--muted-foreground", label: "Quiet text", group: "Colours", kind: "hsl", default: "40 5% 62%", on: "--background" },
    { name: "--card", label: "Cards and panels", group: "Colours", kind: "hsl", default: "200 8% 15%" },
    { name: "--primary", label: "Bronze", group: "Colours", kind: "hsl", default: SHARED_ACCENTS.bronze.hsl, hint: "Buttons, marks, numbers in steps, the current page." },
    { name: "--primary-foreground", label: "Text on bronze", group: "Colours", kind: "hsl", default: "204 8% 12%", on: "--primary" },
    { name: "--rust", label: "Rust", group: "Colours", kind: "hsl", default: "23 52% 60%", hint: "Links, italic subheads, second-tier accents." },
    { name: "--border", label: "Lines", group: "Colours", kind: "hsl", default: "203 7% 23%" },
    { name: "--eac-block-band", label: "Section banners", group: "Colours", kind: "background", default: "#2B3134", hint: "Behind section titles on feed pages." },
    { name: "--site-font-body", label: "Body text", group: "Type", kind: "font", default: BODY, applies: { sel: "body", prop: "font-family" } },
    { name: "--site-font-heading", label: "Headings", group: "Type", kind: "font", default: HEADING, applies: { sel: "h1, h2, h3, h4, .font-serif", prop: "font-family" } },
    { name: "--radius", label: "Corners", group: "Shape", kind: "length", default: "0rem", hint: "0 for square, 4px, 0.5rem, 1rem." },
  ],
  fonts: [
    { label: "Spectral (site)", stack: BODY },
    { label: "Fraunces (site)", stack: HEADING },
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
        links: { label: "Menu links" },
        active: { label: "Current page link" },
        tools: { label: "Hub and Manage links" },
        account: { label: "Account button" },
        menu: { label: "Phone menu" },
      },
    },
    footer: {
      label: "Footer",
      parts: {
        title: { label: "Name line" },
        links: { label: "Links" },
        note: { label: "Bottom line" },
      },
    },
  },
};
