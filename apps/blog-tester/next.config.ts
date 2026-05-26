import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/auth-client",
    "@elkdonis/types",
    "@elkdonis/blog-client",
    "@elkdonis/ui",
    "@elkdonis/utils",
  ],
};

export default nextConfig;
