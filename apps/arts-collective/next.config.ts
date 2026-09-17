import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/services",
    "@elkdonis/db",
    "@elkdonis/types",
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/three",
    "@elkdonis/silex-render",
    "@elkdonis/live-editor",
    "@elkdonis/cms-bindings",
    "@elkdonis/cms-ui",
    "@elkdonis/utils",
    "@elkdonis/astro",
    "@elkdonis/sky-ui",
    "@elkdonis/tokens",
  ],
  // sweph (the Swiss Ephemeris) is a native addon: require it at runtime.
  serverExternalPackages: ["sweph"],
  // Pin tracing root to the monorepo so Next doesn't pick up the stray
  // /home/elkdonis/pnpm-lock.yaml as the "workspace root".
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  // Build concurrency. Next defaults to one worker per CPU, and this host has
  // 32 while the container is capped well below what 31 workers need, so
  // "Collecting page data" gets OOM-killed partway through and leaves a
  // half-written .next that `next start` cannot boot from. Unset means Next's
  // default; the compose command sets NEXT_BUILD_CPUS when building
  // in-container.
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : undefined,
  },
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  // Dev-only: explicitly trust localhost subdomains and the LAN IP so
  // /_next/* static assets serve without the cross-origin warning.
  allowedDevOrigins: [
    "localhost",
    "*.localhost",
    "192.168.0.24",
    "*.192.168.0.24",
    "arts-collective.com",
    "*.arts-collective.com",
  ],
};

export default nextConfig;
