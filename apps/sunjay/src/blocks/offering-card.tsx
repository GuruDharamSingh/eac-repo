import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { OfferingCardView } from "./offering-card.client";
import { SAMPLE_EVENT, type WireEvent } from "./event-sample";

// ============================================================================
// The offering card: the "Current Offerings" lead card (cover, when, how to
// join, the Talk room in place of the RSVP) for one gathering.
//
// Reads `event`, filled by a resolver (lib/puck/data-event.ts), never from the
// page document. Declaration stays server-safe; the component is in
// offering-card.client.tsx.
// ============================================================================

const offeringCardProps = [
  { name: "eyebrow", kind: "string", label: "Line above the heading", default: "Open to everyone" },
  {
    name: "heading",
    kind: "string",
    label: "Heading",
    description: "Leave empty to hide the heading and the line above it.",
    default: "Current Offerings",
  },
  { name: "showCall", kind: "boolean", label: "“Join the room” button and call", default: true },
  { name: "showRsvp", kind: "boolean", label: "RSVP column", default: true },
  { name: "showCalendar", kind: "boolean", label: "“Add to calendar” button", default: true },
] as const;

const defaults = {
  eyebrow: "Open to everyone",
  heading: "Current Offerings",
  showCall: true,
  showRsvp: true,
  showCalendar: true,
};

export const offeringCard = defineBlock(
  {
    id: "pt-offering-card",
    category: "listings",
    label: "Offering card (call + RSVP)",
    description:
      "One gathering as a card: cover, kicker, title, blurb, time, length, join-the-room (the Talk call opens in place of the RSVP), add to calendar, details, and the RSVP.",
    memberSafe: true,
    interactive: true,
    dataDriven: true,
    styling: "tailwind",
    props: offeringCardProps,
  },
  OfferingCardView as unknown as React.ComponentType<
    PropsOf<typeof offeringCardProps> & { event?: WireEvent | null }
  >,
  () => ({ ...defaults, event: SAMPLE_EVENT })
);
