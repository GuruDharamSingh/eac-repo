/**
 * Consistency audit across the four things that describe a workshop template.
 *
 * A template is described in four places that can drift apart independently:
 *
 *   1. the section HTML's `data-trait` attributes — what the live editor can bind
 *   2. the manifest's `traits` arrays        — what the template claims it binds
 *   3. the manifest's `cmsFields` arrays     — what the section reads from the DB
 *   4. the field registry                    — what an author can actually edit
 *
 * They had drifted badly: as of 2026-09-01, `registrationUrl` was declared by
 * three sections and present in none of the HTML, so the registration URL was
 * uneditable in the live editor while the manifest advertised it. Nine of ten
 * sections disagreed with their own markup.
 *
 * Pure and filesystem-free — the caller supplies each section's HTML.
 */
import { fieldRegistry } from "./field-registry";
import { hasColumn, columnKey } from "./field-index";
import { parseCmsField, type TemplateManifest } from "../manifest";

export interface SectionAudit {
  sectionId: string;
  /** Declared in `traits` but absent from the HTML — the live editor sees nothing. */
  phantomTraits: string[];
  /** Present in the HTML but undeclared — works, but invisible to tooling. */
  undeclaredTraits: string[];
  /** Bound in the HTML with no registry entry — renders, but is not editable. */
  unregisteredTraits: string[];
  /** Read by the section but with no registry entry — the wizard cannot ask for it. */
  unmappedFields: string[];
}

export interface TemplateAudit {
  templateId: string;
  sections: SectionAudit[];
  /** True when every section is internally consistent. */
  clean: boolean;
}

/**
 * Tables the workshop data model actually has. A manifest may reference tables
 * that do not exist yet — `workshop_testimonials` and `related_threads` are
 * both marked future work — and those are roadmap, not drift, so they are not
 * reported. Widen this set when such a table lands.
 */
const MODELLED_TABLES = new Set(["threads", "workshop_pages", "artist_profiles"]);

const TRAIT_RE = /data-trait="([^"]+)"/g;

export function extractTraits(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(TRAIT_RE)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found].sort();
}

/**
 * @param sectionHtml Section id → that section's raw HTML. Sections absent from
 *   the map are skipped rather than reported as empty, so a caller may audit a
 *   subset.
 */
export function auditTemplateBindings(
  manifest: TemplateManifest,
  sectionHtml: Record<string, string>
): TemplateAudit {
  const sections: SectionAudit[] = [];

  const registeredTraits = new Set(Object.keys(fieldRegistry));

  for (const section of manifest.sections) {
    const html = sectionHtml[section.id];
    if (html === undefined) continue;

    const actual = new Set(extractTraits(html));
    const declared = new Set(section.traits ?? []);

    const unmappedFields = (section.cmsFields ?? []).filter((entry) => {
      const parsed = parseCmsField(entry);
      // Projections are expected gaps, not drift.
      if (!parsed) return false;
      // Tables that do not exist yet are roadmap, not drift.
      if (!MODELLED_TABLES.has(parsed.table)) return false;
      return !hasColumn(columnKey(parsed.table, parsed.col));
    });

    sections.push({
      sectionId: section.id,
      phantomTraits: [...declared].filter((t) => !actual.has(t)).sort(),
      undeclaredTraits: [...actual].filter((t) => !declared.has(t)).sort(),
      unregisteredTraits: [...actual].filter((t) => !registeredTraits.has(t)).sort(),
      unmappedFields,
    });
  }

  const clean = sections.every(
    (s) =>
      s.phantomTraits.length === 0 &&
      s.undeclaredTraits.length === 0 &&
      s.unregisteredTraits.length === 0 &&
      s.unmappedFields.length === 0
  );

  return { templateId: manifest.id, sections, clean };
}

/** Human-readable audit report. Returns an empty string when nothing is wrong. */
export function formatTemplateAudit(audit: TemplateAudit): string {
  const lines: string[] = [];
  for (const s of audit.sections) {
    const problems: string[] = [];
    if (s.phantomTraits.length)
      problems.push(`  declared but not in HTML : ${s.phantomTraits.join(", ")}`);
    if (s.undeclaredTraits.length)
      problems.push(`  in HTML but not declared : ${s.undeclaredTraits.join(", ")}`);
    if (s.unregisteredTraits.length)
      problems.push(`  bound but not editable   : ${s.unregisteredTraits.join(", ")}`);
    if (s.unmappedFields.length)
      problems.push(`  read but not in registry : ${s.unmappedFields.join(", ")}`);
    if (problems.length) lines.push(`${s.sectionId}`, ...problems);
  }
  return lines.join("\n");
}
