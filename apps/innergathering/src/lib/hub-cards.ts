import type { SurfaceDescriptor, SurfaceKind } from "@elkdonis/cms-ui/surface";

/**
 * The hub's tiles, as data.
 *
 * Every tile is a FACE (@elkdonis/cms-ui/surface): the same object as the
 * popup it opens, at tile size. A tile resolves its click one of two ways —
 * `surface` opens a popup in the shared dialog, `href` navigates for a
 * feature whose depth is a page. Four tiles (calendar, standing meeting,
 * pipeline, chat) are live and built in hub/page.tsx from data rather than
 * listed here.
 *
 * Unavailable tiles are kept so the hub's full shape stays visible while the
 * remaining features are built, but they render muted with no target rather
 * than as a "Coming soon" button.
 */
export type HubCard = {
  id: string;
  title: string;
  blurb: string;
  kind: SurfaceKind;
  glyph?: string;
  href?: string;
  surface?: SurfaceDescriptor;
  available: boolean;
  /** Hidden from anyone without canEdit. */
  adminOnly?: boolean;
  /** Renders full-width. */
  wide?: boolean;
};

export const HUB_CARDS: HubCard[] = [
  {
    id: "my_profile",
    title: "My profile",
    blurb: "Your bio, portrait, links and gallery — on ArtDirect.",
    kind: "neutral",
    glyph: "◍",
    available: true,
  },
  {
    id: "compose",
    title: "Compose",
    blurb: "Writing, gatherings, questionnaires and polls.",
    kind: "compose",
    surface: { type: "compose" },
    available: true,
    adminOnly: true,
  },
  {
    id: "gallery",
    title: "Gallery",
    blurb: "Every image in the group's storage, and a place to add more.",
    kind: "gallery",
    surface: { type: "gallery", title: "Gallery" },
    available: true,
    adminOnly: true,
  },
  {
    id: "create_document",
    title: "Create a document",
    blurb: "A collaborative doc in the group's storage.",
    kind: "neutral",
    glyph: "▭",
    available: false,
  },
  {
    id: "files",
    title: "Files",
    blurb: "Browse the group's Nextcloud storage.",
    kind: "neutral",
    glyph: "▥",
    available: false,
  },
  {
    id: "manage_site",
    title: "Manage site",
    blurb: "Pages, people and roles.",
    kind: "neutral",
    glyph: "⚙",
    href: "/manage",
    available: true,
    adminOnly: true,
  },
  {
    id: "suggested_ideas",
    title: "Suggested ideas",
    blurb: "Propose something, or read the queue.",
    kind: "neutral",
    glyph: "✦",
    available: false,
  },
  {
    id: "questionnaires",
    title: "Questionnaires & group research",
    blurb: "Ask the membership something, and read the results.",
    kind: "questionnaire",
    available: false,
    wide: true,
  },
  {
    id: "help",
    title: "Help & notes from the developer",
    blurb: "How things work, and how to tell us they don't.",
    kind: "neutral",
    glyph: "?",
    available: false,
    wide: true,
  },
];
