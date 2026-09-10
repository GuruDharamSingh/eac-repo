import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/types",
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/silex-render",
    "@elkdonis/utils",
    "@elkdonis/email",
    "@elkdonis/services",
    "@elkdonis/commerce",
    "@elkdonis/checkout",
    "@elkdonis/payments",
    "@elkdonis/cms-ui",
    "@elkdonis/forum-ui",
  ],
  // Pin tracing root to the monorepo so Next doesn't pick a stray lockfile.
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  // Build concurrency. Next defaults to one worker per CPU; this host has 32
  // while the container is capped well below what 31 workers need, so
  // "Collecting page data" gets OOM-killed (exit 137) partway through and
  // leaves a half-written .next that `next start` cannot boot from. That is
  // what put amrit-canada into an unrecoverable restart loop. Unset means
  // Next's default; the compose command sets NEXT_BUILD_CPUS when building.
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : undefined,
  },
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  allowedDevOrigins: ["localhost", "*.localhost", "192.168.0.24", "*.192.168.0.24"],
};

export default nextConfig;
