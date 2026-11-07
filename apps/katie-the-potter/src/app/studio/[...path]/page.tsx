import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Data } from "@puckeditor/core";
// Server-safe entries only: the package's main entry carries editor hooks.
import { EMPTY_PAGE } from "@elkdonis/page-builder/config";
import { isValidPagePath } from "@elkdonis/page-builder/server";
import { requireOrgEditor } from "@/lib/auth";
import { HOME_SLUG, loadPage, PIECE_TEMPLATE } from "@/lib/puck/store";
import { DEFAULT_PIECE_DETAIL } from "@/lib/piece-template";
import { DEFAULT_HOME } from "@/lib/default-home";
import { PageEditor } from "@/components/studio/page-editor";
import { siteConfig } from "@/config/site";
import { loadSiteStyle } from "@/lib/site-style";
import { lookOf, SITE_LOOK_VAR } from "@/blocks/looks";

/**
 * Edit one page: `/studio/home` is the landing, `/studio/about` the page
 * published at `/about`. The home page opens on DEFAULT_HOME until a version
 * has been published, so the studio starts from the designed landing rather
 * than an empty canvas.
 *
 * Gated twice on purpose: here, so someone without the role never loads the
 * editor, and again in savePageAction, because a client component is not an
 * authorisation boundary.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page editor", robots: { index: false, follow: false } };

export default async function StudioPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const slug = path.join("/");
  if (!isValidPagePath(slug)) notFound();

  await requireOrgEditor(`/studio/${slug}`);

  const page = await loadPage(slug);
  const initial = (page?.data as Data | undefined) ?? (slug === HOME_SLUG ? (DEFAULT_HOME as Data) : slug === PIECE_TEMPLATE ? (DEFAULT_PIECE_DETAIL as Data) : (EMPTY_PAGE as Data));
  const siteLook = lookOf((await loadSiteStyle().catch(() => null))?.theme?.[SITE_LOOK_VAR]);
  return <PageEditor slug={slug} orgId={siteConfig.orgId} initial={initial} siteLook={siteLook} />;
}
