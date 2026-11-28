import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/services",
    "@elkdonis/live-editor",
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    // Service booking (checkout → commerce + payments), 2026-09-27.
    "@elkdonis/checkout",
    "@elkdonis/payments",
    "@elkdonis/cms-bindings",
    "@elkdonis/cms-ui",
    "@elkdonis/db",
    "@elkdonis/email",
    "@elkdonis/types",
    // Ships source, not a bundle — without this the upload route's
    // validateUploadBuffer import fails at build.
    "@elkdonis/utils",
    // Booking module (2026-11-15): data package and the shared Booking section.
    "@elkdonis/booking",
    "@elkdonis/studio-forms",
    // Directory search (content library people view, 2026-11-26) and what its server side imports.
    "@elkdonis/content",
    "@elkdonis/commerce",
  ],
  devIndicators: false,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
