import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/services",
    "@elkdonis/ui",
    "@elkdonis/commerce",
    "@elkdonis/db",
    "@elkdonis/types",
    "@elkdonis/nextcloud",
  ],
};

export default nextConfig;

