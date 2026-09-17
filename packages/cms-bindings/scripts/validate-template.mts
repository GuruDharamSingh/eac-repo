/**
 * Cross-check a template's manifest bindings against its HTML hooks and the
 * render context.
 *
 *   pnpm --filter @elkdonis/cms-bindings validate:template [templateId ...]
 *
 * Exits non-zero on any error-severity issue, so this is safe to run in CI as
 * the guard against the manifest / HTML / data drift that used to go unnoticed.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBindings, formatIssues, extractTraitNames } from "../src/engine/index";
import type { SectionToValidate } from "../src/engine/validate";
import type { TemplateManifest } from "../src/manifest";
import { toWorkshopContext } from "../src/workshop/context";
import type { WorkshopPageData } from "../src/workshop/types";
import { toDossierContext } from "../src/dossier/context";
import type { DossierProfileData } from "../src/dossier/types";

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

/**
 * A fully-populated dossier. Same rule as the workshop sample: every optional
 * field is present, so an unresolvable `from` path means a genuine typo rather
 * than "this sample happened to omit it". Sections are all switched ON for the
 * same reason — an off section contributes no context paths to check.
 */
const DOSSIER_SAMPLE: DossierProfileData = {
  slug: "marcus-vance",
  name: "Marcus Vance",
  occupation: "Investigative photographer",
  location: "Chicago, IL",
  dossier_status: "Open — accepting commissions",
  bio: "Documents urban decay at night on 35mm film.\n\nSecond paragraph.",
  photo_url: "/assets/portrait.jpg",
  operations: [
    { title: "Midnight Run", date: "Oct 2023", details: "Abandoned subway tunnels.", image_url: "/assets/a.jpg" },
    { title: "Project 88", date: null, details: null, image_url: null },
  ],
  current_targets: ["A darkroom process for infrared film."],
  projected_movements: ["A hardcover photobook."],
  verified_contacts: ["Nightowl Crew"],
  wanted_accomplices: ["Bookbinders"],
  financial_channels: [
    { title: "Patreon", description: "Monthly dispatches", url: "https://patreon.com/mv" },
  ],
  channels: [{ title: "Website", description: null, url: "https://example.com" }],
  work_history: [
    { role: "Staff photographer", organisation: "The Evening Register", from: "2019", to: "2024", detail: "Night desk." },
  ],
  dispatches: [
    { id: "d1", title: "On working after dark", href: "/x", excerpt: "Notes.", coverImageUrl: "/assets/c.jpg", publishedAt: "2026-09-01T00:00:00.000Z", orgName: "EAC", kind: "post", draft: false },
    { id: "d2", title: "Infrared", href: "/y", excerpt: null, coverImageUrl: null, publishedAt: null, orgName: "IFAC", kind: "writing", draft: true },
  ],
  movements: [
    { id: "m1", title: "Warehouse pop-up", href: "/e1", scheduledAt: "2099-11-14T19:00:00.000Z", durationMinutes: 180, location: "Toronto", orgName: "EAC", kind: "event" },
    { id: "m2", title: "Intaglio intensive", href: "/e2", scheduledAt: "2020-08-02T14:00:00.000Z", durationMinutes: 480, location: "Open Studio", orgName: "IFAC", kind: "workshop" },
  ],
  exhibits: [
    { id: "g1", title: "Tunnels", href: "/g1", description: "Below.", coverUrl: "/assets/g.jpg", itemCount: 18 },
    { id: "g2", title: "Works on paper", href: "/g2", description: null, coverUrl: null, itemCount: 1 },
  ],
  storefront: {
    name: "Norton Street Editions",
    href: "https://market.example/artists/mv",
    lots: [
      { id: "l1", title: "Night Tunnel", href: "/l1", imageUrl: "/assets/l.jpg", price: "$420.00", status: "available" },
      { id: "l2", title: "High Water", href: "/l2", imageUrl: null, price: null, status: "sold" },
    ],
  },
  activity: {
    orgs: [
      {
        orgId: "ifac",
        orgName: "International Fine Art Collectors",
        href: "https://ifacgroup.com",
        roleTitle: "Artist",
        filings: [{ id: "f1", title: "On working after dark", href: "/x", date: "2026-09-01T00:00:00.000Z", draft: false }],
      },
    ],
    filingCount: 1,
    mediaCount: 112,
  },
  claim_status: "claimed",
  verified: true,
  contact_href: "mailto:mv@example.com",
  case_number: "0447",
  sections: { dispatches: true, movements: true, galleries: true, store: true, workHistory: true },
};

const CONTEXTS: Record<string, unknown> = {
  workshop: toWorkshopContext(SAMPLE),
  "dossier-classified": toDossierContext(DOSSIER_SAMPLE),
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

/** Every template directory that ships a manifest. */
function allTemplateIds(): string[] {
  return readdirSync(TEMPLATE_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((id) => existsSync(join(TEMPLATE_ROOT, id, "manifest.json")))
    .sort();
}

const templateIds = process.argv.slice(2).length
  ? process.argv.slice(2)
  : allTemplateIds();

let errors = 0;
const coverage: string[] = [];

for (const templateId of templateIds) {
  const sections = loadSections(templateId);
  const bound = sections.reduce((n, s) => n + Object.keys(s.bindings ?? {}).length, 0);

  // A template with no bindings at all has not been migrated to the engine yet;
  // reporting every one of its hooks as "unbound" is noise, not signal. Say so
  // once and move on — the coverage summary is what tracks the backlog.
  if (bound === 0) {
    const hooks = sections.reduce((n, s) => n + extractTraitNames(s.html).size, 0);
    coverage.push(
      `  ${templateId.padEnd(20)} not migrated — ${sections.length} sections, ${hooks} hook(s) render placeholder text`
    );
    continue;
  }

  const issues = validateBindings(sections, {
    sampleContext: CONTEXTS[templateId],
    ignoreTraits: IGNORE,
  });
  const errs = issues.filter((i) => i.severity === "error").length;
  errors += errs;

  console.log(`\n── ${templateId} ${"─".repeat(Math.max(0, 50 - templateId.length))}`);
  console.log(formatIssues(issues));
  console.log(
    `\n${bound} bindings across ${sections.length} sections · ` +
      `${errs} error(s), ${issues.length - errs} warning(s)`
  );
  coverage.push(
    `  ${templateId.padEnd(20)} ${bound} bindings · ${errs} error(s), ${issues.length - errs} warning(s)`
  );
}

console.log("\n── coverage ───────────────────────────────────────");
for (const line of coverage) console.log(line);

if (errors > 0) process.exitCode = 1;
