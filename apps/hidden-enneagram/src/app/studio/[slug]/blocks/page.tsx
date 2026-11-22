import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Data } from "@puckeditor/core";
// Server-safe entries only: the package's main entry carries editor hooks.
import { isValidSlug } from "@elkdonis/page-builder/server";
import { requireOrgEditor } from "@/lib/auth";
import { BUILT_IN_SLUGS, listPages, loadPageWithVersion, ROUTE_SLUGS } from "@/lib/puck/store";
import { startingPoint } from "@/lib/puck/starting-point";
import { PageEditor } from "@/components/studio/page-editor";
import { siteConfig } from "@/config/site";

/**
 * Puck's editor on one page (moved here from /studio/<slug> on 2026-11-11, canvas
 * first): the canvas at /studio/<slug> is the page editor; this is where a sealed
 * block's settings are edited when the canvas's right column cannot draw them
 * (rows of a list, a reading's steps). Same stored document, same save.
 *
 * Gated twice on purpose: here, so someone without the role never loads the
 * editor, and again in savePageAction (a client component is not an
 * authorisation boundary).
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Block settings", robots: { index: false, follow: false } };

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const [{ slug }, { template }] = await Promise.all([params, searchParams]);
  if (!isValidSlug(slug) || ROUTE_SLUGS.has(slug)) notFound();

  await requireOrgEditor(`/studio/${slug}/blocks`);

  const [page, published] = await Promise.all([loadPageWithVersion(slug), listPages().catch(() => [])]);
  const initial = (page?.data as Data | undefined) ?? startingPoint(slug, template);
  // Round 3: the page switcher (the "Pages" tab): the built-in set, then the published pages.
  const builtIn = new Set(BUILT_IN_SLUGS.map((b) => b.slug));
  const pages = [
    ...BUILT_IN_SLUGS.map((b) => ({ slug: b.slug, label: b.label })),
    ...published
      .map((p) => (p as { slug: string }).slug)
      .filter((s) => !builtIn.has(s))
      .map((s) => ({ slug: s, label: `/${s}` })),
  ];
  return <PageEditor slug={slug} orgId={siteConfig.orgId} initial={initial} version={page?.updatedAt} pages={pages} />;
}
