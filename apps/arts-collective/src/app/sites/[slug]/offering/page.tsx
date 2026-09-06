import { OfferingPage } from "@/components/sites/OfferingPage";

export const dynamic = "force-dynamic";

export default async function SiteOfferingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <OfferingPage slug={slug} />;
}
