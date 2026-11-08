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
    b.onResolve({ filter: /^@\// }, async (a) => {
      const r = await b.resolve("./" + a.path.slice(2), { resolveDir: `${R}/apps/arts-collective/src`, kind: a.kind });
      return r;
    });
  },
};
await esbuild.build({
  entryPoints: [`${H}/entry.tsx`],
  bundle: true,
  format: "iife",
  outfile: `${H}/out/app.js`,
  jsx: "automatic",
  loader: { ".css": "empty" },
  define: { __dirname: '"/"', "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_FORUM_URL": "undefined" },
  nodePaths: [`${R}/apps/arts-collective/node_modules`, `${R}/node_modules`],
  plugins: [plugin],
  logLevel: "warning",
});
const css = readFileSync(`${R}/packages/cms-ui/src/surface/surface.css`, "utf8") + "\n" + readFileSync(`${R}/apps/arts-collective/src/components/channel/channel.css`, "utf8") + "\n" + readFileSync(`${R}/apps/arts-collective/src/components/channel/next.css`, "utf8");
for (const page of ["home", "matrix", "queue", "month", "board", "newpost", "piece", "plan", "library", "quick", "home-phone", "empty", "dark", "lightbox", "outlets", "outlets-live", "newpost-pick", "newpost-confirm", "newpost-posted", "katie", "routines", "adjust"]) {
  writeFileSync(`${H}/out/${page}.html`, `<!doctype html><html lang="en"${page === "dark" ? ' data-theme="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap"><style>body{margin:0}${css}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"},browser:true};window.global=window;window.__PAGE__=${JSON.stringify(page)}</script><script src="app.js"></script></body></html>`);
}
console.log("built");
