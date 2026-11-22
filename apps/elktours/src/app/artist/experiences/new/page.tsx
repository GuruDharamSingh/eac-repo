import type { Metadata } from "next";
import { ArtistWizardLoader } from "@/components/mobile/artist-wizard-loader";
import { requireOrgMember } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New experience", robots: { index: false, follow: false } };

export default async function NewArtistExperiencePage() {
  await requireOrgMember("/artist/experiences/new");
  return <div className="elk-m"><ArtistWizardLoader /></div>;
}
