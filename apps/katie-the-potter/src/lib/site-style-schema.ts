import type { SiteStyleSchema } from "@elkdonis/direct-edit/site";
import { LOOKS, SITE_LOOK_VAR } from "@/blocks/looks";

// ============================================================================
// What an owner may change about this site's look, declared in code; the
// stored style only fills in values (elktours' pattern, 2026-11-06). No
// imports beyond a type, so the editor (browser) and the layout (server) can
// both read it.
//
// The colours are the shadcn HSL triplets globals.css already uses, and the
// chain is: --background/--foreground/--primary/... -> --eac-block-* (globals)
// -> --blk-* (blocks.css) -> every block, the cards' tokens included
// (--ktp-card-bg falls back to --blk-bg-soft, --ktp-accent to --blk-accent).
// So one colour here restyles the shell, the blocks and the piece cards
// together. Text colours carry `on`, so the editor warns about hard pairs.
// Fonts go through --site-font-body / --site-font-heading, which globals.css
// feeds into the block font tokens as well.
// ============================================================================

const BODY = `var(--font-karla), system-ui, sans-serif`;
const HEADING = `var(--font-fraunces), Georgia, serif`;

export const SITE_STYLE: SiteStyleSchema = {
  vars: [
    { name: "--background", label: "Page", group: "Colours", kind: "hsl", default: "36 43% 94%" },
    { name: "--foreground", label: "Text", group: "Colours", kind: "hsl", default: "22 15% 15%", on: "--background" },
    { name: "--muted-foreground", label: "Quiet text", group: "Colours", kind: "hsl", default: "25 11% 39%", on: "--background" },
    { name: "--card", label: "Cards and panels", group: "Colours", kind: "hsl", default: "36 50% 97%" },
    { name: "--muted", label: "Soft tint (picture grounds)", group: "Colours", kind: "hsl", default: "36 33% 89%", hint: "Behind each piece's picture, and in quiet panels." },
    { name: "--primary", label: "Terracotta (accent)", group: "Colours", kind: "hsl", default: "14 51% 47%", hint: "Buttons, prices, the cart, marks." },
    { name: "--primary-foreground", label: "Text on the accent", group: "Colours", kind: "hsl", default: "36 50% 97%", on: "--primary" },
    { name: "--secondary", label: "Celadon (second accent)", group: "Colours", kind: "hsl", default: "150 12% 56%" },
    { name: "--border", label: "Lines", group: "Colours", kind: "hsl", default: "35 25% 80%" },
    { name: "--site-font-body", label: "Body text", group: "Type", kind: "font", default: BODY, applies: { sel: "body", prop: "font-family" } },
    { name: "--site-font-heading", label: "Headings", group: "Type", kind: "font", default: HEADING, applies: { sel: "h1, h2, h3, h4", prop: "font-family" } },
    { name: "--radius", label: "Corners", group: "Shape", kind: "length", default: "10px", hint: "0 for square, 4px, 10px, 1rem." },
    {
      name: SITE_LOOK_VAR,
      label: "Card look",
      group: "Shop",
      kind: "choice",
      default: "house",
      options: LOOKS.map((l) => ({ value: l.value, label: l.label })),
      hint: "Every piece card, unless a block picks its own. Shows once saved.",
    },
  ],
  fonts: [
    { label: "Karla (site)", stack: BODY },
    { label: "Fraunces (site)", stack: HEADING },
    { label: "Georgia", stack: `Georgia, serif` },
    { label: "System sans", stack: `system-ui, sans-serif` },
    { label: "Cormorant Garamond", stack: `"Cormorant Garamond", Georgia, serif`, google: "Cormorant Garamond" },
    { label: "Playfair Display", stack: `"Playfair Display", Georgia, serif`, google: "Playfair Display" },
    { label: "Jost", stack: `"Jost", system-ui, sans-serif`, google: "Jost" },
    { label: "Inter", stack: `"Inter", system-ui, sans-serif`, google: "Inter" },
  ],
  chrome: {
    header: {
      label: "Header",
      parts: {
        brand: { label: "Site name" },
        links: { label: "Menu links" },
        account: { label: "Account / sign in" },
        cart: { label: "Cart button" },
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
