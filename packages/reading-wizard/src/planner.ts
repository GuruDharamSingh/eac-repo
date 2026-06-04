import type {
  ReadingProgramPreview,
  ReadingUnitDraft,
  ReadingWizardState,
  ReadingWizardStep,
} from "./types";

export const READING_WIZARD_STEPS: ReadingWizardStep[] = [
  { id: "source", title: "Source", caption: "Book file" },
  { id: "structure", title: "Structure", caption: "Units" },
  { id: "cadence", title: "Cadence", caption: "Meetings" },
  { id: "resources", title: "Resources", caption: "Media" },
  { id: "publish", title: "Publish", caption: "Preview" },
];

export function createUnitDraft(index: number): ReadingUnitDraft {
  return {
    id: `unit-${Date.now()}-${index}`,
    title: index === 1 ? "Opening Orientation" : `Reading Unit ${index}`,
    label: `Week ${index}`,
    locator: index === 1 ? "Preface and chapter 1" : `Chapter ${index}`,
    estimatedMinutes: 60,
    resourceUrl: "",
    notes: "",
  };
}

export function createReadingWizardState(): ReadingWizardState {
  const units = [1, 2, 3, 4].map((index) => createUnitDraft(index));

  return {
    bookTitle: "In Search of the Miraculous",
    authorName: "P. D. Ouspensky",
    sourceType: "manual",
    rightsStatus: "member_private",
    groupName: "Fourth Way Book Readers",
    startDate: "2026-06-03",
    intervalDays: 7,
    meetingTime: "19:00",
    timeZone: "America/Toronto",
    nextcloudFolder: "EAC_Network/fourth_way_book_readers/Reading",
    units,
  };
}

export function normalizeSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "reading-program";
}

export function buildProgramPreview(state: ReadingWizardState): ReadingProgramPreview {
  const resourceCount = state.units.filter((unit) => unit.resourceUrl.trim()).length;
  const totalUnits = state.units.length;
  const estimatedWeeks = Math.max(1, Math.ceil((totalUnits * state.intervalDays) / 7));
  const slug = normalizeSlug(`${state.groupName}-${state.bookTitle}`);

  return {
    slug,
    totalUnits,
    estimatedWeeks,
    resourceCount,
    missingResourceCount: totalUnits - resourceCount,
    privateSource: state.rightsStatus === "member_private" || state.rightsStatus === "licensed",
    newsletterDraftTitle: `${state.bookTitle}: Week 1 recap`,
    nextcloudFolder: `${state.nextcloudFolder}/${normalizeSlug(state.bookTitle)}`,
  };
}