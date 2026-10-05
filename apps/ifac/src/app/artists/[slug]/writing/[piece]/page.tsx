import type { Metadata } from "next";
import { getWritingPost } from "@elkdonis/services";
import { getDirectoryProfile } from "@/lib/directory";
import { WritingPieceView } from "@/components/writing-views";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; piece: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, piece } = await params;
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== "artist" || !profile.userId) return {};
  // Published only: a draft's title is not something to hand a crawler.
  const post = await getWritingPost(profile.userId, piece);
  if (!post) return {};
  // The Studio's "Search and sharing" overrides win over the piece's own fields.
  const seo = post.seo;
  return {
    title: `${seo?.title ?? post.title} — ${profile.name}`,
    description: seo?.description ?? post.lede ?? undefined,
    robots: seo?.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: seo?.title ?? post.title,
      description: seo?.description ?? post.lede ?? undefined,
      type: "article",
      images: seo?.imageUrl ? [seo.imageUrl] : post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function ArtistWritingPiecePage({ params, searchParams }: Props) {
  const { slug, piece } = await params;
  const { edit } = await searchParams;
  return (
    <WritingPieceView kind="artist" slug={slug} pieceSlug={piece} startEditing={edit === "1"} />
  );
}
