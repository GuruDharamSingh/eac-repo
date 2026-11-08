import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/services",
    "@elkdonis/db",
    "@elkdonis/types",
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/three",
    "@elkdonis/silex-render",
    "@elkdonis/live-editor",
    "@elkdonis/cms-bindings",
    "@elkdonis/cms-ui",
    // Puck org landing pages (/hub/sites/<slug>/design, 2026-10-30).
    "@elkdonis/blocks",
    "@elkdonis/page-builder",
    // Sophia's learner pages at /learn (2026-10-29).
    "@elkdonis/lms",
    "@elkdonis/lms-ui",
    // Action registry: task status, presentation and runAction (2026-11-06).
    "@elkdonis/actions",
    // The dock: current course step and page actions in a corner box (2026-11-06).
    "@elkdonis/dock",
    // The content detail, lifted from the Channel piece view (2026-11-08, pass 1).
    "@elkdonis/content",
    // The platform MCP endpoint, /api/mcp (2026-11-08; docs/open/mcp-foundations).
    "@elkdonis/mcp",
    // Studio Video page (/studio/video): templates, editor, Remotion player.
    "@elkdonis/reels",
    // Gradient backgrounds: reels' brand ground, studio controls (2026-11-07).
    "@elkdonis/gradients",
    // BookingScheduler for /hub/bookings and /bookings/<token> (migration 174).
    "@elkdonis/checkout",
    "@elkdonis/utils",
    "@elkdonis/astro",
    "@elkdonis/sky-ui",
    "@elkdonis/tokens",
    "@elkdonis/studio",
    // Classifieds editor: the direct-editing panel and the shared font library (2026-11-01).
    "@elkdonis/direct-edit",
    "@elkdonis/fonts",
  ],
  // Packages the server must REQUIRE at runtime rather than have bundled.
  //
  //   sweph   the Swiss Ephemeris — a native addon.
  //   jsdom   pulled in by isomorphic-dompurify (the HTML sanitisers in
  //           @elkdonis/utils). It loads `browser/default-stylesheet.css`
  //           from its own package directory at runtime, and a bundler that
  //           inlines the JS without carrying that asset produces a server
  //           build that dies with ENOENT the first time anything sanitises.
  //   @modelcontextprotocol/server  the MCP SDK behind /api/mcp (2026-11-08): plain ESM
  //           for Node, required at runtime instead of bundled, which keeps it out
  //           of the build's work (a direct dependency of this app for that reason).
  serverExternalPackages: ["sweph", "jsdom", "isomorphic-dompurify", "@modelcontextprotocol/server"],
  // Pin tracing root to the monorepo so Next doesn't pick up the stray
  // /home/elkdonis/pnpm-lock.yaml as the "workspace root".
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  // Build concurrency. Next defaults to one worker per CPU, and this host has
  // 32 while the container is capped well below what 31 workers need, so
  // "Collecting page data" gets OOM-killed partway through and leaves a
  // half-written .next that `next start` cannot boot from. Unset means Next's
  // default; the compose command sets NEXT_BUILD_CPUS when building
  // in-container.
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : undefined,
  },
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  // The network org's hub tab moved when the org was renamed to Arts
  // Collective (2026-10-28); old links and bookmarks still land.
  async redirects() {
    return [{ source: "/hub/elkdonis", destination: "/hub/arts-collective", permanent: true }];
  },
  // Dev-only: explicitly trust localhost subdomains and the LAN IP so
  // /_next/* static assets serve without the cross-origin warning.
  allowedDevOrigins: [
    "localhost",
    "*.localhost",
    "192.168.0.24",
    "*.192.168.0.24",
    "arts-collective.com",
    "*.arts-collective.com",
  ],
};

export default nextConfig;
