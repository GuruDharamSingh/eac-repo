import { redirect } from "next/navigation";
import { mailingsHref } from "@/lib/series-letters-mailings";
import { requireIfacManager } from "@/lib/manage-auth";

/** The list of a series' mailings is a section of the series' email page. */
export default async function SeriesMailingsIndex({ params }: { params: Promise<{ id: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireIfacManager();
  const { id } = await params;
  redirect(mailingsHref(id));
}
