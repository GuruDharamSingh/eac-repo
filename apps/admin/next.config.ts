import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/ui",
    "@elkdonis/commerce",
    "@elkdonis/db",
    "@elkdonis/types",
  ],
};

export default nextConfig;

