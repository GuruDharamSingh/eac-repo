import * as React from "react";
import type { Artwork } from "@elkdonis/commerce/types";
import { ProductGrid } from "@elkdonis/commerce/components";
import { marketplaceLinks } from "@elkdonis/commerce/links";
import { DeclineCreditButton } from "./DeclineCreditButton";

/**
 * Pieces in other stores that name this person as the artist (migration
 * 209) — typically an organisation's store listing a donated work. The
 * person did not list them and is not paid for them; what they can do is
 * decline the credit, which takes their name off the listing (ORG_STORE_BRIEF
 * D4). Server component; the decline button is the one client part.
 */
export function CreditedWork({
  artworks,
  marketplaceUrl,
  canDecline,
  heading,
}: {
  artworks: Artwork[];
  marketplaceUrl: string;
  canDecline: boolean;
  heading: React.ReactNode;
}) {
  const links = marketplaceLinks(marketplaceUrl, { from: "artdirect" });
  return (
    <section className="eac-profile-store eac-profile-credited">
      <h2 className="eac-person-section__heading">{heading}</h2>
      <p className="eac-person-section__blurb">
        Listed by the store that holds the piece; proceeds go to that store.
        {canDecline ? " Not your work? Decline the credit and your name comes off it." : ""}
      </p>
      <ProductGrid
        items={artworks}
        hrefBuilder={(a) => links.artwork(a.id)}
        artistHrefBuilder={() => null}
        density="tight"
        label="Credited work"
        renderActions={canDecline ? (a) => <DeclineCreditButton artworkId={a.id} /> : undefined}
      />
    </section>
  );
}
