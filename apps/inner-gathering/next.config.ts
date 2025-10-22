import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@elkdonis/db", "@elkdonis/types"],
};

export default nextConfig;
