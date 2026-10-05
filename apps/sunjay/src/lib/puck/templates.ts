import type { PageTemplate, TemplateNode } from "@elkdonis/blocks";
import { blankTemplate, homeTemplate, type HomeSeed } from "./home-template";

// ============================================================================
// Starting documents for the generated and designed pages.
//
//   event-detail   the page of a gathering that has a detail page: instructions
//                  and the Talk room at the top, RSVP and materials beside
//                  them, the description beneath. One document draws every
//                  such event (app/[feed]/[slug]/page.tsx).
//   services       a services page: the list, one service in full, and booking.
//   journal        a writing index: the Studio listing cards.
//   journal-piece  the layout every piece under /journal/<piece> is drawn in.
//
// Like the home template these are data only: block types and settings, the
// same shape the editor saves, with example words that are meant to be
// replaced. Data blocks store settings and fetch their rows at render.
// ============================================================================

type Ground = "plain" | "raised";

const band = (
  ground: Ground,
  padding: "small" | "regular",
  width: "narrow" | "standard" | "wide",
  rule: boolean,
  content: TemplateNode[]
): TemplateNode => ({ type: "pt-band", props: { ground, padding, width, rule, content } });

const split = (
  ratio: "even" | "wide-start" | "wide-end",
  gap: "regular" | "loose",
  start: TemplateNode[],
  end: TemplateNode[]
): TemplateNode => ({
  type: "split-row",
  props: { ratio, align: "start", gap, columns: "stacked", start, end },
});

const swatch = { ground: "#1B1E20", ink: "#E9E5DD", accent: "#C9AE79" };

export const EVENT_DETAIL_TEMPLATE: PageTemplate = {
  id: "event-detail",
  name: "Event detail page",
  description:
    "A gathering's own page: how-to-join steps and the Talk room first, RSVP and materials beside them, the description below. Edits here change every event that has a detail page.",
  swatch,
  cards: "Event blocks",
  content: [
    band("plain", "regular", "wide", false, [{ type: "pt-event-header", props: { showCrumb: true, showFacts: true, showCover: true } }]),
    band("raised", "regular", "wide", true, [
      split(
        "wide-start",
        "loose",
        [
          {
            type: "pt-steps",
            props: {
              heading: "How to join",
              numbered: true,
              steps: [
                { title: "Open the room", text: "<p>Press <strong>Join the room</strong> below. Allow your camera and microphone when your browser asks.</p>" },
                { title: "Read before we meet", text: "<p>Anything to read or prepare is listed under Materials.</p>" },
                { title: "Bring what you need", text: "<p>Comfortable clothes, water, and something to write with.</p>" },
              ],
            },
          },
          { type: "pt-talk-room", props: { heading: "The room", membersOnly: true, startOpen: false, height: 520, note: "" } },
          { type: "pt-notice", props: { title: "Recording", body: "<p>Say here whether the session is recorded and who can see it.</p>", tone: "note" } },
        ],
        [
          { type: "pt-event-rsvp", props: { showAttendees: true } },
          { type: "pt-event-materials", props: { heading: "Materials" } },
        ]
      ),
    ]),
    band("plain", "regular", "narrow", true, [{ type: "pt-event-about", props: { heading: "About this gathering" } }]),
  ],
};

export const SERVICES_TEMPLATE: PageTemplate = {
  id: "para-theater-services",
  name: "Services page",
  description:
    "A list of services as cards, the chosen one in full beside a booking form. Group and self-paced services are paid by card; one-to-one ones send an enquiry.",
  swatch,
  cards: "Service cards",
  content: [
    {
      type: "pt-banner",
      props: { title: "Services", subtitle: "Work with us", body: "", imageUrl: "", scrim: 80, align: "center", size: "compact" },
    },
    band("plain", "regular", "wide", false, [
      { type: "pt-services", props: { heading: "What is offered", intro: "Choose one to see it in full and book.", limit: 12, layout: "cards", showImages: true, chooseLabel: "Choose" } },
    ]),
    band("raised", "regular", "wide", true, [
      split(
        "wide-start",
        "loose",
        [{ type: "pt-service", props: { service: "", showImage: true, showBody: true } }],
        [
          { type: "pt-booking", props: { service: "", heading: "Book", notesLabel: "Anything we should know before you come? (optional)" } },
          { type: "pt-notice", props: { title: "Before you book", body: "<p>Say here what happens after booking: a confirmation email, where to go, how to cancel.</p>", tone: "quiet" } },
        ]
      ),
    ]),
  ],
};

export const JOURNAL_TEMPLATE: PageTemplate = {
  id: "para-theater-journal",
  name: "Writing page",
  description: "An index of the pieces written in the writing room and shown on this site, as the Studio listing cards.",
  swatch,
  cards: "Studio cards",
  content: [
    {
      type: "pt-banner",
      props: { title: "Writing", subtitle: "", body: "", imageUrl: "", scrim: 80, align: "center", size: "compact" },
    },
    band("plain", "regular", "wide", false, [
      { type: "pt-journal", props: { heading: "", intro: "", limit: 12, series: "", lead: true, emptyNote: "Nothing is published here yet." } },
    ]),
  ],
};

export const JOURNAL_PIECE_TEMPLATE: PageTemplate = {
  id: "journal-piece",
  name: "Writing piece page",
  description:
    "The layout of one piece under /journal/<piece>: the piece in the reading layer, its series, then more writing. Edits here change every piece.",
  swatch,
  cards: "Studio cards",
  content: [
    band("plain", "regular", "wide", false, [{ type: "pt-article", props: { piece: "", reading: "journal", showBack: true, showCover: true } }]),
    band("raised", "regular", "narrow", true, [{ type: "pt-series-nav", props: { heading: "In this series" } }]),
    band("plain", "regular", "wide", true, [
      { type: "pt-journal", props: { heading: "More writing", intro: "", limit: 4, series: "", lead: false, emptyNote: "" } },
    ]),
  ],
};

/** Which start-from choices the "New page" form offers (slug of the query value). */
export const NEW_PAGE_STARTS = [
  { value: "plain", label: "Plain page" },
  { value: "services", label: "Services page" },
  { value: "journal", label: "Writing page" },
] as const;

export function allTemplates(seed: HomeSeed): PageTemplate[] {
  return [
    homeTemplate(seed),
    EVENT_DETAIL_TEMPLATE,
    SERVICES_TEMPLATE,
    JOURNAL_TEMPLATE,
    JOURNAL_PIECE_TEMPLATE,
    blankTemplate(seed.orgName),
  ];
}

/** The document a page opens with when nothing is stored for it yet. */
export function startingTemplate(slug: string, start: string | undefined, seed: HomeSeed): PageTemplate {
  if (slug === "home") return homeTemplate(seed);
  if (slug === "event-detail") return EVENT_DETAIL_TEMPLATE;
  if (slug === "journal-piece") return JOURNAL_PIECE_TEMPLATE;
  if (start === "services") return SERVICES_TEMPLATE;
  if (start === "journal") return JOURNAL_TEMPLATE;
  return blankTemplate(seed.orgName);
}
