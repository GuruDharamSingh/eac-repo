/**
 * Filesystem-backed template loading.
 *
 * Kept in its own entry point (`@elkdonis/cms-bindings/node`) so the main entry
 * stays filesystem-free and safe to pull into a browser bundle — the split the
 * manifest module's header already assumed.
 *
 * Templates live with the Silex connector because that is what serves them to
 * the editor; this resolves that directory from whichever app cwd is current,
 * mirroring the candidate-path convention arts-collective already used.
 */

import fs from "node:fs";
import path from "node:path";
import type { TemplateManifest } from "./manifest";

const TEMPLATE_SUBPATH = "packages/silex-nextcloud-connector/src/templates";

function resolveTemplateRoot(): string {
  const candidates = [
    path.join(process.cwd(), "../..", TEMPLATE_SUBPATH),
    path.join(process.cwd(), "../../..", TEMPLATE_SUBPATH),
    path.join(process.cwd(), TEMPLATE_SUBPATH),
    // Running from inside packages/cms-bindings itself (scripts, tests).
    path.join(process.cwd(), "..", "silex-nextcloud-connector/src/templates"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Template root not found from cwd=${process.cwd()}. Looked in:\n  ${candidates.join("\n  ")}`
  );
}

let cachedRoot: string | null = null;

export function templateRoot(): string {
  if (!cachedRoot) cachedRoot = resolveTemplateRoot();
  return cachedRoot;
}

export function templateDir(templateId: string): string {
  return path.join(templateRoot(), templateId);
}

const manifestCache = new Map<string, TemplateManifest>();

/**
 * Read and cache a template manifest.
 *
 * Cached for the process lifetime: manifests ship with the code, so a change
 * implies a deploy. Template *content* (the HTML a section points at) is read
 * separately and is not cached here.
 */
export function loadTemplateManifest(templateId: string): TemplateManifest {
  const cached = manifestCache.get(templateId);
  if (cached) return cached;

  const file = path.join(templateDir(templateId), "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8")) as TemplateManifest;
  manifestCache.set(templateId, manifest);
  return manifest;
}

/** Read one of a template's declared section HTML files. */
export function readTemplateFile(templateId: string, relativePath: string): string {
  return fs.readFileSync(path.join(templateDir(templateId), relativePath), "utf8");
}
