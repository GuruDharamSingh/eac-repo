// Invented sample content for the elktours mocks: one tour, one experience, stops, places, people.
// Nothing here is real data; names and prices are made up.

/** A soft gradient "photo" as an inline SVG, so the mocks need no image files. */
export function art(hue: number, label = "", w = 640, h = 480): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},38%,38%)'/><stop offset='1' stop-color='hsl(${(hue + 40) % 360},34%,20%)'/></linearGradient></defs>` +
    `<rect width='100%' height='100%' fill='url(#g)'/>` +
    `<circle cx='${w * 0.72}' cy='${h * 0.3}' r='${h * 0.12}' fill='hsl(${hue},60%,78%)' opacity='.55'/>` +
    `<path d='M0 ${h * 0.78} Q ${w * 0.3} ${h * 0.55} ${w * 0.55} ${h * 0.74} T ${w} ${h * 0.62} V ${h} H0Z' fill='hsl(${hue},30%,14%)' opacity='.7'/>` +
    (label ? `<text x='${w * 0.05}' y='${h * 0.93}' font-family='Georgia,serif' font-size='${Math.round(h * 0.07)}' fill='white' opacity='.75'>${label}</text>` : "") +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_TOUR = {
  slug: "passages-and-painters",
  title: "Passages and Painters: a Left Bank walk",
  excerpt: "Two and a half hours through covered passages, a printmaker's courtyard and a painter's old street, with a guide who lives there.",
  typeLabel: "Walking tour",
  durationMinutes: 150,
  languages: ["English", "Francais"],
  effort: "Easy, 3 km, some cobbles",
  maxParty: 8,
  location: "Fountain at Place Example, 6th arrondissement",
  price: 45,
  priceLabel: "€45",
  currency: "EUR",
  status: "published",
  cover: art(28, "Passages and Painters", 1280, 540),
  poster: art(210, "Fly-over film", 1280, 720),
  authorName: "Marguerite Delmas",
  body: "<p>We start at a fountain and follow the covered passages that Parisians use to dodge the rain. Along the way the guide opens doors you would walk past: a printmaker's courtyard, a framer who still gilds by hand, and the street where a painter kept a studio for forty years.</p><p>Small group, on foot, with a coffee stop halfway.</p>",
  highlights: ["Three covered passages", "A printmaker's courtyard", "Coffee at a painter's old cafe"],
  includes: ["Guide for the full walk", "Coffee stop", "A small printed map"],
  departures: [
    { id: "d1", day: "Sat 21 Nov", time: "10:00", left: "4 places left" },
    { id: "d2", day: "Sun 22 Nov", time: "10:00", left: "7 places left" },
    { id: "d3", day: "Sat 28 Nov", time: "10:00", left: "8 places left" },
  ],
  stops: [
    { id: "s1", name: "The fountain", when: "10:00 · 10 min", note: "We meet, and walk through the first passage.", hue: 200 },
    { id: "s2", name: "Passage des Example", when: "10:20 · 25 min", note: "Glass roof, a bookbinder and a stamp dealer.", hue: 30 },
    { id: "s3", name: "The printmaker's courtyard", when: "11:00 · 30 min", note: "Presses, plates and the smell of ink.", hue: 340 },
    { id: "s4", name: "A framer on rue Sample", when: "11:40 · 15 min", note: "Gilding by hand, since 1921.", hue: 48 },
    { id: "s5", name: "The painter's street", when: "12:05 · 25 min", note: "Number 14, third floor: the studio window.", hue: 160 },
  ],
};

export const SAMPLE_OTHER_TOURS = [
  { id: "t2", title: "Ateliers of the Marais", excerpt: "Four working studios behind ordinary doors.", duration: "3 h", language: "English", price: "€60", next: "Next: Sun 22 Nov, 14:00", hue: 20 },
  { id: "t3", title: "A morning at the market", excerpt: "Cheese, bread and a cook who knows everyone.", duration: "2 h", language: "English", price: "€38", next: "Next: Sat 21 Nov, 09:00", hue: 95 },
  { id: "t4", title: "Night walk along the quays", excerpt: "Bridges, bouquinistes and the river after dark.", duration: "1 h 45", language: "Francais", price: "Price on request", next: "Dates coming", hue: 235 },
];

export const SAMPLE_PEOPLE = [
  { id: "u1", role: "artist", name: "Odile Ferrant", craft: "Printmaker", area: "Belleville", status: "Open to visits", hue: 340 },
  { id: "u2", role: "host", name: "Tomas Aubry", craft: "Framer", area: "6th", status: "By request", hue: 48 },
];

export const SAMPLE_EXPERIENCE = {
  slug: "an-hour-in-a-printmakers-studio",
  title: "An hour in a printmaker's studio",
  excerpt: "Pull a print yourself on a press older than the building, then talk it over with the artist.",
  format: "In person",
  where: "Belleville, Paris",
  length: "1 h 30",
  from: "€70",
  priceNote: "indicative",
  cover: art(340, "Printmaker's studio", 1280, 540),
  images: [art(340, "Press", 640, 480), art(20, "Plates", 640, 480), art(200, "Window", 640, 480), art(95, "Paper", 640, 480), art(48, "Ink", 640, 480), art(280, "Prints", 640, 480)],
  body: "<p>A small studio at the back of a courtyard. The artist shows how a plate is inked and wiped, then you pull your own proof on the press.</p><p>Tea is provided. Groups of up to four.</p>",
  highlights: ["Pull your own print", "Meet the artist at work", "Take the proof home"],
  people: SAMPLE_PEOPLE,
};

export const SAMPLE_OTHER_EXPERIENCES = [
  { id: "x2", title: "A private view of a painter's archive", excerpt: "Sketchbooks and letters, shown by the family.", facts: "In person · 1 h", artist: "Anselme Roux", price: "€55", where: "Montparnasse, Paris", hue: 20 },
  { id: "x3", title: "Sketching the passages", excerpt: "A drawing walk with paper and charcoal supplied.", facts: "In person · 2 h", artist: "Lise Maret", price: "€40", where: "2nd arrondissement", hue: 160 },
  { id: "x4", title: "Colour talk, online", excerpt: "A live conversation about pigments and light.", facts: "Online · 45 min", artist: "Odile Ferrant", price: "", where: "Online", hue: 235 },
];

// ---- phone-shaped data (the shapes of blocks/mobile/types.ts, invented) ----
export const M_TOUR = {
  slug: SAMPLE_TOUR.slug,
  title: SAMPLE_TOUR.title,
  guide: { name: "Marguerite Delmas", craft: "Guide and historian", photo: art(28, "", 120, 120), languages: "English and Francais" },
  bodyHtml: SAMPLE_TOUR.body,
  facts: [
    { label: "Length", value: "2 h 30" },
    { label: "Price", value: "€45" },
    { label: "Group", value: "up to 8" },
    { label: "Language", value: "EN / FR" },
  ],
  meetAt: SAMPLE_TOUR.location,
  priceLabel: "€45",
  priced: true,
  slots: [
    { slotId: "d1", day: "Sat 21 Nov", left: "4 left" },
    { slotId: "d2", day: "Sun 22 Nov", left: "7 left" },
    { slotId: "d3", day: "Sat 28 Nov", left: "8 left" },
  ],
  stops: SAMPLE_TOUR.stops.map((s) => ({ ...s, still: art(s.hue, "", 152, 112) })),
  cover: art(28, "Passages and Painters", 716, 660),
};

export const M_PLACES = [
  { id: "p1", name: "A glass-roofed passage", kind: "Passage", area: "2nd", img: art(30, "", 336, 392), tags: ["Passage"], favourite: true },
  { id: "p2", name: "The printmaker's courtyard", kind: "Atelier", area: "Belleville", img: art(340, "", 336, 392), tags: ["Atelier"], favourite: true },
  { id: "p3", name: "A corner cafe", kind: "Cafe", area: "6th", img: art(48, "", 336, 392), tags: ["Cafe"], favourite: false },
  { id: "p4", name: "The painter's street", kind: "Street", area: "14th", img: art(160, "", 336, 392), tags: ["Street"], favourite: false },
];

export const M_GUIDES = [
  { id: "g1", name: "Marguerite Delmas", craft: "Historian", bio: "Walks the passages most weeks.", initial: "M", photo: art(28, "", 120, 120), tours: [{ slug: "t1", title: "Passages and Painters", sub: "Sat 21 Nov, 10:00" }] },
  { id: "g2", name: "Jules Perrin", craft: "Photographer", bio: "Leads the evening quay walks.", initial: "J", photo: art(235, "", 120, 120), tours: [] },
  { id: "g3", name: "Ines Colombe", craft: "Cook", bio: "Knows every stall at the market.", initial: "I", photo: null, tours: [] },
];

export const M_PEOPLE = [
  { slug: "marguerite", name: "Marguerite Delmas", kind: "guide", craft: "Historian", area: "Paris 6e", status: null, initial: "M", photo: art(28, "", 400, 400) },
  { slug: "odile", name: "Odile Ferrant", kind: "artist", craft: "Printmaker", area: "Belleville", status: "Open to visits", initial: "O", photo: art(340, "", 400, 400) },
  { slug: "jules", name: "Jules Perrin", kind: "guide", craft: "Photographer", area: "Paris 4e", status: null, initial: "J", photo: art(235, "", 400, 400) },
  { slug: "lise", name: "Lise Maret", kind: "artist", craft: "Draughtswoman", area: "2nd", status: "By request", initial: "L", photo: null },
];

export const M_EXPERIENCES = [
  { id: "e1", title: "An hour in a printmaker's studio", meta: "In person · 1 h 30", artist: "Odile Ferrant", craft: "Printmaker", pitch: "Pull a print on a press older than the building.", where: "Belleville, Paris", img: art(340, "", 152, 152) },
  { id: "e2", title: "Sketching the passages", meta: "In person · 2 h", artist: "Lise Maret", craft: "Draughtswoman", pitch: "A drawing walk, paper and charcoal supplied.", where: "2nd arrondissement", img: null },
];
