import type { ReadingUnitDraft } from "@elkdonis/reading-wizard";

export const groups = [
  {
    name: "Fourth Way Book Readers",
    members: 24,
    cadence: "Wednesdays",
    active: true,
  },
  {
    name: "Online Study Circle",
    members: 12,
    cadence: "Sundays",
    active: false,
  },
  {
    name: "Toronto Chapter Table",
    members: 8,
    cadence: "Monthly",
    active: false,
  },
];

export const activeProgram = {
  title: "In Search of the Miraculous",
  author: "P. D. Ouspensky",
  week: 3,
  totalWeeks: 12,
  nextMeeting: "May 27, 2026, 7:00 PM",
  location: "Nextcloud Talk + Toronto notes table",
  imageUrl:
    "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=900&q=80",
};

export const units: ReadingUnitDraft[] = [
  {
    id: "unit-1",
    title: "Opening Orientation",
    label: "Week 1",
    locator: "Preface and chapter 1",
    estimatedMinutes: 65,
    resourceUrl: "https://www.youtube.com/",
    notes: "Opening questions and terminology.",
  },
  {
    id: "unit-2",
    title: "Fragments and Method",
    label: "Week 2",
    locator: "Chapter 2",
    estimatedMinutes: 70,
    resourceUrl: "https://archive.org/",
    notes: "Audio companion and glossary notes.",
  },
  {
    id: "unit-3",
    title: "Attention, Memory, Presence",
    label: "Week 3",
    locator: "Chapter 3",
    estimatedMinutes: 80,
    resourceUrl: "",
    notes: "Discussion thread is open.",
  },
  {
    id: "unit-4",
    title: "Work in Common",
    label: "Week 4",
    locator: "Chapter 4",
    estimatedMinutes: 75,
    resourceUrl: "",
    notes: "Meeting notes document queued.",
  },
];

export const newsletterQueue = [
  {
    title: "Week 2 recap",
    status: "Draft ready",
  },
  {
    title: "Week 3 notes",
    status: "Awaiting meeting capture",
  },
];

export const weekWorkspace = [
  {
    title: "Discussion thread",
    detail: "6 new replies since the last meeting",
  },
  {
    title: "Notes document",
    detail: "Nextcloud collaborative doc is ready",
  },
  {
    title: "Resource slots",
    detail: "YouTube, audio, PDF range, and external links",
  },
];