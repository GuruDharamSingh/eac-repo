import Link from "next/link";
import { Lock, Plus } from "lucide-react";
import { listOrgFeeds } from "@elkdonis/services";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentRowActions } from "@/components/manage/content-row-actions";
import { getAllThreadsForOrg } from "@/lib/data";
import { siteConfig } from "@/config/site";

/**
 * The editorial dashboard — everything on the site, published or not.
 *
 * Scoped by org rather than by author (inner-gathering's /offerings shows
 * only what you personally wrote, which is right for a shared feed and wrong
 * for a site with an owner).
 */
export default async function ManageDashboard() {
  const [threads, feeds] = await Promise.all([
    getAllThreadsForOrg(),
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }),
  ]);

  const feedBySlug = new Map(feeds.map((f) => [f.slug, f]));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Content</h2>
        <Button asChild size="sm">
          <Link href="/manage/content/new">
            <Plus className="size-4" aria-hidden />
            New
          </Link>
        </Button>
      </div>

      {threads.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          Nothing here yet.{" "}
          <Link href="/manage/content/new" className="underline underline-offset-4">
            Write the first thing
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Title</th>
                <th className="pb-2 font-medium">Page</th>
                <th className="pb-2 font-medium">Kind</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {threads.map((thread) => {
                const feed = thread.feedSlug ? feedBySlug.get(thread.feedSlug) : undefined;
                const locked = Boolean(feed?.minRole) || thread.visibility === "ORGANIZATION";
                return (
                  <tr key={thread.id} className="align-top">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/manage/content/${thread.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {thread.title}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {feed?.name ?? thread.feedSlug ?? "—"}
                        {locked && <Lock className="size-3" aria-label="Members only" />}
                      </span>
                    </td>
                    <td className="py-3 pr-4 capitalize text-muted-foreground">{thread.kind}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={thread.status === "published" ? "secondary" : "outline"}>
                        {thread.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <ContentRowActions
                        threadId={thread.id}
                        kind={thread.kind}
                        status={thread.status}
                        feedSlug={thread.feedSlug}
                        slug={thread.slug}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
