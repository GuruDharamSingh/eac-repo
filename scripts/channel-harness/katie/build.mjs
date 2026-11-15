// Bundle the katie Channel harness (entry.tsx) and write one HTML page per view.
// Run in a throwaway node container: see README.md.
import * as esbuild from "/repo/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/lib/main.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const R = "/repo";
const H = "/h";
const K = `${R}/apps/katie-the-potter`;
const plugin = {
  name: "alias",
  setup(b) {
    b.onResolve({ filter: /^@\/lib\/channel-door$/ }, () => ({ path: `${H}/stubs/channel-door.ts` }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: `${R}/scripts/channel-harness/stubs/next-link.tsx` }));
    b.onResolve({ filter: /^next\/(server|headers|cache|dynamic|image)$/ }, () => ({ path: `${R}/scripts/channel-harness/stubs/next-other.tsx` }));
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
  define: { "process.env.NODE_ENV": '"production"' },
  nodePaths: [`${K}/node_modules`, `${R}/node_modules`],
  plugins: [plugin],
  logLevel: "warning",
});
// The site's palette (the :root token block of globals.css) and the Channel sheet; next/font's
// variables point at the same families from Google Fonts.
const g = readFileSync(`${K}/src/app/globals.css`, "utf8");
const i = g.indexOf(":root {");
const tokens = g.slice(i, g.indexOf("\n}", i) + 2);
// The shared piece summary's sheet first (the Board's side sheet), then the site's Channel sheet over it.
const channel = [`${R}/packages/content/src/content.css`, `${R}/packages/content/src/summary/summary.css`, `${R}/packages/channel/src/site/site.css`, `${K}/src/app/channel/channel.css`].map((f) => readFileSync(f, "utf8")).join("\n");
const base = `:root{--font-fraunces:'Fraunces';--font-karla:'Karla'}*,*::before,*::after{box-sizing:border-box}*,::before,::after,::backdrop{margin:0;padding:0}body{margin:0;background:hsl(var(--background));color:hsl(var(--foreground));font-family:Karla,system-ui,sans-serif;font-size:16px;line-height:1.5}img{max-width:100%}button{font:inherit}`;
const fonts = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Karla:wght@400;500;600&display=swap";
for (const page of ["home", "home-list", "home-week", "board", "board-cell", "board-summary", "board-edit", "queue", "queue-cell", "queue-kind", "queue-piece", "library", "out"]) {
  writeFileSync(
    `${H}/out/${page}.html`,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${fonts}"><style>${tokens}\n${base}\n${channel}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"},browser:true};window.global=window;window.__PAGE__=${JSON.stringify(page)}</script><script src="app.js"></script></body></html>`,
  );
}
console.log("built");
