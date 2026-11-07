import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Data } from "@puckeditor/core";
// Server-safe entries only: the package's main entry carries editor hooks.
import { EMPTY_PAGE } from "@elkdonis/page-builder/config";
import { isValidSlug } from "@elkdonis/page-builder/server";
import { requireOrgEditor } from "@/lib/auth";
import { FIGURE_SLUG, HOME_SLUG, loadPage, ROUTE_SLUGS } from "@/lib/puck/store";
import { DEFAULT_FIGURE_PAGE, DEFAULT_HOME } from "@/lib/default-pages";
import { PageEditor } from "@/components/studio/page-editor";
import { siteConfig } from "@/config/site";

/**
 * Edit one page: `/studio/home` is `/`, `/studio/enneagram` is The Figure,
 * `/studio/about-the-work` the page published at `/about-the-work`. The two
 * built-in pages open on their code default until a version is published.
 *
 * Gated twice on purpose: here, so someone without the role never loads the
 * editor, and again in savePageAction (a client component is not an
 * authorisation boundary).
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page editor", robots: { index: false, follow: false } };

export default async function StudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug) || ROUTE_SLUGS.has(slug)) notFound();

  await requireOrgEditor(`/studio/${slug}`);

  const page = await loadPage(slug);
  const initial =
    (page?.data as Data | undefined) ??
    (slug === HOME_SLUG ? (DEFAULT_HOME as Data) : slug === FIGURE_SLUG ? (DEFAULT_FIGURE_PAGE as Data) : (EMPTY_PAGE as Data));
  return <PageEditor slug={slug} orgId={siteConfig.orgId} initial={initial} />;
}
