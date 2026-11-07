import { notFound, redirect } from "next/navigation";
import { LANDING_SLUG } from "@/lib/puck/landing";
import type { Data } from "@puckeditor/core";
import { requireOrgEditor } from "@/lib/auth";
import { EMPTY_PAGE, isValidSlug } from "@elkdonis/page-builder";
import { loadPage } from "@/lib/puck/store";
import { PuckEditor } from "@/components/studio/PuckEditor";

/**
 * Edit one page.
 *
 * Gated twice on purpose: here, so someone without the role never loads the
 * editor at all, and again in savePageAction, because a client component is not
 * an authorisation boundary.
 */
export const dynamic = "force-dynamic";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  if (slug === LANDING_SLUG) redirect("/");

  await requireOrgEditor(`/studio/${slug}`);

  const page = await loadPage(slug);
  // A page that does not exist yet opens as an empty canvas rather than a 404 —
  // creating one should be visiting its address, not a separate ceremony.
  return <PuckEditor slug={slug} initial={(page?.data as Data) ?? (EMPTY_PAGE as Data)} />;
}
