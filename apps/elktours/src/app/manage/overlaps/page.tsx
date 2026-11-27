import { requireOrgEditor } from "@/lib/auth";
import { listOverlaps } from "@/lib/slot-overlaps";
import { OverlapList } from "@/components/office/overlap-list";

export const dynamic = "force-dynamic";

/** Overlap notices: runs of one guide that overlap in time. A guide sees their own, an owner all. */
export default async function OverlapsPage() {
  const viewer = await requireOrgEditor("/manage/overlaps");
  const overlaps = await listOverlaps({ guideUserId: viewer.role === "owner" ? undefined : viewer.userId });
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h1 className="font-serif text-2xl">Overlapping runs</h1>
      <OverlapList initial={overlaps} />
    </div>
  );
}
