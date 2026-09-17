/**
 * Template manifest types.
 *
 * Every EAC template ships a manifest.json declaring its sections and, per
 * section, the exact `table.column` fields it consumes. That declaration was
 * originally documentation; it is now a contract two consumers read:
 *
 *   - the renderer, which decides what to draw, and
 *   - the authoring wizard, which decides what to ask for.
 *
 * Because the manifest names the fields a template actually uses, a template
 * can *reduce* the wizard simply by consuming fewer of them. Adding a template
 * should not mean editing the wizard.
 *
 * These types are deliberately filesystem-free — the manifest is loaded by the
 * consuming app (see arts-collective's workshop-render.ts for the path
 * resolution convention) and passed in.
 */

import type { BindingMap } from "./engine/types";

/** Wizard-facing hints a template may attach to one of its sections. */
export interface TemplateSectionWizard {
  /** Omit this section from the wizard entirely — chrome with nothing to author. */
  skip?: boolean;
  /** Step title. Falls back to the section's `label`, which is often internal jargon. */
  label?: string;
  /** One line explaining the step to the author. */
  description?: string;
  /**
   * Columns (`table.column`) this section owns for authoring, regardless of
   * which section lists them first.
   *
   * Manifest order is *page* order, and the two diverge: the hero displays the
   * price, but the registration block is where an author expects to set it.
   * Without this, first-wins claiming drags price, capacity and registration
   * status into the first step that happens to render them.
   */
  claims?: string[];
}

export interface TemplateSection {
  id: string;
  label: string;
  html: string;
  css?: string;
  /** The template always renders this section; the author cannot switch it off. */
  required?: boolean;
  repeatable?: boolean;
  defaultVisible?: boolean;
  /** Render nothing when the underlying data is absent. */
  omitWhenEmpty?: boolean;
  /** Fully-qualified `table.column` names this section reads. The wizard's filter. */
  cmsFields?: string[];
  /** `data-trait` attribute names bound in the section's HTML. Live-editor only. */
  traits?: string[];
  /**
   * The `users.profile_sections` key that must be on for this section to
   * render (migration 105).
   *
   * Only meaningful for templates that describe a PERSON, which is why it is
   * optional here: an org's workshop page has no such notion. Declaring it in
   * the manifest rather than in a renderer is what lets the profile sidebar
   * build its list of switches from the template itself, so adding a section
   * to a template adds its switch without touching the editing UI.
   */
  profileSection?: string;
  /**
   * Trait → binding: which context value fills which hook, and how it is
   * formatted. This is the edge that used to live as hand-written regex in a
   * per-template `render.ts`; declaring it here lets one engine render every
   * template and lets `validateBindings` cross-check it against both the HTML
   * hooks and the data contract.
   *
   * `from` paths mirror `cmsFields` on purpose — `threads.scheduled_at` in
   * `cmsFields` reads as `workshop.scheduled_at` here — so the two declarations
   * can be eyeballed against each other.
   */
  bindings?: BindingMap;
  notes?: string;
  wizard?: TemplateSectionWizard;
}

export interface TemplateManifest {
  id: string;
  name: string;
  version: string;
  category?: string;
  description?: string;
  tokens?: string;
  cssOrder?: string[];
  sections: TemplateSection[];
}

/**
 * Split a manifest `cmsFields` entry into table and column.
 *
 * Returns null for entries the wizard cannot resolve to a real column:
 * projections like `threads.sessions[].title`, and tables that do not exist
 * yet (`workshop_testimonials`, `related_threads` are both marked future work
 * in the workshop manifest). Callers treat null as "not author-editable here".
 */
export function parseCmsField(
  entry: string
): { table: string; col: string } | null {
  if (entry.includes("[]")) return null;
  const parts = entry.split(".");
  if (parts.length !== 2) return null;
  const [table, col] = parts;
  if (!table || !col) return null;
  return { table, col };
}
