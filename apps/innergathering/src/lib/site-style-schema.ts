import type { SiteStyleSchema } from "@elkdonis/direct-edit/site";
import { IG_ALPHA_VARS } from "./site-style-ig-alpha";
import { IG_COLOUR_VARS, IG_FONT_VARS, IG_FONTS } from "./site-style-ig-vars";

// ============================================================================
// What an editor may change about InnerGathering's look, declared in code; the
// stored style only fills in values (katie / sunjay / art-auction pattern,
// 2026-11-20). No imports beyond a type, so the editor (browser) and the layout
// (server) can both read it.
//
// Every default below is the value src/app/globals.css sets today (:root), so
// nothing here changes the site until a style is SAVED: siteStyleCss returns ""
// for an empty style and the layout then emits no <style> at all.
//
// The colours are the shadcn HSL triplets globals.css uses. The shared surfaces
// (--eac-surface-*, the reading layer, the hub, the forum) read them, so one
// colour restyles those together. The marketing pages and the header/footer
// carry literal hex values in landing.css / globals.css; the header and footer
// are restyled through the chrome parts below (their rules are !important).
//
// Dark mode: nothing on this site sets the `.dark` class today (and no OS-dark
// rule exists), so every visitor sees the light palette. Saved values go on
// `html:root` (0,1,1), which also out-ranks `.dark` (0,1,0), so a saved style
// shows in both modes should `.dark` ever be switched on.
// ============================================================================

const BODY = `"Basteleur", "Cormorant Garamond", Georgia, serif`;
const HEADING = `"Venture", Georgia, serif`;

export const SITE_STYLE: SiteStyleSchema = {
  vars: [
    { name: "--background", label: "Page", group: "Colours", kind: "hsl", default: "42 60% 96%", hint: "Parchment. When set it replaces the page's soft gradient with this flat colour.", applies: { sel: "body", prop: "background" } },
    { name: "--foreground", label: "Text (ink)", group: "Colours", kind: "hsl", default: "226 97% 24%", on: "--background" },
    { name: "--muted-foreground", label: "Quiet text", group: "Colours", kind: "hsl", default: "211 79% 31%", on: "--background" },
    { name: "--card", label: "Cards and panels", group: "Colours", kind: "hsl", default: "43 100% 99%", hint: "Paper: the surfaces, cards and pop-ups." },
    { name: "--secondary", label: "Section tint", group: "Colours", kind: "hsl", default: "37 49% 91%" },
    { name: "--muted", label: "Soft tint", group: "Colours", kind: "hsl", default: "40 45% 92%" },
    { name: "--primary", label: "Navy (main accent)", group: "Colours", kind: "hsl", default: "226 97% 24%", hint: "Filled buttons and marks in the shared components." },
    { name: "--primary-foreground", label: "Text on the accent", group: "Colours", kind: "hsl", default: "43 100% 98%", on: "--primary" },
    { name: "--gold", label: "Gold", group: "Colours", kind: "hsl", default: "42 40% 53%", hint: "Rules, markers and surface accents." },
    { name: "--smoke", label: "Deep navy", group: "Colours", kind: "hsl", default: "226 97% 15%", hint: "Text on gold, calendar and compose marks." },
    { name: "--border", label: "Lines", group: "Colours", kind: "hsl", default: "42 40% 76%" },
    { name: "--site-font-body", label: "Body text", group: "Type", kind: "font", default: BODY, applies: { sel: "body", prop: "font-family" } },
    { name: "--site-font-heading", label: "Headings", group: "Type", kind: "font", default: HEADING, applies: { sel: "h1, h2, h3, h4", prop: "font-family" } },
    { name: "--radius", label: "Corners", group: "Shape", kind: "length", default: "0.375rem", hint: "0 for square, 4px, 0.375rem, 1rem." },
    // The literals the landing, workshop, about, dialog and footer styles used to carry (2026-11-20).
    // Generated defaults, one variable per distinct value; see site-style-ig-vars.ts.
    ...IG_FONT_VARS,
    ...IG_COLOUR_VARS,
    ...IG_ALPHA_VARS,
  ],
  fonts: [
    { label: "Basteleur (site body)", stack: BODY },
    { label: "Venture (site headings)", stack: HEADING },
    { label: "Brothers", stack: `"Brothers", "Venture", sans-serif` },
    { label: "Georgia", stack: `Georgia, serif` },
    { label: "System sans", stack: `system-ui, sans-serif` },
    { label: "Cormorant Garamond", stack: `"Cormorant Garamond", Georgia, serif`, google: "Cormorant Garamond" },
    { label: "Playfair Display", stack: `"Playfair Display", Georgia, serif`, google: "Playfair Display" },
    { label: "Jost", stack: `"Jost", system-ui, sans-serif`, google: "Jost" },
    ...IG_FONTS,
  ],
  chrome: {
    hero: {
      label: "Landing hero", cascadeColor: true,
      parts: {
        eyebrow: { label: "Small line above" },
        title: { label: "Title" },
        subtitle: { label: "Subtitle" },
        tagline: { label: "Tagline" },
        cta: { label: "Main button" },
        signin: { label: "Sign-in button" },
      },
    },
    header: {
      label: "Header", cascadeColor: true,
      parts: {
        brand: { label: "Site name" },
        links: { label: "Menu links" },
        account: { label: "Account / Web-Portal button" },
        menu: { label: "Phone menu" },
      },
    },
    footer: {
      label: "Footer", cascadeColor: true,
      parts: {
        social: { label: "Social links" },
        contact: { label: "Email address" },
        cta: { label: "Leave a Message button" },
        legal: { label: "Copyright line" },
      },
    },
  },
};
