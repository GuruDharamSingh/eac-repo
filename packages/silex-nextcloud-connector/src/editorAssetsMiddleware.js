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
} = require("./workshopTemplateRegistry");

const CSS_URL = "/eac-blocks.css";
const WORKSHOP_TEMPLATE_URL = "/eac-workshop-template.json";
const WORKSHOP_CSS_URL = "/eac-workshop-template.css";
const DOSSIER_TEMPLATE_URL = "/eac-dossier-classified.json";
const DOSSIER_CSS_URL = "/eac-dossier-classified.css";
const ENNEAGRAM_TEMPLATE_URL = "/eac-enneagram.json";
const ENNEAGRAM_CSS_URL = "/eac-enneagram.css";
const ASSET_ROUTES = [
  CSS_URL,
  WORKSHOP_TEMPLATE_URL,
  WORKSHOP_CSS_URL,
  DOSSIER_TEMPLATE_URL,
  DOSSIER_CSS_URL,
  ENNEAGRAM_TEMPLATE_URL,
  ENNEAGRAM_CSS_URL,
];
const CSS_FILE = path.join(__dirname, "eac-blocks.css");

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

  app.get(CSS_URL, eacEditorAssets);
  app.get(WORKSHOP_TEMPLATE_URL, eacWorkshopTemplate);
  app.get(WORKSHOP_CSS_URL, eacWorkshopCss);
  app.get(DOSSIER_TEMPLATE_URL, eacDossierTemplate);
  app.get(DOSSIER_CSS_URL, eacDossierCss);
  app.get(ENNEAGRAM_TEMPLATE_URL, eacEnneagramTemplate);
  app.get(ENNEAGRAM_CSS_URL, eacEnneagramCss);
}

module.exports = {
  ASSET_ROUTES,
  CSS_URL,
  WORKSHOP_CSS_URL,
  WORKSHOP_TEMPLATE_URL,
  DOSSIER_CSS_URL,
  DOSSIER_TEMPLATE_URL,
  ENNEAGRAM_CSS_URL,
  ENNEAGRAM_TEMPLATE_URL,
  registerEditorAssets,
};
