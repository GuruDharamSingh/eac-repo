import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Served at arts-collective.com/development beside the network's other apps,
  // so Next owns a sub-path. Hand-written absolute paths go through withBase().
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // Source-exported workspace packages are compiled in-app. @elkdonis/ui is
  // deliberately absent (second React copy; see fourthwayBookreaders).
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/types",
    "@elkdonis/utils",
    "@elkdonis/services",
    "@elkdonis/cms-ui",
    "@elkdonis/direct-edit",
    "@elkdonis/page-builder",
    "@elkdonis/blocks",
    "@elkdonis/primitives",
  ],
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : undefined,
  },
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
