import { redirect } from "next/navigation";

/**
 * The Video page moved into the Studio as a kind (2026-10-04):
 * /studio?kind=video. Kept so old links and bookmarks land there.
 */
type Props = { searchParams: Promise<{ id?: string }> };

export default async function StudioVideoRedirect({ searchParams }: Props) {
  const { id } = await searchParams;
  redirect(`/studio?kind=video${id ? `&id=${encodeURIComponent(id)}` : ""}`);
}
