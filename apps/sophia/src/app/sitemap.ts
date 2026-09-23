import type { MetadataRoute } from "next";
import { getPublishedCourse, listCatalogue, sitemapEntries } from "@elkdonis/lms";
import { SOPHIA_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Published, public courses and their steps only. Drafts, unlisted and private never appear. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listed = await listCatalogue();
  const courses = (await Promise.all(listed.map((c) => getPublishedCourse(c.slug)))).filter((c) => c !== null);
  return [
    { url: SOPHIA_URL, lastModified: new Date() },
    { url: `${SOPHIA_URL}/care` },
    ...sitemapEntries({ origin: SOPHIA_URL }, courses),
  ];
}
