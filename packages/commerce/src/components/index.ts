/**
 * Portable React components for commerce + auction surfaces.
 *
 * Every component is designed to drop into any consuming app:
 *   - apps/art-auction (the storefront)
 *   - apps/arts-collective subdomains (artist embeds)
 *   - workshop pages (GrapesJS templates can mount via iframe or RSC)
 *
 * Styling: the newer components (ProductCard, ProductGrid, StoreShowcase)
 * are styled by `@elkdonis/commerce/commerce.css`, which a host imports once.
 * The older ones are written in Tailwind utilities and therefore only render
 * in a host whose Tailwind build has been pointed at this directory with
 * `@source` — the trap that left art-auction's own buy button unstyled.
 *
 * Components are headless where they need data — they accept callbacks
 * (onAdd, onPlaceBid) instead of importing app-specific actions, so each
 * consumer wires its own server action.
 */

export { ProductCard, readState, type ProductCardProps, type ProductState } from "./ProductCard";
export { ProductGrid, type ProductGridProps } from "./ProductGrid";

/** @deprecated Use {@link ProductCard} — it carries its own stylesheet. */
export { ArtworkCard, type ArtworkCardProps } from "./ArtworkCard";
/** @deprecated Use {@link ProductGrid}. */
export { ArtworkGrid, type ArtworkGridProps } from "./ArtworkGrid";
export { PriceBlock, type PriceBlockProps } from "./PriceBlock";
export { AuctionStatusBadge, type AuctionStatusBadgeProps } from "./AuctionStatusBadge";
export { CountdownTimer, type CountdownTimerProps } from "./CountdownTimer";
export { BuyNowButton, type BuyNowButtonProps } from "./BuyNowButton";
export { BidWidget, type BidWidgetProps } from "./BidWidget";
export { StoreShowcase, type StoreShowcaseProps } from "./StoreShowcase";
export { ShopCard, type ShopCardProps, type ShopCardLook } from "./ShopCard";
export {
  EarningsStatement,
  type EarningsStatementProps,
  type EarningsStatementLine,
} from "./EarningsStatement";
export { PayoutSetup, type PayoutSetupProps, type PayoutSetupValue } from "./PayoutSetup";
