import path from "node:path";
import type { NextConfig } from "next";

const cpus = Number(process.env.NEXT_BUILD_CPUS);

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/types",
    "@elkdonis/cms-ui",
    "@elkdonis/blocks",
    "@elkdonis/page-builder",
    "@elkdonis/redis",
    "@elkdonis/services",
    "@elkdonis/commerce",
    "@elkdonis/checkout",
    "@elkdonis/direct-edit",
    "@elkdonis/studio-ui",
    "@elkdonis/payments",
    "@elkdonis/utils",
  ],
  devIndicators: false,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  // /preview draws sample pieces for design review: never indexed.
  async headers() {
    return [{ source: "/preview/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }, { source: "/preview", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }];
  },
  // The compose command sets NEXT_BUILD_CPUS to keep the build inside the
  // container's memory ceiling (ops.md notes danamccool ignores it).
  ...(Number.isFinite(cpus) && cpus > 0 ? { experimental: { cpus } } : {}),
};

export default nextConfig;
