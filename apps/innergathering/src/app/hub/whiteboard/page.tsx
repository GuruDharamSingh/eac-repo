import type { Metadata } from "next";
import Link from "next/link";
import { WhiteboardSurface } from "@elkdonis/cms-ui/whiteboard";
import { siteConfig } from "@/config/site";
import { requireOrgMember } from "@/lib/auth";
import { WHITEBOARD_CLOUD_SAVE } from "@/lib/whiteboard";

/**
 * The shared canvas, on its own page.
 *
 * The hub tile and panel open it as a full-width popup, which is right for a
 * quick sketch. This is the link you can send someone, come back to, and
 * leave open on a second monitor — none of which a dialog can be. Same gate
 * as the API route behind it: any member, not just editors.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Whiteboard · Hub" };

export default async function WhiteboardPage() {
  await requireOrgMember("/hub/whiteboard");
  return (
    <main className="hub eac-whiteboard-page">
      <header className="eac-whiteboard-page-head">
        <div>
          <p className="eac-whiteboard-page-kicker">{siteConfig.orgName}</p>
          <h1 className="eac-whiteboard-page-title">Whiteboard</h1>
        </div>
        <Link className="eac-whiteboard-page-back" href="/hub">
          ‹ Back to the hub
        </Link>
      </header>
      <WhiteboardSurface fullPage cloudSave={WHITEBOARD_CLOUD_SAVE} />
    </main>
  );
}
