import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getDossierEditFields } from "@/lib/oad";
import { updateDossier } from "@/lib/oad-actions";
import { DossierForm } from "@/components/oad/DossierForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Amend file — ArtDirect" };

type Props = { params: Promise<{ slug: string }> };

export default async function EditDossierPage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=/${slug}/edit`);

  const fields = await getDossierEditFields(slug);
  if (!fields) notFound();

  return <DossierForm action={updateDossier} mode="edit" initial={fields} />;
}
