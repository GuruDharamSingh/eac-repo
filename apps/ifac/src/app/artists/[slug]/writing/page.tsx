import type { Metadata } from "next";
import { getDirectoryProfile } from "@/lib/directory";
import { WritingShelfPage } from "@/components/writing-views";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== "artist") return {};
  return { title: `Writing — ${profile.name} on IFAC` };
}

export default async function ArtistWritingPage({ params }: Props) {
  const { slug } = await params;
  return <WritingShelfPage kind="artist" slug={slug} />;
}
