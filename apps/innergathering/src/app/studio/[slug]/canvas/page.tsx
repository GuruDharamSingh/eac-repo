import { notFound, redirect } from "next/navigation";
import { LANDING_SLUG } from "@/lib/puck/landing";
import { requireOrgEditor } from "@/lib/auth";
import { EMPTY_PAGE, isValidSlug } from "@elkdonis/page-builder";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { siteConfig } from "@/config/site";
import { loadPage } from "@/lib/puck/store";
import { CanvasEditor } from "@/components/studio/CanvasEditor";

/**
 * The canvas editor on one page: the same stored document /studio/<slug> opens
 * in Puck, and the same `/p/<slug>` publishes. Gated here and again in the save action.
 */
export const dynamic = "force-dynamic";

export default async function CanvasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  if (slug === LANDING_SLUG) redirect("/");

  await requireOrgEditor(`/studio/${slug}/canvas`);

  const page = await loadPage(slug);
  return <CanvasEditor slug={slug} orgId={siteConfig.orgId} initial={(page?.data as PuckDoc) ?? (EMPTY_PAGE as PuckDoc)} />;
}
