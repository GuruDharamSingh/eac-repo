import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
// Server-safe entry only: the package's main entry carries editor hooks.
import { isValidSlug } from "@elkdonis/page-builder/server";
import { requireOrgEditor } from "@/lib/auth";
import { loadPageWithVersion, ROUTE_SLUGS } from "@/lib/puck/store";
import { startingPoint } from "@/lib/puck/starting-point";
import { CanvasEditor } from "@/components/studio/CanvasEditor";
import { siteConfig } from "@/config/site";

/**
 * Edit one page in the canvas (2026-11-11, canvas first): `/studio/home` is `/`,
 * `/studio/enneagram` the exposition, `/studio/about-the-work` the page published at
 * `/about-the-work`. The built-in pages open on their code default until a version
 * is saved. Puck's editor on the same document is at /studio/<slug>/blocks.
 *
 * Gated twice on purpose: here, so someone without the role never loads the
 * editor, and again in savePageAction (a client component is not an
 * authorisation boundary).
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page editor", robots: { index: false, follow: false } };

export default async function CanvasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const [{ slug }, { template }] = await Promise.all([params, searchParams]);
  if (!isValidSlug(slug) || ROUTE_SLUGS.has(slug)) notFound();

  await requireOrgEditor(`/studio/${slug}${template ? `?template=${encodeURIComponent(template)}` : ""}`);

  const page = await loadPageWithVersion(slug);
  const initial = ((page?.data as unknown) ?? startingPoint(slug, template)) as PuckDoc;
  // Puck's editor opens the same starting document when nothing is saved yet.
  const blocks = `/studio/${slug}/blocks${!page && template ? `?template=${encodeURIComponent(template)}` : ""}`;
  return <CanvasEditor slug={slug} orgId={siteConfig.orgId} initial={initial} version={page?.updatedAt} blockEditorHref={blocks} />;
}
