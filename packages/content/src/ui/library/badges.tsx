"use client";

import * as React from "react";
import type { ContentListItem } from "../../model";
import type { ContentSaleState } from "../../search-types";

export const SALE_WORD: Record<ContentSaleState, string> = {
  for_sale: "For sale",
  in_auction: "In auction",
  sold: "Sold",
  reserved: "Reserved",
  passed: "Passed",
  withdrawn: "Withdrawn",
  not_for_sale: "Not for sale",
};

/** "For sale · $2,400", or null when the item is not for sale or carries no sale state. */
export function saleText(item: ContentListItem): string | null {
  const s = item.sale;
  if (!s || s.state === "not_for_sale") return null;
  return s.price ? `${SALE_WORD[s.state]} · ${s.price}` : SALE_WORD[s.state];
}

/**
 * The sale state, price and "Hidden" marks (CONTRACT §10.2). Nothing at all (null) when the item has none,
 * so a library with no sale data draws exactly what it always did. `hidden` only ever arrives for keepers:
 * the server decides who gets it, and this never infers it.
 */
export function ItemBadges({ item }: { item: ContentListItem }) {
  const sale = saleText(item);
  if (!sale && !item.hidden) return null;
  return (
    <span className="eac-c-badges">
      {sale ? (
        <span className="eac-c-badge" data-sale={item.sale?.state}>
          {sale}
        </span>
      ) : null}
      {item.hidden ? (
        <span className="eac-c-badge" data-hidden="1">
          Hidden
        </span>
      ) : null}
    </span>
  );
}
