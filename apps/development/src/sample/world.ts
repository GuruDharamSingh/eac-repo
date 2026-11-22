// ============================================================================
// THE SHARED SAMPLE WORLD (Development app, 2026-11-20)
//
// One small invented place that every block tile can draw from, so tiles from different apps show the
// same people, gatherings and prices instead of each inventing its own. Nothing here is real: the
// organisation, the people, the prices and the places are made up, and every picture is a generated SVG
// (see ./art.ts), never a photograph.
//
// The world: LANTERN ROW ARTS, a small arts collective in the (fictional) harbour town of Fenwick.
// It has five members, a weekly gathering and a few one-off ones, three services, a handful of
// writings and forum threads, a gallery of abstract paintings, a pottery piece for sale, one walking
// tour and one experience. Dates are fixed (never "now") so tiles do not change under you.
//
// Rules for adding to it
//   - Keep it small. Add a field when a block needs it, not "just in case".
//   - Invented names only. No real person, business, address or photograph.
//   - Plain JSON-able values (strings, numbers, booleans, arrays, objects): safe to pass as block props.
//
// How a block uses it: a block with its own sample() keeps working; where it has none (or a thin one),
// src/registry/local/overrides.ts maps world values onto its prop names. The older per-app mock
// samples (registry/mocks/sunjay/sample.ts, registry/mocks/elktours/data.ts) are untouched; they could
// adopt this set by importing from "@/sample" and mapping their field names (see the notes in ./index.ts).
// ============================================================================

import { artwork, avatar, picture } from "./art";

/** The reference moment the world is set at. Everything dated is relative to this fixed instant. */
export const NOW = "2026-11-20T15:00:00.000Z";

export interface Org {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  about: string;
  town: string;
  email: string;
  website: string;
  hue: number;
  logo: string;
  cover: string;
}

export interface Person {
  id: string;
  slug: string;
  name: string;
  role: string;
  craft: string;
  bio: string;
  hue: number;
  /** Generated initials disc, never a photograph. */
  photo: string;
  links: { label: string; href: string }[];
}

export interface Gathering {
  id: string;
  slug: string;
  title: string;
  kind: "meeting" | "workshop" | "talk" | "exhibition";
  /** ISO start. */
  start: string;
  /** Human line, already formatted ("Thu 26 Nov, 7:30 pm"). */
  when: string;
  durationMinutes: number;
  place: string | null;
  online: boolean;
  recurrence: string | null;
  summary: string;
  hostId: string;
  attending: number;
  cover: string;
}

export interface Service {
  id: string;
  slug: string;
  title: string;
  summary: string;
  /** Major units. Null = on request. */
  price: number | null;
  priceMax: number | null;
  currency: "CAD";
  priceLabel: string;
  duration: string;
  hostId: string;
  cover: string;
}

export interface Writing {
  id: string;
  slug: string;
  title: string;
  lede: string;
  bodyHtml: string;
  authorId: string;
  /** ISO. */
  publishedAt: string;
  dateLabel: string;
  readingMinutes: number;
  feed: string;
  cover: string | null;
  membersOnly: boolean;
}

export interface ForumThread {
  id: string;
  title: string;
  excerpt: string;
  authorId: string;
  replies: number;
  /** ISO of the last reply. */
  lastAt: string;
  lastLabel: string;
  topic: string;
}

export interface Artwork {
  id: string;
  slug: string;
  title: string;
  artistId: string;
  year: number;
  medium: string;
  size: string;
  price: number | null;
  priceLabel: string;
  status: "available" | "sold" | "not-for-sale";
  hue: number;
  image: string;
  alt: string;
}

export interface Gallery {
  id: string;
  title: string;
  blurb: string;
  artworkIds: string[];
}

export interface TourStop {
  id: string;
  name: string;
  /** Local time and length ("10:20, 25 min"). */
  when: string;
  note: string;
  placeId: string;
  hue: number;
  image: string;
}

export interface Tour {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  durationMinutes: number;
  languages: string[];
  effort: string;
  maxParty: number;
  meeting: string;
  price: number;
  priceLabel: string;
  currency: "CAD";
  guideId: string;
  cover: string;
  highlights: string[];
  includes: string[];
  departures: { id: string; day: string; time: string; left: string; start: string }[];
  stops: TourStop[];
}

export interface Experience {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  durationMinutes: number;
  price: number;
  priceLabel: string;
  hostIds: string[];
  placeId: string;
  cover: string;
  what: string[];
}

export interface Place {
  id: string;
  name: string;
  kind: "studio" | "hall" | "harbour" | "market" | "garden" | "cafe";
  line: string;
  /** Invented coordinates around the (fictional) town; never a real address. */
  lat: number;
  lng: number;
  hue: number;
  image: string;
}

export interface ShopPiece {
  id: string;
  slug: string;
  title: string;
  makerId: string;
  kind: string;
  year: number;
  price: number;
  priceLabel: string;
  status: "available" | "sold";
  glaze: string;
  size: string;
  blurb: string;
  hue: number;
  images: string[];
}

// ── the organisation ────────────────────────────────────────────────────────

export const ORG: Org = {
  id: "org-lantern-row",
  name: "Lantern Row Arts",
  slug: "lantern-row",
  tagline: "Making things together, one evening at a time.",
  about: "Lantern Row Arts is a small collective of makers, writers and hosts in the harbour town of Fenwick. We run a weekly open studio, a few workshops a season, and a shop for what comes out of the kiln.",
  town: "Fenwick Harbour",
  email: "hello@lantern-row.example",
  website: "https://lantern-row.example",
  hue: 28,
  logo: avatar("Lantern Row", 28, 240),
  cover: picture(28, "Lantern Row Arts", 1600, 640),
};

// ── people (five, invented; photos are initials discs) ──────────────────────

const p = (id: string, slug: string, name: string, role: string, craft: string, bio: string, hue: number): Person => ({
  id,
  slug,
  name,
  role,
  craft,
  bio,
  hue,
  photo: avatar(name, hue),
  links: [
    { label: "Studio page", href: `/people/${slug}` },
    { label: "Newsletter", href: `/people/${slug}/news` },
  ],
});

export const PEOPLE: Person[] = [
  p("p1", "maren-aldous", "Maren Aldous", "Convener", "Printmaking", "Maren started the open studio in a borrowed boathouse and still opens the door on Thursdays. She prints in two colours and writes the programme.", 28),
  p("p2", "teodor-vance", "Teodor Vance", "Potter", "Ceramics", "Teodor throws tableware and the occasional large vessel. He fires on Fridays and glazes in the colours of the harbour.", 196),
  p("p3", "ines-halloran", "Ines Halloran", "Writer", "Essays and notes", "Ines writes short essays on looking and listening, and keeps the collective's journal.", 340),
  p("p4", "dov-tennant", "Dov Tennant", "Guide", "Walking tours", "Dov walks visitors through Fenwick's back lanes, net lofts and chandlers, and knows who owns each cat.", 120),
  p("p5", "pia-okello", "Pia Okello", "Painter", "Colour-field painting", "Pia paints large flat fields of colour and teaches a Sunday morning class for beginners.", 262),
];

export const person = (id: string): Person => PEOPLE.find((x) => x.id === id) ?? PEOPLE[0];

// ── places ──────────────────────────────────────────────────────────────────

const pl = (id: string, name: string, kind: Place["kind"], line: string, lat: number, lng: number, hue: number): Place => ({
  id,
  name,
  kind,
  line,
  lat,
  lng,
  hue,
  image: picture(hue, name, 800, 520),
});

export const PLACES: Place[] = [
  pl("pl1", "The Boathouse", "studio", "The open studio: two presses, a long table and a kettle.", 44.402, -64.31, 28),
  pl("pl2", "Kiln Yard", "studio", "A shared yard with two kilns and a glaze shed.", 44.4026, -64.3086, 196),
  pl("pl3", "Net Loft Hall", "hall", "A raftered hall for talks, workshops and the winter show.", 44.4012, -64.3112, 20),
  pl("pl4", "Quay Market", "market", "A Saturday market under the old fish shed.", 44.4005, -64.3135, 95),
  pl("pl5", "Chandler's Row", "harbour", "Rope, brass and a window full of bobbing glass floats.", 44.4019, -64.3071, 210),
  pl("pl6", "The Lantern Garden", "garden", "A walled garden behind the hall, lit on winter evenings.", 44.4021, -64.3118, 150),
];

export const place = (id: string): Place => PLACES.find((x) => x.id === id) ?? PLACES[0];

// ── gatherings (one weekly, the rest one-off) ───────────────────────────────

const g = (id: string, slug: string, title: string, kind: Gathering["kind"], start: string, when: string, durationMinutes: number, placeName: string | null, online: boolean, recurrence: string | null, summary: string, hostId: string, attending: number, hue: number): Gathering => ({
  id,
  slug,
  title,
  kind,
  start,
  when,
  durationMinutes,
  place: placeName,
  online,
  recurrence,
  summary,
  hostId,
  attending,
  cover: picture(hue, "", 800, 450),
});

export const GATHERINGS: Gathering[] = [
  g("g1", "open-studio", "Open studio", "meeting", "2026-11-26T23:30:00.000Z", "Thu 26 Nov, 7:30 pm", 150, "The Boathouse", false, "Weekly, Thursdays", "Bring a project or start one. Presses are free to use; tea and biscuits provided.", "p1", 14, 28),
  g("g2", "glaze-day", "Glaze day", "workshop", "2026-12-05T15:00:00.000Z", "Sat 5 Dec, 10:00 am", 240, "Kiln Yard", false, null, "Glaze your own bisque pieces and watch the kiln packed for firing. All materials included.", "p2", 8, 196),
  g("g3", "listening-walk", "A listening walk", "talk", "2026-12-12T16:00:00.000Z", "Sat 12 Dec, 11:00 am", 90, "Quay Market", false, null, "An easy walk with one rule: no talking for the first twenty minutes.", "p4", 11, 120),
  g("g4", "winter-show", "The winter show", "exhibition", "2026-12-18T22:00:00.000Z", "Fri 18 Dec, 5:00 pm", 180, "Net Loft Hall", false, null, "A one-evening exhibition of what the collective made this season. Mulled cider in the garden.", "p3", 40, 262),
  g("g5", "writing-circle", "Writing circle (online)", "meeting", "2026-12-01T00:00:00.000Z", "Mon 30 Nov, 7:00 pm", 75, null, true, "Fortnightly, Mondays", "Fifteen minutes of writing, then reading aloud. Short pieces welcome.", "p3", 9, 340),
];

export const gathering = (id: string): Gathering => GATHERINGS.find((x) => x.id === id) ?? GATHERINGS[0];

// ── services (with prices) ──────────────────────────────────────────────────

const s = (id: string, slug: string, title: string, summary: string, price: number | null, priceMax: number | null, duration: string, hostId: string, hue: number): Service => ({
  id,
  slug,
  title,
  summary,
  price,
  priceMax,
  currency: "CAD",
  priceLabel: price == null ? "On request" : priceMax && priceMax > price ? `$${price} to $${priceMax}` : `$${price}`,
  duration,
  hostId,
  cover: picture(hue, "", 800, 500),
});

export const SERVICES: Service[] = [
  s("sv1", "intro-printmaking", "Introduction to printmaking", "A relaxed morning at the press: you leave with six prints and the knowledge to make more.", 85, null, "3 hours", "p1", 28),
  s("sv2", "pottery-evening", "Pottery evening for two", "Throw a bowl each on the wheel, with tea. We fire and glaze them for you.", 140, 180, "2 hours", "p2", 196),
  s("sv3", "private-walk", "A private harbour walk", "Dov's back-lane walk for your own group, up to eight people.", 220, null, "2 hours 30", "p4", 120),
];

export const service = (id: string): Service => SERVICES.find((x) => x.id === id) ?? SERVICES[0];

// ── writings ────────────────────────────────────────────────────────────────

const w = (id: string, slug: string, title: string, lede: string, body: string, authorId: string, publishedAt: string, dateLabel: string, readingMinutes: number, hue: number | null, membersOnly = false): Writing => ({
  id,
  slug,
  title,
  lede,
  bodyHtml: body,
  authorId,
  publishedAt,
  dateLabel,
  readingMinutes,
  feed: "journal",
  cover: hue == null ? null : picture(hue, "", 900, 600),
  membersOnly,
});

export const WRITINGS: Writing[] = [
  w("w1", "the-second-colour", "The second colour", "Why a print with two colours is a conversation and a print with one is a statement.", "<p>Printing in one colour is a statement: here is the shape, here is the paper. The second colour changes the grammar. Suddenly the shapes talk to each other, and the gap between them, where the two inks nearly meet, becomes the most interesting part of the sheet.</p><p>We spent three Thursdays this autumn on nothing but registration, the small art of getting the second pass to land where you meant it to. Most of us never managed it exactly, and most of us liked the misses better.</p><h2>What we kept</h2><p>A short rule for the studio wall: <em>let the near miss stay</em>.</p>", "p1", "2026-11-12T12:00:00.000Z", "12 November 2026", 6, 28),
  w("w2", "glaze-notes", "Notes from the glaze shed", "A page of failures and what each one taught us about temperature.", "<p>The shed smells of wet slate and wood smoke. This season's tests: a celadon that went grey, a copper that went a surprising and lovely green, and a white that crawled off the shoulder of every bowl.</p>", "p2", "2026-11-05T12:00:00.000Z", "5 November 2026", 4, 196),
  w("w3", "listening-to-a-room", "Listening to a room", "What ten minutes of agreed quiet does to a hall full of people.", "<p>Ten minutes is long. After the first two, the room starts to speak: the radiator, the harbour, a chair that remembers someone.</p>", "p3", "2026-10-28T12:00:00.000Z", "28 October 2026", 5, null),
  w("w4", "a-field-of-blue", "A field of blue", "Pia on painting one colour for an entire month.", "<p>Month one: blue. I mixed it forty times and each was a different mood. The only rule was that I could not call it finished until I stopped wanting to change it.</p>", "p5", "2026-10-14T12:00:00.000Z", "14 October 2026", 7, 262, true),
];

export const writing = (id: string): Writing => WRITINGS.find((x) => x.id === id) ?? WRITINGS[0];

// ── forum threads ───────────────────────────────────────────────────────────

export const FORUM: ForumThread[] = [
  { id: "f1", title: "Who has a spare kiln shelf?", excerpt: "Mine cracked in the last firing. A 12 inch half-moon would do.", authorId: "p2", replies: 6, lastAt: "2026-11-19T18:20:00.000Z", lastLabel: "yesterday", topic: "Studio" },
  { id: "f2", title: "Winter show: help hanging", excerpt: "We need four people on Thursday evening and a ladder that does not wobble.", authorId: "p3", replies: 11, lastAt: "2026-11-20T09:05:00.000Z", lastLabel: "this morning", topic: "Events" },
  { id: "f3", title: "Registration jig: share your trick", excerpt: "Post a photo of how you line up the second colour. Mine involves a lot of tape.", authorId: "p1", replies: 9, lastAt: "2026-11-18T21:45:00.000Z", lastLabel: "2 days ago", topic: "Printmaking" },
  { id: "f4", title: "Listening walk: where should we end?", excerpt: "Quay Market or the Lantern Garden? Both have tea.", authorId: "p4", replies: 4, lastAt: "2026-11-17T12:30:00.000Z", lastLabel: "3 days ago", topic: "Events" },
];

// ── artworks and galleries ──────────────────────────────────────────────────

const art = (id: string, slug: string, title: string, artistId: string, year: number, medium: string, size: string, price: number | null, status: Artwork["status"], hue: number, seed: number): Artwork => ({
  id,
  slug,
  title,
  artistId,
  year,
  medium,
  size,
  price,
  priceLabel: status === "sold" ? "Sold" : price == null ? "Not for sale" : `$${price.toLocaleString("en-CA")}`,
  status,
  hue,
  image: artwork(hue, seed),
  alt: `${title}: an abstract painting in flat fields of colour`,
});

export const ARTWORKS: Artwork[] = [
  art("a1", "blue-month-one", "Blue, month one", "p5", 2026, "Acrylic on canvas", "90 x 120 cm", 1800, "available", 262, 1),
  art("a2", "blue-month-two", "Blue, month two", "p5", 2026, "Acrylic on canvas", "90 x 120 cm", 1800, "available", 252, 2),
  art("a3", "low-tide-red", "Low tide, red", "p5", 2025, "Oil on linen", "60 x 80 cm", 1200, "sold", 8, 3),
  art("a4", "harbour-ochre", "Harbour ochre", "p5", 2025, "Oil on linen", "60 x 80 cm", 1200, "available", 40, 4),
  art("a5", "two-colour-study", "Two-colour study", "p1", 2026, "Linocut, edition of 20", "30 x 40 cm", 220, "available", 28, 5),
  art("a6", "net-loft-print", "Net loft", "p1", 2026, "Linocut, edition of 20", "30 x 40 cm", 220, "available", 190, 6),
];

export const artworkById = (id: string): Artwork => ARTWORKS.find((x) => x.id === id) ?? ARTWORKS[0];

export const GALLERIES: Gallery[] = [
  { id: "gal1", title: "Colour fields", blurb: "Pia Okello's flat colour paintings, 2025 to 2026.", artworkIds: ["a1", "a2", "a3", "a4"] },
  { id: "gal2", title: "From the press", blurb: "Maren Aldous's two-colour linocuts.", artworkIds: ["a5", "a6"] },
];

// ── a tour with stops, and an experience ────────────────────────────────────

const stop = (id: string, name: string, when: string, note: string, placeId: string, hue: number): TourStop => ({ id, name, when, note, placeId, hue, image: picture(hue, name, 800, 520) });

export const TOUR: Tour = {
  id: "tour1",
  slug: "back-lanes-of-fenwick",
  title: "The back lanes of Fenwick",
  excerpt: "Two and a half hours through net lofts, a kiln yard and a chandler's window, with a guide who knows every cat.",
  durationMinutes: 150,
  languages: ["English"],
  effort: "Easy, 3 km, some steps",
  maxParty: 8,
  meeting: "The Boathouse door, Lantern Row",
  price: 45,
  priceLabel: "$45",
  currency: "CAD",
  guideId: "p4",
  cover: picture(210, "The back lanes of Fenwick", 1280, 540),
  highlights: ["A working kiln yard", "The net loft hall", "Tea in a walled garden"],
  includes: ["Guide for the full walk", "Tea and a biscuit", "A small printed map"],
  departures: [
    { id: "d1", day: "Sat 5 Dec", time: "10:00", left: "5 places left", start: "2026-12-05T15:00:00.000Z" },
    { id: "d2", day: "Sat 12 Dec", time: "10:00", left: "8 places left", start: "2026-12-12T15:00:00.000Z" },
    { id: "d3", day: "Sun 20 Dec", time: "14:00", left: "3 places left", start: "2026-12-20T19:00:00.000Z" },
  ],
  stops: [
    stop("ts1", "The Boathouse", "10:00, 15 min", "We meet at the door; Maren shows the presses.", "pl1", 28),
    stop("ts2", "Kiln Yard", "10:20, 25 min", "Two kilns, a glaze shed and the best view of the roofs.", "pl2", 196),
    stop("ts3", "Net Loft Hall", "10:50, 30 min", "Raftered, cold and wonderful. Sit under the beams.", "pl3", 20),
    stop("ts4", "Chandler's Row", "11:25, 20 min", "Rope, brass and a window of glass floats.", "pl5", 210),
    stop("ts5", "The Lantern Garden", "11:50, 30 min", "Tea in the walled garden.", "pl6", 150),
  ],
};

export const EXPERIENCE: Experience = {
  id: "exp1",
  slug: "a-day-at-the-wheel",
  title: "A day at the wheel",
  excerpt: "Spend a day with Teodor at the kiln yard: throw, trim, glaze, and take your own bowl home when it is fired.",
  durationMinutes: 360,
  price: 160,
  priceLabel: "$160",
  hostIds: ["p2", "p1"],
  placeId: "pl2",
  cover: picture(196, "A day at the wheel", 1280, 720),
  what: ["Throw two bowls on the wheel", "Trim and sign them", "Choose glazes from the shed", "Lunch at Quay Market"],
};

// ── a shop piece ────────────────────────────────────────────────────────────

export const SHOP_PIECE: ShopPiece = {
  id: "piece1",
  slug: "harbour-bowl-celadon",
  title: "Harbour bowl, celadon",
  makerId: "p2",
  kind: "Bowl",
  year: 2026,
  price: 68,
  priceLabel: "$68",
  status: "available",
  glaze: "Celadon over white stoneware",
  size: "19 cm wide, 8 cm tall",
  blurb: "A wide, shallow bowl with a thick foot, thrown and glazed in the kiln yard. Food safe and dishwasher safe, though it prefers a sink.",
  hue: 170,
  images: [picture(170, "Harbour bowl", 900, 900), picture(180, "Seen from above", 900, 900), picture(160, "The foot", 900, 900)],
};

/** The whole world in one object, for blocks that want a bundle. */
export const WORLD = {
  now: NOW,
  org: ORG,
  people: PEOPLE,
  places: PLACES,
  gatherings: GATHERINGS,
  services: SERVICES,
  writings: WRITINGS,
  forum: FORUM,
  artworks: ARTWORKS,
  galleries: GALLERIES,
  tour: TOUR,
  experience: EXPERIENCE,
  shopPiece: SHOP_PIECE,
} as const;
