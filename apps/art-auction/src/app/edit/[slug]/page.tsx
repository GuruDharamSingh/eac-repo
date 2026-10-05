import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Data } from "@puckeditor/core";
import { isValidSlug } from "@elkdonis/page-builder";
import { templateDocument } from "@elkdonis/blocks";
import { requirePagesEditor } from "@/lib/puck/auth";
import { loadPage } from "@/lib/puck/store";
import { slugProblem } from "@/lib/puck/actions";
import { startingTemplate, allTemplates } from "@/lib/puck/templates";
import { PageEditor } from "@/components/pages/page-editor";
import { siteConfig } from "@/config/site";

/**
 * Edit one page: `/edit/auction` edits the page published at `/auction`;
 * `/edit/article-detail` edits the template every article is drawn from.
 *
 * Gated twice: here, so someone without the role never loads the editor, and
 * in savePageAction, because a client component is not an authorisation
 * boundary.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page editor", robots: { index: false, follow: false } };

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { slug } = await params;
  const { template: start } = await searchParams;
  if (!isValidSlug(slug)) notFound();
  await requirePagesEditor(`/edit/${slug}`);

  const problem = await slugProblem(slug, { allowTemplate: true });
  if (problem) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-serif text-2xl">That name is taken</h1>
        <p className="mt-3 text-muted-foreground">{problem} Pick another name for the page.</p>
        <a href="/admin/pages" className="mt-6 inline-block underline underline-offset-4">
          Back to the page list
        </a>
      </main>
    );
  }

  const stored = await loadPage(slug);
  // A page that does not exist yet opens as its starting template (the page's
  // own name picks it: `featured`, `auction`, `article-detail`), or a blank
  // page. Nothing is saved until Publish.
  const initial = stored
    ? (stored.data as Data)
    : (templateDocument(startingTemplate(slug, start), slug.replace(/-/g, " ")) as unknown as Data);

  return <PageEditor slug={slug} orgId={siteConfig.marketplaceOrgId} initial={initial} templates={allTemplates()} />;
}
