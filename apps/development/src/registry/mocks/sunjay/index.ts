import type { ComponentType } from "react";
import type { AppMocks } from "../types";

// Sunjay (Para Theater): 17 blocks. "real" = cms-ui's own face or shelf component with invented data;
// "static" = the block's markup copied into static.tsx, scoped CSS in sunjay-mock.css.
const real = (note: string) => note;
const st = (name: string) => () => import("./static").then((m) => ({ default: (m as unknown as Record<string, ComponentType>)[name] }));

export const MOCKS: AppMocks = {
  "pt-standing": { kind: "real", load: () => import("./standing"), note: real("Real cms-ui StandingMeetingFace; the meeting is invented.") },
  "pt-calendar": { kind: "real", load: () => import("./calendar"), note: real("Real cms-ui HubCalendar on invented gatherings.") },
  "pt-forum": { kind: "real", load: () => import("./forum"), note: real("Real cms-ui ForumFace; the board is invented.") },
  "pt-gallery": { kind: "real", load: () => import("./gallery"), note: real("Real cms-ui GalleryFace on generated placeholder pictures.") },
  "pt-writing": { kind: "real", load: () => import("./writing"), note: real("Real cms-ui WritingShelf with four invented pieces.") },
  "pt-profile": { kind: "static", load: st("Profile"), note: "Copy of ProfileCard markup; an invented guide, placeholder photograph." },
  "pt-threads": { kind: "static", load: st("Threads"), note: "Copy of ThreadCard markup (cms-ui face classes); invented posts." },
  "pt-member": { kind: "static", load: st("Member"), note: "Signed-out sign-up card and signed-in membership card side by side; nothing submits." },
  "pt-event-header": { kind: "static", load: st("EventHeader"), note: "Copy of EventHeaderView markup; an invented gathering." },
  "pt-event-about": { kind: "static", load: st("EventAbout"), note: "Copy of EventAboutView markup; invented description." },
  "pt-talk-room": { kind: "static", load: st("TalkRoom"), note: "The closed state with Join the room; no call is loaded." },
  "pt-event-rsvp": { kind: "static", load: st("EventRsvp"), note: "Guest RSVP form and attendee chips; nothing submits." },
  "pt-event-materials": { kind: "static", load: st("EventMaterials"), note: "Two invented file links." },
  "pt-offering-card": { kind: "static", load: st("OfferingCard"), note: "Copy of the offering card markup with Sunjay's own offering-card.css (pt-offer-*)." },
  "pt-services": { kind: "static", load: st("Services"), note: "Card layout; three invented services." },
  "pt-service": { kind: "static", load: st("Service"), note: "One invented service in full." },
  "pt-booking": { kind: "static", load: st("Booking"), note: "Static look of the booking form; the live one is the shared checkout form." },
};
