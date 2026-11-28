import type { Metadata } from "next";
import { Catalogue } from "@/offer-templates/Catalogue";
import { requireNetworkAdmin } from "@/lib/gate";

export const metadata: Metadata = { title: "Offer catalogue" };
export const dynamic = "force-dynamic";

/**
 * The offer catalogue on a page of its own, so a link can point at a section
 * (#cat-patterns, #cat-template-event, #cat-layer-pay ...). The same view is the
 * "Catalogue" tab of /offer-templates. Data: src/offer-templates/catalogue.ts.
 */
export default async function OfferCataloguePage() {
  await requireNetworkAdmin("/offer-templates/catalogue");
  return (
    <div className="dev-page">
      <Catalogue withTitle />
    </div>
  );
}
