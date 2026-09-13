import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { listWikiPages, buildWikiTree, searchWiki } from "@elkdonis/services";
import type { WikiTreeNode, WikiSearchHit, WikiSearchSpan } from "@elkdonis/services";

export const dynamic = "force-dynamic";

function countPages(nodes: WikiTreeNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countPages(n.children), 0);
}

/**
 * Matches come back as spans rather than HTML, so they are rendered as React
 * children and escaped. See searchWiki — wiki titles are never
 * HTML-sanitised, so highlighting them as markup would be an injection.
 */
function Spans({ spans, fallback }: { spans: WikiSearchSpan[]; fallback: string }) {
  if (spans.length === 0) return <>{fallback}</>;
  return (
    <>
      {spans.map((s, i) =>
        s.hit ? (
          <mark key={i} className="bg-primary/20 text-foreground">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  );
}

/**
 * Search lives on the index as `?q=`, not at /hub/wiki/search: a static
 * segment would shadow any page whose slug happened to be "search", since
 * Next resolves static routes before dynamic ones. A plain GET form also
 * means search works with no JavaScript.
 */
export default async function WikiIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const pages = await listWikiPages();
  const tree = buildWikiTree(pages);
  const hits = query ? await searchWiki(query) : null;

  const recent = [...pages]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  return (
    <div>
      <header className="mb-8 border-b border-border pb-6">
        <div className="flex items-end justify-between gap-4">
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
        </div>

        {pages.length > 0 && (
          <form method="get" action="/hub/wiki" className="mt-5 flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search titles, pages and definitions…"
              aria-label="Search the wiki"
              className="h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
            {query && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/hub/wiki">Clear</Link>
              </Button>
            )}
          </form>
        )}
      </header>

      {hits && (
        <section className="mb-10">
          <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {hits.length === 0
              ? `Nothing matches “${query}”`
              : `${hits.length} ${hits.length === 1 ? "result" : "results"} for “${query}”`}
          </h2>
          {hits.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Try fewer words.{" "}
              <Link
                href={`/hub/wiki/new?title=${encodeURIComponent(query)}`}
                className="underline underline-offset-4"
              >
                Write “{query}”
              </Link>{" "}
              instead.
            </p>
          ) : (
            <ul className="mt-3 space-y-4">
              {hits.map((hit: WikiSearchHit) => (
                <li key={hit.id}>
                  <Link
                    href={`/hub/wiki/${hit.slug}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    <Spans spans={hit.titleSpans} fallback={hit.title} />
                  </Link>
                  {hit.viaDefinition && (
                    <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      definition
                    </span>
                  )}
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    <Spans spans={hit.snippetSpans} fallback="" />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
