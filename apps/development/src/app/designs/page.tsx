import type { Metadata } from "next";
import { DesignHandoffs } from "@/ideas/design-handoffs/DesignHandoffs";
import { requireNetworkAdmin } from "@/lib/gate";

export const metadata: Metadata = { title: "Designs" };
export const dynamic = "force-dynamic";

/**
 * The "Designs" tab: every design kept in apps/development/designs/ (playing live), the design
 * pages in this app and the claude.ai canvases, behind one side navigation. The files themselves
 * are served by ./[...path]/route.ts. Data: src/ideas/design-handoffs/manifest.ts.
 */
export default async function DesignsPage() {
  await requireNetworkAdmin("/designs");
  return (
    <div className="dev-page">
      <h1>Designs</h1>
      <p className="dev-lede">
        Design handoffs and prototypes, each playing live in a frame at phone, tablet or desktop width, with the apps it is for, the matching code and what is built.
        Pick one on the left; the link keeps your pick (<code>#d=…</code>).
      </p>
      <DesignHandoffs />
    </div>
  );
}
