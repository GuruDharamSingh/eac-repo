import type { PageTemplate } from "@elkdonis/blocks";

// ============================================================================
// Starting documents for this site's pages (2026-11-17).
//
// A template is a page's content as data: block types and the settings the
// editor saves, no ids (the Templates tab and `templateDocument` give every
// node a fresh one). Nothing here is special once applied: each block is an
// ordinary block the editor can change, move or delete. Same mechanism as
// sunjay's `lib/puck/templates.ts`; the tab is `templatesPlugin` in
// components/studio/page-editor.tsx.
//
//   about   a one-potter About page: ktp-about-hero (story beside a shaped
//           portrait), ktp-studio-strip (studio pictures + facts band), a quote,
//           a visit/contact panel and a button to the pieces. The two ktp-*
//           blocks are this site's own (blocks/about-hero.tsx, studio-strip.tsx).
//
// Words are placeholders to be replaced. The only facts stated are ones the
// home page's own copy already carries (wheel-thrown stoneware and porcelain,
// fired in a small studio kiln). No name, place, date, award, address or
// contact detail is supplied: the editor adds them. The pictures are left
// empty and chosen from the media picker (This site / My files); with none
// chosen the hero draws only its words and the strip only its facts.
//
// Import-free beyond types: the client editor config and the studio route both read it.
// ============================================================================

const swatch = { ground: "#f6f1ea", ink: "#2b2622", accent: "#9c5b3a" };

// Blocks on this site sit directly in `.ktp-content` (a flex column with no gutter), so a content block
// brings its own through the generic Style layer (`blkStyle`): side padding, a reading width, centred.
const column = { padX: 24, padY: 14, maxWidth: 1040, align: "center" } as const;

export const ABOUT_TEMPLATE: PageTemplate = {
  id: "ktp-about",
  name: "About the studio",
  description:
    "An About page for one potter: your story beside a shaped portrait, a mosaic of studio pictures with a band of facts, a statement in your own words, and a note on visiting or getting in touch.",
  swatch,
  cards: "About blocks",
  content: [
    {
      type: "ktp-about-hero",
      props: {
        kicker: "About",
        title: "About the studio",
        story:
          "<p>Introduce yourself here: who you are, how you came to clay, and what you like to make.</p>" +
          "<p>Choose a portrait, or a photograph of the studio, with the Portrait field, and a small second picture if you like. Select this text to change it.</p>",
        signature: "",
        portrait: "",
        portraitAlt: "",
        inset: "",
        insetAlt: "",
        side: "right",
        shape: "arch",
        frame: true,
        titleSize: 60,
        titleStyle: "italic",
        accent: "",
        ink: "",
        ground: "",
      },
    },
    {
      type: "ktp-studio-strip",
      props: {
        eyebrow: "In the studio",
        title: "How the pots are made",
        intro: "Say in a sentence or two where the work happens. Add pictures below: the wheel, the kiln, a shelf of drying pots.",
        pictures: [],
        layout: "mosaic",
        ratio: "photo",
        radius: 12,
        // Only what the home page's own copy already says; the rest is for the potter to fill in.
        facts: [
          { label: "Made", value: "On the wheel" },
          { label: "Clay", value: "Stoneware and porcelain" },
          { label: "Fired", value: "In a small studio kiln" },
          { label: "Made for", value: "Everyday ritual" },
        ],
        accent: "",
        ground: "",
        blkStyle: column,
      },
    },
    {
      type: "quote",
      props: {
        text: "Add a sentence or two in your own words about why you make pots.",
        attribution: "",
        source: "",
        tone: "large",
        blkStyle: column,
      },
    },
    {
      type: "prose",
      props: {
        body:
          "<h3>Visit or get in touch</h3>" +
          "<p>Add here how people can reach you, and whether the studio is open for visits or pickup. Add an address or contact details only if you want them public.</p>",
        size: "regular",
        align: "start",
        measure: true,
        // A soft panel: the Style layer's tint, padding and corner radius.
        blkStyle: { padX: 32, padY: 28, maxWidth: 760, align: "center", bg: "soft", radius: 16, marginTop: 24, marginBottom: 8 },
      },
    },
    {
      type: "link-button",
      props: { label: "See the pieces", href: "/#pieces", tone: "filled", align: "center", newTab: false, blkStyle: { padX: 24, padY: 24, maxWidth: 1040, align: "center" } },
    },
  ],
};

/** The Templates tab's list in the page editor. */
export const PAGE_TEMPLATES: PageTemplate[] = [ABOUT_TEMPLATE];

/** The page address that opens on a template until a version is published. */
export const TEMPLATE_FOR_SLUG: Record<string, PageTemplate> = { about: ABOUT_TEMPLATE };
