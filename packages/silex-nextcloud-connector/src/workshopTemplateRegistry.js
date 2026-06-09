"use strict";

const fs = require("fs");
const path = require("path");

const TEMPLATE_ROOT = path.join(__dirname, "templates");
const WORKSHOP_ROOT = path.join(TEMPLATE_ROOT, "workshop");
const DOSSIER_ROOT = path.join(TEMPLATE_ROOT, "dossier-classified");
const ENNEAGRAM_ROOT = path.join(TEMPLATE_ROOT, "enneagram");

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

module.exports = {
  readWorkshopTemplateCss,
  readWorkshopTemplateRegistry,
  readDossierTemplateRegistry,
  readDossierTemplateCss,
  readEnneagramTemplateRegistry,
  readEnneagramTemplateCss,
};