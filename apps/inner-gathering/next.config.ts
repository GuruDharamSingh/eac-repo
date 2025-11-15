import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@elkdonis/db", "@elkdonis/types"],

  // Allow cross-origin requests from local network during development
  experimental: {
    allowedDevOrigins: ["192.168.2.26:3004"],
  },
};

export default nextConfig;
