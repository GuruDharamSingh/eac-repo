import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { WikiRevertButton } from "@/components/hub/WikiRevertButton";
import { WikiBreadcrumbs } from "@/components/hub/WikiBreadcrumbs";
import {
  getWikiPage,
  getWikiRevisions,
  getWikiAncestors,
} from "@elkdonis/services";

export const dynamic = "force-dynamic";

export default async function WikiHistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireUser();

  const page = await getWikiPage(slug);
  if (!page) notFound();

  const [revisions, ancestors] = await Promise.all([
    getWikiRevisions(page.id),
    getWikiAncestors(page.id),
  ]);

  return (
    <div>
      <header className="mb-6 border-b border-border pb-6">
        <WikiBreadcrumbs ancestors={ancestors} current={page.title} />
        <h1 className="mt-3 font-serif text-2xl text-foreground">History</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {revisions.length} {revisions.length === 1 ? "version" : "versions"}. Reverting
          is saved as a new edit — nothing is erased.
        </p>
      </header>

      <ul className="space-y-3">
        {revisions.map((rev, i) => {
          const isCurrent = i === 0;
          return (
            <li
              key={rev.id}
              className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {rev.title}
                  {isCurrent && (
                    <span className="ml-2 rounded border border-green-300 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-green-700">
                      current
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(rev.createdAt).toLocaleString()}
                  {rev.editorName ? ` · ${rev.editorName}` : ""}
                </p>
              </div>
              {!isCurrent && (
                <WikiRevertButton
                  threadId={page.id}
                  revisionId={rev.id}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
