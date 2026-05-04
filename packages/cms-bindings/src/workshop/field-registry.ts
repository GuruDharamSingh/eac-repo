export type FieldInputType =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "datetime"
  | "date"
  | "select"
  | "image"
  | "compound"
  | "readonly";

export type FieldTable = "threads" | "workshop_pages" | "artist_profiles";

export interface SelectOption {
  value: string;
  label: string;
}

export interface CompoundField {
  col: string;
  table: FieldTable;
  label: string;
  input: "text" | "number" | "url";
}

export interface FieldMeta {
  label: string;
  input: FieldInputType;
  table: FieldTable;
  /** Primary DB column. For compound, this is the first constituent. */
  col: string;
  /**
   * Key in WorkshopPageData when it differs from `col` due to a SQL alias.
   * e.g. artist_profiles.display_name is aliased as `facilitator_name`.
   */
  dataKey?: string;
  hint?: string;
  options?: SelectOption[];
  /** For compound inputs — list every underlying field in order. */
  compound?: CompoundField[];
}

/**
 * Maps every data-trait value used in workshop templates to its DB source.
 * Consumed by the live editor (EditOverlay, FieldPopover) and the server
 * action updateWorkshopFieldAction.
 */
export const fieldRegistry: Record<string, FieldMeta> = {
  title: {
    label: "Workshop Title",
    input: "text",
    table: "threads",
    col: "title",
    hint: "Main headline shown in the hero section",
  },
  eyebrowText: {
    label: "Eyebrow (Discipline · Series)",
    input: "compound",
    table: "workshop_pages",
    col: "discipline",
    hint: "Shown above the title — discipline and series label joined by ·",
    compound: [
      { col: "discipline", table: "workshop_pages", label: "Discipline", input: "text" },
      { col: "series_label", table: "workshop_pages", label: "Series label", input: "text" },
    ],
  },
  recurrence: {
    label: "Schedule Summary",
    input: "text",
    table: "workshop_pages",
    col: "recurrence_label",
    hint: "e.g. 'Saturdays 10am–1pm' or 'Every other Tuesday'",
  },
  locationName: {
    label: "Location",
    input: "text",
    table: "threads",
    col: "location",
    hint: "Short location name shown in the metadata pills",
  },
  spotsText: {
    label: "Capacity (spots)",
    input: "number",
    table: "threads",
    col: "attendee_limit",
    hint: "Max attendees — 0 means unlimited",
  },
  spotsRemaining: {
    label: "Capacity (spots)",
    input: "number",
    table: "threads",
    col: "attendee_limit",
    hint: "Same as capacity — displayed in the register section",
  },
  ctaLabel: {
    label: "CTA Label",
    input: "readonly",
    table: "threads",
    col: "price",
    hint: "Derived from price and registration status — not directly editable",
  },
  registrationUrl: {
    label: "Registration URL",
    input: "url",
    table: "workshop_pages",
    col: "registration_url",
    hint: "External booking or sign-up link",
  },
  startDate: {
    label: "Start Date & Time",
    input: "datetime",
    table: "threads",
    col: "scheduled_at",
    hint: "When the first session begins",
  },
  sessionCount: {
    label: "Number of Sessions",
    input: "number",
    table: "workshop_pages",
    col: "session_count",
    hint: "Total sessions in this workshop",
  },
  sessionDuration: {
    label: "Session Duration (hrs)",
    input: "number",
    table: "workshop_pages",
    col: "session_duration_hrs",
    hint: "Duration of each individual session in hours",
  },
  priceContext: {
    label: "Session Count (price context)",
    input: "number",
    table: "workshop_pages",
    col: "session_count",
    hint: "Shown as '/ N sessions' next to the price — same field as session count",
  },
  format: {
    label: "Format",
    input: "select",
    table: "threads",
    col: "format",
    hint: "Delivery format of the workshop",
    options: [
      { value: "in_person", label: "In person" },
      { value: "online", label: "Online" },
      { value: "hybrid", label: "Hybrid" },
    ],
  },
  level: {
    label: "Experience Level",
    input: "select",
    table: "workshop_pages",
    col: "level",
    hint: "Who this workshop is designed for",
    options: [
      { value: "all_levels", label: "All levels" },
      { value: "beginner", label: "Beginner" },
      { value: "intermediate", label: "Intermediate" },
      { value: "advanced", label: "Advanced" },
    ],
  },
  language: {
    label: "Language",
    input: "text",
    table: "workshop_pages",
    col: "language",
    hint: "Primary language the workshop is taught in",
  },
  descriptionLong: {
    label: "Full Description",
    input: "textarea",
    table: "threads",
    col: "body",
    hint: "Main workshop description (use the full editor for rich formatting)",
  },
  descriptionLongExtra: {
    label: "Full Description",
    input: "textarea",
    table: "threads",
    col: "body",
    hint: "Same as Full Description",
  },
  accessibilityNotes: {
    label: "Accessibility Notes",
    input: "textarea",
    table: "workshop_pages",
    col: "accessibility_notes",
    hint: "Accessibility information for attendees",
  },
  fullName: {
    label: "Facilitator Name",
    input: "text",
    table: "artist_profiles",
    col: "display_name",
    dataKey: "facilitator_name",
    hint: "Name shown in the facilitator section",
  },
  pronouns: {
    label: "Facilitator Pronouns",
    input: "text",
    table: "artist_profiles",
    col: "pronouns",
    dataKey: "facilitator_pronouns",
    hint: "e.g. she/her · they/them",
  },
  roleTitle: {
    label: "Facilitator Role Title",
    input: "text",
    table: "artist_profiles",
    col: "display_name",
    dataKey: "facilitator_name",
    hint: "Role or title shown under the facilitator name",
  },
  bio: {
    label: "Facilitator Bio (this workshop)",
    input: "textarea",
    table: "workshop_pages",
    col: "author_note",
    hint: "Workshop-specific bio — overrides profile bio for this page",
  },
  photoPath: {
    label: "Facilitator Photo",
    input: "image",
    table: "artist_profiles",
    col: "photo_url",
    dataKey: "facilitator_photo",
    hint: "Profile photo shown in the facilitator section",
  },
  priceFull: {
    label: "Price",
    input: "compound",
    table: "threads",
    col: "price",
    hint: "Full price shown in the registration section",
    compound: [
      { col: "price", table: "threads", label: "Price (number)", input: "number" },
      { col: "currency", table: "threads", label: "Currency (e.g. USD)", input: "text" },
    ],
  },
  slidingScaleNote: {
    label: "Sliding Scale Note",
    input: "text",
    table: "workshop_pages",
    col: "sliding_scale_note",
    hint: "e.g. 'Pay what you can: $80–$180'",
  },
  startsIn: {
    label: "Start Date (countdown)",
    input: "datetime",
    table: "threads",
    col: "scheduled_at",
    hint: "Same as start date — displayed as 'starts in X days'",
  },
  deadlineNote: {
    label: "Registration Deadline",
    input: "date",
    table: "workshop_pages",
    col: "registration_deadline",
    hint: "Last date to register",
  },
  websiteUrl: {
    label: "Website / Registration URL",
    input: "url",
    table: "workshop_pages",
    col: "registration_url",
    hint: "Link used in nav and facilitator sections",
  },
  promoVideoUrl: {
    label: "Promo Video URL",
    input: "url",
    table: "workshop_pages",
    col: "promo_video_url",
    hint: "Embed URL for the promotional video (YouTube, Vimeo, etc.)",
  },
  showAccessibilityNotes: {
    label: "Show Accessibility Notes",
    input: "readonly",
    table: "workshop_pages",
    col: "optional_sections",
    hint: "Visibility toggle — edit via the optional sections panel",
  },
  showCo: {
    label: "Show Co-facilitator",
    input: "readonly",
    table: "workshop_pages",
    col: "optional_sections",
    hint: "Visibility toggle — edit via the optional sections panel",
  },
  showLongDescription: {
    label: "Show Long Description",
    input: "readonly",
    table: "workshop_pages",
    col: "optional_sections",
    hint: "Visibility toggle — edit via the optional sections panel",
  },
};

/** CSS custom properties exposed by workshop templates that owners can theme. */
export const themeVarRegistry = [
  {
    name: "--eac-ws-hero-bg",
    label: "Hero Background",
    type: "color" as const,
    default: "#0f172a",
    hint: "Background color of the hero section",
  },
  {
    name: "--eac-ws-hero-accent-rgb",
    label: "Hero Glow Accent",
    type: "rgb" as const,
    default: "120, 80, 220",
    hint: "RGB values (e.g. 120, 80, 220) for the hero glow effect",
  },
  {
    name: "--eac-ws-register-bg",
    label: "Register Section Background",
    type: "color" as const,
    default: "#0a0f1a",
    hint: "Background color of the registration/pricing section",
  },
] as const;

export type ThemeVarName = (typeof themeVarRegistry)[number]["name"];
export type ThemeOverrides = Partial<Record<ThemeVarName, string>>;
