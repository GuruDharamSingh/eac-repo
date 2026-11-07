import type { MetadataRoute } from "next";

/**
 * Everything that is the shop's back office, the buyer's own pages and the
 * sample preview stays out of search. (Each of those pages also carries
 * `robots: noindex` in its metadata, and /preview an X-Robots-Tag header.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/manage", "/hub", "/center", "/account", "/cart", "/checkout", "/orders", "/studio", "/preview", "/login", "/claim", "/api/"],
      },
    ],
  };
}
