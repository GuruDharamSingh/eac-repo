import { redirect } from "next/navigation";

/**
 * The guide desk is now the journal's "To answer" section. Old links (and
 * bookmarks) land there, keeping their course filter.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ course?: string; all?: string }> }) {
  const { course, all } = await searchParams;
  const qs = new URLSearchParams();
  if (course) qs.set("course", course);
  if (all === "1") qs.set("all", "1");
  const query = qs.toString();
  redirect(`/journal${query ? `?${query}` : ""}#to-answer`);
}
