export type ReadingSourceType = "pdf" | "epub" | "audio" | "manual" | "link";

export type ReadingRightsStatus =
  | "public_domain"
  | "licensed"
  | "member_private"
  | "link_only"
  | "unknown";

export interface ReadingUnitDraft {
  id: string;
  title: string;
  label: string;
  locator: string;
  estimatedMinutes: number;
  resourceUrl: string;
  notes: string;
}

export interface ReadingWizardState {
  bookTitle: string;
  authorName: string;
  sourceType: ReadingSourceType;
  rightsStatus: ReadingRightsStatus;
  groupName: string;
  startDate: string;
  intervalDays: number;
  meetingTime: string;
  timeZone: string;
  nextcloudFolder: string;
  units: ReadingUnitDraft[];
}

export interface ReadingProgramPreview {
  slug: string;
  totalUnits: number;
  estimatedWeeks: number;
  resourceCount: number;
  missingResourceCount: number;
  privateSource: boolean;
  newsletterDraftTitle: string;
  nextcloudFolder: string;
}

export interface ReadingWizardStep {
  id: "source" | "structure" | "cadence" | "resources" | "publish";
  title: string;
  caption: string;
}