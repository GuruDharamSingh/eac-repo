// Bundles library.tsx and writes the library harness pages. Run like build.mjs (see README), with /h = this folder.
import * as esbuild from "/repo/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/lib/main.js";
import { readFileSync, writeFileSync } from "node:fs";
const R = "/repo";
const H = "/h";
const plugin = {
  name: "alias",
  setup(b) {
    b.onResolve({ filter: /^@\/lib\/channel\/actions$/ }, () => ({ path: `${H}/stubs/actions.ts` }));
    b.onResolve({ filter: /^@\/lib\/actions\/run$/ }, () => ({ path: `${H}/stubs/actions-run.ts` }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: `${H}/stubs/next-link.tsx` }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: `${H}/stubs/next-navigation.ts` }));
    b.onResolve({ filter: /^next\/(server|headers|cache|dynamic|image)$/ }, () => ({ path: `${H}/stubs/next-other.tsx` }));
    b.onResolve({ filter: /^@\// }, async (a) => b.resolve("./" + a.path.slice(2), { resolveDir: `${R}/apps/arts-collective/src`, kind: a.kind }));
  },
};
await esbuild.build({
  entryPoints: [`${H}/library.tsx`],
  bundle: true,
  format: "iife",
  outfile: `${H}/out/library.js`,
  jsx: "automatic",
  loader: { ".css": "empty" },
  define: { __dirname: '"/"', "process.env.NODE_ENV": '"production"' },
  nodePaths: [`${R}/apps/arts-collective/node_modules`, `${R}/node_modules`],
  plugins: [plugin],
  logLevel: "warning",
});
const surfaceCss = readFileSync(`${R}/packages/cms-ui/src/surface/surface.css`, "utf8");
const channelCss = readFileSync(`${R}/apps/arts-collective/src/components/channel/channel.css`, "utf8");
const contentCss = readFileSync(`${R}/packages/content/src/content.css`, "utf8");
const PAGES = JSON.parse(readFileSync(`${H}/library-pages.json`, "utf8"));
const hx = `.hx{min-height:100vh}.hx-page{padding:24px 28px 48px;display:flex;flex-direction:column;gap:14px}.hx-page h1{font-size:28px;font-weight:600;margin:0}.hx-ch{display:flex;justify-content:space-between;align-items:flex-end}`;
for (const p of PAGES) {
  const dark = p.name.includes("dark");
  writeFileSync(
    `${H}/out/${p.name}.html`,
    `<!doctype html><html lang="en"${dark ? ' data-theme="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${surfaceCss}
${channelCss}
${contentCss}
${hx}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"},browser:true};window.global=window;window.__PAGE__=${JSON.stringify(p.page ?? p.name)}</script><script src="library.js"></script></body></html>`
  );
}
console.log("built", PAGES.length);
