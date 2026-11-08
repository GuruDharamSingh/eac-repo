// Bundles the forms harness (packages/studio/src/forms/harness) and writes one HTML page per
// canvas id and look. Run in a throwaway node container with the repo mounted at /repo (README).
import * as esbuild from "/repo/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/lib/main.js";
import { readFileSync, writeFileSync } from "node:fs";

const R = "/repo";
const H = "/h";
const stubs = {
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: `${H}/stubs/next-link.tsx` }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: `${H}/stubs/next-navigation.ts` }));
    b.onResolve({ filter: /^next\/(server|headers|cache|dynamic|image)$/ }, () => ({ path: `${H}/stubs/next-other.tsx` }));
  },
};

await esbuild.build({
  entryPoints: [`${H}/entry.tsx`],
  bundle: true,
  format: "iife",
  outfile: `${H}/out/app.js`,
  jsx: "automatic",
  loader: { ".css": "empty" },
  define: { __dirname: '"/"', "process.env.NODE_ENV": '"production"' },
  nodePaths: [`${R}/packages/studio/node_modules`, `${R}/node_modules`],
  plugins: [stubs],
  logLevel: "warning",
});

const read = (p) => readFileSync(`${R}/${p}`, "utf8");
// The host's own stylesheets first (cms-ui surface for the preview cards, the Canvas for the
// blocks slot), then the forms' two: the order a site imports them in.
const css = [
  read("packages/cms-ui/src/surface/surface.css"),
  read("packages/cms-ui/src/article/essay.css"),
  read("packages/studio/src/canvas/canvas.css"),
  read("packages/studio/src/forms/theme/forms.css"),
  read("packages/studio/src/forms/theme/broadsheet.css"),
].join("\n");

const PAGES = [
  "1a", "2a", "2b", "1b", "1h", "1i", "1j", "1l", "1m", "1n", "blank",
  // pass 2
  "1c", "1c-page", "1o", "1f", "1f-page", "1p", "service", "service-page", "service-m", "joints", "joints-m",
];
const LOOKS = { broadsheet: "", plain: "-plain", dark: "-dark" };
const font = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap">';
const ground = { broadsheet: "#f3f2f2", plain: "#ffffff", dark: "#16161a" };

for (const page of PAGES) {
  for (const [look, suffix] of Object.entries(LOOKS)) {
    writeFileSync(
      `${H}/out/${page}${suffix}.html`,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${look === "broadsheet" ? font : ""}<style>html,body{margin:0;background:${ground[look]}}#root{min-height:100vh;display:flex;flex-direction:column}#root>.frm-shell{flex:1}${look === "plain" ? "body{font-family:system-ui,sans-serif}" : ""}${css}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"},browser:true};window.global=window;window.__PAGE__=${JSON.stringify(page)};window.__THEME__=${JSON.stringify(look)}</script><script src="app.js"></script></body></html>`
    );
  }
}
console.log("built", PAGES.length * Object.keys(LOOKS).length, "pages");
