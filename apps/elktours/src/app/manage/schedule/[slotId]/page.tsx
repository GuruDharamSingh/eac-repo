import Link from "next/link";
import { Split } from "@/components/mobile/split";
import { SlotMobile } from "@/components/mobile/board-server";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Screen 33 (G7a): one slot at /manage/schedule/[slotId]. Phone only; desktop keeps the planner's side panel. */
export default async function SlotPage({ params }: { params: Promise<{ slotId: string }> }) {
  const { slotId } = await params;
  await requireOrgEditor(`/manage/schedule/${slotId}`);
  return (
    <Split
      mobile={<SlotMobile slotId={slotId} />}
      desktop={
        <p className="text-sm text-muted-foreground">
          Open a departure from the <Link href="/manage/schedule" className="underline underline-offset-4">Schedule</Link>.
        </p>
      }
    />
  );
}
