import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { OfferingsBand, type OfferingItem, type OfferingPanel, type OfferingRow } from "@/components/landing/OfferingsBand";

// ============================================================================
// offerings-band (2026-11-21): "Current offerings", the landing page's lead gathering, as a block. It was the live
// part `offerings` (a finished piece of HTML with nothing to set). It keeps the three-column card: the cover at the
// left, the details (title, words, time, buttons) in the middle, and a right-hand panel. What each column holds is
// now a setting:
//
//   right-hand panel   Are you coming? (the RSVP, as before), a sign-in form (the site's own, for someone who is not
//                      signed in), or nothing
//   the row beneath    the next gatherings (as before), the latest posts, or nothing; how many
//   the lead           the soonest upcoming gathering (as before), or one gathering of the Offerings feed that you choose
//   the cover          its framing: where the picture is centred and how far it is zoomed, the same shape as the
//                      series planner's cover frame (cms-ui cover-frame.ts: fx, fy, zoom)
//   the words          the small line and the heading above, and the words of the closing link
//
// With no settings changed it draws what the part drew, to the pixel (proved against the live page, IG-landing.md).
// What the block shows is read per request by the resolver (config.server.ts: loadOfferingsData in
// lib/landing-offerings.ts), and only the settings are stored. The saved landing's `part` node is turned into this
// block at read time (lib/puck/landing-blocks.ts); the stored row is not changed.
// ============================================================================

const props = [
  { name: "eyebrow", kind: "string", label: "Small line above the heading", default: "Open to everyone", inlineEditable: false },
  { name: "heading", kind: "string", label: "Heading", default: "Current Offerings", inlineEditable: false },
  {
    name: "featured",
    kind: "string",
    binds: "thread",
    label: "Gathering to feature",
    description: "A gathering of the Offerings feed, by its id. Empty: the soonest upcoming one, as the page always showed.",
    default: "",
  },
  {
    name: "panel",
    kind: "select",
    label: "Right-hand panel",
    description: "What sits beside the details. The sign-in form shows only to someone who is not signed in.",
    default: "rsvp",
    options: [
      { value: "rsvp", label: "Are you coming? (RSVP)" },
      { value: "signin", label: "Sign-in form" },
      { value: "none", label: "Nothing" },
    ],
  },
  {
    name: "more",
    kind: "select",
    label: "Row beneath",
    default: "upcoming",
    options: [
      { value: "upcoming", label: "The next gatherings" },
      { value: "posts", label: "The latest posts" },
      { value: "none", label: "None" },
    ],
  },
  { name: "moreCount", kind: "number", label: "How many in the row", default: 3, min: 1, max: 12, step: 1 },
  { name: "allLabel", kind: "string", label: "Closing link words", description: "Empty hides the link.", default: "All offerings →", inlineEditable: false },
  { name: "allHref", kind: "url", label: "Closing link goes to", default: "/offerings" },
  { name: "coverX", kind: "number", label: "Cover: across", description: "Where the picture is centred, 0 left to 100 right.", default: 50, min: 0, max: 100, step: 1, unit: "%" },
  { name: "coverY", kind: "number", label: "Cover: down", description: "0 top to 100 bottom.", default: 50, min: 0, max: 100, step: 1, unit: "%" },
  { name: "coverZoom", kind: "number", label: "Cover: zoom", description: "1 fills the box; more crops in around that point.", default: 1, min: 1, max: 4, step: 0.1 },
] as const;

export type OfferingsBlockProps = PropsOf<typeof props> & {
  /** What the resolver read: the lead (with the viewer's own answer), the rows beneath, who is looking. Never stored. */
  items?: OfferingItem[] | null;
  rows?: OfferingRow[] | null;
  signedIn?: boolean;
  nextcloudUrl?: string | null;
};

const words = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function OfferingsBlock(p: OfferingsBlockProps) {
  const items = Array.isArray(p.items) ? p.items : [];
  if (items.length === 0) return null;
  const panel: OfferingPanel = p.panel === "signin" || p.panel === "none" ? p.panel : "rsvp";
  return (
    <OfferingsBand
      items={items}
      rows={Array.isArray(p.rows) ? p.rows : undefined}
      signedIn={Boolean(p.signedIn)}
      nextcloudUrl={p.nextcloudUrl ?? null}
      eyebrow={words(p.eyebrow, "Open to everyone")}
      heading={words(p.heading, "Current Offerings")}
      panel={panel}
      frame={{ fx: num(p.coverX, 50), fy: num(p.coverY, 50), zoom: num(p.coverZoom, 1) }}
      allLabel={words(p.allLabel, "All offerings →")}
      allHref={typeof p.allHref === "string" && p.allHref ? p.allHref : "/offerings"}
    />
  );
}

export const offeringsBand = defineBlock(
  {
    id: "offerings-band",
    category: "listings",
    label: "Current offerings",
    description:
      "The lead gathering as a card: cover at the left, details in the middle, and a right-hand panel (RSVP, sign-in form or nothing), with an optional row of other gatherings or posts beneath.",
    memberSafe: false,
    dataDriven: true,
    styling: "tokens",
    props,
    // The gathering is read from the Offerings feed, so a block placed twice draws the same one unless told otherwise.
    reads: [
      { from: "site", what: "org" },
      { from: "viewer", what: "signed-in" },
      { from: "record", via: "featured", kinds: ["thread"] },
      { from: "flow", what: "rsvp" },
    ],
    parts: {
      root: { label: "Offerings band", sel: "> .ig-offer-section" },
      eyebrow: { label: "Small line", sel: ".ig-offer-eyebrow", prop: "eyebrow", draws: { props: { eyebrow: "Open to everyone" } } },
      heading: { label: "Heading", sel: ".ig-offer-heading", prop: "heading" },
      card: { label: "Card", sel: ".ig-offer-card" },
      cover: { label: "Cover", sel: ".ig-offer-media" },
      details: { label: "Details", sel: ".ig-offer-body" },
      title: { label: "Gathering title", sel: ".ig-offer-title" },
      facts: { label: "Time and length", sel: ".ig-offer-facts" },
      buttons: { label: "Buttons", sel: ".ig-offer-actions" },
      panel: { label: "Right-hand panel", sel: ".ig-offer-rsvp", draws: { props: { panel: "signin" } } },
      rows: { label: "Row beneath", sel: ".ig-offer-more", repeat: true },
      all: { label: "Closing link", sel: ".ig-offer-all", prop: "allLabel" },
    },
  },
  OfferingsBlock,
  () => ({
    eyebrow: "Open to everyone",
    heading: "Current Offerings",
    featured: "",
    panel: "signin" as const,
    more: "upcoming" as const,
    moreCount: 3,
    allLabel: "All offerings →",
    allHref: "/offerings",
    coverX: 50,
    coverY: 50,
    coverZoom: 1,
    items: [
      {
        thread: {
          id: "sample",
          slug: "morning-sit",
          title: "Morning sit",
          kind: "meeting",
          feedSlug: "offerings",
          description: "We meet before dawn and keep the hours together.",
          excerpt: null,
          coverImageUrl: null,
          location: "Online",
          isOnline: true,
          isRsvpEnabled: false,
          durationMinutes: 60,
          recurrencePattern: "DAILY",
          nextOccurrenceAt: new Date("2030-01-01T09:00:00Z"),
          talkToken: null,
        },
        cycleStatus: null,
        attendanceCount: 0,
        attending: false,
      },
    ] as unknown as OfferingItem[],
    rows: [{ id: "sample-2", href: "/offerings/evening-reading", title: "Evening reading", meta: "Fri, Jan 3 · 7:00 p.m." }] as OfferingRow[],
    signedIn: false,
    nextcloudUrl: null,
  })
);
