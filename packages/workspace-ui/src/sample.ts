import type { Course, Entry, Message, Material, Module, Ongoing, Person, Step } from "./types";

// Invented sample: Lantern Row Arts, "Clay and Breath", six evenings, guide Ilan Marlowe. No photos of people.

export const PEOPLE: Person[] = [
  { id: "p-ilan", name: "Ilan Marlowe", initials: "IM", role: "guide", online: true, bio: "Potter and teacher at Lantern Row Arts. Twenty years of hand-building, slowly.", pictureLabel: "picture: Ilan" },
  { id: "p-wren", name: "Wren Okafor", initials: "WO", role: "participant", online: true, shareJournal: true },
  { id: "p-tomas", name: "Tomas Reyes", initials: "TR", role: "participant", online: true, shareJournal: true },
  { id: "p-saoirse", name: "Saoirse Lindqvist", initials: "SL", role: "participant", shareJournal: true },
  { id: "p-dev", name: "Dev Chandrasekar", initials: "DC", role: "participant", shareJournal: false },
  { id: "p-mira", name: "Mira Halloran", initials: "MH", role: "participant", online: true, shareJournal: true },
];

/** Deep, muted colours: light text on each passes 4.5:1. */
export const PALETTE = ["#2f4d68", "#6b3f2e", "#6a5524", "#5a3a5e", "#3d5a46", "#6b3a3a", "#3a4f6b", "#4d4a2c"];

const mat = (id: string, name: string, access: Material["access"]): Material => ({ id, name, access });
const fill = (row = true, pane = true, title = true, buttons = true) => ({ row, pane, title, buttons });

const steps = {
  m1: (): Step[] => [
    { id: "s1-1", kind: "setup", title: "Before the first evening", prompt: "Tick these off so we can start on time.", items: ["Apron and a towel", "Short nails, no rings", "A glass of water", "Read the studio notes"], required: true },
    { id: "s1-2", kind: "reading", title: "Why we start with breath", body: "Clay answers pressure with memory. A held breath leaves a held wall. Before you touch the clay we will spend five minutes on a long exhale, and you will feel the difference in the first pinch.", required: true },
    { id: "s1-3", kind: "reflection", due: "2026-01-16T23:00:00.000Z", title: "First impressions", prompt: "What did your hands notice in the first ten minutes?", required: true },
  ],
  m2: (): Step[] => [
    { id: "s2-1", kind: "watch", title: "Opening the clay", videoLabel: "Opening the clay", duration: "18:42", required: true },
    { id: "s2-2", kind: "practice", title: "Practice log: ten minutes a day", prompt: "Make one small pinch pot a day and log the minutes." },
    { id: "s2-3", kind: "reflection", due: "2026-01-23T23:00:00.000Z", title: "What did your hands notice?", prompt: "Write a few lines about the thickness of the wall and your breath.", required: true },
    { id: "s2-4", kind: "photo", due: "2026-01-25T23:00:00.000Z", title: "Photograph your pot", prompt: "A photo of your pot on the board, side on." },
    { id: "s2-5", kind: "gathering", title: "Join the room", when: "Thu 21 Jan, 7:00 pm", where: "Lantern Row studio, upstairs" },
  ],
  m3: (): Step[] => [
    { id: "s3-1", kind: "reading", title: "Rolling a coil", body: "Roll from the centre of the palm outward, light as a pencil. If the coil cracks, the clay is too dry: wet your fingers, not the clay." },
    { id: "s3-2", kind: "recording", title: "Describe your coil", prompt: "Record one minute on how the coil felt under your fingers." },
    { id: "s3-3", kind: "conversation", title: "Group talk: what slowed you down?", prompt: "Share one thing that slowed you down this week and what you did about it." },
    { id: "s3-4", kind: "practice", title: "A coil a day", prompt: "Roll ten coils each day and note the minutes." },
  ],
  m4: (): Step[] => [
    { id: "s4-1", kind: "resource", title: "Slab thickness guide", fileName: "Slab-thickness-guide.pdf", href: "#" },
    { id: "s4-2", kind: "quiz", due: "2026-02-05T23:00:00.000Z", timeLimit: 10, title: "Slab check", prompt: "How thick should a slab wall be for a small cup?", options: ["About 2 mm", "About 6 mm", "About 15 mm", "As thick as you can"], answer: 1, required: true },
    { id: "s4-3", kind: "reflection", title: "The edge", prompt: "Where did you rush, and where did you wait?" },
    { id: "s4-4", kind: "photo", title: "Photograph your slab piece", prompt: "Any angle; show the seam." },
  ],
  m5: (): Step[] => [
    { id: "s5-1", kind: "reading", title: "Surface as attention", body: "A surface is a record of speed. Burnish slowly and the clay shines; hurry and it drags." },
    { id: "s5-2", kind: "practice", title: "Burnishing minutes", prompt: "Burnish one piece and log the time." },
    { id: "s5-3", kind: "reflection", title: "What does your surface say?", prompt: "Describe the surface you made and how it came to be." },
  ],
  m7: (): Step[] => [
    { id: "s7-1", kind: "practice", title: "Five minutes", prompt: "Practise for five minutes, whenever suits you today. Then write down how it was.", timeLimit: 5, required: true },
  ],
  m6: (): Step[] => [
    { id: "s6-1", kind: "setup", title: "Firing day checklist", items: ["Name stamped on each piece", "Pieces bone dry", "Collection time agreed"], required: true },
    { id: "s6-2", kind: "gathering", title: "Firing day", when: "Thu 18 Feb, 6:00 pm", where: "Lantern Row kiln room" },
    { id: "s6-3", kind: "recording", title: "A closing word", prompt: "Record a short closing word to the group." },
    { id: "s6-4", kind: "reflection", title: "Six evenings", prompt: "What will you carry out of this room?" },
  ],
};

const iso = (d: number) => new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10);

function sampleOngoing(): Ongoing {
  const note: Record<number, string> = {
    19: "Same practice. Sit however is comfortable and let the five minutes be short.",
    20: "Same practice. Notice where your attention goes in the last minute.",
    21: "Same practice. If you miss a day, just write that down.",
    22: "Same practice. Note the time you did it, so we can see when we each sat.",
    23: "Last day of the week. Look back over your own notes before tonight.",
    24: "Rest day. No practice; read the week's notes if you like.",
  };
  const plans = [19, 20, 21, 22, 23, 24, 25].map((d) => ({
    key: iso(d), note: note[d], materials: [] as Material[],
  }));
  plans[4].materials = [mat("ip4", "Friday: we read the week's notes together", "participants")];
  return { stepId: "s7-1", every: "day", start: iso(15), closes: true, show: 5, plans };
}

export function ongoingModule(index: number): Module {
  const stepId = `s-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id: `m-${Math.random().toString(36).slice(2, 8)}`, title: "Daily practice", length: "", description: "", coverLabel: "session picture",
    colour: PALETTE[index % PALETTE.length], fill: fill(true, false, false, false), materials: [],
    steps: [{ id: stepId, kind: "reflection", title: "Daily entry", prompt: "What did you do today, and what did you notice?" }],
    kind: "ongoing", ongoing: { stepId, every: "day", start: SAMPLE_NOW.slice(0, 10), closes: true, show: 5, plans: [] },
  };
}

export const SAMPLE_COURSE = (): Course => {
  const mods: Module[] = [
    { id: "m1", title: "First touch", date: "Thu 14 Jan, 7:00 pm", length: "2 hours", description: "We meet the clay, the studio and each other, and settle the breath before the hands begin.", coverLabel: "session picture: hands on a clay ball", colour: PALETTE[0], fill: fill(), materials: [mat("mt1", "Studio notes.pdf", "open"), mat("mt2", "What to bring.pdf", "open")], steps: steps.m1() },
    { id: "m2", title: "Pinch pots and the long exhale", date: "Thu 21 Jan, 7:00 pm", length: "2 hours", description: "We start from a single ball of clay and open it with the thumb, one slow breath per turn.", coverLabel: "video: Opening the clay, 18:42", hasVideo: true, colour: PALETTE[1], fill: fill(), materials: [mat("mt3", "Pinch-pot steps.pdf", "open"), mat("mt4", "Breath practice audio.mp3", "participants")], steps: steps.m2() },
    { id: "m3", title: "Coils", date: "Thu 28 Jan, 7:00 pm", length: "2 hours", description: "Rolling, joining and building height without losing the breath.", coverLabel: "session picture: a coil pot in progress", colour: PALETTE[2], fill: fill(true, true, false, true), materials: [mat("mt5", "Coil building notes.pdf", "participants")], steps: steps.m3() },
    { id: "m4", title: "Slabs", date: "Thu 4 Feb, 7:00 pm", length: "2 hours", description: "Flat clay, clean edges, and patience at the seam.", coverLabel: "session picture: slab on the canvas", colour: PALETTE[3], fill: fill(), materials: [mat("mt6", "Slab thickness guide.pdf", "open")], steps: steps.m4() },
    { id: "m5", title: "Surface", date: "Thu 11 Feb, 7:00 pm", length: "2 hours", description: "Burnishing, slip and the marks that are left.", coverLabel: "session picture: burnished bowl", colour: PALETTE[4], fill: fill(true, false, true, true), materials: [mat("mt7", "Slip recipes.pdf", "participants")], steps: steps.m5() },
    { id: "m6", title: "Firing day", date: "Thu 18 Feb, 6:00 pm", length: "3 hours", description: "We load the kiln together and close the workshop together.", coverLabel: "session picture: kiln room", colour: PALETTE[5], fill: fill(), materials: [mat("mt8", "Glaze and firing notes.pdf", "open")], steps: steps.m6() },
    { id: "m7", title: "Five minutes a day", length: "5 minutes a day", description: "Practise for five minutes each day, at a time that suits you, and write down how it was. Post your note so everyone can see when you did it. On Friday we read the week's notes together.", coverLabel: "session picture: a row of small pots", colour: PALETTE[6], fill: fill(), materials: [], steps: steps.m7(), kind: "ongoing", ongoing: sampleOngoing() },
  ];
  return {
    id: "course-clay", title: "Clay and Breath", line: "Six evenings of slow hand-building.", price: "CA$ 180",
    when: "Thursdays, 14 Jan to 18 Feb", where: "In person", bannerLabel: "banner picture: the Lantern Row studio",
    about: "We build three small vessels by hand, slowly, with attention on breath and posture as much as on the clay. No wheel, no experience needed. An apron and a towel; clay is provided. 12 places.",
    guideId: "p-ilan", modules: mods, journals: "shared", journalComments: "everyone", status: "draft",
    pacing: "open", endDate: null, join: "invite", callLink: "",
    emails: { to: "guide", when: "each", remind: false },
  };
};

const day = (d: number, h = 19) => new Date(Date.UTC(2026, 0, d, h + 5, 10)).toISOString();
let n = 0;
const E = (e: Omit<Entry, "id" | "comments"> & { comments?: Entry["comments"] }): Entry => ({ comments: [], ...e, id: `seed-${++n}` });

/** Entries in the ongoing session over past days. Today (22 Jan) has others' entries but not the guide's or Wren's. */
function dailyEntries(): Entry[] {
  const D = (who: string, d: number, h: number, text: string, extra: Partial<Entry> = {}): Entry =>
    E({ personId: who, moduleId: "m7", stepId: "s7-1", kind: "practice", at: day(d, h), intervalKey: iso(d), minutes: 5, text, ...extra });
  return [
    D("p-wren", 18, 7, "Before the kettle boiled. Mind was busy for four of the five minutes, then it settled a little."),
    D("p-tomas", 18, 22, "Late, in bed. Fell asleep around minute four, which I think counts."),
    D("p-mira", 18, 13, "Lunch break at my desk. Harder than it sounds with the phone face down.", { minutes: 6 }),
    D("p-wren", 19, 7, "Same time as yesterday. Noticed my jaw was tight; let it go."),
    D("p-saoirse", 19, 18, "After work, on the stairs. The five minutes felt long, which I did not expect."),
    D("p-tomas", 19, 21, "Did it with the radio off for once. Quiet was odd.", { comments: [{ id: "c-d1", by: "p-ilan", at: day(20, 9), text: "Good. The odd quiet is worth writing down." }] }),
    D("p-wren", 20, 7, "Attention kept sliding to my to-do list. I let it, and came back."),
    D("p-mira", 20, 20, "Forgot until bedtime, so a late five minutes. Better than none.", { late: true }),
    D("p-saoirse", 20, 12, "Noon, outside. Birds, then a lawnmower, then birds."),
    D("p-wren", 21, 8, "Missed my usual time, did it on the train. Not ideal but done."),
    D("p-tomas", 21, 22, "Late again. In the last minute my attention went to my breathing without me asking."),
    D("p-saoirse", 21, 17, "Quick one before dinner. Restless."),
    D("p-mira", 22, 8, "Morning this time. Calmer than my evening ones.", { at: day(22, 8) }),
    D("p-tomas", 22, 9, "Short morning sit with coffee going cold. Liked it.", { at: day(22, 9) }),
  ];
}

export const SAMPLE_ENTRIES = (): Entry[] => {
  n = 0;
  return [
    E({ personId: "p-wren", moduleId: "m1", stepId: "s1-3", kind: "reflection", at: day(14, 21), text: "My hands were colder than I expected, and I pressed too hard at first. When I breathed out, the clay stopped pushing back." }),
    E({ personId: "p-tomas", moduleId: "m1", stepId: "s1-3", kind: "reflection", at: day(14, 21), text: "I did not notice anything until the third minute, then the weight of the clay surprised me." }),
    E({ personId: "p-wren", moduleId: "m2", stepId: "s2-3", kind: "reflection", at: day(21, 22), text: "Wall still too thick at the base. I rushed the last three turns and the rim cracked.",
      comments: [{ id: "c-1", by: "p-ilan", at: day(22, 9), text: "The cracked rim is a good teacher. Try one turn per exhale, even when it feels slow." }] }),
    E({ personId: "p-saoirse", moduleId: "m2", stepId: "s2-3", kind: "reflection", at: day(21, 22), text: "I felt the wall thin out under my thumb as I breathed out. I forgot to breathe in at all." }),
    E({ personId: "p-wren", moduleId: "m2", stepId: "s2-2", kind: "practice", at: day(23, 20), minutes: 10, text: "Three small pots, ten minutes." }),
    E({ personId: "p-dev", moduleId: "m2", stepId: "s2-2", kind: "practice", at: day(24, 20), minutes: 15, text: "Fifteen minutes; two pots, one collapsed." }),
    E({ personId: "p-mira", moduleId: "m2", stepId: "s2-4", kind: "photo", at: day(22, 18), mediaLabel: "photo: pinch pot on a wooden board", text: "My first one that stood up on its own." ,
      comments: [{ id: "c-2", by: "p-ilan", at: day(23, 8), text: "Lovely even wall. Notice how the shadow shows it." }] }),
    E({ personId: "p-wren", moduleId: "m2", kind: "note", at: day(21, 20), timestamp: "04:12", text: "Thumbs meet in the middle before the first turn." }),
    E({ personId: "p-wren", moduleId: "m2", kind: "note", at: day(21, 20), timestamp: "05:50", text: "She pauses here to check the wall." }),
    E({ personId: "p-tomas", moduleId: "m3", stepId: "s3-2", kind: "recording", at: day(29, 20), mediaLabel: "recording: describing the coil, 0:58", text: "Spoken notes about the coil cracking." }),
    E({ personId: "p-saoirse", moduleId: "m4", stepId: "s4-2", kind: "quiz", at: day(31, 12), text: "Slab check: About 6 mm (correct)." }),
    ...dailyEntries(),
  ];
};

export const SAMPLE_NOW = "2026-01-22T12:00:00.000Z";

export const SAMPLE_MESSAGES = (): Message[] => [
  { id: "msg-1", by: "p-ilan", at: day(14, 22), text: "Welcome all. Bring an apron on Thursday; clay is provided." },
  { id: "msg-2", by: "p-wren", at: day(15, 9), text: "Is the upstairs room step-free? Asking for a friend who may join." },
  { id: "msg-3", by: "p-ilan", at: day(15, 10), text: "There is a ramp at the side door; I will put it in the notes." },
];

export const SAMPLE_DONE = (): Record<string, string[]> => ({
  "p-wren": ["s1-1", "s1-2", "s1-3", "s2-1", "s2-2", "s2-3"],
  "p-tomas": ["s1-1", "s1-2", "s1-3", "s3-2"],
  "p-saoirse": ["s1-1", "s1-2", "s1-3", "s2-3", "s4-2"],
  "p-dev": ["s1-1", "s2-2"],
  "p-mira": ["s1-1", "s1-2", "s2-4"],
});

export function blankModule(index: number): Module {
  return {
    id: `m-${Math.random().toString(36).slice(2, 8)}`, title: `Session ${index + 1}`, date: "", length: "2 hours", description: "",
    coverLabel: "session picture", colour: PALETTE[index % PALETTE.length], fill: fill(true, false, false, false), materials: [], steps: [],
  };
}

function weekly(i: number, when: string): string {
  const m = /(\d{1,2})\s+([A-Za-z]{3})/.exec(when);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mi = m ? months.findIndex((x) => x.toLowerCase() === m[2].toLowerCase()) : -1;
  if (!m || mi < 0) return i === 0 ? when : `Week ${i + 1}`;
  const d = new Date(Date.UTC(2026, mi, Number(m[1]) + i * 7));
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

export function buildCourse(
  a: { title: string; line: string; when: string; where: Course["where"]; sessions: number; ongoing?: boolean },
  people: Person[],
): Course {
  const guide = people.find((p) => p.role === "guide") ?? people[0];
  const count = Math.max(0, Math.min(24, Math.round(a.sessions)));
  const modules: Module[] = a.ongoing
    ? [ongoingModule(0)]
    : Array.from({ length: count }, (_, i) => ({ ...blankModule(i), date: weekly(i, a.when) }));
  return {
    id: `course-${Math.random().toString(36).slice(2, 8)}`, title: a.title.trim() || "Untitled workshop", line: a.line, price: "Free",
    when: a.when, where: a.where, bannerLabel: "banner picture", about: "", guideId: guide.id,
    modules, journals: "private", journalComments: "guide", status: "draft",
    pacing: "open", endDate: null, join: "open", callLink: "",
    emails: { to: "guide", when: "each", remind: false },
  };
}
