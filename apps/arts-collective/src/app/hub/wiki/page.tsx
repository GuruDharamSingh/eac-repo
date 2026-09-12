import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { listWikiPages, buildWikiTree } from "@elkdonis/services";
import type { WikiTreeNode } from "@elkdonis/services";

export const dynamic = "force-dynamic";

function countPages(nodes: WikiTreeNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countPages(n.children), 0);
}

export default async function WikiIndexPage() {
  await requireUser();

  const pages = await listWikiPages();
  const tree = buildWikiTree(pages);

  const recent = [...pages]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  return (
    <div>
      <header className="mb-8 flex items-end justify-between border-b border-border pb-6">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Wiki</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pages.length === 0
              ? "Nothing written yet."
              : `${countPages(tree)} ${countPages(tree) === 1 ? "page" : "pages"} · shared across the network`}
          </p>
        </div>
        <Button asChild>
          <Link href="/hub/wiki/new">New page</Link>
        </Button>
      </header>

      {pages.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            A wiki grows by writing. Start with one page — an index, a glossary, a
            process note — and link out from it with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">[[Page Name]]</code>.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/hub/wiki/new">New page</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Recently edited
            </h2>
            <ul className="mt-3 space-y-2">
              {recent.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-4">
                  <Link
                    href={`/hub/wiki/${p.slug}`}
                    className="truncate text-sm text-foreground hover:underline"
                  >
                    {p.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(p.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
              All pages
            </h2>
            <TreeOutline nodes={tree} depth={0} />
          </section>
        </div>
      )}
    </div>
  );
}

function TreeOutline({
  nodes,
  depth,
}: {
  nodes: WikiTreeNode[];
  depth: number;
}) {
  return (
    <ul
      className={
        depth === 0
          ? "mt-3 space-y-1.5"
          : "mt-1.5 space-y-1.5 border-l border-border/60 pl-4"
      }
    >
      {nodes.map((node) => (
        <li key={node.id}>
          <Link
            href={`/hub/wiki/${node.slug}`}
            className="text-sm text-foreground hover:underline"
          >
            {node.title}
          </Link>
          {node.children.length > 0 && (
            <TreeOutline nodes={node.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}
