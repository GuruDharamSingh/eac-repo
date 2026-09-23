import { listOrgFeeds } from "@elkdonis/services";
import { FeedEditor } from "@/components/manage/feed-editor";
import { siteConfig } from "@/config/site";

/**
 * The pages of the site.
 *
 * This screen is what makes the app a template: a new site's sections are
 * rows here, not new route files. Slug, name, presenter credit, accent colour
 * and order all come from the database.
 */
export default async function ManageFeedsPage() {
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true });

  return (
    <>
      <h2 className="font-serif text-2xl">Pages</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Each page is a section of the site with its own feed, address and colour. The slug is the
        URL — <code className="text-xs">/gatherings</code> — and changing it breaks existing links,
        so it can only be set when a page is created.
      </p>

      <div className="mt-6 space-y-4">
        {feeds.map((feed) => (
          <FeedEditor key={feed.slug} feed={feed} />
        ))}
        <FeedEditor />
      </div>
    </>
  );
}
