// Sample data for the forum top bar + SurfaceFan mock (ideas/forum-surface-fan). Invented boards, threads and people;
// labels and route hints follow packages/forum-ui (shell.tsx, parts.tsx, wiki-pages.tsx, actions.ts) as of 2026-11-27.

export interface Board { slug: string; name: string; threads: number }
export interface BoardGroup { org: string; boards: Board[] }

export const BOARD_GROUPS: BoardGroup[] = [
  {
    org: "Network",
    boards: [
      { slug: "general", name: "General", threads: 214 },
      { slug: "site-help", name: "Site help", threads: 88 },
      { slug: "studio-practice", name: "Studio practice", threads: 131 },
    ],
  },
  {
    org: "Theatre lab",
    boards: [
      { slug: "rehearsal-notes", name: "Rehearsal notes", threads: 47 },
      { slug: "scripts", name: "Scripts", threads: 22 },
    ],
  },
  {
    org: "Reading circles",
    boards: [
      { slug: "weekly-chapter", name: "Weekly chapter", threads: 63 },
      { slug: "questions", name: "Questions", threads: 39 },
    ],
  },
  {
    org: "Market",
    boards: [
      { slug: "commissions", name: "Commissions", threads: 18 },
      { slug: "shipping-art", name: "Shipping art", threads: 12 },
    ],
  },
];

export const ALL_BOARDS = BOARD_GROUPS.flatMap((g) => g.boards.map((b) => ({ ...b, org: g.org })));

export interface Thread {
  id: number;
  slug: string;
  title: string;
  board: string;
  excerpt: string;
  author: string;
  replies: number;
  views: number;
  last: string;
  unread?: boolean;
  pinned?: boolean;
}

export const THREADS: Thread[] = [
  { id: 4121, slug: "winter-salon-hanging-plan", title: "Winter salon: hanging plan and who brings what", board: "General", excerpt: "Twelve works, two walls, one ladder. A first draft of the layout is attached; comments on the sightline from the door welcome.", author: "Ines V.", replies: 23, views: 410, last: "12 min", unread: true, pinned: true },
  { id: 4118, slug: "glaze-crawling-at-cone-6", title: "Glaze crawling at cone 6 after a thicker dip", board: "Studio practice", excerpt: "Three test tiles, same bucket, only the dip time changed. Photos of each and the kiln log.", author: "Tomas R.", replies: 9, views: 162, last: "40 min", unread: true },
  { id: 4110, slug: "chapter-seven-the-octave", title: "Chapter seven: the octave and the missing interval", board: "Weekly chapter", excerpt: "Notes from Tuesday's circle and the two questions we did not get to.", author: "Mara K.", replies: 31, views: 588, last: "2 h" },
  { id: 4102, slug: "masks-for-the-second-act", title: "Masks for the second act", board: "Rehearsal notes", excerpt: "Paper-mache versus leather: weight, sweat and how long each takes to make.", author: "Joel A.", replies: 14, views: 205, last: "5 h" },
  { id: 4097, slug: "crating-a-framed-work", title: "Crating a framed work under 20 kg", board: "Shipping art", excerpt: "Corner protectors, foam thickness and what the courier asked for at the counter.", author: "Priya N.", replies: 6, views: 97, last: "yesterday" },
  { id: 4093, slug: "sign-in-loop-on-phone", title: "Sign-in loops back to the start page on my phone", board: "Site help", excerpt: "Happens in the in-app browser only. Opening in the phone's own browser works.", author: "Sam O.", replies: 4, views: 61, last: "yesterday" },
  { id: 4088, slug: "commission-deposit-terms", title: "What deposit do you ask for on a commission?", board: "Commissions", excerpt: "Collecting what people use: percentage, when it is refundable, and how it is written down.", author: "Lena H.", replies: 18, views: 330, last: "2 d" },
];

export interface Happening { when: string; title: string; where: string }
export const HAPPENING: Happening[] = [
  { when: "Tue 19:00", title: "Reading circle: chapter eight", where: "Reading circles · Talk" },
  { when: "Thu 18:30", title: "Open rehearsal, act two", where: "Theatre lab · studio" },
  { when: "Sat 11:00", title: "Winter salon hanging day", where: "General · on site" },
];

export const WHO_IS_HERE = ["Ines V.", "Tomas R.", "Mara K.", "Sam O.", "Lena H."];

export interface WikiPage { slug: string; title: string; edited: string }
export const WIKI_PAGES: WikiPage[] = [
  { slug: "how-the-forum-works", title: "How the forum works", edited: "3 d" },
  { slug: "kiln-schedules", title: "Kiln schedules", edited: "1 w" },
  { slug: "reading-circle-format", title: "Reading circle format", edited: "2 w" },
  { slug: "shipping-checklist", title: "Shipping checklist", edited: "3 w" },
];

export interface Term { word: string; gloss: string }
export const TERMS: Term[] = [
  { word: "Octave", gloss: "A sequence of seven steps with two intervals where outside help is needed." },
  { word: "Crawling", gloss: "A glaze defect: the glaze pulls back from the body and leaves bare patches." },
  { word: "Paratheatre", gloss: "Performance work done without an audience, for the participants." },
  { word: "Impasto", gloss: "Paint laid on thickly enough that brush or knife marks stand up from the surface." },
  { word: "Self-remembering", gloss: "Holding attention on oneself and on the thing observed at the same time." },
];

export interface Recent { kind: "thread" | "board" | "wiki" | "word" | "member"; title: string; path: string; when: string }
export const RECENT: Recent[] = [
  { kind: "thread", title: "Chapter seven: the octave and the missing interval", path: "/t/4110/chapter-seven-the-octave", when: "8 min" },
  { kind: "board", title: "Studio practice", path: "/o/network/studio-practice", when: "25 min" },
  { kind: "wiki", title: "Kiln schedules", path: "/wiki/kiln-schedules", when: "1 h" },
  { kind: "word", title: "Crawling", path: "/dictionary#crawling", when: "1 h" },
  { kind: "member", title: "Tomas R.", path: "/members/tomas-r", when: "yesterday" },
];

export interface Draft { id: string; kind: "Writing" | "Post" | "Wiki page"; title: string; edited: string }
export const DRAFTS: Draft[] = [
  { id: "d1", kind: "Writing", title: "Notes on the winter octave", edited: "today" },
  { id: "d2", kind: "Post", title: "Glaze test results, round three", edited: "yesterday" },
  { id: "d3", kind: "Wiki page", title: "Crating checklist (draft)", edited: "4 d" },
];

/** Where each fan action lands on the real forum (action names: packages/forum-ui/src/actions.ts:20-23). */
export const ROUTES = {
  define: "POST /api/forum/wiki-define · section on /dictionary",
  category: "POST /api/forum/category",
  topic: "POST /api/forum/propose-topic · reviewed at /topics/review",
  thread: "POST /api/forum/topic · lands at /t/<id>/<slug>",
  publish: "no forum route; Studio (arts-collective /studio) publishes",
  recent: "nothing records visits yet; this list would be new",
};

export const VIEWER = { name: "Ari D.", initials: "AD", unread: 7, notifications: 3 };
