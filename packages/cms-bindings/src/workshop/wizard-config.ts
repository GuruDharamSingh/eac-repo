/**
 * Section-keyed workshop wizard.
 *
 * Steps are derived, not hand-written: each step is one section of the active
 * template's manifest, and its fields are that section's `cmsFields` resolved
 * against the workshop field registry. A template that consumes fewer fields
 * therefore produces a shorter wizard, and a new template needs no wizard code.
 *
 * Two things this deliberately does NOT do:
 *
 *  - It drives off `cmsFields`, not `traits`. The trait arrays were written for
 *    the live editor's DOM binding and are narrower than the field contract —
 *    the gallery section, for instance, lists one trait but consumes two
 *    columns. cmsFields is the authoritative list.
 *
 *  - It does not let a template suppress platform fields. Publishing, media
 *    slots and SEO exist whether or not a template renders them, so registry
 *    entries marked `platform: true` bypass the manifest filter and are grouped
 *    into their own steps.
 */
import {
  fieldRegistry,
  type FieldMeta,
  type FieldInputType,
  type SelectOption,
  type CompoundField,
} from "./field-registry";
import { lookupColumnKey, columnsForTrait, columnKey } from "./field-index";
import {
  parseCmsField,
  type TemplateManifest,
  type TemplateSection,
} from "../manifest";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WizardField {
  /** Registry key — also the `data-trait` the live editor binds to. */
  trait: string;
  label: string;
  input: FieldInputType;
  hint?: string;
  options?: SelectOption[];
  table: string;
  col: string;
  dataKey?: string;
  compound?: CompoundField[];
  required: boolean;
  visibleWhen?: { col: string; equals?: string | number | boolean };
}

export type WizardStepSource = "template" | "platform";

export interface WizardStep {
  /** Manifest section id, or `platform:<name>` for a platform step. */
  id: string;
  label: string;
  description?: string;
  source: WizardStepSource;
  /**
   * The author may switch this section off. False for sections the template
   * marks `required`, and for every platform step.
   */
  optional: boolean;
  fields: WizardField[];
}

export interface BuildWizardOptions {
  /**
   * Platform steps to append after the template steps, in order. Each maps to
   * a bespoke component rather than a generated field list — sessions,
   * materials, Talk and email have structure the registry cannot express.
   */
  platformSteps?: PlatformStepDef[];
  /** Drop template steps the author has switched off via `optional_sections`. */
  optionalSections?: Record<string, boolean>;
}

export interface PlatformStepDef {
  id: string;
  label: string;
  description?: string;
  /** Registry keys to render in this step. Empty for fully bespoke steps. */
  traits?: string[];
}

function toWizardField(trait: string, meta: FieldMeta): WizardField {
  return {
    trait,
    label: meta.label,
    input: meta.input,
    hint: meta.hint,
    options: meta.options,
    table: meta.table,
    col: meta.col,
    dataKey: meta.dataKey,
    compound: meta.compound,
    required: meta.required ?? false,
    visibleWhen: meta.visibleWhen,
  };
}

// ─── Step construction ────────────────────────────────────────────────────────

/**
 * Columns explicitly owned by a section via `wizard.claims`, mapped to that
 * section's id. Resolved before the main pass so ownership beats manifest order.
 */
function buildReservations(manifest: TemplateManifest): Map<string, string> {
  const reservations = new Map<string, string>();
  for (const section of manifest.sections) {
    if (section.wizard?.skip) continue;
    for (const col of section.wizard?.claims ?? []) {
      if (!reservations.has(col)) reservations.set(col, section.id);
    }
  }
  return reservations;
}

function stepFromSection(
  section: TemplateSection,
  claimed: Set<string>,
  reservations: Map<string, string>
): WizardStep | null {
  if (section.wizard?.skip) return null;

  const fields: WizardField[] = [];

  for (const entry of section.cmsFields ?? []) {
    const parsed = parseCmsField(entry);
    if (!parsed) continue; // projection, or a table that doesn't exist yet

    const key = `${parsed.table}.${parsed.col}`;
    if (claimed.has(key)) continue; // an earlier section already asks for it

    // Another section owns this column outright — leave it to them.
    const owner = reservations.get(key);
    if (owner && owner !== section.id) continue;

    const hit = lookupColumnKey(key);
    if (!hit) continue; // consumed by the template but not author-editable
    if (hit.meta.input === "readonly") continue; // derived, e.g. the CTA label
    if (hit.meta.platform) continue; // belongs to a platform step

    // Claim every column this field writes, so a compound isn't asked twice.
    claimed.add(key);
    for (const owned of columnsForTrait(hit.trait)) claimed.add(owned);

    fields.push(toWizardField(hit.trait, hit.meta));
  }

  // A section with nothing to author is chrome — the nav, for instance.
  if (fields.length === 0) return null;

  return {
    id: section.id,
    label: section.wizard?.label ?? section.label,
    description: section.wizard?.description,
    source: "template",
    optional: section.required !== true,
    fields,
  };
}

/**
 * Build the ordered wizard steps for one template.
 *
 * Manifest order is page order, which reads as a sensible authoring order too:
 * hero, then details, then description, then the registration block.
 */
export function buildWorkshopWizardSteps(
  manifest: TemplateManifest,
  options: BuildWizardOptions = {}
): WizardStep[] {
  const { platformSteps = DEFAULT_PLATFORM_STEPS, optionalSections } = options;

  const claimed = new Set<string>();
  const reservations = buildReservations(manifest);
  const steps: WizardStep[] = [];

  for (const section of manifest.sections) {
    const step = stepFromSection(section, claimed, reservations);
    if (!step) continue;
    // A section the author switched off is not worth asking about. Sections the
    // template marks required cannot be switched off and are never dropped.
    if (step.optional && optionalSections?.[section.id] === false) continue;
    steps.push(step);
  }

  for (const def of platformSteps) {
    const fields = (def.traits ?? [])
      .map((trait) => {
        const meta = fieldRegistry[trait];
        return meta ? toWizardField(trait, meta) : null;
      })
      .filter((f): f is WizardField => f !== null);

    steps.push({
      id: def.id,
      label: def.label,
      description: def.description,
      source: "platform",
      optional: false,
      fields,
    });
  }

  return steps;
}

/**
 * Platform steps offered for every template.
 *
 * `sessions`, `materials`, `talk` and `email` carry no registry fields on
 * purpose: a session list, a Nextcloud folder and an email template are not
 * flat columns, so each is rendered by a bespoke component keyed on the step id.
 */
export const DEFAULT_PLATFORM_STEPS: PlatformStepDef[] = [
  {
    id: "platform:media",
    label: "Images & video",
    description: "The cover, banner and hero media for this workshop.",
    traits: [
      "coverImage",
      "bannerImage",
      "bannerFocalY",
      "heroMedia",
      "heroText",
      "backgroundColor",
    ],
  },
  {
    id: "platform:sessions",
    label: "Sessions",
    description: "Individual meetings, each with its own time, notes and files.",
  },
  {
    id: "platform:materials",
    label: "Materials",
    description: "A Nextcloud folder shared with people once they register.",
  },
  {
    id: "platform:talk",
    label: "Video room",
    description: "A Nextcloud Talk room for online and hybrid sessions.",
  },
  {
    id: "platform:email",
    label: "Emails",
    description: "Welcome and reminder messages sent to registrants.",
  },
  {
    id: "platform:seo",
    label: "Sharing",
    description: "How this workshop appears in search results and link previews.",
    traits: ["seoTitle", "seoDescription", "ogImage"],
  },
  {
    id: "platform:publish",
    label: "Review & publish",
    description: "Check everything over, then make it visible.",
  },
];

/** Steps whose fields are all empty-able — used to compute the required spine. */
export function requiredTraits(steps: WizardStep[]): string[] {
  return steps.flatMap((s) => s.fields.filter((f) => f.required).map((f) => f.trait));
}
