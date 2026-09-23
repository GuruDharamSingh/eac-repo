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
  if (!profile || profile.kind !== "dealer" || !profile.userId) return {};
  const g = await getUserGallery(profile.userId, gallery, { site: "ifac" });
  if (!g || !g.isPublic) return {};
  return { title: `${g.title} — ${profile.name} on IFAC` };
}

export default async function DealerGalleryPage({ params, searchParams }: Props) {
  const { slug, gallery } = await params;
  const { edit } = await searchParams;
  return <GalleryPageView kind="dealer" slug={slug} gallerySlug={gallery} startEditing={edit === "1"} />;
}
