import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Source-exported workspace packages, compiled in-app. Same list as
  // amrit-canada's, plus the forum package itself. @elkdonis/ui is left out
  // on purpose (see amrit-canada's config for the duplicate-React reason);
  // this app imports nothing from it.
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/types",
    "@elkdonis/utils",
    "@elkdonis/services",
    "@elkdonis/cms-ui",
    "@elkdonis/forum-ui",
  ],
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : undefined,
  },
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
