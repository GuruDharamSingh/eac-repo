import { contentCheckout } from "@/lib/content-checkout";

export const dynamic = "force-dynamic";

/** GET /api/content/checkout/return: Stripe's success URL; confirms the order, then back to the page's done layer. */
export const GET = contentCheckout.checkoutReturn!;
