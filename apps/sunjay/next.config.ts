import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @elkdonis/ui is deliberately NOT transpiled here.
  //
  // It carries react as a devDependency, so pnpm gives it its own physical
  // copy. Transpiling its source would compile that source in-app and bind it
  // to that second React instance — hooks then read a null context and
  // rendering dies (it surfaces as "Cannot read properties of null (reading
  // 'useContext')" during prerender). Consuming its built dist instead lets
  // tsup's `external: react` resolve React from this app.
  //
  // This is the successor to the @mantine/* aliasing the pre-rebuild config
  // carried: same duplicate-copy problem, different package. The only thing
  // imported from @elkdonis/ui now is BaroqueSignup, which is Mantine-free.
  transpilePackages: [
    "@elkdonis/pipeline",
    "@elkdonis/chat",
    "@elkdonis/db",
    "@elkdonis/email",
    "@elkdonis/types",
    "@elkdonis/utils",
    "@elkdonis/auth-client",
    "@elkdonis/services",
    // Source-exported and unbundled, like the other cms-ui consumers — the
    // matching `@source` in globals.css is what makes Tailwind scan it.
    "@elkdonis/cms-ui",
    "@elkdonis/forum-ui",
  ],
  // Build concurrency. Next defaults to one worker per CPU; this host has 32
  // while the container is capped well below what 31 workers need, so
  // "Collecting page data" gets OOM-killed (exit 137) partway through and
  // leaves a half-written .next that `next start` cannot boot from — which is
  // exactly the crash loop this service was stuck in. Unset means Next's
  // default; the compose command sets NEXT_BUILD_CPUS when building in-container.
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : undefined,
  },
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
