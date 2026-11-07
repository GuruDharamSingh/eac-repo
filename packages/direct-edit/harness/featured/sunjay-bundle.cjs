// Bundles sunjay-opens.mts for Node inside the sunjay container (automatic JSX, "@/" = sunjay src). Output in /tmp.
require("/app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild").build({
  entryPoints: ["/app/packages/direct-edit/harness/featured/sunjay-opens.mts"], bundle: true, platform: "node", format: "cjs", jsx: "automatic",
  outfile: "/tmp/sj-opens.cjs", logLevel: "error", alias: { "@": "/app/apps/sunjay/src" },
  nodePaths: ["/app/apps/sunjay/node_modules"], external: ["sharp", "pg-native", "jsdom", "isomorphic-dompurify", "@opentelemetry/api", "next", "next/*"], resolveExtensions: [".tsx", ".ts", ".mjs", ".js", ".json"], loader: { ".css": "empty" },
}).catch(() => process.exit(1));
