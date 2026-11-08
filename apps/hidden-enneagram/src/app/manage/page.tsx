import Link from "next/link";
import { Lock } from "lucide-react";
import { listOrgFeeds } from "@elkdonis/services";
import { Badge } from "@/components/ui/badge";
import { ContentRowActions } from "@/components/manage/content-row-actions";
import { getAllThreadsForOrg } from "@/lib/data";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";
import { PageHeader } from "@elkdonis/cms-ui/manage";
import { EditInStudio, ManageNewMenu } from "@/components/publish/manage-doors";

const KIND_FILTERS = [
  { kind: null, label: "All" },
  { kind: "post", label: "Writing and posts" },
  { kind: "service", label: "Services" },
] as const;

/**
 * The editorial dashboard — everything on the site, published or not.
 *
 * Scoped by org rather than by author (inner-gathering's /offerings shows
 * only what you personally wrote, which is right for a shared feed and wrong
 * for a site with an owner).
 */
export default async function ManageDashboard({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const [threads, feeds] = await Promise.all([
    getAllThreadsForOrg(),
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }),
  ]);

  const feedBySlug = new Map(feeds.map((f) => [f.slug, f]));
  // Round 4: kind filters (?kind=post|service) and the Studio doors.
  const { kind } = await searchParams;
  const filter = kind === "post" || kind === "service" ? kind : null;
  const shown = filter ? threads.filter((t) => t.kind === filter) : threads;

  return (
    <>
      <PageHeader
        title="Content"
        description="Writing and offerings on the site, published or not. Bookable services live here too."
        actions={
          <ManageNewMenu feeds={feeds.map((f) => ({ slug: f.slug, name: f.name }))} />
        }
      />

      <nav aria-label="Filter by kind" className="mt-4 flex flex-wrap gap-2 text-sm">
        {KIND_FILTERS.map((k) => {
          const n = k.kind ? threads.filter((t) => t.kind === k.kind).length : threads.length;
          const on = filter === k.kind;
          return (
            <Link
              key={k.label}
              href={k.kind ? `/manage?kind=${k.kind}` : "/manage"}
              aria-current={on ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${on ? "border-foreground" : "border-border text-muted-foreground"}`}
            >
              {k.label} <span className="tabular-nums opacity-70">{n}</span>
            </Link>
          );
        })}
      </nav>

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
              {shown.map((thread) => {
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
                      <div className="flex items-center justify-end gap-1">
                        {thread.kind === "post" || thread.kind === "service" ? <EditInStudio id={thread.id} kind={thread.kind} /> : null}
                        <ContentRowActions
                          threadId={thread.id}
                          kind={thread.kind}
                          status={thread.status}
                          feedSlug={thread.feedSlug}
                          slug={thread.slug}
                        />
                      </div>
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
