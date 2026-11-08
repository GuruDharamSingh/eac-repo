import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Data } from "@puckeditor/core";
// Server-safe entries only: the package's main entry carries editor hooks.
import { EMPTY_PAGE } from "@elkdonis/page-builder/config";
import { isValidSlug } from "@elkdonis/page-builder/server";
import { requireOrgEditor } from "@/lib/auth";
import { ABOUT_SLUG, BUILT_IN_SLUGS, FIGURE_SLUG, HOME_SLUG, listPages, loadPage, MUSIC_SLUG, READINGS_SLUG, ROUTE_SLUGS, SERVICE_SLUG } from "@/lib/puck/store";
import { DEFAULT_ABOUT_PAGE, DEFAULT_FIGURE_PAGE, DEFAULT_HOME, DEFAULT_MUSIC_PAGE, DEFAULT_READINGS_PAGE, DEFAULT_SERVICE_PAGE } from "@/lib/default-pages";
import { READING_TEMPLATE } from "@/lib/reading-template";
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

/** What a page opens on before it is first published: its code default, the reading starter, or empty. */
function startingPoint(slug: string, template?: string): Data {
  if (slug === HOME_SLUG) return DEFAULT_HOME as Data;
  if (slug === FIGURE_SLUG) return DEFAULT_FIGURE_PAGE as Data;
  if (slug === MUSIC_SLUG) return DEFAULT_MUSIC_PAGE as Data;
  if (slug === READINGS_SLUG) return DEFAULT_READINGS_PAGE as unknown as Data;
  if (slug === ABOUT_SLUG) return DEFAULT_ABOUT_PAGE as unknown as Data;
  if (slug === SERVICE_SLUG) return DEFAULT_SERVICE_PAGE as unknown as Data;
  if (template === "reading") return READING_TEMPLATE as unknown as Data;
  return EMPTY_PAGE as Data;
}

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const [{ slug }, { template }] = await Promise.all([params, searchParams]);
  if (!isValidSlug(slug) || ROUTE_SLUGS.has(slug)) notFound();

  await requireOrgEditor(`/studio/${slug}`);

  const [page, published] = await Promise.all([loadPage(slug), listPages().catch(() => [])]);
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
  return <PageEditor slug={slug} orgId={siteConfig.orgId} initial={initial} pages={pages} />;
}
