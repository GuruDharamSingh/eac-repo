import type { MetadataRoute } from "next";
import { SOPHIA_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/journal", "/guide", "/studio", "/login"] }],
    sitemap: `${SOPHIA_URL}/sitemap.xml`,
  };
}
