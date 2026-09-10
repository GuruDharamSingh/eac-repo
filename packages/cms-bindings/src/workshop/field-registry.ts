/**
 * Input types @elkdonis/live-editor can render as in-place edit popovers.
 * This union must stay assignable to live-editor's own FieldInputType.
 */
export type LiveEditorInputType =
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

/**
 * The full authoring union. A superset of LiveEditorInputType: the wizard can
 * render richer controls than a live-editor popover can, so the extra members
 * are filtered out at the live-editor boundary (see editor-config.ts) rather
 * than being split into a second registry. One registry, two renderers.
 */
export type FieldInputType =
  | LiveEditorInputType
  | "color"
  | "gallery"
  | "media"
  | "boolean";

/** Runtime guard for the narrowing described above. */
const LIVE_EDITOR_INPUTS = new Set<string>([
  "text", "textarea", "url", "number", "datetime",
  "date", "select", "image", "compound", "readonly",
]);

export function isLiveEditorInput(input: FieldInputType): input is LiveEditorInputType {
  return LIVE_EDITOR_INPUTS.has(input);
}

/**
 * `users` is the facilitator's identity (migrations 084-087, 099-100);
 * `org_profiles` is their affiliation with one org, which is where a role title
 * belongs. Neither is `artist_profiles` — that table is keyed one row per
 * person and merely tagged with an org, and writing through it here meant an
 * `UPDATE … WHERE org_id = (…)` that rewrote every member of the org.
 */
export type FieldTable =
  | "threads"
  | "workshop_pages"
  | "users"
  | "org_profiles";

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

  // ── Wizard metadata ───────────────────────────────────────────────────────
  // Consumed by buildWorkshopWizardSteps(); ignored by the live editor.

  /**
   * Platform fields describe how the workshop *operates* (publishing, RSVP,
   * media slots) rather than what a template renders. They are offered by the
   * wizard regardless of which template is active, so they are exempt from
   * the manifest cmsFields filter.
   */
  platform?: boolean;
  /** Blocks step completion when empty. Only `title` is a hard DB requirement. */
  required?: boolean;
  /**
   * Show this field only when another field has a value. `equals` narrows
   * further. Drives conditional disclosure — e.g. sliding-scale copy is
   * pointless until a minimum price exists.
   */
  visibleWhen?: { col: string; equals?: string | number | boolean };
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
    required: true,
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
    table: "users",
    col: "display_name",
    dataKey: "facilitator_name",
    hint: "Name shown in the facilitator section",
  },
  pronouns: {
    label: "Facilitator Pronouns",
    input: "text",
    table: "users",
    col: "pronouns",
    dataKey: "facilitator_pronouns",
    hint: "e.g. she/her · they/them",
  },
  roleTitle: {
    // Editable again (2026-09-07). It was made readonly on 2026-09-01 because
    // it pointed at artist_profiles.display_name — the same column as
    // `fullName` — so saving a role title overwrote the facilitator's name.
    // The note then said the correct target was org_profiles.role_title and
    // that it would stay readonly "until the facilitator fields move off
    // artist_profiles as a set". They have; this is that move.
    label: "Facilitator Role Title",
    input: "text",
    table: "org_profiles",
    col: "role_title",
    dataKey: "facilitator_role",
    hint: "The facilitator's role in this organisation",
  },
  facilitatorBio: {
    label: "Facilitator Bio (profile)",
    input: "textarea",
    table: "users",
    col: "bio",
    hint: "The facilitator's standing bio, shared across their workshops",
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
    table: "users",
    col: "avatar_url",
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
    visibleWhen: { col: "price_sliding_min" },
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

  // ── Added 2026-09-01: authorable columns the trait list never covered ─────
  // The manifest's `traits` arrays were written for the live editor's DOM
  // binding and are narrower than its `cmsFields` contract; the wizard drives
  // off cmsFields, so every consumed column needs an entry here.

  subtitle: {
    label: "Subtitle",
    input: "text",
    table: "workshop_pages",
    col: "subtitle",
    hint: "Short line under the title, e.g. 'A 6-week series'",
  },
  descriptionShort: {
    label: "Short Description",
    input: "textarea",
    table: "workshop_pages",
    col: "description_short",
    hint: "One or two sentences used in listings and previews",
  },
  locationAddress: {
    label: "Full Address",
    input: "text",
    table: "workshop_pages",
    col: "location_address",
    visibleWhen: { col: "format" },
    hint: "Street address shown to registered attendees",
  },
  registrationStatus: {
    label: "Registration Status",
    input: "select",
    table: "workshop_pages",
    col: "registration_status",
    hint: "Controls the registration block's state",
    options: [
      { value: "open", label: "Open" },
      { value: "waitlist", label: "Waitlist" },
      { value: "full", label: "Full" },
      { value: "closed", label: "Closed" },
    ],
  },
  priceSlidingMin: {
    label: "Sliding Scale Minimum",
    input: "number",
    table: "workshop_pages",
    col: "price_sliding_min",
    hint: "Lowest price you will accept — leave empty for a fixed price",
  },
  priceMember: {
    label: "Member Price",
    input: "number",
    table: "workshop_pages",
    col: "price_member",
    hint: "Price for organisation members",
  },
  galleryItems: {
    label: "Gallery",
    input: "gallery",
    table: "workshop_pages",
    col: "gallery_image_urls",
    hint: "Images from past sessions — each takes an optional alt text and caption",
  },
  rsvpEnabled: {
    label: "Take registrations here",
    input: "boolean",
    table: "threads",
    col: "is_rsvp_enabled",
    hint: "Off if people register somewhere else — use the registration link instead",
  },

  // ── Platform fields: how the workshop operates, template-independent ──────

  durationMinutes: {
    label: "Length of a session",
    input: "number",
    table: "threads",
    col: "duration_minutes",
    platform: true,
    hint: "In minutes. The per-session length; `sessionDuration` is the hours shown on the page.",
  },
  meetingUrl: {
    label: "Meeting link",
    input: "url",
    table: "threads",
    col: "meeting_url",
    platform: true,
    hint: "For online or hybrid sessions. Leave empty if you create a Talk room instead.",
  },
  nextcloudDocUrl: {
    label: "Shared document",
    input: "url",
    table: "threads",
    col: "nextcloud_doc_url",
    platform: true,
    hint: "A Nextcloud document shared with registrants",
  },

  coverImage: {
    label: "Cover Image",
    input: "image",
    table: "workshop_pages",
    col: "cover_image_url",
    platform: true,
    hint: "Used in listings and feeds",
  },
  bannerImage: {
    label: "Banner Image",
    input: "image",
    table: "workshop_pages",
    col: "banner_image_url",
    platform: true,
    hint: "Wide header image on the workshop page",
  },
  bannerFocalY: {
    label: "Banner Crop (vertical)",
    input: "number",
    table: "workshop_pages",
    col: "banner_focal_y",
    platform: true,
    visibleWhen: { col: "banner_image_url" },
    hint: "0 = top of the image, 100 = bottom. Default 50.",
  },
  heroMedia: {
    label: "Hero Media",
    input: "media",
    table: "workshop_pages",
    col: "hero_media_url",
    platform: true,
    hint: "Image or video shown across the top of the page",
  },
  heroText: {
    label: "Hero Text",
    input: "textarea",
    table: "workshop_pages",
    col: "hero_text",
    platform: true,
    visibleWhen: { col: "hero_media_url" },
    hint: "Overlaid across the hero media",
  },
  backgroundColor: {
    label: "Background Colour",
    input: "color",
    table: "workshop_pages",
    col: "background_color",
    platform: true,
    hint: "Page background — leave empty to inherit the template",
  },
  seoTitle: {
    label: "SEO Title",
    input: "text",
    table: "workshop_pages",
    col: "seo_title",
    platform: true,
    hint: "Overrides the workshop title in search results and link previews",
  },
  seoDescription: {
    label: "SEO Description",
    input: "textarea",
    table: "workshop_pages",
    col: "seo_description",
    platform: true,
    hint: "Up to 160 characters, shown under the title in search results",
  },
  ogImage: {
    label: "Social Share Image",
    input: "image",
    table: "workshop_pages",
    col: "og_image_url",
    platform: true,
    hint: "Shown when the page is shared — falls back to the cover image",
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
