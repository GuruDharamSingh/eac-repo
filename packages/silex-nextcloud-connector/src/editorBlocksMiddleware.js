"use strict";

const fs = require("fs");
const path = require("path");
const { readWorkshopTemplateRegistry, readDossierTemplateRegistry } = require("./workshopTemplateRegistry");

const SCRIPT_PATH = "/eac-silex-blocks.js";
const CLIENT_INDEX_PATH = process.env.SILEX_CLIENT_INDEX_PATH || "/silex/dist/client/index.html";

function readBlocksScript() {
  const blocksScript = fs.readFileSync(path.join(__dirname, "editor-blocks.js"), "utf8");
  const registry = readWorkshopTemplateRegistry();
  const dossierRegistry = readDossierTemplateRegistry();
  return `window.__eacWorkshopTemplate = ${JSON.stringify(registry)};\nwindow.__eacDossierTemplate = ${JSON.stringify(dossierRegistry)};\n${blocksScript}`;
}

function injectBlocksScript(html) {
  if (html.includes(SCRIPT_PATH)) return html;
  const tag = `<script src="${SCRIPT_PATH}"></script>`;
  if (/<script\s+src=(['"])js\/main\.js/i.test(html)) {
    return html.replace(/<script\s+src=(['"])js\/main\.js/i, `${tag}<script src=$1js/main.js`);
  }
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}</body>`);
  return `${html}${tag}`;
}

function isHtmlResponse(res, body) {
  const contentType = String(res.getHeader("content-type") || "");
  if (contentType.includes("text/html")) return true;
  if (typeof body === "string") return /<!doctype html|<html[\s>]/i.test(body);
  if (Buffer.isBuffer(body)) return /<!doctype html|<html[\s>]/i.test(body.toString("utf8", 0, 256));
  return false;
}

function editorBlocksMiddleware() {
  return function eacEditorBlocks(req, res, next) {
    if (req.method !== "GET") return next();
    const accept = req.headers.accept || "";
    const acceptsHtml = !accept || accept.includes("text/html") || accept.includes("*/*");
    if (!acceptsHtml) return next();

    if (typeof res.send === "function") {
      const originalSend = res.send.bind(res);
      res.send = function sendWithEacBlocks(body) {
        if (!isHtmlResponse(res, body)) return originalSend(body);

        if (Buffer.isBuffer(body)) {
          return originalSend(Buffer.from(injectBlocksScript(body.toString("utf8"))));
        }

        if (typeof body === "string") {
          return originalSend(injectBlocksScript(body));
        }

        return originalSend(body);
      };
    }

    return next();
  };
}

function editorBlocksScriptMiddleware() {
  const script = readBlocksScript();

  return function eacEditorBlocksScript(req, res, next) {
    if (req.method !== "GET") return next();
    res.setHeader("content-type", "application/javascript; charset=utf-8");
    res.setHeader("content-length", Buffer.byteLength(script));
    res.end(script);
  };
}

function editorRootMiddleware() {
  return function eacEditorRoot(req, res, next) {
    if (req.method !== "GET") return next();
    const url = new URL(req.originalUrl || req.url || "/", "http://silex.local");
    if (url.searchParams.has("t")) return next();
    if (url.pathname !== "/") return next();

    try {
      const html = injectBlocksScript(fs.readFileSync(CLIENT_INDEX_PATH, "utf8"));
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.setHeader("content-length", Buffer.byteLength(html));
      return res.end(html);
    } catch (err) {
      console.warn(`[silex-nextcloud-connector] could not inject editor root: ${err.message}`);
      return next();
    }
  };
}

module.exports = {
  SCRIPT_PATH,
  editorBlocksMiddleware,
  editorBlocksScriptMiddleware,
  editorRootMiddleware,
};