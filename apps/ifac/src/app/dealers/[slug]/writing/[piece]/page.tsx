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
  if (!profile || profile.kind !== "dealer" || !profile.userId) return {};
  // Published only: a draft's title is not something to hand a crawler.
  const post = await getWritingPost(profile.userId, piece);
  if (!post) return {};
  return {
    title: `${post.title} — ${profile.name}`,
    description: post.lede ?? undefined,
    openGraph: {
      title: post.title,
      description: post.lede ?? undefined,
      type: "article",
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function DealerWritingPiecePage({ params, searchParams }: Props) {
  const { slug, piece } = await params;
  const { edit } = await searchParams;
  return (
    <WritingPieceView kind="dealer" slug={slug} pieceSlug={piece} startEditing={edit === "1"} />
  );
}
