import { notFound, permanentRedirect } from "next/navigation";
import { profilePathByUserId } from "@/lib/legacy";

/**
 * /profile/<userId> was how apps/inner-gathering linked to a person. People's
 * pages are the links most likely to have been shared, so they resolve here
 * rather than 404.
 */
export const dynamic = "force-dynamic";

export default async function LegacyProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const path = await profilePathByUserId(userId);
  if (!path) notFound();
  permanentRedirect(path);
}
