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

// ─── dossier ─────────────────────────────────────────────────────────────────

import {
  DOSSIER_TEMPLATE_ID,
  renderDossier,
  bindPublishedDossier,
  type DossierSectionHtml,
  type RenderDossierOptions,
} from "./dossier/render";
import type { DossierProfileData } from "./dossier/types";

/**
 * Every section file of a template, keyed by its manifest `html` path.
 *
 * Not cached, deliberately: the manifest ships with the code, but the section
 * HTML is what a designer edits, and caching it means a CSS-and-markup change
 * needs a process restart to be seen. The read is a handful of small files.
 */
export function readTemplateSections(templateId: string): Record<string, string> {
  const manifest = loadTemplateManifest(templateId);
  const out: Record<string, string> = {};
  for (const section of manifest.sections) {
    out[section.html] = readTemplateFile(templateId, section.html);
  }
  return out;
}

/** Compose and bind a dossier straight from the template on disk. */
export function renderDossierFromDisk(
  data: DossierProfileData,
  opts: RenderDossierOptions = {}
): string {
  const manifest = loadTemplateManifest(DOSSIER_TEMPLATE_ID);
  const html: DossierSectionHtml = readTemplateSections(DOSSIER_TEMPLATE_ID);
  return renderDossier(manifest, html, data, opts);
}

/** Bind a dossier published from Silex, using the manifest on disk. */
export function bindPublishedDossierFromDisk(
  publishedHtml: string,
  data: DossierProfileData,
  opts: RenderDossierOptions = {}
): string {
  const manifest = loadTemplateManifest(DOSSIER_TEMPLATE_ID);
  return bindPublishedDossier(manifest, publishedHtml, data, opts);
}

/**
 * The template's whole stylesheet: tokens first, then the sections in
 * `cssOrder`. One reader for every host, rather than each app re-deriving the
 * order from the manifest — which is how ArtDirect ended up owning the file
 * frame that the template itself needed.
 */
export function readTemplateCss(templateId: string): string {
  const manifest = loadTemplateManifest(templateId);
  const dir = templateDir(templateId);
  const parts: string[] = [];
  if (manifest.tokens) {
    parts.push(fs.readFileSync(path.resolve(dir, manifest.tokens), "utf8"));
  }
  const order =
    manifest.cssOrder ??
    manifest.sections.map((s) => s.css).filter((c): c is string => Boolean(c));
  for (const rel of order) parts.push(readTemplateFile(templateId, rel));
  return parts.join("\n\n");
}
