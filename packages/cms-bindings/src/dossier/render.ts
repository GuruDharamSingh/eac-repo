import { applyManifestBindings, removeSections } from "../engine";
import type { TemplateManifest, TemplateSection } from "../manifest";
import type { DossierProfileData } from "./types";
import {
  toDossierContext,
  visibleDossierSections,
  type DossierContextOptions,
} from "./context";

// ============================================================================
// The dossier, rendered.
//
// ── What this file used to be ───────────────────────────────────────────────
//
// 950 lines: a `build*Html` function per section, each assembling markup from
// template literals, plus a set of regex "trait setters" for binding data into
// Silex-published pages. Two renderers for one template, and the page's design
// living in TypeScript strings where no designer could reach it.
//
// It is now a manifest + HTML change with no renderer code, which is what the
// binding engine exists for. The section HTML files are the only place the
// markup lives; `toDossierContext` holds the display logic; `manifest.json`
// declares which value fills which hook. All three are cross-checked by
// `validateBindings`, so a renamed field is a failing script rather than a
// blank line on somebody's page.
//
// ── One renderer, two entry points ──────────────────────────────────────────
//
// `renderDossier` composes the page from the template's own section files.
// `bindPublishedDossier` binds the same data into a page the person published
// from Silex. Both are `applyManifestBindings` over the same manifest and the
// same context — which is the point. The regex path could not be shared, so
// the two drifted: a published page kept the template's demo copy for any
// section the person had no data for, and visitors read "Marcus Vance,
// Investigative Journalist" under a real artist's name.
// ============================================================================

export const DOSSIER_TEMPLATE_ID = "dossier-classified";

/**
 * Section HTML, keyed by the manifest's `html` path.
 *
 * Passed in rather than read here: this module has to stay filesystem-free so
 * it can be pulled into a browser bundle. `@elkdonis/cms-bindings/node` reads
 * the files; see `renderDossierFromDisk` there.
 */
export type DossierSectionHtml = Record<string, string>;

export interface RenderDossierOptions extends DossierContextOptions {
  includeNav?: boolean;
  /**
   * Wrap the file in the desk. A host that already provides page chrome passes
   * false and gets the folder alone.
   */
  includeFolder?: boolean;
  /**
   * Render ONLY the archive nav.
   *
   * For a host that wants to put something of its own between the bar and the
   * file — ArtDirect puts the owner's sidebar there. The alternative is for
   * the host to build the nav itself, which is how a template's chrome ends up
   * existing in two places and drifting.
   */
  navOnly?: boolean;
}

/**
 * Sections to render, in manifest order, for this person's data.
 *
 * `visibleDossierSections` answers both halves of the question at once — did
 * they ask for it, and is there anything in it — so a server render and a
 * published-page cleanup cannot disagree about which sections exist.
 */
export function dossierSectionsFor(
  manifest: TemplateManifest,
  data: DossierProfileData,
  opts: RenderDossierOptions = {}
): TemplateSection[] {
  const visible = visibleDossierSections(data);
  return manifest.sections.filter((section) => {
    if (section.id === "eac-dossier-nav" && opts.includeNav === false) return false;
    return visible.has(section.id);
  });
}

/**
 * Compose and bind a whole dossier.
 *
 * Returns an HTML string for `dangerouslySetInnerHTML`. Every value it writes
 * has been escaped by the engine, and every href was filtered through
 * `safeHref` on the way into the context — a `users` row on this directory is
 * editable by any signed-in contributor, so its links are untrusted input.
 */
export function renderDossier(
  manifest: TemplateManifest,
  html: DossierSectionHtml,
  data: DossierProfileData,
  opts: RenderDossierOptions = {}
): string {
  const sections = dossierSectionsFor(manifest, data, opts);
  const context = toDossierContext(data, opts);

  const nav = sections.filter((s) => s.id === "eac-dossier-nav");

  if (opts.navOnly) {
    return applyManifestBindings(
      nav.map((s) => html[s.html] ?? "").join("\n"),
      nav,
      context
    );
  }

  const lightbox = sections.filter((s) => s.id === "eac-dossier-lightbox");
  const body = sections.filter(
    (s) => s.id !== "eac-dossier-nav" && s.id !== "eac-dossier-lightbox"
  );

  const join = (list: TemplateSection[]) =>
    list.map((s) => html[s.html] ?? "").join("\n");

  const file = `<div class="eac-dossier-file">
  <span class="eac-dos-tab">${escapeText(context.subject.caseLabel)}</span>
  <div class="eac-dos-sheet">
${join(body)}
  </div>
</div>
${join(lightbox)}`;

  const page = [
    join(nav),
    opts.includeFolder === false ? file : `<div class="eac-dossier-folder">\n${file}\n</div>`,
  ]
    .filter(Boolean)
    .join("\n");

  return applyManifestBindings(page, sections, context);
}

/**
 * Bind a person's data into a dossier page they published from Silex.
 *
 * Sections they have switched off, or that have nothing in them, are REMOVED
 * rather than left showing the template's placeholder copy.
 */
export function bindPublishedDossier(
  manifest: TemplateManifest,
  publishedHtml: string,
  data: DossierProfileData,
  opts: RenderDossierOptions = {}
): string {
  const visible = visibleDossierSections(data);
  const drop = manifest.sections
    .filter((section) => !visible.has(section.id))
    .map((section) => section.id);

  const cleaned = removeSections(publishedHtml, drop);
  const keep = manifest.sections.filter((section) => visible.has(section.id));
  return applyManifestBindings(cleaned, keep, toDossierContext(data, opts));
}

/**
 * The case label is the one string this module writes itself, because the tab
 * belongs to the file wrapper rather than to any section — so it never passes
 * through the engine's escaping.
 */
function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { toDossierContext, visibleDossierSections, caseNumber, safeHref } from "./context";
export type { DossierContext, DossierContextOptions, DossierPlate } from "./context";
