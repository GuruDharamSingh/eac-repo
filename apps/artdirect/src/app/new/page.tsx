import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { createDossier } from "@/lib/oad-actions";
import { DossierForm } from "@/components/oad/DossierForm";
import { DirectoryShell } from "@/components/shell/DirectoryShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Open a file — ArtDirect" };

export default async function NewDossierPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/new");

  return (
    <DirectoryShell current="new">
      <DossierForm action={createDossier} mode="create" />
    </DirectoryShell>
  );
}
