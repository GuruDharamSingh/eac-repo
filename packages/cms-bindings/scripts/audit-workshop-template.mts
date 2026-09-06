/**
 * Reports drift between a workshop template's HTML, its manifest, and the
 * field registry. Exits non-zero when they disagree.
 *
 *   pnpm --filter @elkdonis/cms-bindings audit:template
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  auditTemplateBindings,
  formatTemplateAudit,
} from "../src/workshop/audit";
import type { TemplateManifest } from "../src/manifest";

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(
  here,
  "../../silex-nextcloud-connector/src/templates/workshop"
);

const manifest: TemplateManifest = JSON.parse(
  fs.readFileSync(path.join(templateDir, "manifest.json"), "utf-8")
);

const sectionHtml: Record<string, string> = {};
for (const section of manifest.sections) {
  const file = path.join(templateDir, section.html);
  if (fs.existsSync(file)) sectionHtml[section.id] = fs.readFileSync(file, "utf-8");
}

const audit = auditTemplateBindings(manifest, sectionHtml);

if (audit.clean) {
  console.log(`${audit.templateId}: template bindings consistent`);
  process.exit(0);
}

console.error(`${audit.templateId}: template binding drift\n`);
console.error(formatTemplateAudit(audit));
process.exit(1);
