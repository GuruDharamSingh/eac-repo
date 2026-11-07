import { notFound, redirect } from "next/navigation";
import { getSeriesById } from "@elkdonis/commerce/queries";
import { requireAdmin } from "@/lib/marketplace-auth";

export const dynamic = "force-dynamic";

/** Series are managed in their workspace since 2026-10-28. */
export default async function ManageSeriesRedirect({ params }: { params: Promise<{ id: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireAdmin();
  const { id } = await params;
  const series = await getSeriesById(id);
  if (!series) notFound();
  redirect(`/series/${series.slug}/manage`);
}
