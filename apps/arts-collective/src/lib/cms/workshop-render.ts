/**
 * Arts-collective adapter for the standalone workshop page (OfferingPage,
 * /preview/workshop, /sites/[slug]/[contentSlug]).
 *
 * Rendering is the manifest-driven binding engine — the same one that binds
 * Silex-published pages. This file only resolves filesystem paths; the engine,
 * the manifest and the formatters live in @elkdonis/cms-bindings.
 */
import path from "path";
import {
  applyManifestBindings,
  toWorkshopContext,
  type WorkshopPageData,
} from "@elkdonis/cms-bindings";
import {
  loadTemplateManifest,
  readTemplateFile,
  templateDir,
} from "@elkdonis/cms-bindings/node";
import fs from "fs";

// Re-export the canonical type so callers can import it from here.
export type { WorkshopPageData } from "@elkdonis/cms-bindings";

const TEMPLATE_ID = "workshop";

export function readWorkshopCss(): string {
  const manifest = loadTemplateManifest(TEMPLATE_ID);
  const dir = templateDir(TEMPLATE_ID);
  const tokenRel = manifest.tokens ?? "../tokens/eac-tokens.css";
  const tokenPath = path.join(dir, tokenRel);
  const tokens = fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, "utf-8") : "";
  const order = manifest.cssOrder ?? manifest.sections.map((s) => s.css).filter(Boolean);
  const sections = (order as string[]).map((rel) => readTemplateFile(TEMPLATE_ID, rel));
  return [tokens, ...sections].join("\n");
}

/**
 * Compose the workshop page from its section HTML in manifest order, then bind
 * the org's workshop data into it. The output is a fragment for
 * `dangerouslySetInnerHTML` — callers already wrap it and load `readWorkshopCss`.
 */
export function renderWorkshopTemplate(data: WorkshopPageData): string {
  const manifest = loadTemplateManifest(TEMPLATE_ID);
  const page = manifest.sections
    .map((section) => readTemplateFile(TEMPLATE_ID, section.html))
    .join("\n");
  return applyManifestBindings(page, manifest.sections, toWorkshopContext(data));
}
