export type CardStatus = "not_started" | "in_progress" | "complete" | "locked";

export type HubCard = {
  id: string;
  title: string;
  blurb: string;
  href: string | null;
  available: boolean;
};

export const HUB_CARDS: HubCard[] = [
  {
    id: "artist_profile",
    title: "Artist Profile",
    blurb:
      "Who you are, your practice, your audience, your goals. Powers your public page.",
    href: "/wizard",
    available: true,
  },
  {
    id: "wants_needs",
    title: "Wants & Needs",
    blurb:
      "What you're looking for, what you're offering — shared with the rest of the collective.",
    href: null,
    available: false,
  },
  {
    id: "questions_for_collective",
    title: "Questions for the Collective",
    blurb:
      "Ask the inner group anything. Answers may be surfaced on the forum.",
    href: null,
    available: false,
  },
  {
    id: "meet_artists",
    title: "Get to Know Other Artists",
    blurb:
      "Browse the other corners of the collective. Follow, reach out, collaborate.",
    href: null,
    available: false,
  },
  {
    id: "how_to_use",
    title: "How to Use the Site",
    blurb:
      "A short tour of the content form, the template editor, and the tools you have access to.",
    href: null,
    available: false,
  },
  {
    id: "structure_business",
    title: "Structure Your Business",
    blurb:
      "Optional: if you sell work or services, we'll walk you through tasteful monetization and collective alignment.",
    href: "/wizard/business",
    available: true,
  },
  {
    id: "custom_email",
    title: "Custom Email Notifications",
    blurb:
      "Design the emails your audience gets. Drafts, templates, subscriber list.",
    href: null,
    available: false,
  },
  {
    id: "own_domain",
    title: "Get Your Own Domain",
    blurb:
      "Move from a subdomain of the collective to your own domain, managed through us.",
    href: null,
    available: false,
  },
];

// Secondary row: site-level panels rather than onboarding processes.
// Treated visually similar to the onboarding cards per the hub design.
export const SITE_PANELS: HubCard[] = [
  {
    id: "analytics",
    title: "Analytics",
    blurb:
      "Visitors, engagement, and which posts are pulling people in over time.",
    href: null,
    available: false,
  },
  {
    id: "featured_content",
    title: "Featured Content Panel",
    blurb:
      "Curate the hero piece at the top of your public page — a workshop, post, or announcement.",
    href: null,
    available: false,
  },
  {
    id: "eac_account",
    title: "Elkdonis Account",
    blurb:
      "Your EAC membership settings — email, notifications, deeper partnership options.",
    href: "/account",
    available: true,
  },
];
