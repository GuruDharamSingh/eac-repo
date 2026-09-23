import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] }];
  },
  // Source-exported workspace packages, compiled in-app (same pattern as apps/forum).
  transpilePackages: ["@elkdonis/db", "@elkdonis/utils", "@elkdonis/services", "@elkdonis/cms-ui", "@elkdonis/lms", "@elkdonis/lms-ui"],
  // Pin the monorepo root — see apps/forum/next.config.ts for why inference is not safe here.
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  turbopack: { root: path.resolve(__dirname, "../..") },
  experimental: { cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : undefined },
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
