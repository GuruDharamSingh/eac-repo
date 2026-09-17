import type { Metadata } from "next";
import { getDirectoryProfile } from "@/lib/directory";
import { WritingShelfPage } from "@/components/writing-views";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== "dealer") return {};
  return { title: `Writing — ${profile.name} on IFAC` };
}

export default async function DealerWritingPage({ params }: Props) {
  const { slug } = await params;
  return <WritingShelfPage kind="dealer" slug={slug} />;
}
