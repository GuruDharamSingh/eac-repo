import type { Metadata } from "next";
import { WhiteboardSurface } from "@elkdonis/cms-ui/whiteboard";
import { requireOrgMember } from "@/lib/auth";

/**
 * The shared canvas, on its own page.
 *
 * The tile opens it as a full-width surface, which is right for a quick
 * sketch. This is the link you can send someone, come back to, and leave open
 * on a second monitor — none of which a dialog can be.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Whiteboard · Hub" };

export default async function WhiteboardPage() {
  await requireOrgMember("/hub/whiteboard");
  return (
    <main className="hub hub-whiteboard-page">
      <WhiteboardSurface />
    </main>
  );
}
