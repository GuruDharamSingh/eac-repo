import type { Metadata } from "next";
import { getDirectoryProfile } from "@/lib/directory";
import { getUserGallery } from "@elkdonis/services";
import { GalleryPageView } from "@/components/gallery-page-view";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; gallery: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, gallery } = await params;
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== "artist" || !profile.userId) return {};
  const g = await getUserGallery(profile.userId, gallery);
  if (!g || !g.isPublic) return {};
  return { title: `${g.title} — ${profile.name} on IFAC` };
}

export default async function ArtistGalleryPage({ params, searchParams }: Props) {
  const { slug, gallery } = await params;
  const { edit } = await searchParams;
  return <GalleryPageView kind="artist" slug={slug} gallerySlug={gallery} startEditing={edit === "1"} />;
}
