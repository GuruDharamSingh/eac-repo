import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/auth-client",
    "@elkdonis/types",
    "@elkdonis/blog-client",
    "@elkdonis/blog-server",
    "@elkdonis/ui",
    "@elkdonis/utils",
  ],
};

export default nextConfig;
