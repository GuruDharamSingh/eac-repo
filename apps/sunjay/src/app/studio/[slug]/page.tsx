import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Data } from "@puckeditor/core";
import { isValidSlug } from "@elkdonis/page-builder";
import { templateDocument } from "@elkdonis/blocks";
import { requireOrgEditor } from "@/lib/auth";
import { loadPage, HOME_SLUG } from "@/lib/puck/store";
import { slugProblem } from "@/lib/puck/actions";
import { allTemplates, startingTemplate } from "@/lib/puck/templates";
import { loadHomeSeed } from "@/lib/puck/home-seed";
import { PageEditor } from "@/components/studio/page-editor";
import { siteConfig } from "@/config/site";

/**
 * Edit one page: `/studio/home` is the landing page, `/studio/visiting` the
 * page that answers at `/visiting`.
 *
 * Gated twice on purpose: here, so someone without the role never loads the
 * editor at all, and again in savePageAction, because a client component is not
 * an authorisation boundary.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page editor", robots: { index: false, follow: false } };

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { slug } = await params;
  const { template: start } = await searchParams;
  if (!isValidSlug(slug)) notFound();
  await requireOrgEditor(`/studio/${slug}`);

  // A name the site already uses (a section, /hub, /about) cannot hold a page.
  const problem = await slugProblem(slug, { allowTemplate: true });
  if (problem) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-serif text-2xl">That name is taken</h1>
        <p className="mt-3 text-muted-foreground">{problem} Pick another name for the page.</p>
        <a href="/manage/builder" className="mt-6 inline-block underline underline-offset-4">
          Back to the page list
        </a>
      </div>
    );
  }

  const seed = await loadHomeSeed();
  const templates = allTemplates(seed);

  const stored = await loadPage(slug);
  // A page that does not exist yet opens as a starting document rather than a
  // 404: the home page as it is today, anything else a plain page. Nothing is
  // saved until Publish, and the home page keeps rendering the hard-coded
  // landing until then.
  const initial = stored
    ? (stored.data as Data)
    : (templateDocument(startingTemplate(slug, start, seed), slug === HOME_SLUG ? "Home" : "") as unknown as Data);

  return (
    <PageEditor
      slug={slug}
      orgId={siteConfig.orgId}
      initial={initial}
      templates={templates}
    />
  );
}
