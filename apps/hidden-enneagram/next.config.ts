import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elkdonis/db",
    "@elkdonis/types",
    "@elkdonis/auth-client",
    "@elkdonis/auth-server",
    "@elkdonis/utils",
    "@elkdonis/email",
    "@elkdonis/services",
    "@elkdonis/commerce",
    "@elkdonis/checkout",
    "@elkdonis/payments",
    "@elkdonis/cms-ui",
    "@elkdonis/newsletter",
    "@elkdonis/forum-ui",
    // The page builder, the look layer and the blocks (2026-11-07 re-stand).
    "@elkdonis/blocks",
    "@elkdonis/page-builder",
    "@elkdonis/direct-edit",
    "@elkdonis/analytics",
    "@elkdonis/redis",
    // The authoring Studio at /publish (round 4, 2026-11-07).
    "@elkdonis/studio",
    "@elkdonis/chat",
    "@elkdonis/pipeline",
  ],
  // Pin tracing root to the monorepo so Next doesn't pick a stray lockfile.
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  // Build concurrency. Next defaults to one worker per CPU; this host has 32
  // while the container is capped well below what 31 workers need, so
  // "Collecting page data" gets OOM-killed (exit 137) partway through and
  // leaves a half-written .next that `next start` cannot boot from. That is
  // what put amrit-canada into an unrecoverable restart loop. Unset means
  // Next's default; the compose command sets NEXT_BUILD_CPUS when building.
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : undefined,
  },
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  // Round 3 (2026-11-07): the exposition is ONE page. The old chapter pages
  // fold into /enneagram (308s, before any route, so neither [page] nor the
  // studio can shadow them; their slugs are in ROUTE_SLUGS too). /type-N
  // lands on its row (#type-N opens it). /services is now /readings; a
  // service keeps /services/<slug>. /contact is the landing's contact form.
  async redirects() {
    return [
      { source: "/introduction", destination: "/enneagram#introduction", permanent: true },
      { source: "/centers", destination: "/enneagram#centers", permanent: true },
      { source: "/triads", destination: "/enneagram#triads", permanent: true },
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ source: `/type-${n}`, destination: `/enneagram#type-${n}`, permanent: true })),
      { source: "/contact", destination: "/#contact", permanent: true },
      { source: "/services", destination: "/readings", permanent: true },
      // Round 5: the old /edit bounce is gone; an old "Edit page" link lands in the page editor.
      { source: "/edit", destination: "/studio", permanent: false },
    ];
  },
  allowedDevOrigins: ["localhost", "*.localhost", "127.0.0.1", "192.168.0.24", "*.192.168.0.24"],
};

export default nextConfig;
