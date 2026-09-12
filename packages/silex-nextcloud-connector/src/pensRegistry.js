"use strict";

/**
 * The pens library — see src/pens/README.md.
 *
 * Reads every `src/pens/<id>/manifest.json` and returns the entries with their
 * markup and CSS inlined, in the shape client-config.js consumes. Mirrors
 * workshopTemplateRegistry.js, but generic: adding a pen is adding a folder.
 */

const fs = require("fs");
const path = require("path");

const PENS_ROOT = path.join(__dirname, "pens");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readPen(dir) {
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readText(manifestPath));
  if (!manifest.id) return null;
  return {
    ...manifest,
    htmlContent: manifest.html ? readText(path.join(dir, manifest.html)) : "",
    cssContent: manifest.css ? readText(path.join(dir, manifest.css)) : "",
  };
}

/** Every pen, sorted by id. Folders without a manifest are ignored. */
function readPensRegistry() {
  if (!fs.existsSync(PENS_ROOT)) return { pens: [] };
  const pens = fs
    .readdirSync(PENS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      try {
        return readPen(path.join(PENS_ROOT, entry.name));
      } catch (err) {
        console.error("[pensRegistry] could not read pen", entry.name, err);
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
  return { pens };
}

/** All pen stylesheets concatenated — what the editor canvas links. */
function readPensCss() {
  return readPensRegistry()
    .pens.map((pen) => `/* pen: ${pen.id} */\n${pen.cssContent}`)
    .join("\n\n");
}

module.exports = { readPensRegistry, readPensCss, PENS_ROOT };
