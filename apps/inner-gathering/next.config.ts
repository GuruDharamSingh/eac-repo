import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@elkdonis/db", "@elkdonis/types", "@elkdonis/ui"],

  // Production: Enable standalone output for Docker
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // Allow cross-origin requests from local network during development
  experimental: {
    allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS || '').split(',').filter(Boolean),
  },
};

export default nextConfig;
