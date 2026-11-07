import Link from "next/link";
import type { Metadata } from "next";
import { requirePagesEditor } from "@/lib/puck/auth";
import { siteConfig } from "@/config/site";
import { listInstallationArtworks, listInstallationPieces, listOrgHangableArtworks } from "@/lib/installations";
import { ensureLandingInstallation, loadLoftPointer } from "@/lib/landing-loft";
import { LandingLoftEditor } from "./landing-loft-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Landing loft" };

/**
 * The scene under the home page's hero, edited in the installations editor:
 * any pictured work on the market can be hung, with the visitors' free spot
 * and an opening view. Changes save as a draft; "Put on the landing page"
 * shows them to visitors.
 */
export default async function AdminLoftPage() {
  const { userId } = await requirePagesEditor("/admin/loft");
  const installation = await ensureLandingInstallation(userId);
  const [hangable, hung, pieces, pointer] = await Promise.all([
    listOrgHangableArtworks(siteConfig.marketplaceOrgId),
    listInstallationArtworks(installation.id, { publicOnly: false }),
    listInstallationPieces(installation.id),
    loadLoftPointer(),
  ]);
  // A hung work since withdrawn still shows here, so it can be taken down.
  const known = new Map(hangable.map((a) => [a.id, a]));
  for (const a of hung) if (!known.has(a.id)) known.set(a.id, a);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <Link href="/admin/pages" className="underline underline-offset-4">
          Pages
        </Link>{" "}
        / The loft under the home page&apos;s hero. Changes save as you go and stay here until you put them on the landing page.
      </p>
      <LandingLoftEditor
        installation={installation}
        artworks={[...known.values()]}
        initialPieces={pieces}
        publishedAt={pointer.published?.at ?? null}
      />
    </div>
  );
}
