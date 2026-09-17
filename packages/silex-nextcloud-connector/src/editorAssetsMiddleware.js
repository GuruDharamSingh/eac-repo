"use strict";

/**
 * Editor assets — registers an explicit GET route that serves the EAC
 * editor stylesheet at /eac-blocks.css. The Silex client config points
 * GrapesJS canvas.styles at this URL so the editor canvas iframe injects
 * it on first paint — no DOM monkey-patching, no HTML interception.
 */

const fs = require("fs");
const path = require("path");
const {
  readWorkshopTemplateCss,
  readWorkshopTemplateRegistry,
  readDossierTemplateCss,
  readDossierTemplateRegistry,
  readEnneagramTemplateCss,
  readEnneagramTemplateRegistry,
  readBrochureTemplateCss,
  readBrochureTemplateRegistry,
  readArticleTemplateRegistry,
  readArticleTemplateCss,
  readHubTemplateRegistry,
  readHubTemplateCss,
} = require("./workshopTemplateRegistry");
const { readPensRegistry, readPensCss } = require("./pensRegistry");

const CSS_URL = "/eac-blocks.css";
const WORKSHOP_TEMPLATE_URL = "/eac-workshop-template.json";
const WORKSHOP_CSS_URL = "/eac-workshop-template.css";
const DOSSIER_TEMPLATE_URL = "/eac-dossier-classified.json";
const DOSSIER_CSS_URL = "/eac-dossier-classified.css";
const ENNEAGRAM_TEMPLATE_URL = "/eac-enneagram.json";
const ENNEAGRAM_CSS_URL = "/eac-enneagram.css";
const BROCHURE_TEMPLATE_URL = "/eac-brochure-template.json";
const BROCHURE_CSS_URL = "/eac-brochure-template.css";
const ARTICLE_TEMPLATE_URL = "/eac-article-template.json";
const ARTICLE_CSS_URL = "/eac-article-template.css";
// The pens library (src/pens/README.md): one JSON registry, one stylesheet.
const HUB_TEMPLATE_URL = "/eac-hub-template.json";
const HUB_CSS_URL = "/eac-hub-template.css";
const PENS_URL = "/eac-pens.json";
const PENS_CSS_URL = "/eac-pens.css";
// The live-component catalogue (@elkdonis/silex-render components.data.json),
// bind-mounted into the container. Serving it here is what lets the editor build
// its live-slot blocks from the same list the renderer reads, instead of a
// hardcoded copy that drifts — it had: 12 declared, 8 offered.
const COMPONENTS_URL = "/eac-components.json";
const COMPONENTS_FILE =
  process.env.EAC_COMPONENTS_FILE || "/silex/extensions/eac-components.json";
const ASSET_ROUTES = [
  CSS_URL,
  WORKSHOP_TEMPLATE_URL,
  WORKSHOP_CSS_URL,
  DOSSIER_TEMPLATE_URL,
  DOSSIER_CSS_URL,
  ENNEAGRAM_TEMPLATE_URL,
  ENNEAGRAM_CSS_URL,
  BROCHURE_TEMPLATE_URL,
  ARTICLE_CSS_URL,
  ARTICLE_TEMPLATE_URL,
  BROCHURE_CSS_URL,
  COMPONENTS_URL,
  PENS_URL,
  PENS_CSS_URL,
  HUB_TEMPLATE_URL,
  HUB_CSS_URL,
];
const CSS_FILE = path.join(__dirname, "eac-blocks.css");

// ── Vendored GrapesJS plugins ───────────────────────────────────────────────
//
// Third-party editor plugins live in their own npm tree, installed by
// packages/silex/Dockerfile at /silex/eac-vendor. Each is served as ONE UMD
// bundle at /eac-vendor/<id>.js, because the client config is delivered raw to
// the browser and cannot resolve bare npm specifiers — it loads these with
// <script> tags and reads the global each UMD wrapper defines.
//
// An ALLOWLIST, deliberately: the id in the URL selects a row here, so no
// request can reach an arbitrary path under the vendor tree. `dist` is each
// package's own `main`, recorded once rather than resolved at request time.
const VENDOR_DIR = process.env.EAC_VENDOR_DIR || "/silex/eac-vendor/node_modules";
const VENDOR_URL_PREFIX = "/eac-vendor/";
const VENDOR_BUNDLES = {
  "grapesjs-tabs": "grapesjs-tabs/dist/grapesjs-tabs.min.js",
  "grapesjs-rte-extensions": "grapesjs-rte-extensions/dist/index.js",
  "grapesjs-project-manager": "grapesjs-project-manager/dist/grapesjs-project-manager.min.js",
  "grapesjs-blocks-flexbox": "grapesjs-blocks-flexbox/dist/index.js",
  "grapesjs-blocks-table": "grapesjs-blocks-table/dist/grapesjs-blocks-table.min.js",
  "grapesjs-plugin-export": "grapesjs-plugin-export/dist/index.js",
  "grapesjs-preset-newsletter": "grapesjs-preset-newsletter/dist/index.js",
  "grapesjs-mjml": "grapesjs-mjml/dist/index.js",
};

/** Which vendored bundles are actually present in this image. */
function availableVendorPlugins() {
  return Object.keys(VENDOR_BUNDLES).filter((id) =>
    fs.existsSync(path.join(VENDOR_DIR, VENDOR_BUNDLES[id]))
  );
}

function registerEditorAssets(app) {
  function eacEditorAssets(req, res, next) {
    fs.readFile(CSS_FILE, (err, body) => {
      if (err) {
        console.error("[editorAssets] failed to read", CSS_FILE, err);
        return next(err);
      }
      res.set("Content-Type", "text/css; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    });
  }

  function eacWorkshopTemplate(req, res, next) {
    try {
      const body = JSON.stringify(readWorkshopTemplateRegistry());
      res.set("Content-Type", "application/json; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read workshop template", err);
      next(err);
    }
  }

  function eacWorkshopCss(req, res, next) {
    try {
      const body = readWorkshopTemplateCss();
      res.set("Content-Type", "text/css; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read workshop css", err);
      next(err);
    }
  }

  function eacDossierTemplate(req, res, next) {
    try {
      const body = JSON.stringify(readDossierTemplateRegistry());
      res.set("Content-Type", "application/json; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read dossier template", err);
      next(err);
    }
  }

  function eacDossierCss(req, res, next) {
    try {
      const body = readDossierTemplateCss();
      res.set("Content-Type", "text/css; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read dossier css", err);
      next(err);
    }
  }

  function eacEnneagramTemplate(req, res, next) {
    try {
      const body = JSON.stringify(readEnneagramTemplateRegistry());
      res.set("Content-Type", "application/json; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read enneagram template", err);
      next(err);
    }
  }

  function eacEnneagramCss(req, res, next) {
    try {
      const body = readEnneagramTemplateCss();
      res.set("Content-Type", "text/css; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read enneagram css", err);
      next(err);
    }
  }

  function eacBrochureTemplate(req, res, next) {
    try {
      const body = JSON.stringify(readBrochureTemplateRegistry());
      res.set("Content-Type", "application/json; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read brochure template", err);
      next(err);
    }
  }

  function eacBrochureCss(req, res, next) {
    try {
      const body = readBrochureTemplateCss();
      res.set("Content-Type", "text/css; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read brochure css", err);
      next(err);
    }
  }

  function eacArticleTemplate(req, res, next) {
    try {
      const body = JSON.stringify(readArticleTemplateRegistry());
      res.set("Content-Type", "application/json; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read article template", err);
      next(err);
    }
  }

  function eacArticleCss(req, res, next) {
    try {
      const body = readArticleTemplateCss();
      res.set("Content-Type", "text/css; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read article css", err);
      next(err);
    }
  }

  function eacComponents(req, res, next) {
    fs.readFile(COMPONENTS_FILE, (err, body) => {
      if (err) {
        // Not fatal: the client config falls back to its built-in slot list, so
        // a missing mount degrades to the old behaviour rather than an empty panel.
        console.warn("[editorAssets] component catalogue unavailable:", err.message);
        res.set("Content-Type", "application/json; charset=utf-8");
        return res.status(200).send("[]");
      }
      res.set("Content-Type", "application/json; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    });
  }

  function eacPens(req, res, next) {
    try {
      const body = JSON.stringify(readPensRegistry());
      res.set("Content-Type", "application/json; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read pens registry", err);
      next(err);
    }
  }

  function eacPensCss(req, res, next) {
    try {
      const body = readPensCss();
      res.set("Content-Type", "text/css; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read pens css", err);
      next(err);
    }
  }

  function eacHubTemplate(req, res, next) {
    try {
      const body = JSON.stringify(readHubTemplateRegistry());
      res.set("Content-Type", "application/json; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read hub template", err);
      next(err);
    }
  }

  function eacHubCss(req, res, next) {
    try {
      const body = readHubTemplateCss();
      res.set("Content-Type", "text/css; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60");
      res.status(200).send(body);
    } catch (err) {
      console.error("[editorAssets] failed to read hub css", err);
      next(err);
    }
  }

  // GET /eac-vendor/<id>.js — one allowlisted UMD bundle.
  // GET /eac-vendor/           — what this image actually has, so the client
  //                              config can skip a plugin the image predates
  //                              instead of injecting a <script> that 404s.
  function eacVendorPlugin(req, res, next) {
    const id = String(req.params.id || "").replace(/\.js$/, "");
    const rel = VENDOR_BUNDLES[id];
    if (!rel) return res.status(404).type("text/plain").send("Unknown plugin");
    const file = path.join(VENDOR_DIR, rel);
    fs.readFile(file, (err, body) => {
      if (err) {
        // Not an error the editor should die on: the image may simply predate
        // this entry. Say which file, and answer 404 so the loader skips it.
        console.warn(`[editorAssets] vendor plugin missing: ${id} (${file})`);
        return res.status(404).type("text/plain").send("Plugin not installed");
      }
      res.set("Content-Type", "application/javascript; charset=utf-8");
      res.set("Cache-Control", "public, max-age=300");
      res.status(200).send(body);
    });
  }

  function eacVendorIndex(req, res) {
    res.set("Content-Type", "application/json; charset=utf-8");
    res.set("Cache-Control", "public, max-age=60");
    res.status(200).send(JSON.stringify({ plugins: availableVendorPlugins() }));
  }

  app.get(HUB_TEMPLATE_URL, eacHubTemplate);
  app.get(HUB_CSS_URL, eacHubCss);
  app.get(COMPONENTS_URL, eacComponents);
  app.get(PENS_URL, eacPens);
  app.get(PENS_CSS_URL, eacPensCss);
  app.get(CSS_URL, eacEditorAssets);
  app.get(WORKSHOP_TEMPLATE_URL, eacWorkshopTemplate);
  app.get(WORKSHOP_CSS_URL, eacWorkshopCss);
  app.get(DOSSIER_TEMPLATE_URL, eacDossierTemplate);
  app.get(DOSSIER_CSS_URL, eacDossierCss);
  app.get(ENNEAGRAM_TEMPLATE_URL, eacEnneagramTemplate);
  app.get(ENNEAGRAM_CSS_URL, eacEnneagramCss);
  app.get(BROCHURE_TEMPLATE_URL, eacBrochureTemplate);
  app.get(BROCHURE_CSS_URL, eacBrochureCss);
  app.get(ARTICLE_TEMPLATE_URL, eacArticleTemplate);
  app.get(ARTICLE_CSS_URL, eacArticleCss);
  app.get(VENDOR_URL_PREFIX, eacVendorIndex);
  app.get(`${VENDOR_URL_PREFIX}:id`, eacVendorPlugin);
}

module.exports = {
  ASSET_ROUTES,
  VENDOR_URL_PREFIX,
  VENDOR_BUNDLES,
  availableVendorPlugins,
  COMPONENTS_URL,
  CSS_URL,
  WORKSHOP_CSS_URL,
  WORKSHOP_TEMPLATE_URL,
  DOSSIER_CSS_URL,
  DOSSIER_TEMPLATE_URL,
  ENNEAGRAM_CSS_URL,
  ENNEAGRAM_TEMPLATE_URL,
  BROCHURE_CSS_URL,
  BROCHURE_TEMPLATE_URL,
  ARTICLE_CSS_URL,
  ARTICLE_TEMPLATE_URL,
  registerEditorAssets,
};
