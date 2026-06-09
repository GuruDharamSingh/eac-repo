import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/types",
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/silex-render",
  ],
  // Pin tracing root to the monorepo so Next doesn't pick a stray lockfile.
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  allowedDevOrigins: ["localhost", "*.localhost", "192.168.0.24", "*.192.168.0.24"],
};

export default nextConfig;
