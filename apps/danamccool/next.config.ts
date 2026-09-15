import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/types",
    "@elkdonis/cms-ui",
    "@elkdonis/services",
    "@elkdonis/utils",
  ],
  devIndicators: false,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
