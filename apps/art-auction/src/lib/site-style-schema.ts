import type { SiteStyleSchema } from "@elkdonis/direct-edit/site";

// ============================================================================
// What an editor may change about Collect Art's look, declared in code; the
// stored style only fills in values (katie / elktours pattern, 2026-11-20).
// No imports beyond a type, so the editor (browser) and the layout (server)
// can both read it.
//
// Every default below is the value globals.css sets today (light palette,
// :root), so nothing here changes the site until a style is SAVED: siteStyleCss
// returns "" for an empty style and the layout then emits no <style> at all.
//
// The colours are the shadcn HSL triplets globals.css uses; Tailwind reads
// them through @theme inline (--color-background: hsl(var(--background)) ...),
// and the page blocks and article reader read them through --eac-block-* and
// --read-*. One colour here therefore restyles the shell, the cards, the
// blocks and the reader together.
//
// Dark mode: a saved value applies in light AND dark. globals.css's OS-dark
// block is `html:not(.light)` (specificity 0,1,1, same as the saved `html:root`),
// and the saved <style> loads after it, so it wins. Defaults are the light
// palette; with nothing saved, dark visitors get the dark palette unchanged.
// ============================================================================

const BODY = `var(--font-inter), ui-sans-serif, system-ui, sans-serif`;
const HEADING = `var(--font-fraunces), Georgia, "Times New Roman", serif`;

export const SITE_STYLE: SiteStyleSchema = {
  vars: [
    { name: "--background", label: "Page", group: "Colours", kind: "hsl", default: "36 22% 97%" },
    { name: "--foreground", label: "Text", group: "Colours", kind: "hsl", default: "24 14% 11%", on: "--background" },
    { name: "--muted-foreground", label: "Quiet text", group: "Colours", kind: "hsl", default: "28 6% 38%", on: "--background" },
    { name: "--wall", label: "Wall (behind hung pieces)", group: "Colours", kind: "hsl", default: "32 16% 93%", hint: "The plaster tone behind a piece, a shade off the page." },
    { name: "--card", label: "Cards and panels", group: "Colours", kind: "hsl", default: "0 0% 100%" },
    { name: "--muted", label: "Soft tint", group: "Colours", kind: "hsl", default: "30 14% 94%", hint: "Quiet panels, the phone menu's hover." },
    { name: "--primary", label: "Vermilion (accent)", group: "Colours", kind: "hsl", default: "6 70% 44%", hint: "Buttons, the cart count, marks." },
    { name: "--primary-foreground", label: "Text on the accent", group: "Colours", kind: "hsl", default: "36 30% 98%", on: "--primary" },
    { name: "--secondary", label: "Second tint", group: "Colours", kind: "hsl", default: "30 12% 92%" },
    { name: "--live", label: "Auction green", group: "Colours", kind: "hsl", default: "152 58% 30%", hint: "Reserved for the one fact on a card that expires." },
    { name: "--border", label: "Lines", group: "Colours", kind: "hsl", default: "28 12% 86%" },
    { name: "--site-font-body", label: "Body text", group: "Type", kind: "font", default: BODY, applies: { sel: "body", prop: "font-family" } },
    { name: "--site-font-heading", label: "Headings and site name", group: "Type", kind: "font", default: HEADING, applies: { sel: "h1, h2, h3, h4, .font-serif", prop: "font-family" } },
    { name: "--radius", label: "Corners", group: "Shape", kind: "length", default: "0.625rem", hint: "0 for square, 4px, 0.625rem, 1rem." },
  ],
  fonts: [
    { label: "Inter (site body)", stack: BODY },
    { label: "Fraunces (site headings)", stack: HEADING },
    { label: "Georgia", stack: `Georgia, serif` },
    { label: "System sans", stack: `system-ui, sans-serif` },
    { label: "Cormorant Garamond", stack: `"Cormorant Garamond", Georgia, serif`, google: "Cormorant Garamond" },
    { label: "Playfair Display", stack: `"Playfair Display", Georgia, serif`, google: "Playfair Display" },
    { label: "Jost", stack: `"Jost", system-ui, sans-serif`, google: "Jost" },
  ],
  chrome: {
    header: {
      label: "Header",
      parts: {
        brand: { label: "Site name" },
        links: { label: "Menu links" },
        messages: { label: "Messages link" },
        cta: { label: "Sell / Studio button" },
        account: { label: "Account / sign in" },
        cart: { label: "Cart button" },
        menu: { label: "Phone menu" },
      },
    },
    footer: {
      label: "Footer",
      parts: {
        title: { label: "Name" },
        blurb: { label: "Description" },
        links: { label: "Links" },
      },
    },
  },
};
