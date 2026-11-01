import { notFound, redirect } from "next/navigation";
import { getSeriesById } from "@elkdonis/commerce/queries";

export const dynamic = "force-dynamic";

/** Series are managed in their workspace since 2026-10-28. */
export default async function ManageSeriesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await getSeriesById(id);
  if (!series) notFound();
  redirect(`/series/${series.slug}/manage`);
}
