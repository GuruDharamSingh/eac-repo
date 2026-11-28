import { contentCheckout } from "@/lib/content-checkout";

export const dynamic = "force-dynamic";

/** POST /api/content/checkout: start Stripe checkout for an offer (body: CheckoutRequest). */
export const POST = contentCheckout.checkout!;
