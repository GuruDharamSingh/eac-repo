import * as React from "react";
import type { Artwork, Store } from "../types";
import { marketplaceLinks } from "../links";
import { ProductGrid } from "./ProductGrid";

export interface StoreShowcaseProps {
  store: Store;
  artworks: Artwork[];
  /** Origin of the marketplace app, e.g. https://market.elkdonis-arts.org */
  marketplaceUrl: string;
  /** Which app this is embedded on, so the marketplace can send them back. */
  from?: string | null;
  /** Section heading. Default: "Store". */
  heading?: React.ReactNode;
  /** Copy under the heading. Default explains where the sale happens. */
  blurb?: React.ReactNode;
  /** Card width band; `tight` suits a narrow profile column. */
  density?: "tight" | "normal" | "loose";
  /** @deprecated The grid now fits its container. Use `density`. */
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * A person's store, embedded on a page that is not the marketplace — an org
 * site's member page, the ArtDirect profile, an artist subdomain. The store
 * is a front and this is a window onto it: every card links to the piece on
 * the marketplace, where cart, checkout and payment live, so a host site
 * never carries commerce of its own.
 *
 * It renders the same {@link ProductCard} the marketplace's own grid uses, so
 * a piece looks and reads identically wherever a collector meets it. It used
 * to be a second, simpler card written in inline styles, which is why an
 * embedded store showed a bare price where the marketplace showed a live
 * auction with a bid count.
 *
 * Colours are inherited from the host page; a host may override the `--pc-*`
 * variables. Presentational and server-safe — the caller decides whether to
 * render it (typically `users.profile_sections.store`) and fetches the data
 * (`getStoreShowcaseForUser`).
 */
export function StoreShowcase({
  store,
  artworks,
  marketplaceUrl,
  from,
  heading = "Store",
  blurb,
  density,
  columns,
  className,
}: StoreShowcaseProps) {
  const links = marketplaceLinks(marketplaceUrl, { from });
  const storeHref = store.slug ? links.store(store.slug) : links.browse;

  return (
    <section
      className={["eac-commerce", "eac-store-showcase", className].filter(Boolean).join(" ")}
      data-trait="store"
    >
      <div className="eac-store-head">
        <div>
          <h2 className="eac-store-heading">{heading}</h2>
          <p className="eac-store-blurb">
            {blurb ??
              "Original work for sale. Purchases happen on the marketplace, and the artist is paid directly."}
          </p>
        </div>
        <a href={storeHref} className="eac-store-link">
          See the whole store →
        </a>
      </div>

      <ProductGrid
        items={artworks}
        baseUrl={marketplaceUrl}
        density={density ?? (columns && columns >= 4 ? "tight" : "normal")}
        label={typeof heading === "string" ? heading : "Store"}
        hrefBuilder={(a) => links.artwork(a.id)}
        // The maker is the page this is embedded on — a link back to
        // themselves reads as a loop, so the credit stays as plain text.
        artistHrefBuilder={() => null}
        compact
        emptyState={
          <p className="eac-store-blurb">
            Nothing is listed right now.{" "}
            <a href={storeHref} className="eac-store-link">
              Visit the store
            </a>
            .
          </p>
        }
      />
    </section>
  );
}
