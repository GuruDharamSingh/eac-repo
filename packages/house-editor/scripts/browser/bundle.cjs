const esbuild = require("/app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild");
const fs = require("fs");
const common = {
  alias: { "@elkdonis/house-editor": "/app/packages/house-editor/src" },
  bundle: true, jsx: "automatic", logLevel: "error",
  nodePaths: ["/app/packages/house-editor/node_modules", "/app/node_modules"],
  resolveExtensions: [".tsx", ".ts", ".mjs", ".js", ".json"],
  loader: { ".css": "css", ".woff": "empty", ".woff2": "empty", ".png": "empty", ".svg": "empty" },
  define: { "process.env.NODE_ENV": '"production"' },
  external: ["postgres", "pg-native", "sharp"],
};
(async () => {
  fs.mkdirSync("/out/site", { recursive: true });
  await esbuild.build({ ...common, entryPoints: ["/out/render-page.tsx"], platform: "node", format: "cjs", outfile: "/out/render-page.cjs", external: [...common.external, "jsdom", "isomorphic-dompurify", "dompurify", "happy-dom"] });
  await esbuild.build({ ...common, entryPoints: ["/out/entry.tsx"], platform: "browser", format: "iife", outfile: "/out/site/app.js", alias: { ...common.alias, "@elkdonis/cms-ui/editor": "/out/stub-editor.tsx" } });
  console.log("bundled");
})().catch((e) => { console.error(String(e.message || e).slice(0, 3000)); process.exit(1); });
