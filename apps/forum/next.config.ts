import path from "node:path";
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
  // Pin the monorepo root. Without it Turbopack infers a root per entry and
  // intermittently lands on apps/forum/src/app, from which next/package.json
  // is not resolvable — the dev server then dies mid-session with
  // "couldn't find the Next.js package". ifac and hidden-enneagram already
  // pin it the same way; this app had been relying on inference.
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  turbopack: { root: path.resolve(__dirname, "../..") },
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : undefined,
  },
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
