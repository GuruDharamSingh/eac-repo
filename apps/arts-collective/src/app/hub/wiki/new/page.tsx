import { requireUser } from "@/lib/session";
import { WikiPageForm } from "@/components/hub/WikiPageForm";
import { parentOptionsFor } from "@/lib/wiki-options";
import { listWikiPages } from "@elkdonis/services";

export const dynamic = "force-dynamic";

export default async function NewWikiPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; parent?: string }>;
}) {
  const { title, parent } = await searchParams;
  await requireUser();

  const pages = await listWikiPages();

  return (
    <div>
      <header className="mb-6 border-b border-border pb-6">
        <h1 className="font-serif text-2xl text-foreground">New page</h1>
        {title && (
          <p className="mt-1 text-xs text-muted-foreground">
            Following an unwritten link — writing this fills it in everywhere it's
            linked from.
          </p>
        )}
      </header>
      <WikiPageForm
        initialTitle={title ?? ""}
        initialParentId={parent ?? null}
        parentOptions={parentOptionsFor(pages)}
        wikiPages={pages.map((p) => ({ title: p.title, slug: p.slug }))}
      />
    </div>
  );
}
