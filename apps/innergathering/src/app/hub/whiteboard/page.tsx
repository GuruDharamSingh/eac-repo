import type { Metadata } from "next";
import { WhiteboardSurface } from "@elkdonis/cms-ui/whiteboard";
import { requireOrgMember } from "@/lib/auth";

/**
 * The shared canvas, on its own page — the "Open as a page" link in the hub's
 * whiteboard popup comes here. The popup stays the quick way in; this is the
 * one you can link to, come back to and leave open on a second monitor.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Whiteboard · Hub" };

export default async function WhiteboardPage() {
  await requireOrgMember("/hub/whiteboard");
  return (
    <main className="hub-whiteboard-page">
      <WhiteboardSurface variant="page" />
    </main>
  );
}
