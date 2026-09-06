import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";
import { SilexLayout } from "@/components/silex-layout";
import { OfferingPage } from "@/components/sites/OfferingPage";

export const dynamic = "force-dynamic";

/**
 * The subdomain root.
 *
 * An org that has published its own homepage through Silex keeps it — that is
 * the whole point of `layout_mode='silex'`, and hidden-enneagram is live on
 * it. Everyone else lands on the offering, which is the first of the three
 * templated pages (offering / profile / community) every org subdomain has.
 */
export default async function OrgSiteRootPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  if (org.layout_mode === "silex" && org.silex_published_path) {
    return <SilexLayout org={org} />;
  }

  return <OfferingPage slug={slug} />;
}
