// ============================================================================
// Four starting points for a store section.
//
// A template is a page's CONTENT, as data: block types and their props, the
// same shape an editor saves. Nothing here is special to a template — every
// piece is an ordinary block the author can then change, move or delete — so
// a template is a head start, not a mode. Ids are left out on purpose: the
// editor gives every node a fresh one when a template is applied, because
// two nodes sharing an id is a broken document.
//
// Each uses only blocks in STORE_PANEL_BLOCKS, and every shelf reads the
// person's own store, so a template shows their real pieces the moment it is
// applied. Between them they show every card: gallery label, poster, tag and
// feature.
// ============================================================================

export interface TemplateNode {
  type: string;
  props: Record<string, unknown>;
}

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  /** Three colours for the picker's thumbnail: ground, ink, accent. */
  swatch: { ground: string; ink: string; accent: string };
  /** Which card the template shows, for the picker. */
  cards: string;
  content: TemplateNode[];
}

const box = (props: Record<string, unknown>, content: TemplateNode[]): TemplateNode => ({
  type: "store-frame",
  props: { image: "", overlay: "dark", ...props, content },
});

export const STORE_TEMPLATES: PageTemplate[] = [
  {
    id: "gallery-wall",
    name: "Gallery wall",
    description: "White walls and wall labels. Quiet, like an exhibition — the work does the talking.",
    swatch: { ground: "#ffffff", ink: "#151515", accent: "#151515" },
    cards: "Gallery label",
    content: [
      box({ palette: "gallery", pattern: "none", padding: "roomy", edge: "hairline" }, [
        {
          type: "store-header",
          props: {
            kicker: "Available work",
            title: "In the studio now",
            subtitle: "Original pieces, each one of a kind. Every sale goes straight to the artist.",
            effect: "reveal",
            size: "large",
            align: "start",
          },
        },
        {
          type: "store-shelf",
          props: {
            artist: "", heading: "", intro: "", card: "label", layout: "grid", columns: "3",
            limit: 6, skip: 0, cta: "View the piece", storeLink: "See the whole store",
          },
        },
      ]),
    ],
  },
  {
    id: "poster-shop",
    name: "Poster shop",
    description: "Dark and bold: a running title band and full-bleed pictures, with the first piece twice the size.",
    swatch: { ground: "#111214", ink: "#f1efe9", accent: "#e8c170" },
    cards: "Poster",
    content: [
      box({ palette: "ink", pattern: "grain", padding: "regular", edge: "soft" }, [
        {
          type: "store-header",
          props: { kicker: "", title: "New work", subtitle: "", effect: "marquee", size: "huge", align: "start" },
        },
        {
          type: "store-shelf",
          props: {
            artist: "", heading: "", intro: "Tap a piece to see it large, with its price and details.",
            card: "poster", layout: "featured", columns: "3", limit: 6, skip: 0,
            cta: "View the piece", storeLink: "Everything for sale",
          },
        },
      ]),
    ],
  },
  {
    id: "market-stall",
    name: "Market stall",
    description: "Warm and handmade: prints pinned at a tilt with price tags, on a dotted clay ground.",
    swatch: { ground: "#9a4322", ink: "#fff7ef", accent: "#fbf3dc" },
    cards: "Tag",
    content: [
      box({ palette: "terracotta", pattern: "dots", padding: "regular", edge: "double" }, [
        {
          type: "store-header",
          props: {
            kicker: "Open studio",
            title: "Pieces for sale",
            subtitle: "Small works and editions — pick one up before the season ends.",
            effect: "shimmer",
            size: "large",
            align: "center",
          },
        },
        {
          type: "store-shelf",
          props: {
            artist: "", heading: "", intro: "", card: "tag", layout: "grid", columns: "3",
            limit: 6, skip: 0, cta: "View the piece", storeLink: "See the whole store",
          },
        },
      ]),
    ],
  },
  {
    id: "spotlight",
    name: "Spotlight",
    description: "One piece in a gilt frame with its full story, and a scrolling row of more work beneath it.",
    swatch: { ground: "#221f45", ink: "#f4f1ff", accent: "#ffb86b" },
    cards: "Feature + poster strip",
    content: [
      box({ palette: "night", pattern: "lines", padding: "roomy", edge: "gilt" }, [
        {
          type: "store-header",
          props: { kicker: "In the spotlight", title: "The piece of the season", subtitle: "", effect: "underline", size: "large", align: "start" },
        },
        {
          type: "store-shelf",
          props: {
            artist: "", heading: "", intro: "", card: "feature", layout: "grid", columns: "3",
            limit: 1, skip: 0, cta: "See it on the marketplace", storeLink: "",
          },
        },
        {
          type: "store-shelf",
          props: {
            artist: "", heading: "More from the studio", intro: "", card: "poster", layout: "strip", columns: "3",
            limit: 6, skip: 1, cta: "View the piece", storeLink: "See the whole store",
          },
        },
      ]),
    ],
  },
];
