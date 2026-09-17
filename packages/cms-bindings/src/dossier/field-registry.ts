import type { FieldInputType } from "../workshop/field-registry";

// ============================================================================
// What a person can actually type into their dossier, and where it lands.
//
// ── Why this is one declaration and not three ───────────────────────────────
//
// The same set of facts is needed in three places: the template needs to know
// which context path fills which hook (manifest bindings), the save action
// needs to know which column a trait writes to, and the editing UI needs to
// know what control to draw and what to call it. Those had been drifting for
// months — the manifest declared `artist_profiles.*`, the registry declared
// `directory_profiles.*`, and neither table has held a profile since the
// profile unification merged them into `users` + `org_profiles`.
//
// So: the manifest owns the render edge, and THIS file owns the authoring
// edge, grouped by the manifest section each field feeds. The profile sidebar
// is generated from `dossierFieldGroups` — adding a field here is what adds
// its control, rather than a second list in a component.
// ============================================================================

/**
 * One editable field.
 *
 * `col` is where the value lands. With `json`, it is a key inside the
 * `users.oad_dossier` JSONB bag rather than a column of its own — which is the
 * right home for anything free-form that nothing queries.
 */
export interface DossierFieldMeta {
  /** The `data-trait` this field feeds, where it feeds one directly. */
  trait: string;
  label: string;
  input: FieldInputType;
  table: "users";
  col: string;
  /** True when `col` is a key inside `users.oad_dossier`. */
  json?: boolean;
  hint?: string;
  /** Placeholder for the control, when an example helps more than a hint. */
  placeholder?: string;
  /**
   * Stored as an array of strings, edited as one-per-line.
   *
   * The distinction matters at save time: a textarea's value is one string,
   * and writing it to a column the renderer reads as a list produces a section
   * with exactly one very long bullet.
   */
  list?: boolean;
  /** Field shape for a repeatable row (`input: "compound"`). */
  itemFields?: Array<{
    name: string;
    label: string;
    input: "text" | "textarea" | "url" | "image";
    placeholder?: string;
  }>;
}

/**
 * The optional sections a person switches on for their own profile
 * (`users.profile_sections`, migration 105).
 *
 * Deliberately the SAME flag store the org sites read, and `store` is
 * deliberately the SAME key IFAC and amrit-canada use — so a person who has
 * turned their store on for their org page has turned it on here too. A second
 * parallel flag per app is how "show my store" ends up meaning three different
 * things on three pages.
 */
export const DOSSIER_SECTION_KEYS = [
  "dispatches",
  "movements",
  "galleries",
  "store",
  "workHistory",
] as const;

export type DossierSectionKey = (typeof DOSSIER_SECTION_KEYS)[number];

/**
 * A group of fields, matching one section of the template.
 *
 * `sectionId` ties a group to the manifest section it fills, so the sidebar can
 * order itself by the page rather than by this file, and can say truthfully
 * whether a section is currently showing.
 */
export interface DossierFieldGroup {
  sectionId: string;
  title: string;
  blurb: string;
  /** The `profile_sections` key that switches this section on, if optional. */
  sectionKey?: DossierSectionKey;
  fields: DossierFieldMeta[];
  /**
   * Set when the section's content is authored somewhere else entirely.
   *
   * These sections are real and the person controls whether they appear, but
   * the writing, the events and the listings are edited where they live. The
   * sidebar says so and links out, rather than offering a control that would
   * write to the wrong place — which is what a naive "edit everything here"
   * panel would do with a thread that belongs to an org.
   */
  managedElsewhere?: { what: string; where: string; hrefKey?: "marketplace" | "network" };
}

const workItem = [
  { name: "title", label: "Title", input: "text" as const },
  { name: "image_url", label: "Image", input: "image" as const },
  { name: "date", label: "Date", input: "text" as const, placeholder: "2023, or Oct 2023" },
  { name: "details", label: "Note", input: "textarea" as const },
];

export const dossierFieldGroups: DossierFieldGroup[] = [
  {
    sectionId: "eac-dossier-identity",
    title: "Who you are",
    blurb: "The top of the file. Anything left blank shows as an unfilled line rather than a dash.",
    fields: [
      {
        trait: "aliasName",
        label: "Name",
        input: "text",
        table: "users",
        col: "display_name",
        hint: "The headline name on your file.",
      },
      {
        trait: "occupation",
        label: "Occupation",
        input: "text",
        table: "users",
        col: "headline",
        placeholder: "Painter, jazz musician",
        hint: "One line. This is blank on every profile in the directory — filling it is the single biggest improvement to your page.",
      },
      {
        trait: "location",
        label: "Location",
        input: "text",
        table: "users",
        col: "location",
        json: true,
        placeholder: "Grass Valley, CA",
        hint: "Falls back to the city and region on your account when this is empty.",
      },
      {
        trait: "fileStatus",
        label: "File status",
        input: "text",
        table: "users",
        col: "dossier_status",
        json: true,
        placeholder: "Open — accepting commissions",
        hint: "The status line. Defaults to whether your file has been claimed.",
      },
      {
        trait: "bioNotes",
        label: "Notes",
        input: "textarea",
        table: "users",
        col: "bio",
        hint: "Your statement. Blank lines become paragraphs.",
      },
      {
        trait: "photoUrl",
        label: "Portrait",
        input: "image",
        table: "users",
        col: "avatar_url",
        hint: "Shown clipped to the file, in black and white.",
      },
    ],
  },
  {
    sectionId: "eac-dossier-operations",
    title: "Your work",
    blurb:
      "The plate wall. Thumbnails are black and white; a visitor clicks one to see it full size in colour.",
    fields: [
      {
        trait: "operationsList",
        label: "Pieces",
        input: "compound",
        table: "users",
        col: "operations",
        json: true,
        itemFields: workItem,
        hint: "Leave this empty and your file falls back to the portfolio on your account.",
      },
    ],
  },
  {
    sectionId: "eac-dossier-dispatches",
    title: "Dispatches",
    blurb: "Posts and writing you have published anywhere on the network, newest first.",
    sectionKey: "dispatches",
    fields: [],
    managedElsewhere: {
      what: "Your posts and writing",
      where: "edited wherever you filed them",
      hrefKey: "network",
    },
  },
  {
    sectionId: "eac-dossier-movements",
    title: "Movements",
    blurb: "Events, meetings and workshops you are hosting. Upcoming first, then what has happened.",
    sectionKey: "movements",
    fields: [],
    managedElsewhere: {
      what: "Your events",
      where: "edited on the organisation running them",
      hrefKey: "network",
    },
  },
  {
    sectionId: "eac-dossier-exhibits",
    title: "Exhibits",
    blurb: "Your gallery pages, as a wall of doors.",
    sectionKey: "galleries",
    fields: [],
    managedElsewhere: { what: "Your galleries", where: "edited on your gallery pages" },
  },
  {
    sectionId: "eac-dossier-acquisitions",
    title: "Acquisitions",
    blurb: "Work you have listed for sale, with prices. Only appears when your store is active.",
    sectionKey: "store",
    fields: [],
    managedElsewhere: {
      what: "Your listings",
      where: "edited in the marketplace studio",
      hrefKey: "marketplace",
    },
  },
  {
    sectionId: "eac-dossier-record",
    title: "Service record",
    blurb: "Where you have shown, taught, been collected or held a post.",
    sectionKey: "workHistory",
    fields: [
      {
        trait: "workHistory",
        label: "Entries",
        input: "compound",
        table: "users",
        col: "work_history",
        json: true,
        itemFields: [
          { name: "role", label: "What", input: "text", placeholder: "Artist in residence" },
          { name: "organisation", label: "Where", input: "text", placeholder: "Open Studio, Toronto" },
          { name: "from", label: "From", input: "text", placeholder: "2019" },
          { name: "to", label: "To", input: "text", placeholder: "2024, or Present" },
          { name: "detail", label: "Note", input: "textarea" },
        ],
        hint: "Dates are free text — 'Spring 2021' and '2019 — present' are both fine.",
      },
    ],
  },
  {
    sectionId: "eac-dossier-intelligence",
    title: "In progress",
    blurb: "Two short lists, side by side.",
    fields: [
      {
        trait: "currentTargets",
        label: "Working on",
        input: "textarea",
        table: "users",
        col: "current_targets",
        json: true,
        list: true,
        hint: "One per line.",
      },
      {
        trait: "projectedMovements",
        label: "Next",
        input: "textarea",
        table: "users",
        col: "projected_movements",
        json: true,
        list: true,
        hint: "One per line.",
      },
    ],
  },
  {
    sectionId: "eac-dossier-network",
    title: "Associates",
    blurb: "Who you work with, and who you are looking for.",
    fields: [
      {
        trait: "verifiedContacts",
        label: "Works with",
        input: "textarea",
        table: "users",
        col: "verified_contacts",
        json: true,
        list: true,
        hint: "One per line. Shown as solid tags.",
      },
      {
        trait: "wantedAccomplices",
        label: "Looking for",
        input: "textarea",
        table: "users",
        col: "wanted_accomplices",
        json: true,
        list: true,
        hint: "One per line. Shown as dashed tags.",
      },
    ],
  },
  {
    sectionId: "eac-dossier-channels",
    title: "Where else you are",
    blurb:
      "Your site and your social links. Anything that is somewhere to BUY — a shop, a patronage page — moves itself to the next section.",
    fields: [
      {
        trait: "channelsList",
        label: "Links",
        input: "compound",
        table: "users",
        col: "social_links",
        itemFields: [
          { name: "label", label: "Label", input: "text", placeholder: "Instagram" },
          { name: "url", label: "Link", input: "url", placeholder: "https://…" },
        ],
      },
    ],
  },
  {
    sectionId: "eac-dossier-funds",
    title: "Buy & support",
    blurb: "Somewhere a visitor can buy your work or back it directly.",
    fields: [
      {
        trait: "financialChannels",
        label: "Places to buy or support",
        input: "compound",
        table: "users",
        col: "financial_channels",
        json: true,
        itemFields: [
          { name: "title", label: "Name", input: "text", placeholder: "Patreon" },
          { name: "description", label: "What it is", input: "text" },
          { name: "url", label: "Link", input: "url", placeholder: "https://…" },
        ],
        hint: "Shops you already listed as links appear here automatically — you do not need to add them twice.",
      },
    ],
  },
  {
    sectionId: "eac-dossier-activity",
    title: "Filed activity",
    blurb: "Where you operate across the network, and what you have filed there. Always shown.",
    fields: [],
    managedElsewhere: { what: "This", where: "built from what you have published" },
  },
];

/** Every editable field, keyed by trait. The save action's lookup table. */
export const dossierFieldRegistry: Record<string, DossierFieldMeta> = Object.fromEntries(
  dossierFieldGroups.flatMap((g) => g.fields.map((f) => [f.trait, f]))
);
