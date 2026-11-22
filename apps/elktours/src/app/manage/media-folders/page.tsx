import Link from "next/link";
import { requireOrgEditor } from "@/lib/auth";
import { folderCounts, planStopsMove } from "@/lib/media-folders";
import { MediaFoldersPanel } from "@/components/manage/media-folders-panel";

export const dynamic = "force-dynamic";

/**
 * /manage/media-folders (2026-11-20): make the Tours/<slug>/ and Places/<slug>/ folders for records that have none,
 * and record what each picture in the old Stops/<TOUR>/ folders is of (in place, nothing moves). Owners and guides only.
 */
export default async function MediaFoldersPage() {
  // Gate in the page as well as the layout (see app/manage/places/[id]/page.tsx).
  await requireOrgEditor("/manage/media-folders");
  const [counts, plan] = await Promise.all([
    folderCounts(),
    planStopsMove().catch((err: unknown) => ({ items: [], unclaimed: [], error: err instanceof Error ? err.message : "Storage error" })),
  ]);
  return (
    <div className="max-w-5xl">
      <Link href="/manage" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Manage</Link>
      <h2 className="mt-1 font-serif text-2xl">Media folders</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Each tour has a folder in Files at <code>elktours/Tours/&lt;tour&gt;/</code> (its <code>Private/</code> folder is for
        guide notes and documents, never shown on the site) and each place one at <code>elktours/Places/&lt;place&gt;/</code>.
        Pictures dropped into a folder appear on the tour&apos;s or place&apos;s media page after <em>Scan folder</em>, hidden until
        switched on. A place&apos;s pictures can be used by every tour that stops there.
      </p>
      <MediaFoldersPanel counts={counts} plan={plan} />
    </div>
  );
}
