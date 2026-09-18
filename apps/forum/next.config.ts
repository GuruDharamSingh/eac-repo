import path from "node:path";
import type { NextConfig } from "next";

/**
 * Who may put /embed in an <iframe>. Space-separated CSP sources; the
 * network's own hosts by default, plus localhost in development. Anything
 * outside the list gets a blank frame from the browser, not an error page.
 */
const EMBED_ANCESTORS = (
  process.env.FORUM_EMBED_ANCESTORS ??
  "https://*.arts-collective.com https://arts-collective.com https://*.elkdonis-arts.org https://elkdonis-arts.org"
).trim();
const DEV_ANCESTORS = process.env.NODE_ENV === "production" ? "" : " http://localhost:* http://127.0.0.1:* http://192.168.0.11:*";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${EMBED_ANCESTORS}${DEV_ANCESTORS}` },
        ],
      },
      {
        // Everything else refuses to be framed at all.
        source: "/((?!embed).*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
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
