// Bundles the playground into one self-contained HTML file (React included).
// Run from the repo root: node packages/gradients/playground/build.mjs [esbuild-module-dir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(process.argv[2] ? resolve(process.argv[2], "package.json") : import.meta.url);
const esbuild = req("esbuild");
// React resolves from cms-ui (the package has no node_modules until pnpm install links it)
const nodePaths = [resolve(here, "../node_modules"), resolve(here, "../../cms-ui/node_modules")];

const r = await esbuild.build({
  entryPoints: [resolve(here, "main.tsx")],
  bundle: true,
  write: false,
  format: "iife",
  minify: true,
  target: "es2020",
  jsx: "automatic",
  nodePaths,
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(resolve(here, "playground.css"), "utf8");
const html = `<title>Gradient Lab</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Source+Sans+3:wght@400;600&family=IBM+Plex+Mono:wght@400&display=swap">
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
mkdirSync(resolve(here, "dist"), { recursive: true });
writeFileSync(resolve(here, "dist/index.html"), html);
console.log(`playground: ${(html.length / 1024).toFixed(0)} KB -> playground/dist/index.html`);
