import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@elkdonis/db", "@elkdonis/email", "@elkdonis/types", "@elkdonis/ui"],

  // Production: Enable standalone output for Docker
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
};

export default nextConfig;
