// Bundle the Studio Create + piece summary harness (entry.tsx) and the summary gate in front of the real
// meeting form (entry-gate.tsx), and write one HTML page per view. Run in a throwaway node container: README.md.
import * as esbuild from "/repo/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/lib/main.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const R = "/repo";
const H = "/h";
const A = `${R}/apps/arts-collective`;
// next/* as the forms harness stubs them (focus.tsx reaches cms-ui, which imports next/link).
const S = `${R}/scripts/forms-harness/stubs`;
const stubs = {
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: `${S}/next-link.tsx` }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: `${S}/next-navigation.ts` }));
    b.onResolve({ filter: /^next\/(server|headers|cache|dynamic|image)$/ }, () => ({ path: `${S}/next-other.tsx` }));
  },
};
mkdirSync(`${H}/out`, { recursive: true });
const common = {
  bundle: true,
  format: "iife",
  jsx: "automatic",
  loader: { ".css": "empty" },
  define: { __dirname: '"/"', "process.env.NODE_ENV": '"production"' },
  nodePaths: [`${A}/node_modules`, `${R}/packages/studio/node_modules`, `${R}/node_modules`],
  plugins: [stubs],
  logLevel: "warning",
};
await esbuild.build({ ...common, entryPoints: [`${H}/entry.tsx`], outfile: `${H}/out/app.js` });
await esbuild.build({ ...common, entryPoints: [`${H}/entry-gate.tsx`], outfile: `${H}/out/gate.js` });

const read = (f) => readFileSync(`${R}/${f}`, "utf8");
// The Studio frame's own stylesheet, then Create's and the summary's, as the Studio page imports them;
// the gate pages add the forms' (canvas, forms, ledger).
const css = ["packages/studio/src/studio.css", "packages/studio/src/create/create.css", "packages/content/src/summary/summary.css"].map(read).join("\n");
const formsCss = ["packages/studio-forms/src/canvas/canvas.css", "packages/studio-forms/src/forms/theme/forms.css", "packages/studio-forms/src/forms/theme/ledger.css"]
  .map(read)
  .join("\n");
const fonts =
  "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
const base = "*,*::before,*::after{box-sizing:border-box}body{margin:0}button{font:inherit}";
const html = (page, script, extraCss = "") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${fonts}"><style>${base}\n${css}\n${extraCss}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"},browser:true};window.global=window;window.__PAGE__=${JSON.stringify(page)}</script><script src="${script}"></script></body></html>`;
// A dark site's --ps-* (sunjay's slate and bronze), set on .ps as a site does, for the pop-up pages.
const darkSite =
  ".site-dark .ps{--ps-bg:#1b1e20;--ps-panel:#23272a;--ps-panel-2:#2c3134;--ps-line:#3a4044;--ps-control-line:#62696d;--ps-ink:#e9e5dd;--ps-muted:#a9a59e;--ps-accent:#c9ae79;--ps-accent-ink:#1b1e20;--ps-ok:#8fd1a8;--ps-danger:#f08a8a;--ps-serif:Georgia,serif}";
const pages = ["create", "create-dark", "create-personal", "create-loading", "summary", "summary-dark", "summary-bare", "sheet", "sheet-bare", "popup", "popup-edit", "popup-bare"];
for (const page of pages) writeFileSync(`${H}/out/${page}.html`, html(page, "app.js", page.startsWith("popup") ? darkSite : ""));
const gates = ["gate", "gate-draft", "gate-stuck"];
for (const page of gates) writeFileSync(`${H}/out/${page}.html`, html(page, "gate.js", formsCss));
console.log("built", pages.length + gates.length, "pages");
