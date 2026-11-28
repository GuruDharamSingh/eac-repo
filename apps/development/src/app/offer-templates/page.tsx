import type { Metadata } from "next";
import { Gallery } from "@/offer-templates/Gallery";
import { requireNetworkAdmin } from "@/lib/gate";

export const metadata: Metadata = { title: "Offer templates" };
export const dynamic = "force-dynamic";

/**
 * The offer-page templates, each live in a desktop frame and a phone frame (iframes of
 * /offer-templates/t/<id>). Reached by URL for now. Source: packages/cms-ui/src/offer-surface/templates.
 */
export default async function OfferTemplatesPage() {
  await requireNetworkAdmin("/offer-templates");
  return (
    <div className="dev-page">
      <h1>Offer templates</h1>
      <p className="dev-lede">
        Each template draws the same sample site. Pick one on the left, switch the look, and read it in both frames; the link keeps your pick (<code>#t=…</code>). A template whose route is not built yet shows a 404 in the frame.
      </p>
      <Gallery />
    </div>
  );
}
