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
const surfaceCss = readFileSync(`${R}/packages/cms-ui/src/surface/surface.css`, "utf8");
const channelCss = readFileSync(`${R}/apps/arts-collective/src/components/channel/channel.css`, "utf8");
const contentCss = readFileSync(`${R}/packages/content/src/content.css`, "utf8");
// The publish primitives (@elkdonis/content/ui) render from their own entry: no Channel frame.
await esbuild.build({
  entryPoints: [`${H}/publish.tsx`],
  bundle: true,
  format: "iife",
  outfile: `${H}/out/publish.js`,
  jsx: "automatic",
  loader: { ".css": "empty" },
  define: { __dirname: '"/"', "process.env.NODE_ENV": '"production"' },
  nodePaths: [`${R}/apps/arts-collective/node_modules`, `${R}/node_modules`],
  plugins: [plugin],
  logLevel: "warning",
});
const PUBLISH_PAGES = ["kinds", "face", "popup", "popup-phone", "popup-plain", "popup-dark", "popup-lightbox", "popup-empty", "content", "content-phone", "content-list", "content-lightbox", "content-empty", "lightbox-piece"];
const hx = `.hx{min-height:100vh}.plain{background:#f2f2f1}.hx-page{padding:24px 28px 48px;display:flex;flex-direction:column;gap:14px}.hx-page h1{font-size:28px;font-weight:600;margin:0}.hx-ch{display:flex;justify-content:space-between;align-items:flex-end}.hx-scrim{min-height:100vh;display:grid;place-items:start center;padding:32px 16px;background:rgb(34 32 29/.3)}.hx-panel{background:var(--ch-bg,#f2f2f1);color:var(--ch-ink,#1f1d1c);border:1px solid var(--ch-accent-fill,#0a7396);border-radius:4px;box-shadow:0 10px 40px rgb(0 0 0/.25);display:flex;flex-direction:column;overflow:hidden;position:relative}.hx-head{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:2px solid var(--ch-accent-fill,#0a7396)}.hx-head>div{flex:1}.hx-head h2{margin:0;font-size:24px;font-weight:600}.hx-head p{margin:0}.hx-mark{display:grid;place-items:center;width:38px;height:38px;background:var(--ch-accent-100,#d3e6ee);color:var(--ch-accent,#075f7c);font-size:18px}.hx-foot{padding:10px 20px;background:var(--ch-surface,#e7e6e5);border-top:1px solid var(--ch-line,#ccc)}`;
for (const page of PUBLISH_PAGES) {
  writeFileSync(`${H}/out/${page}.html`, `<!doctype html><html lang="en"${page === "popup-dark" ? ' data-theme="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap"><style>body{margin:0}${surfaceCss}
${channelCss}
${contentCss}
${hx}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"},browser:true};window.global=window;window.__PAGE__=${JSON.stringify(page === "lightbox-piece" ? "lightbox" : page.replace("content-phone", "content"))}</script><script src="publish.js"></script></body></html>`);
}
const css = readFileSync(`${R}/packages/cms-ui/src/surface/surface.css`, "utf8") + "\n" + readFileSync(`${R}/apps/arts-collective/src/components/channel/channel.css`, "utf8") + "\n" + readFileSync(`${R}/apps/arts-collective/src/components/channel/next.css`, "utf8");
for (const page of ["home", "matrix", "queue", "month", "board", "newpost", "piece", "plan", "library", "quick", "home-phone", "empty", "dark", "lightbox", "outlets", "outlets-live", "newpost-pick", "newpost-confirm", "newpost-posted", "katie", "routines", "adjust"]) {
  writeFileSync(`${H}/out/${page}.html`, `<!doctype html><html lang="en"${page === "dark" ? ' data-theme="dark"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap"><style>body{margin:0}${css}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"},browser:true};window.global=window;window.__PAGE__=${JSON.stringify(page)}</script><script src="app.js"></script></body></html>`);
}
console.log("built");
