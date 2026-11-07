// Bundles an entry in eac-dev with /app read-only. ENTRY, OUT. CSS imports land in OUT's .css sibling.
const esbuild = require("/app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild");
const fs = require("fs");
const stubServer = { name: "stub-use-server", setup(b) {
  b.onLoad({ filter: /\.(ts|tsx)$/ }, (a) => {
    if (a.path.includes("/node_modules/")) return null;
    const src = fs.readFileSync(a.path, "utf8");
    if (!/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(src)) return null;
    const names = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    return { contents: names.map((n) => `export const ${n} = async () => ({ ok: true });`).join("\n"), loader: "ts" };
  });
} };
esbuild.build({ entryPoints: [process.env.ENTRY], bundle: true, format: "iife", minify: false, jsx: "automatic", outfile: process.env.OUT, logLevel: "error", logLimit: 20,
  define: { "process.env.NODE_ENV": '"production"', __dirname: '"/"' },
  loader: { ".json": "json", ".woff": "empty", ".woff2": "empty", ".ttf": "empty", ".svg": "dataurl", ".png": "empty" },
  banner: { js: "globalThis.process=globalThis.process||{env:{}};" },
  alias: { "next/font/google": "/w/h/shim-font.ts", "next/link": "/w/h/shim-link.tsx", "next/navigation": "/w/h/shim-nav.ts", ...(process.env.ALIAS ? JSON.parse(process.env.ALIAS) : {}) },
  nodePaths: ["/app/apps/sunjay/node_modules", "/app/packages/direct-edit/node_modules", "/app/packages/page-builder/node_modules"], plugins: [stubServer],
  resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
}).catch(() => process.exit(1));
