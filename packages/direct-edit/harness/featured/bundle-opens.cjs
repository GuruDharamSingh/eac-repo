// Bundles opens-published.mts for Node inside the elktours container (automatic JSX, "@/" = elktours src). Output in /tmp.
require("/app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild").build({
  entryPoints: ["/app/packages/direct-edit/harness/featured/opens-published.mts"], bundle: true, platform: "node", format: "cjs", jsx: "automatic",
  outfile: "/tmp/opens-published.cjs", logLevel: "error", alias: { "@": "/app/apps/elktours/src" },
  nodePaths: ["/app/apps/elktours/node_modules"], external: ["sharp", "pg-native", "jsdom", "isomorphic-dompurify"], resolveExtensions: [".tsx", ".ts", ".mjs", ".js", ".json"], loader: { ".css": "empty" },
}).catch(() => process.exit(1));
