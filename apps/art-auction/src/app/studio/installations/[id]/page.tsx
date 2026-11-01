import { notFound } from "next/navigation";
import { requireStudioStore } from "@/lib/marketplace-auth";
import {
  getInstallation,
  listHangableArtworks,
  listInstallationArtworks,
  listInstallationPieces,
} from "@/lib/installations";
import { InstallationEditor } from "./installation-editor";

export const dynamic = "force-dynamic";

export default async function EditInstallationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { stores } = await requireStudioStore();
  const installation = await getInstallation(id);
  if (!installation || !stores.some((s) => s.id === installation.storeId)) notFound();

  const [hangable, hung, pieces] = await Promise.all([
    listHangableArtworks(installation.storeId),
    listInstallationArtworks(id, { publicOnly: false }),
    listInstallationPieces(id),
  ]);
  // A hung work that has since been archived still shows on the wall here, so
  // the curator can see it and take it down.
  const known = new Map(hangable.map((a) => [a.id, a]));
  for (const a of hung) if (!known.has(a.id)) known.set(a.id, a);

  return (
    <InstallationEditor
      installation={installation}
      artworks={[...known.values()]}
      initialPieces={pieces}
    />
  );
}
