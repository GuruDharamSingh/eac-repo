import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Set NEXT_PUBLIC_BASE_PATH=/astro to serve the whole app under that prefix
  // (arts-collective.com/astro). Unset, the app lives at the root as usual.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // @elkdonis/ui is deliberately NOT used: it declares Mantine and a second
  // React instance (see apps/pigeonshoot/next.config.ts). @elkdonis/astro ships
  // raw TypeScript, so it must be transpiled.
  transpilePackages: [
    "@elkdonis/astro",
    "@elkdonis/astro-corpus",
    "@elkdonis/auth-client",
    // Service booking (checkout → commerce + payments), 2026-09-27.
    "@elkdonis/checkout",
    "@elkdonis/cms-ui",
    "@elkdonis/commerce",
    "@elkdonis/db",
    "@elkdonis/payments",
    "@elkdonis/services",
    "@elkdonis/sky-ui",
    "@elkdonis/utils",
  ],
  // sweph is a native addon: load it with Node's require at runtime, never bundle it.
  serverExternalPackages: ["sweph"],
  // This app is served to the public from `next dev`; the dev-tools badge
  // would sit over the studio's bottom bar on a phone.
  devIndicators: false,
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
};

export default nextConfig;
