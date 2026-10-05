import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import {
  EventAboutView,
  EventHeaderView,
  EventMaterialsView,
  EventRsvpView,
  TalkRoomView,
} from "./event.client";
import { SAMPLE_EVENT, type WireEvent } from "./event-sample";

// ============================================================================
// The event detail blocks.
//
// A gathering's page, in pieces: header, about, the Talk room, RSVP, materials.
// All read one `event`, filled by a resolver (lib/puck/data-event.ts), so the
// same template draws every gathering that has a detail page. With `event`
// absent in the editor, the client resolver supplies SAMPLE_EVENT.
//
// All `interactive`: they use hooks or call server actions. Declarations stay
// here, server-safe; the components are in event.client.tsx.
// ============================================================================

type Ev = { event?: WireEvent | null };
const base = {
  memberSafe: true,
  interactive: true,
  dataDriven: true,
  styling: "tailwind" as const,
  category: "listings" as const,
};

const headerProps = [
  { name: "showCrumb", kind: "boolean", label: "“← section” link above the title", default: true },
  { name: "showFacts", kind: "boolean", label: "Next date, length, place and host", default: true },
  { name: "showCover", kind: "boolean", label: "Cover picture", default: true },
] as const;

export const eventHeader = defineBlock(
  {
    ...base,
    id: "pt-event-header",
    label: "Event header",
    description: "Title, kind, next date and time, length, place and host, and the cover picture of the gathering this page is about.",
    props: headerProps,
  },
  EventHeaderView as unknown as React.ComponentType<PropsOf<typeof headerProps> & Ev>,
  () => ({ showCrumb: true, showFacts: true, showCover: true, event: SAMPLE_EVENT })
);

const aboutProps = [{ name: "heading", kind: "string", label: "Heading", default: "About this gathering" }] as const;

export const eventAbout = defineBlock(
  {
    ...base,
    id: "pt-event-about",
    label: "Event description",
    description: "The gathering's written description, as its author composed it.",
    props: aboutProps,
  },
  EventAboutView as unknown as React.ComponentType<PropsOf<typeof aboutProps> & Ev>,
  () => ({ heading: "About this gathering", event: SAMPLE_EVENT })
);

const roomProps = [
  { name: "heading", kind: "string", label: "Heading", default: "The room" },
  {
    name: "note",
    kind: "text",
    label: "Words above the buttons",
    description: "A line about the room: when it opens, that it is recorded, what to have ready.",
    default: "",
  },
  {
    name: "membersOnly",
    kind: "boolean",
    label: "Only people in the group get the room",
    description:
      "On: the link is left out of the page for everyone else, so it is never in their copy of it. Off: anyone who can see the page can join.",
    default: true,
  },
  { name: "startOpen", kind: "boolean", label: "Open the room when the page loads", default: false },
  {
    name: "height",
    kind: "number",
    label: "Height of the room",
    default: 520,
    min: 320,
    max: 900,
    step: 20,
    unit: "px",
  },
] as const;

export const talkRoom = defineBlock(
  {
    ...base,
    id: "pt-talk-room",
    category: "actions",
    label: "Talk room",
    description:
      "The gathering's Nextcloud Talk room in the page, with join, full screen and a new-tab link. Editors can create the room from here.",
    props: roomProps,
  },
  TalkRoomView as unknown as React.ComponentType<PropsOf<typeof roomProps> & Ev>,
  () => ({ heading: "The room", membersOnly: true, startOpen: false, height: 520, event: SAMPLE_EVENT })
);

const rsvpProps = [
  { name: "showAttendees", kind: "boolean", label: "Show who is coming (to the group)", default: true },
] as const;

export const eventRsvp = defineBlock(
  {
    ...base,
    id: "pt-event-rsvp",
    category: "actions",
    label: "RSVP",
    description: "“Are you coming?” for members and guests, with the count and, for the group, the names.",
    props: rsvpProps,
  },
  EventRsvpView as unknown as React.ComponentType<PropsOf<typeof rsvpProps> & Ev>,
  () => ({ showAttendees: true, event: SAMPLE_EVENT })
);

const materialsProps = [{ name: "heading", kind: "string", label: "Heading", default: "Materials" }] as const;

export const eventMaterials = defineBlock(
  {
    ...base,
    id: "pt-event-materials",
    label: "Event materials",
    description: "Files attached to the gathering, as download links. Hidden when there are none.",
    props: materialsProps,
  },
  EventMaterialsView as unknown as React.ComponentType<PropsOf<typeof materialsProps> & Ev>,
  () => ({ heading: "Materials", event: SAMPLE_EVENT })
);
