/**
 * Portable React components for commerce + auction surfaces.
 *
 * Every component is designed to drop into any consuming app:
 *   - apps/art-auction (the storefront)
 *   - apps/arts-collective subdomains (artist embeds)
 *   - workshop pages (GrapesJS templates can mount via iframe or RSC)
 *
 * Components are headless where they need data — they accept callbacks
 * (onAdd, onPlaceBid) instead of importing app-specific actions, so each
 * consumer wires its own server action.
 */

export { ArtworkCard, type ArtworkCardProps } from "./ArtworkCard";
export { ArtworkGrid, type ArtworkGridProps } from "./ArtworkGrid";
export { PriceBlock, type PriceBlockProps } from "./PriceBlock";
export { AuctionStatusBadge, type AuctionStatusBadgeProps } from "./AuctionStatusBadge";
export { CountdownTimer, type CountdownTimerProps } from "./CountdownTimer";
export { BuyNowButton, type BuyNowButtonProps } from "./BuyNowButton";
export { BidWidget, type BidWidgetProps } from "./BidWidget";
