import type { Metadata } from "next";
import { DesignerRoute } from "@/components/design/DesignerRoute";

// The person's featured page in the page designer. Owner or admin only; see DesignerRoute.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Design your featured page — ArtDirect", robots: { index: false } };

type Props = { params: Promise<{ slug: string }> };

export default async function DesignFeaturedPage({ params }: Props) {
  const { slug } = await params;
  return <DesignerRoute slug={slug} kind="featured" />;
}
