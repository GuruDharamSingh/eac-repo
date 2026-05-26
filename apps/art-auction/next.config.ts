import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/checkout",
    "@elkdonis/cms-bindings",
    "@elkdonis/commerce",
    "@elkdonis/db",
    "@elkdonis/email",
    "@elkdonis/nextcloud",
    "@elkdonis/payments",
    "@elkdonis/types",
  ],
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  allowedDevOrigins: [
    "localhost",
    "*.localhost",
    "127.0.0.1",
    "192.168.0.24",
    "*.192.168.0.24",
  ],
  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost" },
      { protocol: "http",  hostname: "nextcloud-nginx" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
