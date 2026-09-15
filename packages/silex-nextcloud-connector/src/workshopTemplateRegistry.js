"use strict";

const fs = require("fs");
const path = require("path");

const TEMPLATE_ROOT = path.join(__dirname, "templates");
const WORKSHOP_ROOT = path.join(TEMPLATE_ROOT, "workshop");
const DOSSIER_ROOT = path.join(TEMPLATE_ROOT, "dossier-classified");
const ENNEAGRAM_ROOT = path.join(TEMPLATE_ROOT, "enneagram");
const BROCHURE_ROOT = path.join(TEMPLATE_ROOT, "brochure");
const ARTICLE_ROOT = path.join(TEMPLATE_ROOT, "article");
const HUB_ROOT = path.join(TEMPLATE_ROOT, "hub");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function readWorkshopTemplateRegistry() {
  const manifest = readJson(path.join(WORKSHOP_ROOT, "manifest.json"));
  const tokensCss = readText(path.join(TEMPLATE_ROOT, "tokens", "eac-tokens.css"));

  const sections = manifest.sections.map((section) => ({
    ...section,
    htmlContent: readText(path.join(WORKSHOP_ROOT, section.html)),
    cssContent: readText(path.join(WORKSHOP_ROOT, section.css)),
  }));

  return {
    ...manifest,
    tokensCss,
    sections,
  };
}

function readDossierTemplateRegistry() {
  const manifest = readJson(path.join(DOSSIER_ROOT, "manifest.json"));
  const tokensCss = readText(path.join(TEMPLATE_ROOT, "..", "tokens", "dossier-classified.css"));

  const sections = manifest.sections.map((section) => ({
    ...section,
    htmlContent: readText(path.join(DOSSIER_ROOT, section.html)),
    cssContent: readText(path.join(DOSSIER_ROOT, section.css)),
  }));

  return {
    ...manifest,
    tokensCss,
    sections,
  };
}

function readWorkshopTemplateCss() {
  const registry = readWorkshopTemplateRegistry();
  return [registry.tokensCss || ""]
    .concat(registry.sections.map((section) => section.cssContent || ""))
    .join("\n\n");
}

function readDossierTemplateCss() {
  const registry = readDossierTemplateRegistry();
  return [registry.tokensCss || ""]
    .concat(registry.sections.map((section) => section.cssContent || ""))
    .join("\n\n");
}

function readEnneagramTemplateRegistry() {
  const manifest = readJson(path.join(ENNEAGRAM_ROOT, "manifest.json"));
  const tokensCss = readText(path.join(ENNEAGRAM_ROOT, "tokens", "eac-enneagram.css"));

  const sections = manifest.sections.map((section) => ({
    ...section,
    htmlContent: readText(path.join(ENNEAGRAM_ROOT, section.html)),
    cssContent: readText(path.join(ENNEAGRAM_ROOT, section.css)),
  }));

  // `...manifest` carries the `pages` array through to the client so it can
  // register one block per page composition in addition to per-section blocks.
  return {
    ...manifest,
    tokensCss,
    sections,
  };
}

function readEnneagramTemplateCss() {
  const registry = readEnneagramTemplateRegistry();
  return [registry.tokensCss || ""]
    .concat(registry.sections.map((section) => section.cssContent || ""))
    .join("\n\n");
}

function readBrochureTemplateRegistry() {
  const manifest = readJson(path.join(BROCHURE_ROOT, "manifest.json"));
  const tokensCss = readText(path.join(BROCHURE_ROOT, "tokens", "eac-brochure-tokens.css"));

  const sections = manifest.sections.map((section) => ({
    ...section,
    htmlContent: readText(path.join(BROCHURE_ROOT, section.html)),
    cssContent: readText(path.join(BROCHURE_ROOT, section.css)),
  }));

  // `...manifest` carries the `pages` array through to the client so it can
  // register one block per page composition (org-profile, offering) in
  // addition to per-section blocks — same convention as Enneagram.
  return {
    ...manifest,
    tokensCss,
    sections,
  };
}

function readBrochureTemplateCss() {
  const registry = readBrochureTemplateRegistry();
  return [registry.tokensCss || ""]
    .concat(registry.sections.map((section) => section.cssContent || ""))
    .join("\n\n");
}

/**
 * The article template — the reading environment for a published post.
 *
 * Its tokens live in the shared ../tokens/eac-tokens.css rather than a
 * template-private file, because this template is deliberately the same system
 * as @elkdonis/cms-ui/article.css: a post must read identically whether it is
 * served from the database by ArticleView or from a published file. Two
 * renderers, one reading environment.
 */
function readArticleTemplateRegistry() {
  const manifest = readJson(path.join(ARTICLE_ROOT, "manifest.json"));
  const tokensCss = readText(path.join(TEMPLATE_ROOT, "tokens", "eac-tokens.css"));

  const sections = manifest.sections.map((section) => ({
    ...section,
    htmlContent: readText(path.join(ARTICLE_ROOT, section.html)),
    cssContent: readText(path.join(ARTICLE_ROOT, section.css)),
  }));

  return { ...manifest, tokensCss, sections };
}

function readArticleTemplateCss() {
  const registry = readArticleTemplateRegistry();
  // Sections share one stylesheet here, so de-duplicate rather than emitting
  // the reading CSS four times.
  const seen = new Set();
  const css = registry.sections
    .map((section) => section.cssContent || "")
    .filter((body) => {
      if (!body || seen.has(body)) return false;
      seen.add(body);
      return true;
    });
  return [registry.tokensCss || ""].concat(css).join("\n\n");
}

/**
 * The hub template. Its cssOrder reaches OUT of the template directory to the
 * spotlight-grid pen (../../pens/...), which is deliberate: the tile grid and
 * the Spotlight Grid block are one stylesheet, so a hub cannot drift from the
 * block an owner drops on any other page. path.join resolves the climb, and
 * the de-duplication below stops the pen being emitted once per section.
 */
function readHubTemplateRegistry() {
  const manifest = readJson(path.join(HUB_ROOT, "manifest.json"));
  const tokensCss = readText(path.join(TEMPLATE_ROOT, "tokens", "eac-tokens.css"));

  const sections = manifest.sections.map((section) => ({
    ...section,
    htmlContent: readText(path.join(HUB_ROOT, section.html)),
    cssContent: readText(path.join(HUB_ROOT, section.css)),
  }));

  return { ...manifest, tokensCss, sections };
}

function readHubTemplateCss() {
  const manifest = readJson(path.join(HUB_ROOT, "manifest.json"));
  const parts = [readText(path.join(TEMPLATE_ROOT, "tokens", "eac-tokens.css"))];
  const seen = new Set();
  for (const rel of manifest.cssOrder || []) {
    const body = readText(path.join(HUB_ROOT, rel));
    if (!body || seen.has(body)) continue;
    seen.add(body);
    parts.push(`/* hub/${rel} */\n${body}`);
  }
  return parts.join("\n\n");
}

module.exports = {
  readHubTemplateRegistry,
  readHubTemplateCss,
  readWorkshopTemplateCss,
  readWorkshopTemplateRegistry,
  readDossierTemplateRegistry,
  readDossierTemplateCss,
  readEnneagramTemplateRegistry,
  readEnneagramTemplateCss,
  readBrochureTemplateRegistry,
  readBrochureTemplateCss,
  readArticleTemplateRegistry,
  readArticleTemplateCss,
};