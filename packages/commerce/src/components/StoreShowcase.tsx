import * as React from "react";
import type { Artwork, Store } from "../types";
import { formatMoney } from "../money";

export interface StoreShowcaseProps {
  store: Store;
  artworks: Artwork[];
  /** Origin of the marketplace app, e.g. https://market.elkdonis-arts.org */
  marketplaceUrl: string;
  /** Section heading. Default: "Store". */
  heading?: React.ReactNode;
  /** Copy under the heading. Default explains where the sale happens. */
  blurb?: React.ReactNode;
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
 * Styled with inline layout rules and `eac-store-*` class hooks rather than
 * Tailwind utilities: it has to look right in a shadcn app (amrit-canada)
 * and in a plain-CSS one (ArtDirect) alike. Colours are inherited from the
 * host page; a host may theme the hooks.
 *
 * Presentational and server-safe. The caller decides whether to render it
 * (typically `users.profile_sections.store`) and fetches the data
 * (`getStoreShowcaseForUser`).
 */
export function StoreShowcase({
  store,
  artworks,
  marketplaceUrl,
  heading = "Store",
  blurb,
  columns = 3,
  className,
}: StoreShowcaseProps) {
  const base = marketplaceUrl.replace(/\/$/, "");
  const storeHref = store.slug ? `${base}/artists/${store.slug}` : `${base}/artworks`;
  const muted: React.CSSProperties = { opacity: 0.7, fontSize: "0.9em" };

  return (
    <section
      className={["eac-store-showcase", className].filter(Boolean).join(" ")}
      data-trait="store"
    >
      <div
        className="eac-store-head"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h2 className="eac-store-heading" style={{ margin: 0 }}>
            {heading}
          </h2>
          <p style={{ ...muted, margin: "0.25rem 0 0" }}>
            {blurb ??
              "Original work for sale. Purchases happen on the marketplace, and the artist is paid directly."}
          </p>
        </div>
        <a href={storeHref} className="eac-store-link" style={{ fontSize: "0.9em" }}>
          See the whole store →
        </a>
      </div>

      {artworks.length === 0 ? (
        <p style={muted}>
          Nothing is listed right now.{" "}
          <a href={storeHref} className="eac-store-link">
            Visit the store
          </a>
          .
        </p>
      ) : (
        <ul
          className="eac-store-grid"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: `repeat(auto-fill, minmax(${columns >= 4 ? 160 : columns === 3 ? 200 : 260}px, 1fr))`,
          }}
        >
          {artworks.map((a) => {
            const href = `${base}/artworks/${a.id}`;
            const price = a.variants?.[0]?.priceMinor ?? null;
            const lot = a.lot;
            const atAuction = lot && (lot.status === "live" || lot.status === "scheduled");
            return (
              <li key={a.id} className="eac-store-card">
                <a
                  href={href}
                  className="eac-store-image"
                  style={{
                    display: "block",
                    aspectRatio: "4 / 5",
                    overflow: "hidden",
                    borderRadius: "0.375rem",
                    background: "rgba(127,127,127,0.12)",
                  }}
                >
                  {a.primaryImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.primaryImageUrl}
                      alt={a.primaryImageAlt ?? a.title}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  )}
                </a>
                <div style={{ marginTop: "0.5rem" }}>
                  <a href={href} className="eac-store-title" style={{ fontWeight: 500 }}>
                    {a.title}
                  </a>
                  <p style={{ ...muted, margin: "0.15rem 0 0" }}>
                    {atAuction
                      ? `At auction${lot?.currentBidMinor != null ? ` · ${formatMoney(lot.currentBidMinor, lot.currency)}` : ""}`
                      : a.status === "reserved"
                        ? "Reserved"
                        : price != null
                          ? formatMoney(price, a.variants?.[0]?.currency ?? "CAD")
                          : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
