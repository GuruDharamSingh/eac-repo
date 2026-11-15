// Bundle the hub-card harness (entry.tsx) and write one HTML page per view. Run in a throwaway node container: see README.md.
import * as esbuild from "/repo/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/lib/main.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const R = "/repo";
const H = "/h";
const K = `${R}/apps/sunjay`;
const plugin = {
  name: "alias",
  setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: `${R}/scripts/channel-harness/stubs/next-link.tsx` }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: `${R}/scripts/channel-harness/stubs/next-navigation.ts` }));
    b.onResolve({ filter: /^@\// }, (a) => b.resolve("./" + a.path.slice(2), { resolveDir: `${K}/src`, kind: a.kind }));
  },
};
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
  plugins: [plugin],
  logLevel: "warning",
});
const g = readFileSync(`${K}/src/app/globals.css`, "utf8");
const tokens = (g.match(/^:root \{[\s\S]*?^\}/gm) ?? []).join("\n");
// The sheets the hub page imports, in its order: surface, hub bands, then the card's.
const sheets = [
  `${R}/packages/cms-ui/src/surface/surface.css`,
  `${R}/packages/cms-ui/src/hub/hub.css`,
  `${R}/packages/content/src/summary/summary.css`,
  `${R}/packages/content/src/content.css`,
  `${R}/packages/channel/src/site/site.css`,
  `${K}/src/app/channel/channel.css`,
  `${R}/packages/channel/src/hub/hub.css`,
]
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
const base = `:root{--font-fraunces:'Fraunces';--font-spectral:'Spectral'}*,*::before,*::after{box-sizing:border-box}body{margin:0;background:hsl(var(--background));color:hsl(var(--foreground));font-family:Spectral,Georgia,serif;font-size:16px;line-height:1.5}img{max-width:100%}button{font:inherit}`;
const fonts = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Spectral:wght@400;500;600&display=swap";
for (const page of ["face", "panel", "panel-week", "panel-piece", "panel-cell", "panel-cell-closed"]) {
  writeFileSync(
    `${H}/out/${page}.html`,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${fonts}"><style>${tokens}\n${base}\n${sheets}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"},browser:true};window.global=window;window.__PAGE__=${JSON.stringify(page)}</script><script src="app.js"></script></body></html>`,
  );
}
console.log("built");
