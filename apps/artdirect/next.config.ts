import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/live-editor",
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/cms-bindings",
    "@elkdonis/cms-ui",
    "@elkdonis/db",
    "@elkdonis/email",
    "@elkdonis/types",
    // Ships source, not a bundle — without this the upload route's
    // validateUploadBuffer import fails at build.
    "@elkdonis/utils",
  ],
  devIndicators: false,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
