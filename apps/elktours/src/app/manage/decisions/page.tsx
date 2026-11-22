import Link from "next/link";
import { Split } from "@/components/mobile/split";
import { DecisionsMobile } from "@/components/mobile/board-server";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Screen 34 (G7a): slots that closed below their minimum. Phone only; desktop keeps the Schedule and Bookings pages. */
export default async function DecisionsPage() {
  await requireOrgEditor("/manage/decisions");
  return (
    <Split
      mobile={<DecisionsMobile />}
      desktop={
        <p className="text-sm text-muted-foreground">
          Slots that closed below their minimum are decided on the phone layout, or from the{" "}
          <Link href="/manage/schedule" className="underline underline-offset-4">Schedule</Link>.
        </p>
      }
    />
  );
}
