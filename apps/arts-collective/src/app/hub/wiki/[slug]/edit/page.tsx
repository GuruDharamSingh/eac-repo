import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { WikiPageForm } from "@/components/hub/WikiPageForm";
import { WikiBreadcrumbs } from "@/components/hub/WikiBreadcrumbs";
import { WikiDeleteButton } from "@/components/hub/WikiDeleteButton";
import { parentOptionsFor } from "@/lib/wiki-options";
import {
  getWikiPage,
  getWikiAncestors,
  listWikiPages,
  collectSubtreeIds,
  listWikiTopics,
  listTopicChoices,
} from "@elkdonis/services";

export const dynamic = "force-dynamic";

export default async function EditWikiPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireUser();

  const page = await getWikiPage(slug);
  if (!page) notFound();

  const [pages, ancestors, mine, choices] = await Promise.all([
    listWikiPages(),
    getWikiAncestors(page.id),
    listWikiTopics(page.id),
    // The wiki lives under the collective's org, so that is whose proposed
    // topics are offered alongside the network-approved ones.
    listTopicChoices("elkdonis"),
  ]);

  return (
    <div>
      <header className="mb-6 border-b border-border pb-6">
        <WikiBreadcrumbs ancestors={ancestors} current={page.title} />
        <h1 className="mt-3 font-serif text-2xl text-foreground">Editing</h1>
      </header>
      <WikiPageForm
        threadId={page.id}
        initialTitle={page.title}
        initialBody={page.body ?? ""}
        initialParentId={page.parentId}
        parentOptions={parentOptionsFor(pages, collectSubtreeIds(pages, page.id))}
        wikiPages={pages
          .filter((p) => p.id !== page.id)
          .map((p) => ({ title: p.title, slug: p.slug }))}
        updatedAt={new Date(page.updatedAt).toISOString()}
        topicChoices={choices.map((c) => ({ id: c.id, name: c.name }))}
        initialTopicIds={mine.map((t) => t.id)}
      />

      <section className="mt-10 border-t border-border pt-6">
        <WikiDeleteButton
          threadId={page.id}
          title={page.title}
          childCount={pages.filter((p) => p.parentId === page.id).length}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Removing hides the page. Its history is kept, so it can be restored by
          hand.
        </p>
      </section>
    </div>
  );
}
