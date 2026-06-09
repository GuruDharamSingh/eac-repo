import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/types",
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/three",
    "@elkdonis/silex-render",
  ],
  // Pin tracing root to the monorepo so Next doesn't pick up the stray
  // /home/elkdonis/pnpm-lock.yaml as the "workspace root".
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  // Dev-only: explicitly trust localhost subdomains and the LAN IP so
  // /_next/* static assets serve without the cross-origin warning.
  allowedDevOrigins: [
    "localhost",
    "*.localhost",
    "192.168.0.24",
    "*.192.168.0.24",
  ],
};

export default nextConfig;
