import { notFound, permanentRedirect } from "next/navigation";
import { threadPathById } from "@/lib/legacy";

/**
 * /workshops/<id> was how apps/inner-gathering addressed content. Those links
 * are in inboxes and search results, so they resolve here rather than 404.
 */
export const dynamic = "force-dynamic";

export default async function LegacyWorkshopsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const path = await threadPathById(id);
  if (!path) notFound();
  permanentRedirect(path);
}
