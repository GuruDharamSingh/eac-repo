// Sample site for the template sandbox and harnesses. Packet copy ("Host Name",
// "Event title"), no pictures: every image slot stays a placeholder.
import { DEFAULT_LOOK, type SurfaceActions, type SurfaceLook, type SurfaceOffer, type SurfaceProfile } from "../types";
import type { TemplateData, TemplateId, TemplatePiece } from "./types";

const owner: SurfaceProfile = {
  id: "owner",
  name: "Host Name",
  role: "Practice · City",
  bio: "Two or three sentences about who they are and what they do, in their own words.",
  links: [
    { label: "Website", href: "#" },
    { label: "Instagram", href: "#" },
    { label: "Email", href: "#" },
  ],
  followers: 312,
  following: false,
};
const guest: SurfaceProfile = {
  id: "guest",
  name: "Another host",
  role: "Practice · Another city",
  bio: "A line or two in their own words, carried over from their own site.",
  links: [
    { label: "Their site", href: "https://anotherhost.org" },
    { label: "Instagram", href: "#" },
  ],
  followers: 88,
  following: false,
  siteHref: "https://anotherhost.org",
};

const iso = (d: string) => new Date(d).toISOString();

const event: SurfaceOffer = {
  key: "thread:evt",
  kind: "event",
  title: "Event title",
  standfirst: "with Act one and Act two",
  description: "One evening, two acts, doors at seven.",
  when: { start: iso("2026-12-14T20:00:00-05:00"), timeZone: "America/Toronto" },
  venue: { name: "Venue name", address: "Street, City" },
  takeUp: "rsvp",
  capacity: { limit: 40, coming: 23 },
  hostId: "owner",
  coHostIds: ["guest"],
  href: "#",
};
const announcement: SurfaceOffer = {
  ...event,
  title: "The next session has a new date",
  standfirst: null,
  description: "One short paragraph says what changed and what, if anything, the reader needs to do.",
};
const service: SurfaceOffer = {
  key: "thread:svc",
  kind: "service",
  title: "One-to-one session",
  standfirst: "An hour of private work, arranged to suit you.",
  description: "A paragraph on what happens in a session, who it is for, and anything to prepare beforehand.",
  price: { amountMinor: 9000, currency: "USD" },
  sliding: { minMinor: 5000, maxMinor: 9000, stepMinor: 500 },
  takeUp: "pay",
  durationMinutes: 60,
  venue: { online: true },
  tags: ["60 min", "Online"],
  hostId: "owner",
  slots: [
    { id: "s1", start: iso("2026-12-15T10:00:00-05:00") },
    { id: "s2", start: iso("2026-12-16T18:00:00-05:00") },
    { id: "s3", start: iso("2026-12-18T14:00:00-05:00") },
  ],
};
const series: SurfaceOffer = {
  key: "thread:ser",
  kind: "series",
  title: "Series name",
  standfirst: "A weekly hour of reading and talk.",
  description: "What the series is, who it is for and how a session runs.",
  takeUp: "subscribe",
  hostId: "owner",
  coHostIds: ["guest"],
  when: { start: iso("2026-12-14T18:00:00-08:00"), timeZone: "America/Los_Angeles" },
  venue: { online: true },
};
const artwork: SurfaceOffer = {
  key: "artwork:1",
  kind: "artwork",
  title: "Title of the work",
  standfirst: "A line from the artist about the work.",
  description: "An artist's note: how it was made and what it is about.",
  price: { amountMinor: 42000, currency: "USD" },
  takeUp: "order",
  hostId: "owner",
  images: ["", "", ""],
  artwork: { medium: "Oil on linen", size: "60 × 80 cm", edition: "1 of 1", shipping: { amountMinor: 1500, currency: "USD" }, collect: true },
};

const body =
  "<p>The body of a piece sits here, in paragraphs set at a measure that is easy to read. Headings, pictures and quotes break it up where the writer wants them to. Each piece is written and laid out in the writing room.</p>" +
  "<p>Pictures can sit at the width of the text, break out wider, or run edge to edge with a caption under them.</p>" +
  "<p>A second section picks the thread back up and runs as long as it needs to. The format sets the rhythm of the page, and the font template sets its voice. Both are chosen per piece, and either can change without touching the words.</p>";

const pieces: TemplatePiece[] = [
  {
    key: "thread:w3",
    title: "Title of the piece",
    standfirst: "A standfirst: one or two sentences that say what this piece is about.",
    minutes: 4,
    series: "Notes from the lab",
    n: 3,
    total: 8,
    date: iso("2026-09-20T12:00:00Z"),
    authorId: "owner",
    bodyHtml: body,
    sections: [
      {
        id: "opening",
        title: "Opening",
        html:
          "<p>The body of a piece sits here, in paragraphs set at a measure that is easy to read. Headings, pictures and quotes break it up where the writer wants them to. Each piece is written and laid out in the writing room.</p>" +
          "<p>Pictures can sit at the width of the text, break out wider, or run edge to edge with a caption under them.</p>",
      },
      {
        id: "a-heading",
        title: "A heading",
        html:
          "<p>A second section picks the thread back up and runs as long as it needs to. The format sets the rhythm of the page, and the font template sets its voice.</p>" +
          "<p>Both are chosen per piece, and either can change without touching the words.</p>",
      },
      {
        id: "closing",
        title: "Closing",
        html: "<p>A closing section ends the piece. The index under the text leads on to the next one, and the talk is one button away.</p>",
      },
    ],
    pullQuote: "A pull quote, set large, from the paragraph around it.",
    caption: "Caption for the picture · credit",
    tags: ["materials", "practice"],
    replies: [{ name: "Name", ago: "2h", text: "A reply, shown in full under the note." }],
    version: "v1.2",
    footnotes: ["A footnote sits at the foot of the section it belongs to."],
    facts: [
      { label: "Pages", value: "6" },
      { label: "Reading", value: "8 minutes" },
      { label: "For", value: "Members and guests" },
    ],
  },
  { key: "thread:w2", bodyHtml: body, standfirst: "A standfirst: one or two sentences that say what this piece is about.", title: "An earlier piece", minutes: 2, series: "Notes from the lab", n: 2, total: 8, date: iso("2026-09-12T12:00:00Z"), authorId: "owner" },
  { key: "thread:w1", bodyHtml: body, standfirst: "A standfirst: one or two sentences that say what this piece is about.", title: "Another title", minutes: 6, series: "Notes from the lab", n: 1, total: 8, date: iso("2026-09-02T12:00:00Z"), authorId: "owner" },
  { key: "thread:w0", bodyHtml: body, standfirst: "A standfirst: one or two sentences that say what this piece is about.", title: "A third piece", minutes: 4, date: iso("2026-08-28T12:00:00Z"), authorId: "owner" },
];

const notes: TemplatePiece[] = [
  {
    key: "thread:n3",
    title: "A short note on something",
    minutes: 1,
    date: iso("2026-09-20T07:40:00Z"),
    authorId: "owner",
    bodyHtml: "<p>A note is a few lines, posted when there is something to say. No cover, no standfirst.</p>",
    tags: ["materials", "practice"],
    replies: [
      { name: "Name", ago: "2h", text: "A reply, shown in full under the note." },
      { name: "Another name", ago: "5h", text: "A second reply." },
      { name: "Host Name", ago: "1d", text: "The host answers in the same place." },
    ],
  },
  { key: "thread:n4", title: "A later note", minutes: 1, date: iso("2026-09-24T09:00:00Z"), authorId: "owner", bodyHtml: "<p>A later note.</p>" },
  { key: "thread:n2", title: "An earlier one", minutes: 1, date: iso("2026-09-14T09:00:00Z"), authorId: "owner", bodyHtml: "<p>An earlier note.</p>" },
  { key: "thread:n1", title: "Older still", minutes: 1, date: iso("2026-09-09T09:00:00Z"), authorId: "owner", bodyHtml: "<p>An older note.</p>" },
];

const FEATURED: Record<TemplateId, SurfaceOffer | null> = {
  event,
  announcement,
  note: null,
  service,
  artwork,
  series,
  essay: null,
  feature: null,
  document: null,
  gazette: null,
  profile: event,
};

/** The sample site as a given template would receive it. */
export function sampleData(template: TemplateId, look: Partial<SurfaceLook> = {}): TemplateData {
  const featured = FEATURED[template];
  const all = [event, service, series, artwork];
  return {
    site: { orgId: "sample", slug: "sample", name: "Site name", origin: "https://sample.arts-collective.com" },
    owner,
    featured: featured ? { ...featured, featured: true } : null,
    offers: all.filter((o) => o.key !== featured?.key),
    writing: template === "note" ? notes : pieces,
    people: { guest },
    viewer: null,
    placeholders: true,
    look: { ...DEFAULT_LOOK, ...look },
    extras: {
      category: featured?.kind === "event" ? "Music" : featured?.kind === "service" ? "One to one" : undefined,
      program: [
        { time: "7:00", label: "Doors" },
        { time: "7:45", label: "Act one" },
        { time: "8:30", label: "Act two" },
        { time: "10:00", label: "Close" },
      ],
      attendees: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }],
      photos: ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      talkCount: 8,
      replyNote: "Usually replies within a day",
      ribbon: "New date added · 2 days ago",
      facts: [
        { label: "When", value: "Sat 14 Dec", note: "8:00 pm" },
        { label: "Where", value: "Venue name", note: "Street, City" },
        { label: "Cost", value: "Free", note: "RSVP to hold a place" },
      ],
      sessions: [
        { n: 7, title: "Session title", when: "Mon 14 Dec · 6 pm PT", next: true },
        { n: 6, title: "An earlier session", when: "Mon 7 Dec" },
        { n: 5, title: "Before that", when: "Mon 30 Nov" },
      ],
    },
    pieces: template === "note" ? notes : pieces,
  };
}

/**
 * Sandbox only (`?ended=1`): the same sample with its event and series dates moved into the past, to see the
 * ended state. The live sample stays in December 2026.
 */
export function endedSampleData(d: TemplateData): TemplateData {
  const past = (o: SurfaceOffer): SurfaceOffer =>
    o.kind === "event" && o.when
      ? { ...o, when: { ...o.when, start: iso("2026-11-14T20:00:00-05:00") } }
      : o.kind === "series" && o.when
        ? { ...o, when: { ...o.when, start: iso("2026-11-09T18:00:00-08:00") } }
        : o;
  return {
    ...d,
    featured: d.featured ? past(d.featured) : null,
    offers: d.offers.map(past),
    extras: {
      ...d.extras,
      facts: d.extras.facts?.map((f) => (f.label === "When" ? { ...f, value: "Sat 14 Nov" } : f.label === "Cost" ? { label: f.label, value: f.value } : f)),
      sessions: d.extras.sessions?.map((s, i) => ({ n: s.n, title: s.title, when: ["Mon 9 Nov · 6 pm PT", "Mon 2 Nov", "Mon 26 Oct"][i] ?? s.when, past: true })),
    },
  };
}

/** Actions that never leave the browser: for the sandbox only. */
export const sampleActions: SurfaceActions = {
  rsvp: async () => ({ ok: true, follows: null }),
  follow: async (_id, input) => ({ ok: true, following: input.follow }),
  checkout: async () => ({ ok: false, error: "The sandbox takes no payments." }),
  // The quick sign-up (layer `join`). Nothing is created: the kit marks the viewer signed in for this page view.
  // Try the other answers with the email: one that starts "taken" is refused; one that starts "confirm" asks
  // for an email check instead of signing in. A sign-in whose email starts "wrong" is refused.
  join: async (input) => {
    await new Promise((r) => setTimeout(r, 250));
    const e = input.email.trim().toLowerCase();
    if (e.startsWith("taken")) return { ok: false, error: 'That email already has an account. Use "I have an account".' };
    if (e.startsWith("confirm")) return { ok: true, signedIn: false, confirm: true };
    return { ok: true, signedIn: true };
  },
  signIn: async (input) => {
    await new Promise((r) => setTimeout(r, 250));
    if (input.email.trim().toLowerCase().startsWith("wrong")) return { ok: false, error: "That email and password do not match." };
    return { ok: true, signedIn: true };
  },
};
