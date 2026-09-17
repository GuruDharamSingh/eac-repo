import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The brand faces are fetched cross-origin by every email this network
   * sends — the @font-face in packages/email points at elkdonis-arts.org/fonts,
   * and an email is rendered from a mail client, never from this origin.
   * Without Access-Control-Allow-Origin a browser refuses the fetch, which is
   * why Brothers silently fell back to Georgia in every preview.
   *
   * Only fonts, only GET, and fonts are not credentialed, so `*` here grants
   * nothing that reading the file would not.
   *
   * NB this fixes the previews and Apple Mail. Gmail and Outlook strip
   * @font-face outright, so most recipients will always see the fallback
   * stack — which is why that stack is Cinzel then Georgia rather than
   * whatever the client picks.
   */
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

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
    "@elkdonis/blocks",
    "@elkdonis/page-builder",
    "@elkdonis/pipeline",
    "@elkdonis/chat",
    "@elkdonis/db",
    "@elkdonis/email",
    "@elkdonis/newsletter",
    "@elkdonis/types",
    "@elkdonis/utils",
    "@elkdonis/auth-client",
    "@elkdonis/services",
    // Source-exported and unbundled, like the other cms-ui consumers — the
    // matching `@source` in globals.css is what makes Tailwind scan it.
    "@elkdonis/cms-ui",
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

  /**
   * Standing in for the app this one replaces.
   *
   * elkdonis-arts.org served apps/inner-gathering for years, so its URL shapes
   * are in inboxes, in search results and on other people's pages. These are
   * the ones that map cleanly onto a route here; the id-addressed ones
   * (/meetings/:id, /posts/:id, /workshops/:id) cannot be done here because
   * they need a database lookup to find the thread's feed and slug, so they
   * have their own redirect pages under src/app.
   *
   * Everything is a 308 except the two members-only destinations, which are
   * 307: where a signed-out visitor lands is a decision this app should be
   * free to change later without a permanent redirect cached in someone's
   * browser saying otherwise.
   */
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: true },
      { source: "/feed", destination: "/general", permanent: true },
      { source: "/manifesto", destination: "/about", permanent: true },
      { source: "/manifest", destination: "/about", permanent: true },
      { source: "/profile", destination: "/account", permanent: true },
      { source: "/workshops-eac", destination: "/offerings", permanent: true },
      { source: "/workshops/create", destination: "/manage/content/new", permanent: true },
      { source: "/meetings/:id/edit", destination: "/manage/content/:id", permanent: true },
      { source: "/workshops/:id/edit", destination: "/manage/content/:id", permanent: true },
      { source: "/admin", destination: "/manage", permanent: true },
      { source: "/admin/:path*", destination: "/manage", permanent: true },
      { source: "/calendar", destination: "/hub/calendar", permanent: false },
      { source: "/files", destination: "/hub", permanent: false },
    ];
  },
};

export default nextConfig;
