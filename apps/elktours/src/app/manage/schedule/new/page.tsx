import Link from "next/link";
import { Split } from "@/components/mobile/split";
import { NewSlotsMobile } from "@/components/mobile/board-server";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Screen 32 (G7a). Phone: New slots. Desktop keeps "Schedule a tour" on the Schedule page. */
export default async function NewSlotsPage() {
  await requireOrgEditor("/manage/schedule/new");
  return (
    <Split
      mobile={<NewSlotsMobile />}
      desktop={
        <p className="text-sm text-muted-foreground">
          New slots are added from <Link href="/manage/schedule" className="underline underline-offset-4">Schedule a tour</Link> on the Schedule page.
        </p>
      }
    />
  );
}
