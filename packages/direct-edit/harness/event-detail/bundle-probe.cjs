// Bundles probe.mts for Node inside the sunjay container (automatic JSX, "@/" = sunjay src). Output in /tmp.
// Run: docker compose exec -T -w /app/apps/sunjay sunjay sh -c 'node /app/packages/direct-edit/harness/event-detail/bundle-probe.cjs && node /tmp/ed-probe.cjs; rm -f /tmp/ed-probe.cjs'
require("/app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild").build({
  entryPoints: ["/app/packages/direct-edit/harness/event-detail/probe.mts"], bundle: true, platform: "node", format: "cjs", jsx: "automatic",
  outfile: "/tmp/ed-probe.cjs", logLevel: "error", alias: { "@": "/app/apps/sunjay/src", "next/navigation": "/app/packages/direct-edit/harness/event-detail/shim-nav.ts" },
  nodePaths: ["/app/apps/sunjay/node_modules"],
  external: ["react", "react/*", "react-dom", "react-dom/*", "sharp", "pg-native", "jsdom", "isomorphic-dompurify", "@opentelemetry/api", "next", "next/*"],
  // Without .css: esbuild would resolve packages/blocks' `./blocks` folder to blocks.css (record-blocks note).
  resolveExtensions: [".tsx", ".ts", ".mjs", ".js", ".json"], loader: { ".css": "empty" },
}).catch(() => process.exit(1));
