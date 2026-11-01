import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveStudioStore } from "@/lib/marketplace-auth";
import { getInstallation, listInstallationArtworks, listInstallationPieces } from "@/lib/installations";
import { InstallationWalk } from "./installation-walk";

export const dynamic = "force-dynamic";

/** Published, or the store's own people previewing a draft. */
async function loadVisible(id: string) {
  const installation = await getInstallation(id);
  if (!installation) return null;
  if (installation.status === "published") return { installation, preview: false };
  const { stores } = await resolveStudioStore();
  return stores.some((s) => s.id === installation.storeId) ? { installation, preview: true } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const found = await loadVisible(id);
  return found
    ? { title: found.installation.title, description: `Walk the hallway hung with ${found.installation.title}.` }
    : { title: "Installation" };
}

export default async function InstallationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await loadVisible(id);
  if (!found) notFound();
  const { installation, preview } = found;

  const [artworks, pieces] = await Promise.all([
    listInstallationArtworks(id, { publicOnly: !preview }),
    listInstallationPieces(id),
  ]);

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8">
      <header className="mb-6 px-2">
        {preview && (
          <p className="mb-2 inline-block rounded bg-accent/40 px-2 py-0.5 text-xs">
            Draft — only your store can see this
          </p>
        )}
        <h1 className="font-serif text-4xl tracking-tight">{installation.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {artworks.length} {artworks.length === 1 ? "work" : "works"} hung along a long hallway.
          Walk it from the entrance, or take the walk piece by piece in the order they were hung.
        </p>
      </header>
      <div className="overflow-hidden rounded-xl border border-border bg-muted">
        <InstallationWalk
          artworks={artworks}
          pieces={pieces}
          venueId={installation.hallway}
          lighting={installation.scene.lighting}
        />
      </div>
    </main>
  );
}
