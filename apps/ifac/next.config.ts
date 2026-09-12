import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/pipeline",
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/db",
    "@elkdonis/cms-ui",
    "@elkdonis/forum-ui",
    "@elkdonis/live-editor",
    "@elkdonis/email",
    "@elkdonis/types",
  ],
  devIndicators: false,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  // Build concurrency. Next defaults to one worker per CPU; this host has 32
  // while the container is capped well below what 31 workers need, so
  // "Collecting page data" gets OOM-killed (exit 137) partway through and
  // leaves a half-written .next that `next start` cannot boot from — the
  // failure mode that put amrit-canada into an unrecoverable restart loop.
  // Unset means Next's default; the compose command sets NEXT_BUILD_CPUS
  // when building in-container.
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : undefined,
  },
};

export default nextConfig;
