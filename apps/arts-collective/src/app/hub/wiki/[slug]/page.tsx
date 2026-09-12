import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { WikiBreadcrumbs } from "@/components/hub/WikiBreadcrumbs";
import { renderWikiBody } from "@/lib/wiki-render";
import {
  getWikiPage,
  getWikiAncestors,
  getWikiBacklinks,
  listWikiPages,
  getTermDefinitions,
  resolveTerms,
} from "@elkdonis/services";

export const dynamic = "force-dynamic";

export default async function WikiPageView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireUser();

  const page = await getWikiPage(slug);
  if (!page) notFound();

  const [ancestors, backlinks, allPages, senses] = await Promise.all([
    getWikiAncestors(page.id),
    getWikiBacklinks(page.id),
    listWikiPages(),
    getTermDefinitions(page.id),
  ]);

  const children = allPages
    .filter((p) => p.parentId === page.id)
    .sort((a, b) => a.title.localeCompare(b.title));

  // Terms inside the body get their definitions filled in here, server-side —
  // the marks store only the term (see TermDefinition in @elkdonis/cms-ui).
  const resolved = await resolveTerms(page.body ?? "", "/hub/wiki");
  const { html, headings } = renderWikiBody(resolved.html, "/hub/wiki");

  return (
    <div>
      <header className="mb-6 border-b border-border pb-6">
        <WikiBreadcrumbs ancestors={ancestors} current={page.title} />
        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl text-foreground">{page.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Last edited {new Date(page.updatedAt).toLocaleString()}
              {page.authorName ? ` · started by ${page.authorName}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/hub/wiki/${slug}/history`}>History</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/hub/wiki/${slug}/edit`}>Edit</Link>
            </Button>
          </div>
        </div>
      </header>

      {headings.length > 1 && (
        <nav className="mb-6 rounded-md border border-border bg-muted/30 p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            On this page
          </p>
          <ul className="mt-2 space-y-1">
            {headings.map((h) => (
              <li key={h.id} className={h.level === 3 ? "pl-4" : undefined}>
                <a
                  href={`#${h.id}`}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {page.body ? (
        <div
          className="prose prose-sm max-w-none prose-headings:font-serif prose-headings:scroll-mt-6 prose-p:my-2 prose-li:my-1 prose-a:text-primary prose-strong:text-foreground dark:prose-invert [&_.wikilink-new]:text-destructive [&_.wikilink-new]:decoration-dotted"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          This page is empty.{" "}
          <Link
            href={`/hub/wiki/${slug}/edit`}
            className="underline underline-offset-4"
          >
            Write it.
          </Link>
        </p>
      )}

      {senses.length > 0 && (
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {senses.length === 1
              ? "How this has been defined"
              : `How this has been defined · ${senses.length} senses`}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Given by people using the word in their own writing. Later ones sit
            alongside earlier ones rather than replacing them.
          </p>
          <ol className="mt-3 space-y-3">
            {senses.map((s) => (
              <li key={s.id} className="border-l-2 border-border pl-3">
                <p className="text-sm text-foreground">{s.text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.byName ?? "someone"} ·{" "}
                  {new Date(s.at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {children.length > 0 && (
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Pages under this one
          </h2>
          <ul className="mt-3 space-y-2">
            {children.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/hub/wiki/${c.slug}`}
                  className="text-sm text-foreground hover:underline"
                >
                  {c.title}
                </Link>
                {c.excerpt && (
                  <p className="truncate text-xs text-muted-foreground">{c.excerpt}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {backlinks.length > 0 && (
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            What links here
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {backlinks.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/hub/wiki/${b.slug}`}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  {b.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
