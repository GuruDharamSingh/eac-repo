import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import {
  EventAboutView,
  EventHeaderView,
  EventMaterialsView,
  EventRsvpView,
  TalkRoomView,
} from "./event.client";
import { SAMPLE_EVENT, type WireEvent } from "./event-sample";
import { editingOf, type PuckEditing } from "@elkdonis/blocks/record";
import {
  EVENT_ABOUT_PARTS,
  EVENT_HEADER_PARTS,
  EVENT_MATERIALS_PARTS,
  EVENT_RSVP_PARTS,
  TALK_ROOM_PARTS,
} from "./detail-parts";

// ============================================================================
// The event detail blocks.
//
// A gathering's page, in pieces: header, about, the Talk room, RSVP, materials.
// All read one `event`, filled by a resolver (lib/puck/data-event.ts), so the
// same template draws every gathering that has a detail page. With `event`
// absent in the editor, the client resolver supplies SAMPLE_EVENT.
//
// Parts (2026-11-14, detail-parts.ts): selectors over today's markup, so a page
// can restyle each piece and type its own headings in place.
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
    parts: EVENT_HEADER_PARTS,
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
    parts: EVENT_ABOUT_PARTS,
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

/**
 * Closed while being edited (2026-11-14, HE's "inert on edit" manners, round 2 item 5): "Open the room when the page
 * loads" mounts the live call frame (camera, microphone, autoplay allowed) with no click, so in an editor it would load
 * the call inside the canvas. Not `interactive` for that reason: this server-safe wrapper reads the editor's `puck`
 * context itself (editingOf) and hands the client view only plain values. Join, full screen and new tab still work on
 * the published page as before; the editor captures clicks anyway.
 */
function TalkRoomBlock({ puck, ...rest }: PropsOf<typeof roomProps> & Ev & { puck?: PuckEditing }) {
  const { drawn } = editingOf(puck);
  return <TalkRoomView {...rest} startOpen={drawn ? false : rest.startOpen} />;
}

export const talkRoom = defineBlock(
  {
    ...base,
    // Reads the editor context itself (TalkRoomBlock), so the adapter must hand it over.
    interactive: false,
    id: "pt-talk-room",
    category: "actions",
    label: "Talk room",
    description:
      "The gathering's Nextcloud Talk room in the page, with join, full screen and a new-tab link. Editors can create the room from here.",
    parts: TALK_ROOM_PARTS,
    props: roomProps,
  },
  TalkRoomBlock as unknown as React.ComponentType<PropsOf<typeof roomProps> & Ev>,
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
    parts: EVENT_RSVP_PARTS,
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
    parts: EVENT_MATERIALS_PARTS,
    props: materialsProps,
  },
  EventMaterialsView as unknown as React.ComponentType<PropsOf<typeof materialsProps> & Ev>,
  () => ({ heading: "Materials", event: SAMPLE_EVENT })
);
