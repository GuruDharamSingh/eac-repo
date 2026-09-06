/**
 * Content/IA ported from apps/ifac/src/app/hub/page.tsx's tile grid, in
 * arts-collective's data-driven HubCard shape (see hub-cards.ts there) rather
 * than IFAC's hardcoded-inline-JSX version. Only three tiles are real this
 * pass (my_profile, pipeline, manage_site) — the rest ship `available: false`
 * so the hub's full shape is visible without building seven more features.
 */

export type CardStatus = "not_started" | "in_progress" | "complete" | "locked";

export type HubCard = {
  id: string;
  title: string;
  blurb: string;
  href: string | null;
  available: boolean;
  /** Hidden from anyone without canEdit. */
  adminOnly?: boolean;
  /** Renders full-width instead of the fixed 280px tile. */
  wide?: boolean;
};

export const HUB_CARDS: HubCard[] = [
  {
    id: "my_profile",
    title: "My profile",
    blurb: "Your bio, portrait, links and gallery — on ArtDirect.",
    href: null,
    available: true,
  },
  {
    id: "create_document",
    title: "Create a document",
    blurb: "A collaborative doc in the group's storage.",
    href: null,
    available: false,
  },
  {
    id: "pipeline",
    title: "Pipeline",
    blurb: "Board of what the group is working on.",
    href: "/hub/pipeline",
    available: true,
  },
  {
    id: "weekly_meeting",
    title: "Weekly meeting",
    blurb: "Standing time, agenda and join link.",
    href: null,
    available: false,
  },
  {
    id: "compose",
    title: "Compose",
    blurb: "Art, announcements, events and products.",
    href: null,
    available: false,
  },
  {
    id: "files",
    title: "Files",
    blurb: "Browse the group's Nextcloud storage.",
    href: null,
    available: false,
  },
  {
    id: "manage_site",
    title: "Manage site",
    blurb: "Review people and roles.",
    href: "/manage/people",
    available: true,
    adminOnly: true,
  },
  {
    id: "suggested_ideas",
    title: "Suggested ideas",
    blurb: "Propose something, or read the queue.",
    href: null,
    available: false,
  },
  {
    id: "questionnaires",
    title: "Questionnaires & group research",
    blurb: "Ask the membership something, and read the results.",
    href: null,
    available: false,
    wide: true,
  },
  {
    id: "appearance",
    title: "Appearance",
    blurb: "Site colours and theme.",
    href: null,
    available: false,
    adminOnly: true,
    wide: true,
  },
  {
    id: "help",
    title: "Help & notes from the developer",
    blurb: "How things work, and how to tell us they don't.",
    href: null,
    available: false,
    wide: true,
  },
];
