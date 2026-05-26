import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/db",
    "@elkdonis/nextcloud",
    "@elkdonis/reading-wizard",
    "@elkdonis/types",
  ],
  devIndicators: false,
  allowedDevOrigins: [
    "localhost",
    "*.localhost",
    "127.0.0.1",
    "192.168.0.24",
    "*.192.168.0.24",
  ],
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;