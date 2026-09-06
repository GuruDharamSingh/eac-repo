/**
 * Cross-check a template's manifest bindings against its HTML hooks and the
 * render context.
 *
 *   pnpm --filter @elkdonis/cms-bindings validate:template [templateId ...]
 *
 * Exits non-zero on any error-severity issue, so this is safe to run in CI as
 * the guard against the manifest / HTML / data drift that used to go unnoticed.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBindings, formatIssues } from "../src/engine/index";
import type { SectionToValidate } from "../src/engine/validate";
import type { TemplateManifest } from "../src/manifest";
import { toWorkshopContext } from "../src/workshop/context";
import type { WorkshopPageData } from "../src/workshop/types";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = join(
  here,
  "../../silex-nextcloud-connector/src/templates"
);

/**
 * A fully-populated row. Every optional column is present so an unresolvable
 * `from` path means a genuine typo rather than "this sample happened to omit it".
 */
const SAMPLE: WorkshopPageData = {
  id: "t1", slug: "clay-and-breath", title: "Clay & Breath",
  body: "<p>Two hands, one pot.</p>", scheduled_at: "2026-03-04T18:00:00.000Z",
  duration_minutes: 120, location: "Studio A", format: "in_person",
  attendee_limit: 12, price: 48, currency: "CAD",
  sessions: [{ title: "Centering", scheduled_at: "2026-03-04T18:00:00.000Z", location: "Studio A" }],
  subtitle: "A short series", description_short: "Short", discipline: "Ceramics",
  series_label: "Spring series", level: "all_levels", language: "English",
  session_count: 3, session_duration_hrs: 2, recurrence_label: "Weekly, Wednesdays",
  location_address: "123 Main St", accessibility_notes: "Step-free access.",
  price_sliding_min: 20, price_member: 40, sliding_scale_note: "Pay what you can.",
  registration_url: "https://example.org/register",
  registration_deadline: "2026-02-25T00:00:00.000Z", registration_status: "open",
  author_note: null, cover_image_url: "/assets/hero.jpg",
  gallery_image_urls: [{ url: "/assets/1.jpg", alt: "kiln" }],
  promo_video_url: "https://example.org/v", optional_sections: {},
  facilitator_name: "Ana R.", facilitator_bio: "Potter.",
  facilitator_photo: "/assets/ana.jpg", facilitator_pronouns: "she/her",
  facilitator_role: "Potter & facilitator",
};

const CONTEXTS: Record<string, unknown> = {
  workshop: toWorkshopContext(SAMPLE),
};

/**
 * Hooks a template deliberately leaves unbound. `descriptionLongExtra` is the
 * "read more" tail inside the prose block: binding the parent as rich text
 * replaces it wholesale, and no column backs a separate teaser/tail split.
 */
const IGNORE = ["descriptionLongExtra", "showLongDescription"];

function loadSections(templateId: string): SectionToValidate[] {
  const root = join(TEMPLATE_ROOT, templateId);
  const manifest: TemplateManifest = JSON.parse(
    readFileSync(join(root, "manifest.json"), "utf8")
  );
  return manifest.sections.map((section) => ({
    id: section.id,
    html: readFileSync(join(root, section.html), "utf8"),
    bindings: section.bindings,
    traits: section.traits,
  }));
}

const templateIds = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["workshop"];

let errors = 0;
for (const templateId of templateIds) {
  console.log(`\n── ${templateId} ${"─".repeat(Math.max(0, 50 - templateId.length))}`);
  const sections = loadSections(templateId);
  const issues = validateBindings(sections, {
    sampleContext: CONTEXTS[templateId],
    ignoreTraits: IGNORE,
  });
  console.log(formatIssues(issues));

  const bound = sections.reduce(
    (n, s) => n + Object.keys(s.bindings ?? {}).length,
    0
  );
  const errs = issues.filter((i) => i.severity === "error").length;
  errors += errs;
  console.log(
    `\n${bound} bindings across ${sections.length} sections · ` +
      `${errs} error(s), ${issues.length - errs} warning(s)`
  );
}

if (errors > 0) process.exitCode = 1;
