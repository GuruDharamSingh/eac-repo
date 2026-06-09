#!/usr/bin/env node
/*
 * seed-enneagram-site.mjs
 * =======================
 * Turnkey "give him his site back" seeder for The Hidden Enneagram.
 *
 * Composes every page from the connector's enneagram template and writes TWO
 * things into the owner's Nextcloud folder over WebDAV:
 *
 *   1. <projectPath>/website.json + meta.json
 *      An *editable* Silex/GrapeJS project: one page per composition, with the
 *      composed section HTML as the page's frame component. Opening the editor
 *      from the arts-collective hub loads these pages ready to tweak.
 *
 *   2. <publishedPath>/*.html + css/eac-enneagram.css + .eac-publish.json
 *      A *live-now* static publication. arts-collective's SilexLayout reads
 *      these directly, so the public site renders immediately (dark Enneagram
 *      design + live <eac-embed> inquiry/booking slots) even before the owner
 *      re-publishes from the editor. This is also the fallback if the editable
 *      website.json page format needs tuning for your Silex build.
 *
 * After it runs, set the org's published pointer (printed SQL at the end).
 *
 * Usage:
 *   NEXTCLOUD_URL=https://cloud.example.org \
 *   NC_USER=eac_hidden_enneagram NC_PASS=<app-password> \
 *   SEED_PROJECT_PATH=eac/hidden-enneagram/silex/project \
 *   SEED_PUBLISHED_PATH=eac/hidden-enneagram/silex/published \
 *   SEED_SLUG=hidden-enneagram \
 *   node scripts/seed-enneagram-site.mjs
 *
 *   # inspect output locally without touching Nextcloud:
 *   node scripts/seed-enneagram-site.mjs --dry-run --out=/tmp/enneagram-seed
 */

import { createRequire } from "module";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const { readEnneagramTemplateRegistry, readEnneagramTemplateCss } = require("../src/workshopTemplateRegistry");
const { createWebdavClient } = require("../src/webdav");

// ── args / config ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name) {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
}
const DRY_RUN = Boolean(flag("dry-run"));
const OUT_DIR = flag("out") || path.join(process.cwd(), ".enneagram-seed");

const cfg = {
  baseUrl: process.env.NEXTCLOUD_URL || process.env.NC_URL,
  user: process.env.NC_USER || process.env.NEXTCLOUD_SEED_USER,
  pass: process.env.NC_PASS || process.env.NEXTCLOUD_SEED_PASS,
  projectPath: (process.env.SEED_PROJECT_PATH || "").replace(/^\/+|\/+$/g, ""),
  publishedPath: (process.env.SEED_PUBLISHED_PATH || "").replace(/^\/+|\/+$/g, ""),
  slug: process.env.SEED_SLUG || "hidden-enneagram",
};

// ── page composition ─────────────────────────────────────────────────────────
const registry = readEnneagramTemplateRegistry();
const sectionHtml = Object.fromEntries(
  registry.sections.map((s) => [s.id, s.htmlContent || ""])
);
function composeSections(ids) {
  return ids.map((id) => sectionHtml[id] || "").filter(Boolean).join("\n");
}
function pageById(id) {
  return registry.pages.find((p) => p.id === id);
}

const CSS_LINK = '<link rel="stylesheet" href="/css/eac-enneagram.css">';

// Working site navigation baked into the seed so the starter site is navigable
// out of the box. The owner can re-point these in the Silex editor.
const NAV_LINKS = [
  { label: "Introduction", route: "/introduction" },
  { label: "Centers", route: "/centers" },
  { label: "Triads", route: "/triads" },
  { label: "Services", route: "/services" },
  { label: "Contact", route: "/contact" },
];
const TOC_LINKS = [
  { label: "Introduction", route: "/introduction" },
  { label: "Centers of Energy", route: "/centers" },
  { label: "Triads", route: "/triads" },
  { label: "Core Types", route: "/type-1" },
  { label: "Services / Inquiries", route: "/services" },
  { label: "Contact", route: "/contact" },
  { label: "Home", route: "/" },
];

/** Replace placeholder href="#" links with real page routes. */
function wireLinks(html) {
  // Top nav (glyph bar) links
  const navInner = NAV_LINKS.map(
    (l) => `<a href="${l.route}" data-gjs-editable="true">${l.label}</a>`
  ).join("\n      ");
  html = html.replace(
    /<nav class="eac-enn-nav__links">[\s\S]*?<\/nav>/,
    `<nav class="eac-enn-nav__links">\n      ${navInner}\n    </nav>`
  );
  // TOC link-stack items, in order
  let ti = 0;
  html = html.replace(
    /<a class="eac-enn-toc__item" href="#"[^>]*>[^<]*<\/a>/g,
    () => {
      const l = TOC_LINKS[ti] || TOC_LINKS[TOC_LINKS.length - 1];
      ti += 1;
      return `<a class="eac-enn-toc__item" href="${l.route}" data-gjs-editable="true">${l.label}</a>`;
    }
  );
  // Core Types grid → /type-N
  html = html.replace(
    /<a class="eac-enn-typenav__item" href="#"[^>]*><span>(\d)<\/span>([^<]*)<\/a>/g,
    (_m, n, name) =>
      `<a class="eac-enn-typenav__item" href="/type-${n}" data-gjs-editable="true"><span>${n}</span>${name}</a>`
  );
  // "Go Back To Core Types" → first type
  html = html.replace(
    /<a class="eac-enn-typenav__back" href="#"[^>]*>([\s\S]*?)<\/a>/,
    '<a class="eac-enn-typenav__back" href="/type-1" data-gjs-editable="true">$1</a>'
  );
  return html;
}

/** Strip authored HTML comments (some contain literal "<eac-embed>" text). */
function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

/** A published page is a self-contained fragment: css link + composed sections. */
function publishedFragment(ids) {
  return wireLinks(
    stripHtmlComments(
      `${CSS_LINK}\n<main class="eac-enn-page">\n${composeSections(ids)}\n</main>\n`
    )
  );
}

/** Swap the text of the type-header H1 (data-trait="title") to an ordinal. */
function setTypeTitle(html, title) {
  return html.replace(
    /(<h1\b[^>]*\bdata-trait="title"[^>]*>)[\s\S]*?(<\/h1>)/,
    `$1\n      ${title}\n    $2`
  );
}

const ORDINALS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

// Conceptual pages → output filename + nice name.
const conceptPages = [
  { file: "index.html", name: "Home", page: "home" },
  { file: "introduction.html", name: "Introduction", page: "introduction" },
  { file: "centers.html", name: "Centers of Energy", page: "centers" },
  { file: "triads.html", name: "Triads", page: "triads" },
  { file: "services.html", name: "Services / Inquiries", page: "services" },
  { file: "contact.html", name: "Contact", page: "contact" },
];

const typeComposition = pageById("type")?.sections || [];

// Build the full list of {file, name, html} to seed.
const outputs = [];
for (const cp of conceptPages) {
  const p = pageById(cp.page);
  if (!p) continue;
  outputs.push({ file: cp.file, name: cp.name, html: publishedFragment(p.sections) });
}
for (let i = 0; i < 9; i++) {
  const html = setTypeTitle(publishedFragment(typeComposition), ORDINALS[i]);
  outputs.push({ file: `type-${i + 1}.html`, name: `Type ${i + 1}`, html });
}

const combinedCss = readEnneagramTemplateCss();

// ── editable Silex project (website.json) ────────────────────────────────────
const website = {
  pages: outputs.map((o) => ({
    id: o.file.replace(/\.html$/, ""),
    name: o.name,
    // GrapeJS parses a string frame component into an editable tree on load.
    frames: [{ component: o.html }],
  })),
  assets: [],
  styles: [],
  settings: {},
  pagesFolder: "pages",
  fonts: [],
  symbols: [],
  publication: {},
};
const meta = {
  name: "The Hidden Enneagram",
  connectorUserSettings: {},
  updatedAt: new Date().toISOString(),
};

// ── publish manifest (.eac-publish.json) ─────────────────────────────────────
const publishedFiles = [...outputs.map((o) => o.file), "css/eac-enneagram.css"];
const publishManifest = {
  version: 1,
  connectorId: "nextcloud-hosting",
  websiteId: "default",
  slug: cfg.slug,
  orgId: null,
  userId: null,
  publishedAt: new Date().toISOString(),
  entryPath: "index.html",
  htmlFiles: outputs.map((o) => o.file),
  files: publishedFiles,
};

// ── writers ──────────────────────────────────────────────────────────────────
async function writeAll() {
  if (DRY_RUN) {
    fs.mkdirSync(path.join(OUT_DIR, "project"), { recursive: true });
    fs.mkdirSync(path.join(OUT_DIR, "published", "css"), { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, "project", "website.json"), JSON.stringify(website, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, "project", "meta.json"), JSON.stringify(meta, null, 2));
    for (const o of outputs) fs.writeFileSync(path.join(OUT_DIR, "published", o.file), o.html);
    fs.writeFileSync(path.join(OUT_DIR, "published", "css", "eac-enneagram.css"), combinedCss);
    fs.writeFileSync(path.join(OUT_DIR, "published", ".eac-publish.json"), JSON.stringify(publishManifest, null, 2));
    console.log(`[dry-run] wrote ${outputs.length} pages + project + css to ${OUT_DIR}`);
    return;
  }

  for (const [k, v] of Object.entries(cfg)) {
    if (!v) throw new Error(`Missing required config: ${k} (set env or pass --dry-run)`);
  }
  const c = createWebdavClient({ baseUrl: cfg.baseUrl, user: cfg.user, pass: cfg.pass });

  // Editable project
  await c.ensureDir(`${cfg.projectPath}/assets`);
  await c.putFile(`${cfg.projectPath}/website.json`, Buffer.from(JSON.stringify(website), "utf8"));
  await c.putFile(`${cfg.projectPath}/meta.json`, Buffer.from(JSON.stringify(meta), "utf8"));

  // Live publication
  await c.ensureDir(`${cfg.publishedPath}/css`);
  for (const o of outputs) {
    await c.putFile(`${cfg.publishedPath}/${o.file}`, Buffer.from(o.html, "utf8"));
  }
  await c.putFile(`${cfg.publishedPath}/css/eac-enneagram.css`, Buffer.from(combinedCss, "utf8"));
  await c.putFile(
    `${cfg.publishedPath}/.eac-publish.json`,
    Buffer.from(`${JSON.stringify(publishManifest, null, 2)}\n`, "utf8")
  );
  console.log(`Seeded ${outputs.length} pages to ${cfg.user}:${cfg.publishedPath}`);
}

function silexPublishedRef() {
  const encUser = encodeURIComponent(cfg.user || "<nc-user>");
  const encPath = `${cfg.publishedPath}/index.html`
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `nextcloud://${encUser}/${encPath}`;
}

writeAll()
  .then(() => {
    const ref = silexPublishedRef();
    console.log("\nNext: point the org at the publication ──────────────────────");
    console.log(`  ref: ${ref}`);
    console.log("  SQL:");
    console.log(
      `    UPDATE organizations SET layout_mode='silex', silex_published_path='${ref}', silex_published_at=NOW() WHERE slug='${cfg.slug}';`
    );
    console.log("\nThen open the editor from the arts-collective hub to tweak pages.");
  })
  .catch((err) => {
    console.error("seed failed:", err.message || err);
    process.exit(1);
  });
