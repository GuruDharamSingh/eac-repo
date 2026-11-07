// Bundles sunjay-try.ts. Run in eac-dev with the repo read-only at /app and a scratch folder at /w, holding h3/.
// A "use server" file is a set of network stubs under Next. Here it is the same: the harness has no server, so each
// export throws if called, and nothing of the database reaches the page.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/package.json");
const esbuild = require("/app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/lib/main.js");

const serverStubs = {
  name: "server-actions",
  setup(b) {
    b.onLoad({ filter: /\.(ts|tsx)$/ }, (a) => {
      const text = fs.readFileSync(a.path, "utf8");
      if (!/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(text)) return undefined;
      const names = [...text.matchAll(/^export\s+(?:async\s+)?(?:function|const|let)\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]);
      return { loader: "js", contents: names.map((n) => `export const ${n} = async () => { throw new Error("server action ${n}: no server here"); };`).join("\n") };
    });
  },
};

await esbuild.build({
  entryPoints: ["/w/h3/sunjay-try.ts"],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: "/w/h3",
  entryNames: "[name]",
  jsx: "automatic",
  logLevel: "warning",
  logLimit: 12,
  absWorkingDir: "/app/apps/sunjay",
  tsconfig: "/app/apps/sunjay/tsconfig.json",
  nodePaths: ["/app/apps/sunjay/node_modules", "/app/packages/page-builder/node_modules", "/app/packages/blocks/node_modules", "/app/packages/cms-ui/node_modules", "/app/packages/direct-edit/node_modules"],
  define: { "process.env.NODE_ENV": '"development"', "process.env": "{}", __dirname: '"/"', global: "globalThis" },
  external: ["node:*"],
  // Without .css: `export * from "./blocks"` in @elkdonis/blocks must find blocks/index.ts, not blocks.css.
  resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
  alias: { "next/font/google": "/w/h3/sunjay-font-stub.ts" },
  loader: { ".woff2": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
  plugins: [serverStubs],
});
fs.copyFileSync("/app/packages/direct-edit/src/direct-edit.css", "/w/h3/visual.css");
