import { redirect } from "next/navigation";
import { mailingsHref } from "@/lib/series-letters-mailings";

/** The list of a series' mailings is a section of the series' email page. */
export default async function SeriesMailingsIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(mailingsHref(id));
}
