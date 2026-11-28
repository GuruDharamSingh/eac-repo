import type { Metadata } from "next";
import { DeskBoard } from "@/desk/DeskBoard";
import { requireNetworkAdmin } from "@/lib/gate";

export const metadata: Metadata = { title: "Desk" };
export const dynamic = "force-dynamic";

export default async function DeskPage() {
  await requireNetworkAdmin("/desk");
  return (
    <div className="desk-page">
      <header>
        <h1>Desk</h1>
        <p className="desk-muted" style={{ margin: 0 }}>
          How this works: on any page, press &ldquo;Note for Claude&rdquo;, point at the thing you mean and write what you want. Claude opens this desk first, reads your notes where they were left, answers them, asks you questions here, and posts what changed.
        </p>
      </header>
      <DeskBoard />
    </div>
  );
}
