import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Served at elkdonis-arts.org/books, beside another app on the same domain,
  // so Next must own a sub-path rather than the root. Read from env so the
  // eventual move to a domain of its own is one variable, not a code change.
  // NOTE: Next rewrites <Link>/useRouter/_next only — hand-written absolute
  // paths go through withBase() in src/lib/base-path.ts.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,

  // Source-exported workspace packages have to be compiled in-app. Note what is
  // deliberately absent: @elkdonis/ui. It carries react as a devDependency, so
  // pnpm gives it a second physical React; transpiling its source binds its
  // components to that copy and rendering dies with a null useContext during
  // prerender. This app imports nothing from it — see amrit-canada's config for
  // the long form of that story.
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/types",
    "@elkdonis/utils",
    "@elkdonis/auth-client",
    "@elkdonis/services",
    "@elkdonis/cms-ui",
  ],
  // Next defaults to one build worker per CPU; this host has 32 while the
  // container is capped well below what 31 workers need, so page collection
  // gets OOM-killed and leaves a half-written .next that `next start` cannot
  // boot from. The compose command sets NEXT_BUILD_CPUS when building in-container.
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : undefined,
  },
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
