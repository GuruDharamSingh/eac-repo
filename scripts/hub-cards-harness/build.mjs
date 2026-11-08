import * as esbuild from "/repo/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/lib/main.js";
import { readFileSync, writeFileSync } from "node:fs";
const R = "/repo";
const H = "/h";
const HUB = `${R}/packages/hub/src`;

// @elkdonis/hub subpaths, as packages/hub/package.json "exports" maps them (the hub is not linked into its own node_modules).
const HUB_MAP = {
  contract: "contract.ts",
  gates: "gates.ts",
  ui: "ui/index.ts",
  members: "members/index.ts",
  "members/model": "members/model.ts",
  "site-builder": "site-builder/index.ts",
  "site-builder/model": "site-builder/model.ts",
};
const plugin = {
  name: "hub-alias",
  setup(b) {
    b.onResolve({ filter: /^@elkdonis\/hub\/.+/ }, (a) => {
      const key = a.path.slice("@elkdonis/hub/".length);
      if (!HUB_MAP[key]) throw new Error("unmapped hub subpath: " + a.path);
      return { path: `${HUB}/${HUB_MAP[key]}` };
    });
    // Only if node resolution misses them (the hub's own node_modules links normally resolve these).
    b.onResolve({ filter: /^@elkdonis\/utils\/host$/ }, () => ({ path: `${R}/packages/utils/src/host.ts` }));
    b.onResolve({ filter: /^@elkdonis\/fonts$/ }, () => ({ path: `${R}/packages/fonts/src/index.ts` }));
  },
};

for (const entry of ["members", "site-builder"]) await esbuild.build({
  entryPoints: [`${H}/${entry}.tsx`],
  bundle: true,
  format: "iife",
  outfile: `${H}/out/${entry}.js`,
  jsx: "automatic",
  loader: { ".css": "empty" },
  define: { __dirname: '"/"', "process.env.NODE_ENV": '"production"' },
  nodePaths: [
    `${R}/packages/hub/node_modules`,
    `${R}/node_modules`,
    `${R}/node_modules/.pnpm/react-dom@19.1.0_react@19.1.0/node_modules`,
  ],
  plugins: [plugin],
  logLevel: "warning",
});

const css = readFileSync(`${HUB}/theme/hub-cards.css`, "utf8") + "\n" + readFileSync(`${HUB}/theme/industry.css`, "utf8");
const fonts = "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;700&family=Barlow+Condensed:wght@600&family=Libre+Caslon+Text:wght@400;700&family=Spectral:wght@400;700&family=Source+Sans+3:wght@400;600;700&display=swap";
const PAGES = [
  "card", "card-small", "card-solo", "card-guide", "popup", "popup-guide", "popup-demote", "popup-nomatch", "people", "people-guide",
  "people-expanded", "confirm-remove", "confirm-demote", "arrivals", "arrivals-guide", "arrivals-empty", "visitors", "visitors-30d",
  "visitors-90d", "permissions", "permissions-guide", "small-org", "small-org-guide", "solo", "card-plain", "people-plain",
  "popup-phone", "people-phone",
];
const SB_PAGES = [
  "sb-card", "sb-card-bookreaders", "sb-card-noeditor", "sb-popup", "sb-popup-template", "sb-popup-nonotes", "sb-pages-grid", "sb-pages-list",
  "sb-pages-expanded-editor", "sb-pages-expanded-template", "sb-pages-nonotes", "sb-bookreaders", "sb-new-page", "sb-new-nested",
  "sb-save-template", "sb-theme", "sb-profile", "sb-profile-nokinds", "sb-pages-plain", "sb-popup-phone", "sb-pages-phone",
];
for (const page of [...PAGES, ...SB_PAGES]) {
  const bundle = page.startsWith("sb-") ? "site-builder" : "members";
  writeFileSync(
    `${H}/out/${page}.html`,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${fonts}"><style>body{margin:0}${css}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"},browser:true};window.global=window;window.__PAGE__=${JSON.stringify(page)}</script><script src="${bundle}.js"></script></body></html>`,
  );
}
console.log("built", PAGES.length + SB_PAGES.length, "pages");
