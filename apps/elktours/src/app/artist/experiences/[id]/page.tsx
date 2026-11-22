import type { Metadata } from "next";
import { ArtistWizardLoader } from "@/components/mobile/artist-wizard-loader";
import { requireOrgMember } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit experience", robots: { index: false, follow: false } };

export default async function EditArtistExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOrgMember(`/artist/experiences/${id}`);
  return <div className="elk-m"><ArtistWizardLoader id={id} /></div>;
}
