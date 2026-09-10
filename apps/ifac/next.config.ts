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
};

export default nextConfig;
