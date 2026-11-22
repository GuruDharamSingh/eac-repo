// Invented sample content for the Sunjay (Para Theater) mocks: a sample teacher, gathering, services,
// writing and pictures. No real people, no real photographs: the pictures are neutral generated SVGs.

/** A neutral placeholder picture as a data URI (a soft two-tone wash and a caption). */
export function placeholder(a = "#3b4144", b = "#262b2d", label = "", w = 800, h = 600): string {
  const text = label ? `<text x="50%" y="52%" fill="#a3a09a" font-family="Georgia,serif" font-size="${Math.round(w / 22)}" text-anchor="middle">${label}</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${text}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** A fixed date (a Thursday evening), so the mocks never change under you. */
export const NEXT = "2026-12-03T00:30:00.000Z";

export const GUIDE = {
  displayName: "Ilan Marlowe",
  roleTitle: "Guide",
  bio: "Ilan leads a weekly practice of movement, voice and presence. He has taught small groups for fifteen years and writes about attention and the body.",
  photoUrl: placeholder("#4a5053", "#2c3234", "Photograph", 800, 600),
  links: [
    { label: "Elkdonis Arts", emphasis: true },
    { label: "Newsletter", emphasis: false },
  ],
};

export interface MockThread {
  id: string;
  title: string;
  kind: string;
  excerpt: string;
  when: string;
  duration: string | null;
  place: string | null;
  online: boolean;
  recurrence: string | null;
  author: string;
  cover: string | null;
  attending?: number;
  published: string;
}

export const THREADS: MockThread[] = [
  { id: "t1", title: "Ritual Theatre Lab", kind: "meeting", excerpt: "A weekly lab for movement, voice and presence. Bring comfortable clothes and something to write with.", when: "Thu, Dec 3 · 7:30 pm", duration: "1 h 30 min", place: null, online: true, recurrence: "Weekly", author: "Ilan Marlowe", cover: placeholder("#4e5659", "#2b3133", "", 800, 450), attending: 12, published: "Nov 18, 2026" },
  { id: "t2", title: "Notes on attention", kind: "post", excerpt: "What changes when a room agrees to be quiet for ten minutes, and what does not.", when: "", duration: null, place: null, online: false, recurrence: null, author: "Ilan Marlowe", cover: null, published: "Nov 10, 2026" },
  { id: "t3", title: "Winter workshop: the voice as an instrument", kind: "workshop", excerpt: "A half-day for breath, resonance and the first sound.", when: "Sat, Dec 12 · 10:00 am", duration: "4 h", place: "Toronto", online: false, recurrence: null, author: "Ilan Marlowe", cover: placeholder("#59603f", "#2e3322", "", 800, 450), attending: 6, published: "Nov 2, 2026" },
  { id: "t4", title: "Reading list for the winter term", kind: "post", excerpt: "Six short books we will draw on, with a line on why each.", when: "", duration: null, place: null, online: false, recurrence: null, author: "Ilan Marlowe", cover: null, published: "Oct 21, 2026" },
];

export const SHELF = [
  { id: "w1", slug: "on-attention", title: "On attention, and the body that carries it", lede: "A short essay on why practice begins below the neck.", coverImageUrl: placeholder("#51595c", "#2b3133", "", 900, 600), publishedAt: "2026-11-12T12:00:00.000Z", readingMinutes: 7 },
  { id: "w2", slug: "quiet-rooms", title: "Quiet rooms", lede: "Notes from ten minutes of agreed silence.", coverImageUrl: null, publishedAt: "2026-10-30T12:00:00.000Z", readingMinutes: 4 },
  { id: "w3", slug: "the-first-sound", title: "The first sound", lede: "What a workshop asks of a beginner's voice.", coverImageUrl: null, publishedAt: "2026-10-04T12:00:00.000Z", readingMinutes: 5 },
  { id: "w4", slug: "weekly-practice", title: "A weekly practice, kept", lede: "Why the same hour each week matters more than the hour.", coverImageUrl: null, publishedAt: "2026-09-19T12:00:00.000Z", readingMinutes: 6 },
];

export const IMAGES = [
  { url: placeholder("#4d5457", "#2a2f31", "Studio", 1000, 700), name: "Studio" },
  { url: placeholder("#5a5242", "#2e2a20", "Rehearsal", 1000, 700), name: "Rehearsal" },
  { url: placeholder("#425057", "#222e33", "Hall", 1000, 700), name: "Hall" },
];

export const EVENT = {
  id: "ev1",
  title: "Ritual Theatre Lab",
  kicker: "Gathering · Weekly",
  crumb: "← Gatherings",
  excerpt: "A weekly lab for movement, voice and presence.",
  next: "Thu, Dec 3 · 7:30 pm Toronto",
  length: "1 h 30 min",
  where: "Online",
  host: "Ilan Marlowe",
  cover: placeholder("#4e5659", "#2b3133", "", 800, 600),
  description: [
    "A weekly lab for movement, voice and presence. Each evening starts with a short warm-up, moves into guided exploration in pairs, and ends with a few minutes of shared writing.",
    "Bring comfortable clothes and something to write with. No experience is needed.",
  ],
  attending: 12,
  limit: 20,
  attendees: ["Mara", "Joss", "Ines", "Tobias", "Wren", "Alder"],
  materials: [
    { id: "m1", filename: "Warm-up sequence.pdf", kb: 214 },
    { id: "m2", filename: "Reading for week three.pdf", kb: 530 },
  ],
};

export interface MockService {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  body: string[];
  facts: string[];
  price: string;
  sliding: string | null;
  cover: string;
}

export const SERVICES: MockService[] = [
  { id: "s1", title: "Movement Lab series", subtitle: "Six evenings of voice and movement", summary: "A small group meets weekly to work from the body's own impulses.", body: ["Each evening begins with a warm-up and moves into guided exploration. No experience needed.", "Groups are capped at twelve so everyone is seen."], facts: ["Group", "In person", "6 sessions", "2 h each", "Weekly", "Toronto"], price: "CA$40-80", sliding: "Pay what you can within the range.", cover: placeholder("#4e5659", "#2b3133", "", 960, 540) },
  { id: "s2", title: "One-to-one session", subtitle: "An hour, just for you", summary: "A private session to work on one question, in person or online.", body: ["We begin by listening, then choose one thing to work on."], facts: ["One to one", "In person and online", "1 h each"], price: "CA$90", sliding: null, cover: placeholder("#59603f", "#2e3322", "", 960, 540) },
  { id: "s3", title: "Voice at home", subtitle: "A self-paced course", summary: "Eight short recorded lessons to follow at your own pace.", body: ["Lessons are about fifteen minutes each."], facts: ["At your own pace", "Online", "8 sessions"], price: "CA$60", sliding: null, cover: placeholder("#5a5242", "#2e2a20", "", 960, 540) },
];

export const ME = {
  name: "Wren Alder",
  headline: "Member since 2024",
  role: "member",
  orgName: "Para Theater",
  rsvps: [
    { id: "r1", title: "Ritual Theatre Lab", when: "Thu, Dec 3, 7:30 p.m." },
    { id: "r2", title: "Winter workshop: the voice as an instrument", when: "Sat, Dec 12, 10:00 a.m." },
  ],
};

export const FORUM = {
  title: "Para Theater",
  href: "/forum",
  topicCount: 41,
  postCount: 268,
  unreadCount: null,
  unreadHref: null,
  composeHref: null,
  feeds: [
    { slug: "general", name: "General", topicCount: 18, href: "/forum/general", accent: "#c9ae79" },
    { slug: "practice", name: "Practice notes", topicCount: 15, href: "/forum/practice", accent: "#8da882" },
    { slug: "events", name: "Gatherings", topicCount: 8, href: "/forum/events", accent: "#ce9a62" },
  ],
  recent: [
    { id: "f1", title: "What did you notice after the first week?", kind: "post", feedName: "Practice notes", authorName: "Mara", replyCount: 9, at: "2026-11-18T18:00:00.000Z", href: "/forum/t/1" },
    { id: "f2", title: "Carpooling to the winter workshop", kind: "post", feedName: "Gatherings", authorName: "Joss", replyCount: 4, at: "2026-11-17T14:00:00.000Z", href: "/forum/t/2" },
    { id: "f3", title: "Introduce yourself", kind: "post", feedName: "General", authorName: "Ines", replyCount: 23, at: "2026-11-12T10:00:00.000Z", href: "/forum/t/3" },
  ],
};

export const STANDING = {
  event: {
    id: "ev1",
    title: "Ritual Theatre Lab",
    slug: "ritual-theatre-lab",
    kind: "meeting",
    scheduledAt: NEXT,
    durationMinutes: 90,
    location: null,
    format: "online",
    meetingUrl: null,
    talkToken: null,
    coverImageUrl: placeholder("#4e5659", "#2b3133", "", 800, 450),
    recurrencePattern: "WEEKLY",
    section: "gatherings",
    attendeeLimit: 20,
    rsvpCount: 12,
    isRsvpEnabled: true,
  },
  at: new Date(NEXT),
  source: "weekly" as const,
};

/** Calendar events spread over the current month so the grid is never empty. */
export function monthEvents() {
  const now = new Date();
  const mk = (day: number, hour: number, title: string, kind: string, rec: string | null = null, n = 0) => {
    const d = new Date(now.getFullYear(), now.getMonth(), day, hour, 0, 0);
    return {
      id: `c${day}-${title}`,
      title,
      slug: title.toLowerCase().replace(/[^a-z]+/g, "-"),
      kind,
      scheduledAt: d.toISOString(),
      durationMinutes: 90,
      location: null,
      format: "online",
      meetingUrl: null,
      talkToken: null,
      coverImageUrl: null,
      recurrencePattern: rec,
      section: "gatherings",
      attendeeLimit: null,
      rsvpCount: n,
    };
  };
  return [
    mk(3, 19, "Ritual Theatre Lab", "meeting", "WEEKLY", 12),
    mk(10, 19, "Ritual Theatre Lab", "meeting", "WEEKLY", 9),
    mk(12, 10, "Winter workshop", "workshop", null, 6),
    mk(17, 19, "Ritual Theatre Lab", "meeting", "WEEKLY", 11),
    mk(24, 19, "Ritual Theatre Lab", "meeting", "WEEKLY", 8),
    mk(26, 14, "Open rehearsal", "event", null, 4),
  ];
}
