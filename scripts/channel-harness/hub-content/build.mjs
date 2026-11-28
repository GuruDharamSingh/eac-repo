// Bundle the hub-content harness (entry.tsx) and write one HTML page per view. Run in a throwaway node container: see README.md.
import * as esbuild from "/repo/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/lib/main.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const R = "/repo";
const H = "/h";
const K = `${R}/apps/sunjay`;
mkdirSync(`${H}/out`, { recursive: true });
await esbuild.build({
  entryPoints: [`${H}/entry.tsx`],
  bundle: true,
  format: "iife",
  outfile: `${H}/out/app.js`,
  jsx: "automatic",
  loader: { ".css": "empty" },
  define: { __dirname: '"/"', "process.env.NODE_ENV": '"production"' },
  nodePaths: [`${K}/node_modules`, `${R}/node_modules`],
  logLevel: "warning",
});
const sheets = [`${R}/packages/hub/src/theme/hub-cards.css`, `${R}/packages/content/src/content.css`].map((f) => readFileSync(f, "utf8")).join("\n");
const fonts = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap";
for (const page of ["face", "list-site", "list-network", "piece", "edit", "suggest"]) {
  writeFileSync(
    `${H}/out/${page}.html`,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${fonts}"><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif}${sheets}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"},browser:true};window.global=window;window.__PAGE__=${JSON.stringify(page)}</script><script src="app.js"></script></body></html>`,
  );
}
console.log("built");
