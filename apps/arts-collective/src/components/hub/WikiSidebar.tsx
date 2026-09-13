"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WikiTreeNode } from "@elkdonis/services";

import { Button } from "@/components/ui/button";

type Props = {
  tree: WikiTreeNode[];
};

function TreeLevel({
  nodes,
  currentSlug,
  depth,
}: {
  nodes: WikiTreeNode[];
  currentSlug?: string;
  depth: number;
}) {
  return (
    <ul className={depth === 0 ? "space-y-0.5" : "mt-0.5 space-y-0.5 border-l border-border/60 pl-3"}>
      {nodes.map((node) => {
        const isCurrent = node.slug === currentSlug;
        return (
          <li key={node.id}>
            <Link
              href={`/hub/wiki/${node.slug}`}
              className={
                isCurrent
                  ? "block rounded px-2 py-1 text-sm font-medium text-foreground bg-muted"
                  : "block rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }
            >
              {node.title}
            </Link>
            {node.children.length > 0 && (
              <TreeLevel
                nodes={node.children}
                currentSlug={currentSlug}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function useCurrentSlug(): string | undefined {
  const pathname = usePathname() ?? "";
  const segment = pathname.match(/^\/hub\/wiki\/([^/]+)/)?.[1];
  return segment === "new" ? undefined : segment;
}

export function WikiMobileNav({ tree }: Props) {
  const currentSlug = useCurrentSlug();

  return (
    <details className="mb-6 rounded-md border border-border bg-card md:hidden">
      <summary className="cursor-pointer px-4 py-3 text-sm text-foreground">
        <span className="font-medium">Wiki</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {tree.length === 0 ? "no pages" : "browse pages"}
        </span>
      </summary>
      <div className="border-t border-border/60 px-3 py-3">
        {tree.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">No pages yet.</p>
        ) : (
          <TreeLevel nodes={tree} currentSlug={currentSlug} depth={0} />
        )}
        <Button asChild size="sm" variant="outline" className="mt-3 w-full">
          <Link href="/hub/wiki/new">New page</Link>
        </Button>
      </div>
    </details>
  );
}

export function WikiSidebar({ tree }: Props) {
  const currentSlug = useCurrentSlug();

  return (
    <div className="sticky top-6">
      <Link
        href="/hub"
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Hub
      </Link>
      <Link href="/hub/wiki" className="mt-2 block">
        <p className="font-serif text-lg text-foreground">Wiki</p>
        <p className="text-xs text-muted-foreground">Network knowledge base</p>
      </Link>

      {/* Plain GET form: search needs no JavaScript, and lands on the index
          as ?q= rather than a /hub/wiki/search route that would shadow a page
          slugged "search". */}
      <form method="get" action="/hub/wiki" className="mt-4">
        <input
          type="search"
          name="q"
          placeholder="Search…"
          aria-label="Search the wiki"
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </form>

      <Button asChild size="sm" variant="outline" className="mt-3 w-full">
        <Link href="/hub/wiki/new">New page</Link>
      </Button>

      <nav className="mt-5 border-t border-border/60 pt-4">
        {tree.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">No pages yet.</p>
        ) : (
          <TreeLevel nodes={tree} currentSlug={currentSlug} depth={0} />
        )}
      </nav>
    </div>
  );
}
