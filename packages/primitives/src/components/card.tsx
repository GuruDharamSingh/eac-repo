import * as React from "react";
import { cx } from "../slot";

// ============================================================================
// Card.
//
// Six parts, matching the shadcn copy exactly: Card, CardHeader, CardTitle,
// CardDescription, CardAction, CardContent, CardFooter.
//
// The layout that used to live in container-query utility classes is now one
// `:has([data-slot="card-action"])` rule in primitives.css — a header lays
// itself out in two columns when, and only when, it actually contains an
// action. Same behaviour, expressed once instead of on every card.
// ============================================================================

type Div = React.ComponentProps<"div">;

const part =
  (slot: string, cls: string) =>
  ({ className, ...props }: Div) => (
    <div data-slot={slot} className={cx(cls, className)} {...props} />
  );

export const Card = part("card", "eac-card");
export const CardHeader = part("card-header", "eac-card-header");
export const CardTitle = part("card-title", "eac-card-title");
export const CardDescription = part("card-description", "eac-card-description");
export const CardAction = part("card-action", "eac-card-action");
export const CardContent = part("card-content", "eac-card-content");
export const CardFooter = part("card-footer", "eac-card-footer");
